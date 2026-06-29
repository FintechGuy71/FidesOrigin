// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IAssetCompliance.sol";

/**
 * @title CompliantStableCoin
 * @notice 集成FidesOrigin合规协议的示例稳定币合约
 * @dev 展示资产发行方如何集成ComplianceEngine
 * 
 * 集成方式：在转账函数中调用compliance.preTransferHook()
 * 实现效果：所有转账自动经过FidesOrigin风控检查
 */
contract CompliantStableCoin is ERC20, AccessControl, Pausable {
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant COMPLIANCE_ADMIN_ROLE = keccak256("COMPLIANCE_ADMIN_ROLE");
    
    // ============ State ============
    
    /// @notice FidesOrigin合规引擎地址
    IAssetCompliance public complianceEngine;
    
    /// @notice 合规检查是否启用
    bool public complianceEnabled = true;
    
    /// @notice 本币的合规策略配置
    IAssetCompliance.IssuerPolicy public policy;
    
    /// @notice 用户KYC状态
    mapping(address => bool) public kycVerified;
    
    /// @notice 代币小数位 (稳定币通常6位)
    uint8 private constant TOKEN_DECIMALS = 6;
    
    /// @notice 用户每日已用额度 (account => day => amount)
    mapping(address => mapping(uint256 => uint256)) public dailySpent;
    
    /// @notice 最大单笔转账金额 (硬上限)
    uint256 public constant MAX_TX_AMOUNT = 10000000 * 10**6; // 1000万

    /// @notice 策略校验常量
    uint256 public constant MIN_MAX_TX = 1e6;               // 至少 1 token
    uint256 public constant MAX_DAILY_LIMIT = 100_000_000e6; // 最多 1亿 token
    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public constant MAX_KYC_BATCH_SIZE = 200;
    
    // ============ Events ============
    
    event ComplianceEngineSet(address indexed engine);
    event ComplianceToggled(bool enabled);
    event PolicyUpdated(
        uint256 indexed maxTxAmount,
        uint256 indexed dailyLimit,
        bool allowMediumRisk,
        bool allowHighRisk,
        bool blockMixer,
        bool requireDestinationKYC,
        uint256 cooldownPeriod
    );
    event KYCStatusUpdated(address indexed account, bool verified);
    event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason);
    
    // ============ Errors ============
    
    error InvalidAddress();
    error ComplianceCheckFailed(string reason);
    error ExceedsMaxTransaction();
    error NotKYCVerified();
    error InsufficientAllowance();
    error InsufficientBalance();
    error LengthMismatch();
    error InvalidLength();
    error InvalidPolicy();
    
    // ============ Constructor ============
    
    constructor(
        string memory name,
        string memory symbol,
        address _complianceEngine
    ) ERC20(name, symbol) {
        if (_complianceEngine == address(0)) revert InvalidAddress();
        
        complianceEngine = IAssetCompliance(_complianceEngine);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ADMIN_ROLE, msg.sender);
        
        // 设置默认合规策略
        policy = IAssetCompliance.IssuerPolicy({
            maxTxAmount: 1000000 * 10**6,  // 100万
            dailyLimit: 5000000 * 10**6,   // 500万
            allowMediumRisk: false,
            allowHighRisk: false,
            blockMixer: true,
            requireDestinationKYC: false,
            cooldownPeriod: 0,
            blockedTokens: new address[](0)
        });
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice 铸造代币 (带合规检查)
     * @param to 接收地址
     * @param amount 铸造金额
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert InvalidAddress();

        // 铸造时检查接收方风险
        if (complianceEnabled && address(complianceEngine) != address(0)) {
            try complianceEngine.preTransferHook(address(0), to, amount) {
                // 检查通过
            } catch {
                // 修复: 移除死代码 emit（revert 会回滚所有状态变更，包括事件）
                revert ComplianceCheckFailed("Compliance check failed for mint");
            }
        }
        
        _mint(to, amount);
    }
    
    /**
     * @notice 销毁代币 (需 allowance 才能销毁他人代币)
     * @param from 被销毁地址
     * @param amount 销毁金额
     */
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) whenNotPaused {
        if (from == address(0)) revert InvalidAddress();

        // [C-01] 修复：销毁他人代币需要 allowance
        if (from != msg.sender) {
            uint256 currentAllowance = allowance(from, msg.sender);
            if (currentAllowance < amount) revert InsufficientAllowance();
            _spendAllowance(from, msg.sender, amount);
        }

        // [H-02] 修复：burn 也应经过合规检查
        if (complianceEnabled && address(complianceEngine) != address(0)) {
            try complianceEngine.preTransferHook(from, address(0), amount) {
                // 检查通过
            } catch (bytes memory reason) {
                emit TransferBlocked(from, address(0), amount, _getRevertMsg(reason));
                revert ComplianceCheckFailed("Compliance check failed for burn");
            }
        }
        
        _burn(from, amount);
    }
    
    /**
     * @notice 批量转账 (高效处理多笔支付)
     * @param recipients 接收地址数组
     * @param amounts 金额数组
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external whenNotPaused returns (bool) {
        if (recipients.length != amounts.length) revert LengthMismatch();
        if (recipients.length == 0 || recipients.length > MAX_BATCH_SIZE) revert InvalidLength();

        // [M-01] 修复：先做总余额预检，避免半途失败
        uint256 total;
        for (uint256 i = 0; i < amounts.length; ) {
            total += amounts[i];
            unchecked { ++i; }
        }
        if (balanceOf(msg.sender) < total) revert InsufficientBalance();
        
        for (uint256 i = 0; i < recipients.length; ) {
            _update(msg.sender, recipients[i], amounts[i]);
            unchecked { ++i; }
        }
        
        return true;
    }
    
    // ============ Override ERC20 Functions ============
    
    /**
     * @notice 重写_update函数，嵌入合规检查
     * @dev 这是ERC20转账的核心函数，所有转账都会经过这里
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // 跳过合规检查的情况：
        // 1. 铸造 (from == address(0))
        // 2. 销毁 (to == address(0))
        // 3. 合规检查已禁用
        if (from != address(0) && to != address(0) && complianceEnabled) {
            _checkCompliance(from, to, amount);
        }
        
        super._update(from, to, amount);
        
        // [H-17] 修复: 更新每日已用额度
        if (from != address(0) && to != address(0) && complianceEnabled) {
            uint256 currentDay = block.timestamp / 1 days;
            dailySpent[from][currentDay] += amount;
        }
        
        // [H-01] 修复：调用 postTransferHook 包裹 try/catch，防止 DoS
        if (from != address(0) && to != address(0) && complianceEnabled && address(complianceEngine) != address(0)) {
            try complianceEngine.postTransferHook(from, to, amount, true) {
                // success
            } catch (bytes memory reason) {
                // 记录失败但不阻塞核心转账
                emit TransferBlocked(from, to, amount, _getRevertMsg(reason));
            }
        }
    }
    
    /**
     * @notice 内部合规检查函数
     * @param from 发送地址
     * @param to 接收地址
     * @param amount 转账金额
     */
    function _checkCompliance(address from, address to, uint256 amount) internal {
        if (address(complianceEngine) == address(0)) return;
        
        // 1. 基础策略检查
        if (amount > policy.maxTxAmount) {
            revert ComplianceCheckFailed("Exceeds max transaction amount");
        }
        
        // [H-17] 修复: 检查日限额
        uint256 currentDay = block.timestamp / 1 days;
        if (dailySpent[from][currentDay] + amount > policy.dailyLimit) {
            revert ComplianceCheckFailed("Exceeds daily limit");
        }
        
        // 2. KYC检查 (如果启用)
        if (policy.requireDestinationKYC) {
            if (!kycVerified[to]) {
                revert NotKYCVerified();
            }
        }
        
        // 3. 调用FidesOrigin合规引擎
        try complianceEngine.preTransferHook(from, to, amount) {
            // 检查通过
        } catch (bytes memory reason) {
            string memory errorMsg = _getRevertMsg(reason);
            emit TransferBlocked(from, to, amount, errorMsg);
            revert ComplianceCheckFailed(errorMsg);
        }
    }
    
    // ============ View Functions ============
    
    function decimals() public pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }
    
    /**
     * @notice 查询地址风险信息
     * @param account 查询地址
     */
    function getAddressRiskInfo(address account) external view returns (
        uint8 riskScore,
        IAssetCompliance.RiskTier tier,
        bool isSanctioned,
        uint256 spent
    ) {
        if (address(complianceEngine) == address(0)) {
            return (0, IAssetCompliance.RiskTier.UNKNOWN, false, 0);
        }
        
        IAssetCompliance.RiskProfile memory profile = complianceEngine.getAddressRisk(account);
        uint256 dailySpentAmount = complianceEngine.getDailySpent(account, address(this));
        
        return (profile.riskScore, profile.tier, profile.isSanctioned, dailySpentAmount);
    }
    
    /**
     * @notice 检查转账是否会通过合规检查 (模拟，不修改状态)
     * @param from 发送地址
     * @param to 接收地址
     * @param amount 转账金额
     */
    function simulateTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (
        bool wouldSucceed,
        IAssetCompliance.Decision decision,
        string memory reason
    ) {
        // [M-02] 修复：与真实转账语义一致，先检查本地策略
        if (amount > policy.maxTxAmount) {
            return (false, IAssetCompliance.Decision.BLOCK, "Exceeds max transaction amount");
        }

        if (policy.requireDestinationKYC && !kycVerified[to]) {
            return (false, IAssetCompliance.Decision.BLOCK, "Not KYC verified");
        }

        // M-10 FIX: Check dailySpent limit for simulation consistency
        uint256 currentDay = block.timestamp / 1 days;
        if (dailySpent[from][currentDay] + amount > policy.dailyLimit) {
            return (false, IAssetCompliance.Decision.BLOCK, "Exceeds daily limit");
        }
        
        if (address(complianceEngine) == address(0)) {
            return (true, IAssetCompliance.Decision.ALLOW, "");
        }
        
        (decision, reason) = complianceEngine.validateTransfer(from, to, amount, address(this));
        wouldSucceed = decision != IAssetCompliance.Decision.BLOCK;
        
        return (wouldSucceed, decision, reason);
    }
    
    // ============ Admin Functions ============
    
    function setComplianceEngine(address _engine) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        if (_engine == address(0)) revert InvalidAddress();
        // [L-02] 修复：确保新地址是合约
        if (_engine.code.length == 0) revert InvalidAddress();
        complianceEngine = IAssetCompliance(_engine);
        emit ComplianceEngineSet(_engine);
    }
    
    function toggleCompliance(bool _enabled) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        complianceEnabled = _enabled;
        emit ComplianceToggled(_enabled);
    }
    
    /**
     * @notice 设置合规策略 (带输入校验)
     * @param _policy 新策略配置
     */
    function setPolicy(IAssetCompliance.IssuerPolicy calldata _policy) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        // [H-04] 修复：输入校验，防止恶意/误操作冻结
        if (_policy.maxTxAmount < MIN_MAX_TX || _policy.maxTxAmount > MAX_TX_AMOUNT) revert InvalidPolicy();
        if (_policy.dailyLimit < _policy.maxTxAmount || _policy.dailyLimit > MAX_DAILY_LIMIT) revert InvalidPolicy();
        if (_policy.cooldownPeriod > 30 days) revert InvalidPolicy();
        
        policy = _policy;
        emit PolicyUpdated(
            _policy.maxTxAmount,
            _policy.dailyLimit,
            _policy.allowMediumRisk,
            _policy.allowHighRisk,
            _policy.blockMixer,
            _policy.requireDestinationKYC,
            _policy.cooldownPeriod
        );
    }
    
    function setKYCStatus(address account, bool verified) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        kycVerified[account] = verified;
        emit KYCStatusUpdated(account, verified);
    }
    
    /**
     * @notice 批量设置KYC状态
     * @param accounts 地址数组
     * @param verified KYC状态
     */
    function batchSetKYC(address[] calldata accounts, bool verified) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        // [M-04] 修复：长度上限
        if (accounts.length == 0 || accounts.length > MAX_KYC_BATCH_SIZE) revert InvalidLength();
        
        for (uint256 i = 0; i < accounts.length; ) {
            if (accounts[i] == address(0)) revert InvalidAddress();
            kycVerified[accounts[i]] = verified;
            emit KYCStatusUpdated(accounts[i], verified);
            unchecked { ++i; }
        }
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // ============ Internal Helpers ============
    
    /**
     * @notice 从 revert 返回数据中提取错误信息
     * @param _returnData 外部调用的返回数据
     * @return 错误描述字符串
     */
    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        if (_returnData.length == 0) return "Transaction reverted silently";
        
        // [M-03] 修复：健壮解析
        if (_returnData.length >= 4) {
            bytes4 selector;
            assembly {
                selector := mload(add(_returnData, 0x20))
            }
            // Error(string) selector: 0x08c379a0
            if (selector == bytes4(0x08c379a0) && _returnData.length >= 68) {
                (string memory reason) = _decodeString(_returnData);
                return reason;
            }
            // Panic(uint256) selector: 0x4e487b71
            if (selector == bytes4(0x4e487b71)) {
                return "Panic";
            }
        }
        
        // 尝试简单解析
        if (_returnData.length >= 32) {
            return "Reverted";
        }
        
        return "Unknown revert";
    }
function _decodeString(bytes memory data) internal pure returns (string memory) {
        if (data.length < 4) return "Unknown";
        bytes memory sliced = new bytes(data.length - 4);
        for (uint256 i = 0; i < sliced.length; i++) {
            sliced[i] = data[i + 4];
        }
        (string memory reason) = abi.decode(sliced, (string));
        return reason;
    }
}