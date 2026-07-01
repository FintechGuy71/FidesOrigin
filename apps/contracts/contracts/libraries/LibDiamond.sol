// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../interfaces/IDiamond.sol";

library LibDiamond {
    bytes32 internal constant DIAMOND_STORAGE_POSITION =
        keccak256("diamond.standard.diamond.storage");

    struct DiamondStorage {
        mapping(bytes4 => address) facetAddressAndSelectorPosition;
        bytes4[] selectorList;
        address contractOwner;
    }

    function diamondStorage()
        internal
        pure
        returns (DiamondStorage storage ds)
    {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function setContractOwner(address _newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        ds.contractOwner = _newOwner;
    }

    function contractOwner() internal view returns (address owner_) {
        owner_ = diamondStorage().contractOwner;
    }

    function enforceIsContractOwner() internal view {
        require(
            msg.sender == contractOwner(),
            "LibDiamond: Must be contract owner"
        );
    }

    function getFacetAddress(bytes4 selector)
        internal
        view
        returns (address)
    {
        return diamondStorage().facetAddressAndSelectorPosition[selector];
    }

    function getSelectorList() internal view returns (bytes4[] memory) {
        return diamondStorage().selectorList;
    }

    function getSelectorListLength() internal view returns (uint256) {
        return diamondStorage().selectorList.length;
    }

    function diamondCut(
        IDiamond.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        for (
            uint256 facetIndex;
            facetIndex < _diamondCut.length;
            facetIndex++
        ) {
            IDiamond.FacetCutAction action = _diamondCut[facetIndex].action;
            if (action == IDiamond.FacetCutAction.Add) {
                addFunctions(
                    _diamondCut[facetIndex].facetAddress,
                    _diamondCut[facetIndex].functionSelectors
                );
            } else if (action == IDiamond.FacetCutAction.Replace) {
                replaceFunctions(
                    _diamondCut[facetIndex].facetAddress,
                    _diamondCut[facetIndex].functionSelectors
                );
            } else if (action == IDiamond.FacetCutAction.Remove) {
                removeFunctions(
                    _diamondCut[facetIndex].facetAddress,
                    _diamondCut[facetIndex].functionSelectors
                );
            }
        }
        emit IDiamond.DiamondCut(_diamondCut, _init, _calldata);
        initializeDiamondCut(_init, _calldata);
    }

    function addFunctions(
        address _facetAddress,
        bytes4[] memory _functionSelectors
    ) internal {
        require(
            _functionSelectors.length > 0,
            "LibDiamond: No selectors in facet to cut"
        );
        require(
            _facetAddress != address(0),
            "LibDiamond: Add facet can't be address(0)"
        );
        DiamondStorage storage ds = diamondStorage();
        for (uint256 i; i < _functionSelectors.length; i++) {
            bytes4 selector = _functionSelectors[i];
            address oldFacetAddress = ds
                .facetAddressAndSelectorPosition[selector];
            require(
                oldFacetAddress == address(0),
                "LibDiamond: Can't add function that already exists"
            );
            ds.facetAddressAndSelectorPosition[selector] = _facetAddress;
            ds.selectorList.push(selector);
        }
    }

    function replaceFunctions(
        address _facetAddress,
        bytes4[] memory _functionSelectors
    ) internal {
        require(
            _functionSelectors.length > 0,
            "LibDiamond: No selectors in facet to cut"
        );
        require(
            _facetAddress != address(0),
            "LibDiamond: Replace facet can't be address(0)"
        );
        DiamondStorage storage ds = diamondStorage();
        for (uint256 i; i < _functionSelectors.length; i++) {
            bytes4 selector = _functionSelectors[i];
            address oldFacetAddress = ds
                .facetAddressAndSelectorPosition[selector];
            require(
                oldFacetAddress != _facetAddress,
                "LibDiamond: Can't replace function with same function"
            );
            require(
                oldFacetAddress != address(0),
                "LibDiamond: Can't replace function that doesn't exist"
            );
            ds.facetAddressAndSelectorPosition[selector] = _facetAddress;
        }
    }

    function removeFunctions(
        address _facetAddress,
        bytes4[] memory _functionSelectors
    ) internal {
        require(
            _functionSelectors.length > 0,
            "LibDiamond: No selectors in facet to cut"
        );
        DiamondStorage storage ds = diamondStorage();
        for (uint256 i; i < _functionSelectors.length; i++) {
            bytes4 selector = _functionSelectors[i];
            address oldFacetAddress = ds
                .facetAddressAndSelectorPosition[selector];
            require(
                oldFacetAddress != address(0),
                "LibDiamond: Can't remove function that doesn't exist"
            );
            delete ds.facetAddressAndSelectorPosition[selector];
            for (uint256 j; j < ds.selectorList.length; j++) {
                if (ds.selectorList[j] == selector) {
                    ds.selectorList[j] = ds.selectorList[
                        ds.selectorList.length - 1
                    ];
                    ds.selectorList.pop();
                    break;
                }
            }
        }
    }

    function initializeDiamondCut(address _init, bytes memory _calldata)
        internal
    {
        if (_init == address(0)) {
            return;
        }
        require(_init.code.length > 0, "LibDiamond: _init address has no code");
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) {
            if (error.length > 0) {
                assembly {
                    revert(add(32, error), mload(error))
                }
            } else {
                revert("LibDiamond: _init function reverted");
            }
        }
    }
}
