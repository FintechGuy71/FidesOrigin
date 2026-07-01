// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../interfaces/IDiamondLoupe.sol";
import "../libraries/LibDiamond.sol";

contract DiamondLoupeFacet is IDiamondLoupe {
    function facets() external view override returns (Facet[] memory facets_) {
        bytes4[] memory selectors = LibDiamond.getSelectorList();
        uint256 numSelectors = selectors.length;

        address[] memory uniqueFacets = new address[](numSelectors);
        uint256 uniqueCount = 0;
        for (uint256 i = 0; i < numSelectors; i++) {
            address facet = LibDiamond.getFacetAddress(selectors[i]);
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueFacets[j] == facet) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                uniqueFacets[uniqueCount] = facet;
                uniqueCount++;
            }
        }

        facets_ = new Facet[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            facets_[i].facetAddress = uniqueFacets[i];
            uint256 count = 0;
            for (uint256 j = 0; j < numSelectors; j++) {
                if (LibDiamond.getFacetAddress(selectors[j]) == uniqueFacets[i]) {
                    count++;
                }
            }
            bytes4[] memory facetSelectors = new bytes4[](count);
            uint256 idx = 0;
            for (uint256 j = 0; j < numSelectors; j++) {
                if (LibDiamond.getFacetAddress(selectors[j]) == uniqueFacets[i]) {
                    facetSelectors[idx] = selectors[j];
                    idx++;
                }
            }
            facets_[i].functionSelectors = facetSelectors;
        }
    }

    function facetFunctionSelectors(address _facet)
        external
        view
        override
        returns (bytes4[] memory facetFunctionSelectors_)
    {
        bytes4[] memory selectors = LibDiamond.getSelectorList();
        uint256 count = 0;
        for (uint256 i = 0; i < selectors.length; i++) {
            if (LibDiamond.getFacetAddress(selectors[i]) == _facet) {
                count++;
            }
        }
        facetFunctionSelectors_ = new bytes4[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < selectors.length; i++) {
            if (LibDiamond.getFacetAddress(selectors[i]) == _facet) {
                facetFunctionSelectors_[idx] = selectors[i];
                idx++;
            }
        }
    }

    function facetAddresses()
        external
        view
        override
        returns (address[] memory facetAddresses_)
    {
        bytes4[] memory selectors = LibDiamond.getSelectorList();
        uint256 numSelectors = selectors.length;

        address[] memory uniqueFacets = new address[](numSelectors);
        uint256 uniqueCount = 0;
        for (uint256 i = 0; i < numSelectors; i++) {
            address facet = LibDiamond.getFacetAddress(selectors[i]);
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueFacets[j] == facet) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                uniqueFacets[uniqueCount] = facet;
                uniqueCount++;
            }
        }
        facetAddresses_ = new address[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            facetAddresses_[i] = uniqueFacets[i];
        }
    }

    function facetAddress(bytes4 _functionSelector)
        external
        view
        override
        returns (address facetAddress_)
    {
        facetAddress_ = LibDiamond.getFacetAddress(_functionSelector);
    }
}
