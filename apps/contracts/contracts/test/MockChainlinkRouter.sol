// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockChainlinkRouter
 * @notice Minimal mock for Chainlink Functions Router (for testing only)
 */
contract MockChainlinkRouter {
    function getAllowListId() external pure returns (bytes32) {
        return bytes32(0);
    }
    
    receive() external payable {}
}
