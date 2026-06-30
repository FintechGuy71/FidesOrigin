// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IMerkleRiskRegistry {
    function updateMerkleRoot(bytes32 newRoot) external;
    function merkleRoot() external view returns (bytes32);
}

/**
 * @title FidesBridgeReceiver
 * @notice 跨链 Merkle Root 同步接收器
 * @dev 接收来自 Ethereum Mainnet 的 Merkle Root 更新，转发到 L2 MerkleRiskRegistry
 * @dev 支持 Axelar / LayerZero / 通用 message bridge
 */
contract FidesBridgeReceiver is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRIDGE_RELAYER_ROLE = keccak256("BRIDGE_RELAYER_ROLE");

    /// @notice 升级时间锁（秒）
    uint256 public constant UPGRADE_TIMELOCK = 48 hours;

    /// @notice 升级提案映射（bytes32 proposalId => 可执行时间戳）
    mapping(bytes32 => uint256) public upgradeProposals;

    /// @notice 目标 MerkleRiskRegistry
    IMerkleRiskRegistry public merkleRegistry;

    /// @notice 授权的 source chain + sender 映射
    mapping(uint256 => mapping(address => bool)) public authorizedSenders;

    /// @notice 最后同步时间
    /// @dev L-09 NOTE: This is set to block.timestamp (local chain) on sync, but compared
    ///      against the source-chain `timestamp` param. Cross-chain block time drift may
    ///      cause false positives in StaleUpdate checks. Consider adding tolerance.
    uint256 public lastSyncTime;

    /// @notice 最后同步的 Merkle Root
    bytes32 public lastSyncedRoot;

    /// @notice 同步 nonce（防重放）
    uint256 public syncNonce;

    /// @notice 最小同步间隔
    uint256 public constant MIN_SYNC_INTERVAL = 5 minutes;

    /// @notice 最大 root 历史保留数
    uint256 public constant MAX_ROOT_HISTORY = 256;

    /// @notice Root 历史
    bytes32[] public rootHistory;
    
    /// @notice 环形缓冲区写入索引（修复：使用独立索引替代 nonce % MAX_ROOT_HISTORY）
    uint256 public historyIndex;

    // ============ Events ============
    event CrossChainSynced(
        uint256 indexed sourceChainId,
        bytes32 indexed merkleRoot,
        uint256 timestamp,
        uint256 nonce
    );
    event SenderAuthorized(uint256 chainId, address sender);
    event SenderDeauthorized(uint256 chainId, address sender);
    event MerkleRegistryUpdated(address newRegistry);
    event UpgradeProposed(bytes32 indexed proposalId, address indexed proposedImplementation, uint256 executeAfter);

    // ============ Errors ============
    error UnauthorizedSender(uint256 chainId, address sender);
    error StaleUpdate(uint256 receivedTime, uint256 lastSyncTime);
    error SyncTooFrequent(uint256 elapsed, uint256 required);
    error InvalidMerkleRoot();
    error ReplayDetected(uint256 nonce, uint256 expected);
    error UpgradeNotProposed(bytes32 proposalId);
    error UpgradeTimelockActive(bytes32 proposalId, uint256 executeAfter);

    // ============ Constructor ============
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer ============
    function initialize(address admin, address _merkleRegistry) external initializer {
        __AccessControl_init();
        require(admin != address(0), "Invalid admin");
        require(_merkleRegistry != address(0), "Invalid registry");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(BRIDGE_RELAYER_ROLE, admin);

        merkleRegistry = IMerkleRiskRegistry(_merkleRegistry);
    }

    // ============ Core: Receive Cross-Chain Message ============

    /**
     * @notice 接收跨链 Merkle Root 更新（由 Bridge Relayer 调用）
     * @param sourceChainId 源链 ID（Ethereum mainnet = 1）
     * @param sender 源链发送合约地址
     * @param newRoot 新的 Merkle Root
     * @param timestamp 源链更新时间戳
     * @param nonce 同步 nonce
     */
    function receiveCrossChainUpdate(
        uint256 sourceChainId,
        address sender,
        bytes32 newRoot,
        uint256 timestamp,
        uint256 nonce
    ) external onlyRole(BRIDGE_RELAYER_ROLE) {
        // 1. 验证发送者授权
        if (!authorizedSenders[sourceChainId][sender]) {
            revert UnauthorizedSender(sourceChainId, sender);
        }

        // 2. 验证 nonce（防重放）
        if (nonce <= syncNonce) {
            revert ReplayDetected(nonce, syncNonce + 1);
        }

        // 3. 验证时间戳
        if (timestamp < lastSyncTime) {
            revert StaleUpdate(timestamp, lastSyncTime);
        }
        // D1-AUDIT1-017 fix: reject future timestamps beyond 1 hour drift
        if (timestamp > block.timestamp + 1 hours) {
            revert StaleUpdate(timestamp, block.timestamp);
        }

        // 4. 验证同步间隔
        if (block.timestamp - lastSyncTime < MIN_SYNC_INTERVAL) {
            revert SyncTooFrequent(block.timestamp - lastSyncTime, MIN_SYNC_INTERVAL);
        }

        // 5. 验证 root 非零
        if (newRoot == bytes32(0)) {
            revert InvalidMerkleRoot();
        }

        // 6. 更新状态
        syncNonce = nonce;
        lastSyncTime = block.timestamp;
        lastSyncedRoot = newRoot;

        // 7. 记录历史
        if (rootHistory.length >= MAX_ROOT_HISTORY) {
            rootHistory[historyIndex % MAX_ROOT_HISTORY] = newRoot;
        } else {
            rootHistory.push(newRoot);
        }
        historyIndex++;

        // 8. 转发到 MerkleRiskRegistry
        merkleRegistry.updateMerkleRoot(newRoot);

        emit CrossChainSynced(sourceChainId, newRoot, timestamp, nonce);
    }

    // ============ Admin Functions ============

    function authorizeSender(uint256 chainId, address sender)
        external onlyRole(ADMIN_ROLE)
    {
        authorizedSenders[chainId][sender] = true;
        emit SenderAuthorized(chainId, sender);
    }

    function deauthorizeSender(uint256 chainId, address sender)
        external onlyRole(ADMIN_ROLE)
    {
        authorizedSenders[chainId][sender] = false;
        emit SenderDeauthorized(chainId, sender);
    }

    function setMerkleRegistry(address _merkleRegistry)
        external onlyRole(ADMIN_ROLE)
    {
        require(_merkleRegistry != address(0), "Invalid registry");
        // D1-AUDIT1-019 fix: verify interface support
        require(_merkleRegistry.code.length > 0, "Not a contract");
        // Try calling merkleRoot() to verify interface
        (bool success, ) = _merkleRegistry.staticcall(abi.encodeWithSignature("merkleRoot()"));
        require(success, "Not a MerkleRiskRegistry");
        merkleRegistry = IMerkleRiskRegistry(_merkleRegistry);
        emit MerkleRegistryUpdated(_merkleRegistry);
    }

    // ============ View Functions ============

    function getRootHistory() external view returns (bytes32[] memory) {
        return rootHistory;
    }

    function isSenderAuthorized(uint256 chainId, address sender)
        external view returns (bool)
    {
        return authorizedSenders[chainId][sender];
    }

    // ============ UUPS Upgrade ============

    /**
     * @notice 提议升级 — 必须经过 UPGRADE_TIMELOCK 时间锁
     */
    function proposeUpgrade(address newImplementation) external onlyRole(ADMIN_ROLE) {
        require(newImplementation != address(0), "Zero address");
        bytes32 proposalId = keccak256(abi.encode(newImplementation, block.chainid, address(this)));
        upgradeProposals[proposalId] = block.timestamp + UPGRADE_TIMELOCK;
        emit UpgradeProposed(proposalId, newImplementation, upgradeProposals[proposalId]);
    }

    /**
     * @notice 取消升级提案
     */
    function cancelUpgradeProposal(bytes32 proposalId) external onlyRole(ADMIN_ROLE) {
        if (upgradeProposals[proposalId] == 0) revert UpgradeNotProposed(proposalId);
        delete upgradeProposals[proposalId];
    }

    /**
     * @notice UUPS 升级授权 — 强制时间锁与权限控制
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        bytes32 proposalId = keccak256(abi.encode(newImplementation, block.chainid, address(this)));
        uint256 executeAfter = upgradeProposals[proposalId];
        if (executeAfter == 0) revert UpgradeNotProposed(proposalId);
        if (block.timestamp < executeAfter) revert UpgradeTimelockActive(proposalId, executeAfter);
        delete upgradeProposals[proposalId];
    }

    uint256[47] private __gap;
}
