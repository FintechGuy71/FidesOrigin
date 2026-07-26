// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../interfaces/IDiamondLoupe.sol";
import "../libraries/LibDiamond.sol";

contract DiamondLoupeFacet is IDiamondLoupe {

    /**
     * @notice P2 FIX: 分页查询 facets，避免 O(n²) 在大量 selector 时超时
     * @dev H-06 FIX: 使用 LibDiamond 缓存的 facetSelectors 减少内层循环
     * @param offset 起始 selector 索引
     * @param limit 最大返回 facet 数量
     * @return facets_ 分页后的 facet 列表
     */
    function facetsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (Facet[] memory facets_)
    {
        bytes4[] memory selectors = LibDiamond.getSelectorList();
        uint256 numSelectors = selectors.length;
        if (offset >= numSelectors) return new Facet[](0);
        uint256 end = offset + limit;
        if (end > numSelectors) end = numSelectors;

        // First pass: collect unique facet addresses in range
        address[] memory uniqueFacets = new address[](end - offset);
        uint256 uniqueCount = 0;
        for (uint256 i = offset; i < end; i++) {
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

        // H-06 FIX: 使用缓存的 facetSelectors 替代 O(n) 遍历
        facets_ = new Facet[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            facets_[i].facetAddress = uniqueFacets[i];
            facets_[i].functionSelectors = LibDiamond.getFacetSelectors(uniqueFacets[i]);
        }
    }

    /**
     * @notice 返回所有 facets
     * @dev H-06 FIX: 使用 LibDiamond 缓存的 facetSelectors 替代 O(n²) 内层循环
     */
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

        // H-06 FIX: 使用缓存的 facetSelectors
        facets_ = new Facet[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            facets_[i].facetAddress = uniqueFacets[i];
            facets_[i].functionSelectors = LibDiamond.getFacetSelectors(uniqueFacets[i]);
        }
    }

    /**
     * @notice H-06 FIX: 使用缓存直接返回 facet 的 selectors，O(1)
     */
    function facetFunctionSelectors(address _facet)
        external
        view
        override
        returns (bytes4[] memory facetFunctionSelectors_)
    {
        facetFunctionSelectors_ = LibDiamond.getFacetSelectors(_facet);
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
