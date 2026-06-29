// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./CompliantSmartWalletBase.sol";

/**
 * @title CompliantSmartWallet
 * @notice 带签名执行扩展的合规智能钱包
 * @dev 继承 CompliantSmartWalletBase，添加离线签名授权执行功能
 * @dev 支持 relayer 代付 gas 的元交易模式
 *
 * ## 功能定位
 * 在基础合规钱包能力之上，增加签名执行层，实现：
 * 1. 离线签名授权: 用户用私钥签名交易，relayer 代为提交
 * 2. Gas 抽象: 用户无需持有原生代币支付 gas
 * 3. 批量签名: 一次签名可授权多个操作（通过 salt 实现并发与批量）
 *
 * ## 安全机制
 * - 签名使用 EIP-191 标准 (Ethereum Signed Message)
 * - 哈希包含 block.chainid 防止跨链重放
 * - 哈希包含 address(this) 防止同链不同实例重放
 * - 使用 abi.encode 防止哈希碰撞
 * - 每个操作哈希只能执行一次 (重放保护 via executedOps)
 * - 使用 salt 替代全局递增 nonce，支持离线批量签名
 * - 签名有过期时间 (deadline)
 * - 签名验证通过后仍经过完整的合规检查流程
 */
contract CompliantSmartWallet is CompliantSmartWalletBase {
    using ECDSA for bytes32;

    // ============ State ============

    /// @notice 已执行的操作哈希（防止重放攻击）
    mapping(bytes32 => bool) public executedOps;

    // ============ Events ============

    /// @notice 操作通过签名执行时触发
    /// @param opHash 操作哈希（唯一标识）
    /// @param executor 签名者（即 owner）
    /// @param salt Relayer 提交的唯一标识，支持并发与批量
    event OperationExecuted(bytes32 indexed opHash, address indexed executor, bytes32 indexed salt);

    // ============ Errors ============

    error InvalidSignature();
    error SignatureExpired();
    error OperationAlreadyExecuted();

    // ============ Constructor ============

    /**
     * @notice 初始化合规智能钱包（含签名执行）
     * @param _owner 钱包所有者地址
     * @param _complianceEngine 合规引擎地址
     * @param _fidesCompliance 可编程合规引擎地址
     * @param _operator 平台运营方地址
     * @param _quarantineVault 隔离仓地址
     */
    constructor(
        address _owner,
        address _complianceEngine,
        address _fidesCompliance,
        address _operator,
        address _quarantineVault
    ) CompliantSmartWalletBase(_owner, _complianceEngine, _fidesCompliance, _operator, _quarantineVault) {}

    // ============ Signature Execution ============

    /**
     * @notice 签名执行 (支持离线签名授权)
     * @dev 钱包owner用私钥签名操作，relayer可代为提交并支付gas
     * @dev 使用 salt 替代全局递增 nonce，支持离线批量签名与并发提交
     * @param op 操作参数
     * @param signature 离线签名 (EIP-191)
     * @param deadline 签名过期时间戳
     * @param salt 唯一标识（由用户/Relayer 提供），用于防重放并支持批量签名
     * @return 操作返回值
     */
    function executeWithSignature(
        IWalletCompliance.Operation calldata op,
        bytes calldata signature,
        uint256 deadline,
        bytes32 salt
    ) external notEmergency returns (bytes memory) {
        if (block.timestamp > deadline) revert SignatureExpired();

        // [H-01] 修复：加入 block.chainid 防止跨链重放
        // [M-01] 修复：使用 abi.encode 替代 abi.encodePacked 防止哈希碰撞
        // [M-02] 修复：使用 salt 替代 signatureNonce 支持离线批量签名
        bytes32 opHash = keccak256(abi.encode(
            block.chainid,
            address(this),
            op.opType,
            op.target,
            op.value,
            keccak256(op.data),
            op.token,
            op.tokenAmount,
            salt,
            deadline
        ));

        if (executedOps[opHash]) revert OperationAlreadyExecuted();

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(opHash);
        address signer = ECDSA.recover(ethSignedHash, signature);

        // [L] 修复：增加零地址校验，防止 owner 被恶意设置为 address(0) 时绕过签名验证
        if (signer == address(0) || signer != owner) revert InvalidSignature();

        executedOps[opHash] = true;

        // [Info] 修复：触发事件供链下索引器追踪
        emit OperationExecuted(opHash, signer, salt);

        if (complianceEnabled && address(complianceEngine) != address(0)) {
            complianceEngine.preExecutionHook(owner, op);
        }

        return _executeOperation(op);
    }
}