// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev Upgradeable version of ReentrancyGuard for use with UUPS proxy contracts.
 * Based on OpenZeppelin Contracts v5.1.0.
 *
 * I-18 NOTE: 此合约是 OpenZeppelin ReentrancyGuardUpgradeable 的定制副本。
 *            定制原因：确保与项目其他升级合约 (ComplianceEngine, PolicyEngine 等)
 *            的存储布局严格兼容。直接使用 OZ 原版可能导致 __gap 数组大小不一致，
 *            从而在升级时覆盖相邻存储槽。此版本保持 __gap[49] 与项目初始化模式一致。
 */
abstract contract ReentrancyGuardUpgradeable is Initializable {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    function __ReentrancyGuard_init() internal onlyInitializing {
        _status = NOT_ENTERED;
    }

    function __ReentrancyGuard_init_unchained() internal onlyInitializing {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }

    uint256[49] private __gap;
}
