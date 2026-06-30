// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title MerkleRiskRegistry
 * @notice 基于 Merkle Tree 的风险地址注册表 - 支持大规模地址验证
 * @dev 使用 Merkle Tree 存储风险地址，支持 2万+ 地址的高效验证
 */
contract MerkleRiskRegistry is AccessControl, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    /// @notice 合约版本号
    string public constant VERSION = "1.2.0";

    // ============ Constants ============

    /// @notice 最大风险分数
    uint256 public constant MAX_RISK_SCORE = 100;

    /// @notice Merkle Root 历史最大长度（环形缓冲区）
    uint256 public constant MAX_HISTORY = 256;

    /// @notice 批量操作最大数组长度
    uint256 public constant MAX_BATCH_SIZE = 200;

    // ============ State Variables ============

    /// @notice 当前 Merkle Root
    bytes32 public merkleRoot;

    /// @notice Merkle Root 更新历史（环形缓冲区，最多保留 MAX_HISTORY 条）
    bytes32[] public merkleRootHistory;

    /// @notice 环形缓冲区写入索引
    uint256 public historyIndex;

    /// @notice 地址风险档案 (address => riskScore)
    mapping(address => uint256) public addressRiskScores;

    /// @notice 地址标签 (address => tag => exists)
    mapping(address => mapping(bytes32 => bool)) public addressTags;

    /// @notice 签名 nonce 映射（防止重放攻击）
    mapping(address => uint256) public signerNonces;

    // ============ Events ============

    event MerkleRootUpdated(
        bytes32 indexed oldRoot,
        bytes32 indexed newRoot,
        uint256 timestamp,
        string version
    );
    event AddressRiskUpdated(address indexed addr, uint256 riskScore, string tags);
    event SignatureVerified(
        address indexed signer,
        bytes32 indexed leaf,
        uint256 nonce,
        uint256 chainId,
        address contractAddress
    );

    // P0-3: 零地址检查事件
    event ZeroAddressRejected(string functionName, uint256 timestamp);

    // P0-7: 紧急暂停事件
    event ContractPaused(address indexed account, uint256 timestamp);
    event ContractUnpaused(address indexed account, uint256 timestamp);

    // 标签事件
    event AddressTagAdded(address indexed addr, bytes32 indexed tag, uint256 timestamp);
    event AddressTagRemoved(address indexed addr, bytes32 indexed tag, uint256 timestamp);

    // ============ Constructor ============

    constructor(bytes32 initialMerkleRoot) {
        // [Critical-2] 校验初始 root 非零
        require(initialMerkleRoot != bytes32(0), "Invalid initial root");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);

        merkleRoot = initialMerkleRoot;
        merkleRootHistory.push(initialMerkleRoot);
    }

    // ============ Internal Helpers ============

    /// @notice 标准 Leaf 格式：keccak256(abi.encode(addr, riskScore, riskTier))
    /// @dev 所有验证函数统一使用此格式，确保 Merkle Tree 一致性
    function _leaf(
        address addr,
        uint256 riskScore,
        string memory riskTier
    ) internal pure returns (bytes32) {
        return keccak256(
            bytes.concat(keccak256(abi.encode(addr, riskScore, riskTier)))
        );
    }

    /// @notice 构建签名消息哈希（域隔离 + nonce 防重放 + deadline 过期保护）
    /// @dev 签名覆盖 leaf + chainId + contractAddr + nonce + deadline，与 Merkle Proof 解耦
    /// @dev M-09 FIX: 添加 deadline 参数，防止签名被无限期重用
    function _messageHash(bytes32 leaf, uint256 nonce, uint256 deadline) internal view returns (bytes32) {
        return MessageHashUtils.toEthSignedMessageHash(
            keccak256(
                abi.encode(
                    "MerkleRiskRegistry v",
                    VERSION,
                    leaf,
                    block.chainid,
                    address(this),
                    nonce,
                    deadline
                )
            )
        );
    }

    // ============ Merkle Tree Operations ============

    /**
     * @notice 更新 Merkle Root
     * @param newRoot 新的 Merkle Root
     */
    function updateMerkleRoot(bytes32 newRoot)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
    {
        require(newRoot != bytes32(0), "Invalid root");
        require(newRoot != merkleRoot, "Same root");

        bytes32 oldRoot = merkleRoot;
        merkleRoot = newRoot;

        // [High-1] 使用环形缓冲区限制历史长度
        if (merkleRootHistory.length < MAX_HISTORY) {
            merkleRootHistory.push(newRoot);
        } else {
            merkleRootHistory[historyIndex % MAX_HISTORY] = newRoot;
        }
        historyIndex++;

        emit MerkleRootUpdated(oldRoot, newRoot, block.timestamp, VERSION);
    }

    /**
     * @notice 验证地址是否在 Merkle Tree 中（带签名验证，防重放）
     * @param addr 要验证的地址
     * @param riskScore 风险分数
     * @param riskTier 风险等级
     * @param proof Merkle Proof
     * @param signature 签名数据
     * @param signer 签名者地址
     * @param deadline M-09 FIX: 签名截止时间戳，防止签名被无限期重用
     */
    function verifyAddressWithSignature(
        address addr,
        uint256 riskScore,
        string memory riskTier,
        bytes32[] calldata proof,
        bytes calldata signature,
        address signer,
        uint256 deadline
    ) external onlyRole(RELAYER_ROLE) nonReentrant whenNotPaused returns (bool) {
        // P0-3: 零地址检查
        if (addr == address(0)) {
            emit ZeroAddressRejected("verifyAddressWithSignature", block.timestamp);
            revert("Invalid address");
        }
        if (signer == address(0)) {
            emit ZeroAddressRejected("verifyAddressWithSignature", block.timestamp);
            revert("Invalid signer");
        }

        // M-09 FIX: 签名过期时间检查
        require(deadline >= block.timestamp, "Signature expired");

        // [Critical-1] 统一 Leaf 格式，与 verifyAddress / batchVerify 一致
        bytes32 leaf = _leaf(addr, riskScore, riskTier);

        // 验证 Merkle Proof（数据完整性）
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) {
            revert("Invalid Merkle proof");
        }

        // [Medium-4/Medium-5] 签名验证：nonce 从 leaf 中分离，使用标准 ECDSA
        // [High-4] nonce 机制已足够防重放，移除冗余的 verifiedSignatures
        // M-09 FIX: 签名包含 deadline 防止无限期重用
        uint256 nonce = signerNonces[signer];
        bytes32 msgHash = _messageHash(leaf, nonce, deadline);

        address recovered = msgHash.recover(signature);
        require(recovered == signer, "Invalid signature");
        require(hasRole(ORACLE_ROLE, signer), "Signer not authorized");

        // 递增 nonce 防止重放
        signerNonces[signer] = nonce + 1;

        // 更新地址风险分数
        addressRiskScores[addr] = riskScore;

        emit SignatureVerified(signer, leaf, nonce, block.chainid, address(this));

        return true;
    }

    /**
     * @notice 验证地址是否在 Merkle Tree 中（无签名版本）
     * @param addr 要验证的地址
     * @param riskScore 风险分数
     * @param riskTier 风险等级
     * @param proof Merkle Proof
     */
    function verifyAddress(
        address addr,
        uint256 riskScore,
        string memory riskTier,
        bytes32[] calldata proof
    ) external view returns (bool) {
        // [Critical-1] 统一 Leaf 格式
        return MerkleProof.verify(proof, merkleRoot, _leaf(addr, riskScore, riskTier));
    }

    /**
     * @notice 批量验证多个地址
     * @param addresses 地址数组
     * @param riskScores 风险分数数组
     * @param riskTiers 风险等级数组
     * @param proofs Merkle Proof 数组
     */
    function batchVerify(
        address[] calldata addresses,
        uint256[] calldata riskScores,
        string[] calldata riskTiers,
        bytes32[][] calldata proofs
    ) external view returns (bool[] memory results) {
        require(addresses.length == riskScores.length, "Length mismatch");
        require(addresses.length == riskTiers.length, "Length mismatch");
        require(addresses.length == proofs.length, "Length mismatch");

        // [High-3] 添加批量大小上限
        require(addresses.length <= MAX_BATCH_SIZE, "Batch too large");

        results = new bool[](addresses.length);

        for (uint256 i = 0; i < addresses.length; i++) {
            // [Critical-1] 统一 Leaf 格式
            bytes32 leaf = _leaf(addresses[i], riskScores[i], riskTiers[i]);
            results[i] = MerkleProof.verify(proofs[i], merkleRoot, leaf);
        }

        return results;
    }

    // ============ Risk Score Operations ============

    /**
     * @notice 设置地址风险分数
     * @param addr 地址
     * @param riskScore 风险分数 (0-100)
     */
    function setAddressRiskScore(address addr, uint256 riskScore)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        require(addr != address(0), "Invalid address");
        // [Low-1] 使用常量替代魔术数字
        require(riskScore <= MAX_RISK_SCORE, "Invalid score");
        addressRiskScores[addr] = riskScore;
        emit AddressRiskUpdated(addr, riskScore, "");
    }

    /**
     * @notice 批量设置地址风险分数
     */
    function batchSetRiskScores(
        address[] calldata addresses,
        uint256[] calldata riskScores
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        require(addresses.length == riskScores.length, "Length mismatch");

        // [High-3] 添加批量大小上限
        require(addresses.length <= MAX_BATCH_SIZE, "Batch too large");

        for (uint256 i = 0; i < addresses.length; i++) {
            // [Medium-3] 统一错误处理策略：全部 revert
            require(addresses[i] != address(0), "Invalid address");
            require(riskScores[i] <= MAX_RISK_SCORE, "Invalid score");
            addressRiskScores[addresses[i]] = riskScores[i];
            emit AddressRiskUpdated(addresses[i], riskScores[i], "batch");
        }
    }

    /**
     * @notice 获取地址风险分数
     */
    function getAddressRiskScore(address addr) external view returns (uint256) {
        return addressRiskScores[addr];
    }

    // ============ Tag Operations ============

    /**
     * @notice 添加地址标签
     */
    function addAddressTag(address addr, bytes32 tag)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        require(addr != address(0), "Invalid address");
        require(!addressTags[addr][tag], "Tag exists");
        addressTags[addr][tag] = true;
        // [Medium-2] 补充事件
        emit AddressTagAdded(addr, tag, block.timestamp);
    }

    /**
     * @notice 移除地址标签
     */
    function removeAddressTag(address addr, bytes32 tag)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        require(addressTags[addr][tag], "Tag not found");
        delete addressTags[addr][tag];
        emit AddressTagRemoved(addr, tag, block.timestamp);
    }

    // ============ Pausable ============

    // [Low-4] 添加 whenNotPaused / whenPaused 修饰符使意图明确
    function pause() external onlyRole(ADMIN_ROLE) whenNotPaused {
        _pause();
        emit ContractPaused(msg.sender, block.timestamp);
    }

    function unpause() external onlyRole(ADMIN_ROLE) whenPaused {
        _unpause();
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @notice 检查地址是否有标签
     */
    function hasTag(address addr, bytes32 tag) external view returns (bool) {
        return addressTags[addr][tag];
    }

    // ============ View Functions ============

    /**
     * @notice 获取 Merkle Root 历史
     */
    function getMerkleRootHistory() external view returns (bytes32[] memory) {
        return merkleRootHistory;
    }

    /**
     * @notice 获取当前 Merkle Root
     */
    function getMerkleRoot() external view returns (bytes32) {
        return merkleRoot;
    }
}