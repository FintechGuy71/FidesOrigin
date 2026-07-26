// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../interfaces/IDiamondCut.sol";
import "../libraries/LibDiamond.sol";

/**
 * @title DiamondCutFacet
 * @notice M-01 FIX: DiamondCut 添加时间锁包装
 * @dev 所有 diamondCut 操作必须经过 propose -> execute 两步流程
 */
contract DiamondCutFacet is IDiamondCut {

    /// @notice M-01 FIX: DiamondCut 时间锁延迟（48小时）
    uint256 public constant DIAMONDCUT_DELAY = 48 hours;

    /// @notice M-01 FIX: 已提案的 diamondCut 哈希 => 可执行时间戳
    mapping(bytes32 => uint256) public diamondCutProposals;

    // ============ Events ============
    event DiamondCutProposed(bytes32 indexed proposalHash, uint256 executeAfter);
    event DiamondCutExecuted(bytes32 indexed proposalHash);

    // ============ Errors ============
    error NoProposalFound(bytes32 proposalHash);
    error TimelockNotExpired(bytes32 proposalHash, uint256 executeAfter);

    /**
     * @notice M-01 FIX: 提案 DiamondCut 操作
     * @param _diamondCut  facet 切割配置
     * @param _init        初始化合约地址
     * @param _calldata    初始化调用数据
     */
    function proposeDiamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external {
        LibDiamond.enforceIsContractOwner();
        bytes32 proposalHash = keccak256(abi.encode(_diamondCut, _init, _calldata));
        diamondCutProposals[proposalHash] = block.timestamp + DIAMONDCUT_DELAY;
        emit DiamondCutProposed(proposalHash, diamondCutProposals[proposalHash]);
    }

    /**
     * @notice M-01 FIX: 执行已提案的 DiamondCut（时间锁到期后）
     * @param _diamondCut  facet 切割配置
     * @param _init        初始化合约地址
     * @param _calldata    初始化调用数据
     */
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external override {
        LibDiamond.enforceIsContractOwner();

        bytes32 proposalHash = keccak256(abi.encode(_diamondCut, _init, _calldata));
        uint256 executeAfter = diamondCutProposals[proposalHash];
        if (executeAfter == 0) {
            revert NoProposalFound(proposalHash);
        }
        if (block.timestamp < executeAfter) {
            revert TimelockNotExpired(proposalHash, executeAfter);
        }

        delete diamondCutProposals[proposalHash];
        emit DiamondCutExecuted(proposalHash);

        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}
