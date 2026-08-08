// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IPreTransactionGuard.sol";
import "../interfaces/IAssetCompliance.sol";

/**
 * @title GuardedComplianceEngine
 * @notice 集成 PreTransactionGuard 的增强版合规引擎
 * @dev 在现有 ComplianceEngine 基础上添加零Gas预交易拦截
 */
contract GuardedComplianceEngine is IAssetCompliance {
    
    IPreTransactionGuard public guard;
    bool public guardEnabled;
    address public fallbackEngine;
    address public admin;
    
    uint256 public totalGuardChecks;
    uint256 public totalGuardBlocks;
    
    event GuardCheck(address indexed from, address indexed to, uint8 guardAction, uint256 riskScore);
    event GuardBlock(address indexed from, address indexed to, uint256 riskScore, string reason);
    event GuardSet(address indexed guard);
    event GuardEnabled(bool enabled);
    
    error Unauthorized();
    error GuardBlocked(address from, address to, uint256 riskScore, string reason);
    
    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }
    
    constructor(address _guard, address _fallback) {
        admin = msg.sender;
        guard = IPreTransactionGuard(_guard);
        fallbackEngine = _fallback;
        guardEnabled = true;
    }
    
    /**
     * @notice 预交易 Guard 检查
     * @dev [F-03/N-15 FIX R2] 携带真实金额与代币地址（原实现 value:0/token:0/data:"" 空转）
     */
    function checkGuard(address from, address to) 
        public 
        view 
        returns (Decision decision, string memory reason) 
    {
        return checkGuardWithAmount(from, to, 0, address(0));
    }

    /**
     * @notice [F-03/N-15 FIX R2] 携带完整交易参数的 Guard 检查
     */
    function checkGuardWithAmount(address from, address to, uint256 amount, address token)
        public
        view
        returns (Decision decision, string memory reason)
    {
        if (!guardEnabled || address(guard) == address(0)) {
            return (Decision.ALLOW, "Guard disabled");
        }
        
        IPreTransactionGuard.TransactionIntent memory intent = IPreTransactionGuard.TransactionIntent({
            from: from,
            to: to,
            value: token == address(0) ? amount : 0,
            token: token,
            data: abi.encode(amount),
            chainId: block.chainid
        });
        
        IPreTransactionGuard.RiskAssessment memory result = guard.assessTransaction(intent);
        
        if (result.action == IPreTransactionGuard.Action.BLOCK) {
            return (Decision.BLOCK, result.reason);
        }
        if (result.action == IPreTransactionGuard.Action.WARN) {
            return (Decision.FLAG, result.reason);
        }
        
        return (Decision.ALLOW, result.reason);
    }
    
    /**
     * @notice 转账前合规检查 (IAssetCompliance 接口)
     */
    function validateTransfer(
        address from,
        address to,
        uint256 amount,
        address token
    ) external view override returns (Decision decision, string memory reason) {
        // [F-03 FIX R2] 传递真实金额与代币
        (Decision guardDecision, string memory guardReason) = checkGuardWithAmount(from, to, amount, token);
        
        if (guardDecision == Decision.BLOCK) {
            return (Decision.BLOCK, string(abi.encodePacked("Guard: ", guardReason)));
        }
        
        if (fallbackEngine != address(0)) {
            try IAssetCompliance(fallbackEngine).validateTransfer(from, to, amount, token) 
                returns (Decision d, string memory r) 
            {
                if (d == Decision.BLOCK) return (d, r);
                if (guardDecision == Decision.FLAG) return (Decision.FLAG, guardReason);
                return (d, r);
            } catch {
                return (Decision.FLAG, "Fallback check failed");
            }
        }
        
        return (guardDecision, guardReason);
    }
    
    /**
     * @notice preTransferHook 兼容接口
     * @dev [F-03 FIX R2] 传递真实金额（接口不含代币参数，按 ETH 语义传递 value）
     */
    function preTransferHook(address from, address to, uint256 amount) external view override {
        (Decision d, string memory reason) = checkGuardWithAmount(from, to, amount, address(0));
        if (d == Decision.BLOCK) {
            revert GuardBlocked(from, to, 100, reason);
        }
    }
    
    /**
     * @notice 转账后钩子
     * @dev [N-15 FIX R2] 原空实现静默丢弃记账行为。改为转发 fallbackEngine 的
     *      postTransferHook（含其授权校验与 TransferRecorded 事件），失败不阻断转账。
     */
    function postTransferHook(address from, address to, uint256 amount, bool success) external override {
        if (fallbackEngine != address(0)) {
            try IAssetCompliance(fallbackEngine).postTransferHook(from, to, amount, success) {
                // forwarded
            } catch {
                // fallback 不可用时静默降级（不阻断主转账流程）
            }
        }
    }
    
    /**
     * @notice 批量检查
     */
    function checkBatch(address[] calldata fromList, address[] calldata toList)
        external
        view
        returns (Decision[] memory decisions, string[] memory reasons)
    {
        require(fromList.length == toList.length, "Length mismatch");
        decisions = new Decision[](fromList.length);
        reasons = new string[](fromList.length);
        
        for (uint i = 0; i < fromList.length; i++) {
            (decisions[i], reasons[i]) = checkGuard(fromList[i], toList[i]);
        }
    }
    
    // ============ 管理函数 ============
    
    function setGuard(address _guard) external onlyAdmin {
        guard = IPreTransactionGuard(_guard);
        emit GuardSet(_guard);
    }
    
    function setGuardEnabled(bool enabled) external onlyAdmin {
        guardEnabled = enabled;
        emit GuardEnabled(enabled);
    }
    
    function setFallbackEngine(address _fallback) external onlyAdmin {
        fallbackEngine = _fallback;
    }
    
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }
    
    // ============ IAssetCompliance 其他接口 ============
    
    function getAddressRisk(address account) external view override returns (RiskProfile memory) {
        IPreTransactionGuard.RiskAssessment memory r = guard.assessAddress(account);
        
        RiskTier tier = RiskTier.UNKNOWN;
        if (r.riskScore >= 80) tier = RiskTier.CRITICAL;
        else if (r.riskScore >= 50) tier = RiskTier.HIGH;
        else if (r.riskScore >= 20) tier = RiskTier.MEDIUM;
        else if (r.riskScore > 0) tier = RiskTier.LOW;
        
        bytes32[] memory tags = new bytes32[](0);
        
        return RiskProfile({
            riskScore: uint8(r.riskScore),
            tier: tier,
            tags: tags,
            lastUpdated: r.assessmentTime,
            isSanctioned: r.riskScore >= 100
        });
    }
    
    function isSanctioned(address account) external view override returns (bool) {
        IPreTransactionGuard.RiskAssessment memory r = guard.assessAddress(account);
        return r.riskScore >= 100;
    }
    
    function getRiskTier(address account) external view override returns (RiskTier) {
        IPreTransactionGuard.RiskAssessment memory r = guard.assessAddress(account);
        if (r.riskScore >= 80) return RiskTier.CRITICAL;
        if (r.riskScore >= 50) return RiskTier.HIGH;
        if (r.riskScore >= 20) return RiskTier.MEDIUM;
        if (r.riskScore > 0) return RiskTier.LOW;
        return RiskTier.UNKNOWN;
    }
    
    function getIssuerPolicy(address) external pure override returns (IssuerPolicy memory) {
        return IssuerPolicy(0, 0, false, false, false, false, 0, new address[](0));
    }
    
    function getDailySpent(address, address) external pure override returns (uint256) {
        return 0;
    }
}
