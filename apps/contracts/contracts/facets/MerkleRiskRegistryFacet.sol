// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibDiamond.sol";
import "./BaseFacet.sol";

/**
 * @title MerkleRiskRegistryFacet
 * @notice Diamond Facet for Merkle Tree based risk address registry
 * @dev Provides batchVerify and Merkle proof verification as part of Diamond
 * @dev VERSION: 1.0.0
 */
contract MerkleRiskRegistryFacet is BaseFacet {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    string public constant VERSION = "1.0.0";

    // ============ Constants ============
    uint256 public constant MAX_RISK_SCORE = 100;
    uint256 public constant MAX_HISTORY = 256;
    uint256 public constant MAX_BATCH_SIZE = 200;

    // ============ Diamond Storage ============
    bytes32 constant MERKLE_STORAGE_POSITION =
        keccak256("compliance.engine.merkle.storage");

    struct MerkleStorage {
        bytes32 merkleRoot;
        bytes32[] merkleRootHistory;
        uint256 historyIndex;
        mapping(address => uint256) addressRiskScores;
        mapping(address => mapping(bytes32 => bool)) addressTags;
        mapping(address => uint256) signerNonces;
    }

    function merkleStorage() internal pure returns (MerkleStorage storage ms) {
        bytes32 position = MERKLE_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

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
    event ZeroAddressRejected(string functionName, uint256 timestamp);
    event AddressTagAdded(address indexed addr, bytes32 indexed tag, uint256 timestamp);
    event AddressTagRemoved(address indexed addr, bytes32 indexed tag, uint256 timestamp);

    // ============ Errors ============
    error InvalidMerkleRoot();
    error SameMerkleRoot();
    error InvalidMerkleProof();
    error InvalidSignature();
    error SignerNotAuthorized();
    error SignatureExpired();
    error BatchLengthMismatch();
    error BatchTooLarge(uint256 size, uint256 maxSize);

    // ============ Merkle Tree Operations ============

    /**
     * @notice H-07 FIX: 标准 Leaf 格式：keccak256(abi.encode(addr, riskScore, riskTier))
     * @dev 使用 uint8 表示 riskTier，避免字符串参数导致的不一致和额外 gas
     */
    function _leaf(
        address addr,
        uint256 riskScore,
        uint8 riskTier
    ) internal pure returns (bytes32) {
        return keccak256(
            bytes.concat(keccak256(abi.encode(addr, riskScore, riskTier)))
        );
    }

    /**
     * @notice 更新 Merkle Root
     */
    function updateMerkleRoot(bytes32 newRoot)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
    {
        if (newRoot == bytes32(0)) revert InvalidMerkleRoot();

        MerkleStorage storage ms = merkleStorage();
        if (newRoot == ms.merkleRoot) revert SameMerkleRoot();

        bytes32 oldRoot = ms.merkleRoot;
        ms.merkleRoot = newRoot;

        if (ms.merkleRootHistory.length < MAX_HISTORY) {
            ms.merkleRootHistory.push(newRoot);
        } else {
            ms.merkleRootHistory[ms.historyIndex % MAX_HISTORY] = newRoot;
        }
        ms.historyIndex++;

        emit MerkleRootUpdated(oldRoot, newRoot, block.timestamp, VERSION);
    }

    /**
     * @notice 验证地址是否在 Merkle Tree 中（无签名版本）
     * @dev H-07 FIX: riskTier 改为 uint8
     */
    function verifyAddress(
        address addr,
        uint256 riskScore,
        uint8 riskTier,
        bytes32[] calldata proof
    ) external view returns (bool) {
        MerkleStorage storage ms = merkleStorage();
        return MerkleProof.verify(proof, ms.merkleRoot, _leaf(addr, riskScore, riskTier));
    }

    /**
     * @notice 批量验证多个地址
     * @dev P1-1: batchVerify 功能到主流程
     * @dev H-07 FIX: riskTiers 改为 uint8[]
     */
    function batchVerify(
        address[] calldata addresses,
        uint256[] calldata riskScores,
        uint8[] calldata riskTiers,
        bytes32[][] calldata proofs
    ) external view returns (bool[] memory results) {
        if (
            addresses.length != riskScores.length ||
            addresses.length != riskTiers.length ||
            addresses.length != proofs.length
        ) revert BatchLengthMismatch();

        if (addresses.length > MAX_BATCH_SIZE)
            revert BatchTooLarge(addresses.length, MAX_BATCH_SIZE);

        MerkleStorage storage ms = merkleStorage();
        results = new bool[](addresses.length);

        for (uint256 i = 0; i < addresses.length; i++) {
            bytes32 leaf = _leaf(addresses[i], riskScores[i], riskTiers[i]);
            results[i] = MerkleProof.verify(proofs[i], ms.merkleRoot, leaf);
        }
    }

    /**
     * @notice 设置地址风险分数
     */
    function setAddressRiskScore(address addr, uint256 riskScore)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        if (addr == address(0)) {
            emit ZeroAddressRejected("setAddressRiskScore", block.timestamp);
            revert InvalidAddress();
        }
        if (riskScore > MAX_RISK_SCORE) revert InvalidScore();

        MerkleStorage storage ms = merkleStorage();
        ms.addressRiskScores[addr] = riskScore;
        emit AddressRiskUpdated(addr, riskScore, "");
    }

    /**
     * @notice 批量设置地址风险分数
     */
    function batchSetRiskScores(
        address[] calldata addresses,
        uint256[] calldata riskScores
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        if (addresses.length != riskScores.length) revert BatchLengthMismatch();
        if (addresses.length > MAX_BATCH_SIZE)
            revert BatchTooLarge(addresses.length, MAX_BATCH_SIZE);

        MerkleStorage storage ms = merkleStorage();
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == address(0)) {
                emit ZeroAddressRejected("batchSetRiskScores", block.timestamp);
                continue;
            }
            if (riskScores[i] > MAX_RISK_SCORE) revert InvalidScore();
            ms.addressRiskScores[addresses[i]] = riskScores[i];
            emit AddressRiskUpdated(addresses[i], riskScores[i], "batch");
        }
    }

    /**
     * @notice 获取地址风险分数
     */
    function getAddressRiskScore(address addr) external view returns (uint256) {
        return merkleStorage().addressRiskScores[addr];
    }

    /**
     * @notice 添加地址标签
     */
    function addAddressTag(address addr, bytes32 tag)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        if (addr == address(0)) revert InvalidAddress();
        MerkleStorage storage ms = merkleStorage();
        if (ms.addressTags[addr][tag]) revert("Tag exists");
        ms.addressTags[addr][tag] = true;
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
        MerkleStorage storage ms = merkleStorage();
        if (!ms.addressTags[addr][tag]) revert("Tag not found");
        delete ms.addressTags[addr][tag];
        emit AddressTagRemoved(addr, tag, block.timestamp);
    }

    /**
     * @notice 检查地址是否有标签
     */
    function hasTag(address addr, bytes32 tag) external view returns (bool) {
        return merkleStorage().addressTags[addr][tag];
    }

    // ============ View Functions ============

    function getMerkleRoot() external view returns (bytes32) {
        return merkleStorage().merkleRoot;
    }

    function getMerkleRootHistory() external view returns (bytes32[] memory) {
        return merkleStorage().merkleRootHistory;
    }

    // ============ Shared Errors ============
    error InvalidAddress();
    error InvalidScore();
}
