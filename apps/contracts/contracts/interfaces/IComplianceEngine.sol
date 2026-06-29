// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IComplianceEngine
 * @notice 资产发行方合规接口标准 - 稳定币、RWA代币、证券型代币等
 * @dev 实现此接口的合约可被稳定币/RWA项目集成，实现链上自动合规检查
 */
interface IComplianceEngine {
    
    /// @notice 合规决策类型
    enum Decision { 
        ALLOW,      // 放行
        BLOCK,      // 阻止 (revert transaction)
        FLAG,       // 标记 (记录可疑但放行)
        HOLD        // 冻结 (转入托管等待审核)
    }
    
    /// @notice 风险等级
    enum RiskTier {
        UNKNOWN,    // 0: 未知
        LOW,        // 1: 低风险/VIP
        MEDIUM,     // 2: 中风险/灰名单
        HIGH,       // 3: 高风险/黑名单
        CRITICAL    // 4: 极高风险/严重制裁
    }
    
    /// @notice 地址风险档案
    struct RiskProfile {
        uint8 riskScore;        // 0-100 风险评分
        RiskTier tier;          // 风险等级
        bytes32[] tags;         // 标签列表 (如 "exchange", "whale")
        uint256 lastUpdated;    // 最后更新时间
        bool isSanctioned;      // 是否在制裁名单
    }
    
    /// @notice 发行方策略配置
    struct IssuerPolicy {
        uint256 maxTxAmount;           // 单笔最大金额
        uint256 dailyLimit;            // 日限额
        bool allowMediumRisk;          // 是否允许中风险地址
        bool allowHighRisk;            // 是否允许高风险地址
        bool blockMixer;               // 是否阻止混币器
        bool requireDestinationKYC;    // 是否要求收款方KYC
        uint256 cooldownPeriod;        // 冷却期(秒)
        address[] blockedTokens;       // 阻止的代币列表 (M-11 FIX: bytes32[] → address[])
    }
    
    /// @notice 转账前合规检查 (view函数，不消耗gas)
    function validateTransfer(
        address from,
        address to,
        uint256 amount,
        address assetContract
    ) external view returns (Decision decision, string memory reason);
    
    /// @notice 转账前钩子 - 会revert如果BLOCK
    function preTransferHook(
        address from,
        address to,
        uint256 amount
    ) external view;
    
    /// @notice 转账后钩子 - 用于记录和统计
    function postTransferHook(
        address from,
        address to,
        uint256 amount,
        bool success
    ) external;
    
    /// @notice 获取地址风险评分和等级 (简化查询)
    function getAddressRisk(address account) external view returns (uint256 riskScore, RiskTier tier);
    
    /// @notice 获取地址风险等级 (简化查询)
    function getRiskTier(address account) external view returns (RiskTier);
    
    /// @notice 检查地址是否在制裁名单
    function isSanctioned(address account) external view returns (bool);
    
    /// @notice 获取发行方策略配置
    function getIssuerPolicy(address issuer) external view returns (IssuerPolicy memory);
    
    /// @notice 计算地址日累计转账额
    function getDailySpent(address account, address asset) external view returns (uint256);
    
    // ============ 交易合规检查 ============
    
    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) external returns (bool isCompliant, uint8[] memory actionTypes);

    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token
    ) external returns (bool isCompliant, uint8[] memory actionTypes);
    
    // ============ Events ============
    
    event TransferValidated(
        address indexed asset,
        address indexed from,
        address indexed to,
        uint256 amount,
        Decision decision,
        string reason
    );
    
    event TransferRecorded(
        address indexed asset,
        address indexed from,
        address indexed to,
        uint256 amount,
        bool success
    );
    
    event RiskProfileUpdated(
        address indexed account,
        uint8 riskScore,
        RiskTier tier,
        bool isSanctioned
    );
}
