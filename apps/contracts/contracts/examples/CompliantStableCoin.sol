// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IAssetCompliance.sol";

/**
 * @title CompliantStableCoin
 * @notice 集成FidesOrigin合规协议的稳定币合约（生产版）
 * @dev [F-02 FIX R2] 已从 examples/ 示例目录"转正"为生产合约管理：
 *      移除 "EXAMPLE ONLY" 声明，纳入正式审计范围。
 *      R2 修复: F-07 删除必失败的 claimOperatorRole / F-08 simulateTransfer 容错 /
 *      F-11 mint 限额 / F-12 引擎与本地策略开关拆分 / L-03 事件命名澄清
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
    
    /// @notice 合规检查是否启用（引擎 hook 开关）
    /// @dev [F-12 FIX R2] 语义收窄：仅控制对 ComplianceEngine 的 hook 调用。
    ///      本地策略（限额/KYC）由 localPolicyEnabled 独立控制，不再被此开关连带停用。
    bool public complianceEnabled = true;

    /// @notice [F-12 FIX R2] 本地策略开关（maxTxAmount / dailyLimit / KYC）
    bool public localPolicyEnabled = true;
    
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
    error ComplianceEngineNotSet();
    
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

        // [F-11 FIX R2] 铸造同样受本地限额约束，且计入接收方当日额度
        // （原实现 mint 绕过 maxTxAmount/dailyLimit，收款方当日还可转满 dailyLimit，
        //   实际流通增量可超政策设定）
        if (localPolicyEnabled) {
            if (amount > policy.maxTxAmount) {
                revert ComplianceCheckFailed("Mint exceeds max transaction amount");
            }
            uint256 currentDay = block.timestamp / 1 days;
            if (dailySpent[to][currentDay] + amount > policy.dailyLimit) {
                revert ComplianceCheckFailed("Mint exceeds recipient daily limit");
            }
            dailySpent[to][currentDay] += amount;
        }

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
        // [F-12 FIX R2] 本地策略检查由 localPolicyEnabled 独立控制（见 _checkCompliance 内部分流）
        if (from != address(0) && to != address(0)) {
            _checkCompliance(from, to, amount);
        }
        
        super._update(from, to, amount);
        
        // [H-17] 修复: 更新每日已用额度（[F-12] 本地策略开关控制）
        if (from != address(0) && to != address(0) && localPolicyEnabled) {
            uint256 currentDay = block.timestamp / 1 days;
            dailySpent[from][currentDay] += amount;
        }
        
        // [H-01] 修复：调用 postTransferHook 包裹 try/catch，防止 DoS
        if (from != address(0) && to != address(0) && complianceEnabled && address(complianceEngine) != address(0)) {
            try complianceEngine.postTransferHook(from, to, amount, true) {
                // success
            } catch (bytes memory reason) {
                // [L-03 FIX R2] 事件名澄清：hook 失败不阻断转账，改用专用事件名
                emit PostTransferHookFailed(from, to, amount, _getRevertMsg(reason));
            }
        }
    }
    
    /// @notice [L-03 FIX R2] postTransferHook 失败专用事件（不再复用 TransferBlocked 造成"已阻断"误解）
    event PostTransferHookFailed(address indexed from, address indexed to, uint256 amount, string reason);
    
    /**
     * @notice 内部合规检查函数
     * @param from 发送地址
     * @param to 接收地址
     * @param amount 转账金额
     */
    function _checkCompliance(address from, address to, uint256 amount) internal {
        // [F-12 FIX R2] 本地策略由 localPolicyEnabled 独立控制
        if (localPolicyEnabled) {
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
        }
        
        // 3. 调用FidesOrigin合规引擎（由 complianceEnabled 独立控制）
        if (!complianceEnabled || address(complianceEngine) == address(0)) return;
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
        // [L-04 FIX R2] 与真实路径语义一致：开关语义与 _update 对齐
        if (!localPolicyEnabled && !complianceEnabled) {
            return (true, IAssetCompliance.Decision.ALLOW, "compliance disabled");
        }

        // [M-02] 修复：与真实转账语义一致，先检查本地策略
        if (localPolicyEnabled) {
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
        }
        
        if (!complianceEnabled || address(complianceEngine) == address(0)) {
            return (true, IAssetCompliance.Decision.ALLOW, "");
        }
        
        // [F-08 FIX R2] try/catch 容错：引擎 validateTransfer 要求
        // msg.sender==from 或 OPERATOR_ROLE，代币合约调用必然 Unauthorized。
        // 原实现直接调用必 revert，导致模拟功能整体不可用。
        try complianceEngine.validateTransfer(from, to, amount, address(this)) returns (
            IAssetCompliance.Decision d, string memory r
        ) {
            return (d != IAssetCompliance.Decision.BLOCK, d, r);
        } catch {
            // 引擎不可达/未授权时回退：本地策略已通过则视为成功，并明确标注原因
            return (true, IAssetCompliance.Decision.ALLOW, "engine check skipped (unauthorized or unavailable)");
        }
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

    // [F-07 FIX R2] claimOperatorRole 已删除。
    // 原实现调用 engine.grantRole(OPERATOR_ROLE, address(this))：AccessControl 要求
    // 调用者（即本代币合约）持有角色管理员权限，代币合约并无此角色，函数必然 revert，
    // 属误导性死函数。正确流程：由 ComplianceEngine 的 ADMIN_ROLE 直接执行
    // `engine.grantRole(keccak256("OPERATOR_ROLE"), tokenAddress)`（见部署 runbook）。

    /**
     * @notice [F-12 FIX R2] 独立开关本地策略（限额/KYC），与引擎 hook 解耦
     * @dev 原 toggleCompliance(false) 会连带停用本地 KYC 与限额，单点权力过大。
     */
    function setLocalPolicyEnabled(bool _enabled) external onlyRole(COMPLIANCE_ADMIN_ROLE) {
        localPolicyEnabled = _enabled;
        emit LocalPolicyToggled(_enabled);
    }

    /// @notice [F-12 FIX R2] 本地策略开关事件
    event LocalPolicyToggled(bool enabled);

    /**
     * @notice [F-12 FIX R2] toggleCompliance 语义澄清
     * @dev 仅控制对 ComplianceEngine 的 hook 调用；本地策略请用 setLocalPolicyEnabled。
     */
    // toggleCompliance 保留原签名（见上方 Admin Functions 开头），语义已收窄。
    
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