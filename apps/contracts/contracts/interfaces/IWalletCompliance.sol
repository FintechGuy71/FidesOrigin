// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAssetCompliance.sol";

/**
 * @title IWalletCompliance
 * @notice 智能钱包合规接口标准 - MPC钱包、AA账户抽象钱包、机构托管钱包等
 * @dev 实现此接口的合约可被智能钱包集成，实现操作级合规检查
 * @dev 【设计意图】本接口为核心协议层定义的标准，供外部钱包和托管服务商集成使用。
 *      核心协议层不直接提供 IWalletCompliance 的合约实现，由第三方钱包（MPC、AA等）
 *      自行实现或调用核心协议的 IAssetCompliance / IComplianceEngine 接口完成合规检查。
 */
interface IWalletCompliance {
    
    /// @notice 操作类型枚举
    enum OperationType {
        TRANSFER,           // 原生代币转账
        CONTRACT_CALL,      // 合约调用
        TOKEN_APPROVE,      // Token授权
        TOKEN_TRANSFER,     // ERC20转账
        TOKEN_TRANSFER_FROM,// ERC20代转账
        SWAP,               // DEX交易
        BRIDGE,             // 跨链桥
        STAKE,              // 质押
        UNSTAKE,            // 解质押
        CLAIM,              // 领取奖励
        DELEGATE,           // 委托治理
        BATCH               // 批量操作
    }
    
    /// @notice 操作详情结构
    struct Operation {
        OperationType opType;
        address target;         // 目标合约/地址
        uint256 value;          // ETH数量
        bytes data;             // 调用数据
        address token;          // 涉及的Token (address(0)表示ETH)
        uint256 tokenAmount;    // Token数量
        uint256 chainId;        // 目标链ID (跨链操作)
    }
    
    /// @notice 钱包策略配置
    struct WalletPolicy {
        uint256 maxTxValue;             // 单笔最大ETH价值
        uint256 maxTokenTxAmount;       // 单笔最大Token数量
        uint256 dailyEthLimit;          // 日ETH限额
        uint256 dailyTokenLimit;        // 日Token限额
        bool blockContractCalls;        // 是否阻止合约调用
        bool blockUnknownTokens;        // 是否阻止未知Token
        bool requireWhitelist;          // 是否要求目标地址在白名单
        address[] allowedDex;           // 允许的DEX列表
        address[] blockedContracts;     // 禁止的合约列表
        bytes32[] whitelistedContracts; // 白名单合约列表 [PolicyEngine-P1]
    }
    
    /// @notice 验证单个操作
    function validateOperation(
        address walletOwner,
        Operation calldata op,
        address walletContract
    ) external view returns (IAssetCompliance.Decision decision, string memory reason);
    
    /// @notice 执行前钩子 - 会revert如果BLOCK
    function preExecutionHook(
        address walletOwner,
        Operation calldata op
    ) external view;
    
    /// @notice 执行后钩子
    function postExecutionHook(
        address walletOwner,
        Operation calldata op,
        bool success
    ) external;
    
    /// @notice 批量验证操作
    function validateBatch(
        address walletOwner,
        Operation[] calldata ops
    ) external view returns (IAssetCompliance.Decision[] memory decisions);
    
    /// @notice 批量执行前检查
    function preBatchExecutionHook(
        address walletOwner,
        Operation[] calldata ops
    ) external view;
    
    /// @notice 解析操作风险特征
    function analyzeOperationRisk(
        Operation calldata op
    ) external view returns (
        uint8 riskScore,
        IAssetCompliance.RiskTier tier,
        string memory riskFactors
    );
    
    /// @notice 获取钱包策略
    function getWalletPolicy(address wallet) external view returns (WalletPolicy memory);
    
    /// @notice 检查目标合约风险
    function getContractRisk(address target) external view returns (
        bool isVerified,
        uint8 riskScore,
        string memory contractType
    );
    
    // ============ Events ============
    
    event OperationValidated(
        address indexed wallet,
        address indexed owner,
        OperationType opType,
        address target,
        uint256 value,
        IAssetCompliance.Decision decision
    );
    
    event OperationExecuted(
        address indexed wallet,
        address indexed owner,
        OperationType opType,
        bool success
    );
    
    event WalletPolicyUpdated(
        address indexed wallet,
        address indexed owner,
        WalletPolicy policy
    );
}
