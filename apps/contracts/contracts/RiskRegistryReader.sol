// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RiskRegistryReader
 * @notice RiskRegistry Proxy 的只读 Wrapper
 * @dev 用于在 RiskRegistryV2 升级完成前，提供兼容 ABI 的只读访问
 * @dev 通过 staticcall 调用 deployed proxy 的已有函数，无需修改 proxy storage
 *
 * 使用场景:
 * 1. DApp / 前端需要调用 `totalProfiles()` / `riskProfiles()` 但 deployed impl 不支持
 * 2. 临时兼容层，直到 UUPS 升级完成
 * 3. 数据分析 / 监控工具需要统一 ABI
 *
 * 已部署 Proxy (Sepolia): 0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc
 */
contract RiskRegistryReader {

    // ============ 风险等级枚举 (与 V2 保持一致) ============
    enum RiskTier { UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL }

    // ============ 目标 Proxy 地址 ============
    address public immutable targetProxy;

    // ============ V0.2.1 函数 selectors ============
    bytes4 private constant SELECTOR_SANCTIONED = bytes4(keccak256("sanctionedAddresses(address)"));
    bytes4 private constant SELECTOR_PACKED = bytes4(keccak256("_packedProfiles(address)"));
    bytes4 private constant SELECTOR_TAGS = bytes4(keccak256("getTags(address)"));
    bytes4 private constant SELECTOR_RISK_PROFILE = bytes4(keccak256("getRiskProfile(address)"));
    bytes4 private constant SELECTOR_RISK_TIER = bytes4(keccak256("getRiskTier(address)"));
    bytes4 private constant SELECTOR_RISK_SCORE = bytes4(keccak256("getRiskScore(address)"));

    // ============ 错误 ============
    error CallFailed(bytes data);
    error InvalidProxy();

    // ============ 事件 ============
    event ProxyCallFailed(bytes4 selector, bytes reason);

    // ============ Constructor ============
    constructor(address _targetProxy) {
        if (_targetProxy == address(0)) revert InvalidProxy();
        targetProxy = _targetProxy;
    }

    // ============ Internal: Safe Staticcall ============

    function _staticCall(bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory result) = targetProxy.staticcall(data);
        if (!success) {
            // H5 fix: Fail-Closed — revert instead of returning empty data
            if (result.length == 0) {
                revert CallFailed(data);
            }
            // Forward the revert reason
            revert CallFailed(result);
        }
        return result;
    }

    function _staticCallOrZero(bytes memory data) internal view returns (uint256) {
        bytes memory result = _staticCall(data);
        // H5 fix: Fail-Closed — empty result now reverts via _staticCall
        if (result.length >= 32) {
            return abi.decode(result, (uint256));
        }
        revert CallFailed(data);
    }

    function _staticCallBool(bytes memory data) internal view returns (bool) {
        bytes memory result = _staticCall(data);
        // H5 fix: Fail-Closed — empty result now reverts via _staticCall
        if (result.length >= 32) {
            return abi.decode(result, (bool));
        }
        revert CallFailed(data);
    }

    // ============ Bit-Packing Helpers (与 deployed impl 一致) ============

    function _unpackRiskScore(uint256 packed) internal pure returns (uint8) {
        return uint8(packed);
    }

    function _unpackTier(uint256 packed) internal pure returns (uint8) {
        return uint8(packed >> 8);
    }

    function _unpackIsSanctioned(uint256 packed) internal pure returns (bool) {
        return ((packed >> 16) & 1) == 1;
    }

    function _unpackLastUpdated(uint256 packed) internal pure returns (uint256) {
        return (packed >> 17) & 0xFFFFFFFFFFFFFFFF;
    }

    // ============ 兼容 View Functions ============

    /**
     * @notice 检查地址是否受制裁
     * @dev 优先调用 proxy 的 sanctionedAddresses(mapping getter)
     */
    function isSanctioned(address account) external view returns (bool) {
        // V0.2.1 有 sanctionedAddresses(address) public mapping getter
        bytes memory data = abi.encodeWithSelector(SELECTOR_SANCTIONED, account);
        return _staticCallBool(data);
    }

    /**
     * @notice 获取总档案数
     * @dev V0.2.1 没有此计数器，返回估算值: 遍历所有地址不可行，返回 0 并标注
     */
    function totalProfiles() external pure returns (uint256) {
        // V0.2.1 没有 totalProfiles 存储变量
        // 由于无法遍历 _packedProfiles mapping，返回 0 并依赖 off-chain 索引
        return 0;
    }

    /**
     * @notice 获取地址风险档案 (兼容 V1.2.1 ABI)
     * @dev 通过调用 proxy 的 getRiskProfile() 或手动解包 _packedProfiles
     */
    function riskProfiles(address account) external view returns (
        uint256 riskScore,
        address addr,
        uint32 lastUpdated,
        uint8 riskTier,
        uint8 sourceConfidence,
        bool sanctioned,
        bool exists
    ) {
        // 尝试调用 getRiskProfile (如果 deployed version 支持)
        bytes memory data = abi.encodeWithSelector(SELECTOR_RISK_PROFILE, account);
        bytes memory result = _staticCall(data);

        if (result.length > 0) {
            // deployed v0.2.1 的 getRiskProfile 返回 (uint8,uint8,bytes32[],uint256,bool)
            // 但由于 ABI 不匹配，可能 decode 失败，fallback 到手动解包
            try this.decodeRiskProfile(result) returns (
                uint8 _score, uint8 _tier, bytes32[] memory, uint256 _lastUpdated, bool _sanctioned
            ) {
                return (
                    _score,
                    account,
                    uint32(_lastUpdated),
                    _tier,
                    100,
                    _sanctioned,
                    true
                );
            } catch {
                // fallback to manual unpacking
            }
        }

        // 手动读取 _packedProfiles
        bytes memory packedData = abi.encodeWithSelector(SELECTOR_PACKED, account);
        uint256 packed = _staticCallOrZero(packedData);

        return (
            _unpackRiskScore(packed),
            account,
            uint32(_unpackLastUpdated(packed)),
            _unpackTier(packed),
            100,
            _unpackIsSanctioned(packed),
            packed != 0
        );
    }

    // 辅助函数用于 try/catch decode
    function decodeRiskProfile(bytes memory data) external pure returns (
        uint8 riskScore,
        uint8 tier,
        bytes32[] memory tags,
        uint256 lastUpdated,
        bool isSanctioned
    ) {
        return abi.decode(data, (uint8, uint8, bytes32[], uint256, bool));
    }

    // ============ 额外便利函数 ============

    function getRiskScore(address account) external view returns (uint8) {
        bytes memory data = abi.encodeWithSelector(SELECTOR_RISK_SCORE, account);
        bytes memory result = _staticCall(data);
        if (result.length >= 32) {
            return abi.decode(result, (uint8));
        }
        // fallback
        bytes memory packedData = abi.encodeWithSelector(SELECTOR_PACKED, account);
        return _unpackRiskScore(_staticCallOrZero(packedData));
    }

    function getRiskTier(address account) external view returns (RiskTier) {
        bytes memory data = abi.encodeWithSelector(SELECTOR_RISK_TIER, account);
        bytes memory result = _staticCall(data);
        if (result.length >= 32) {
            return RiskTier(abi.decode(result, (uint8)));
        }
        // fallback
        bytes memory packedData = abi.encodeWithSelector(SELECTOR_PACKED, account);
        return RiskTier(_unpackTier(_staticCallOrZero(packedData)));
    }

    function getTags(address account) external view returns (bytes32[] memory) {
        bytes memory data = abi.encodeWithSelector(SELECTOR_TAGS, account);
        bytes memory result = _staticCall(data);
        if (result.length > 0) {
            return abi.decode(result, (bytes32[]));
        }
        return new bytes32[](0);
    }

    /**
     * @notice 获取合约版本标识
     * @dev Reader 自身版本，非 proxy 版本
     */
    function readerVersion() external pure returns (string memory) {
        return "1.0.0-reader";
    }
}
