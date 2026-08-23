// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./libraries/LibDiamond.sol";
import "./interfaces/IDiamondCut.sol";

contract DiamondComplianceEngine {
    constructor(
        address _contractOwner,
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) payable {
        // [L-1 FIX] 零地址校验：owner=0 将永久锁死 diamondCut 与 withdrawETH
        // （enforceIsContractOwner 要求 msg.sender==address(0) 不可达）
        require(
            _contractOwner != address(0),
            "DiamondComplianceEngine: owner cannot be zero address"
        );
        LibDiamond.setContractOwner(_contractOwner);
        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }

    fallback() external payable {
        address facet = LibDiamond.getFacetAddress(msg.sig);
        require(
            facet != address(0),
            "DiamondComplianceEngine: Function does not exist"
        );
        // P2 FIX: 验证 facet 地址仍包含代码（防止 SELFDESTRUCT 后落入空地址）
        require(
            facet.code.length > 0,
            "DiamondComplianceEngine: Facet has no code"
        );
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {
        // [K3 Fix C-14] ETH received can be withdrawn via AdminFacet.withdrawETH()
    }
}
