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
        LibDiamond.setContractOwner(_contractOwner);
        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }

    fallback() external payable {
        address facet = LibDiamond.getFacetAddress(msg.sig);
        require(
            facet != address(0),
            "DiamondComplianceEngine: Function does not exist"
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

    receive() external payable {}
}
