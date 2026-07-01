// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IDiamond {
    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    enum FacetCutAction { Add, Replace, Remove }

    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
}
