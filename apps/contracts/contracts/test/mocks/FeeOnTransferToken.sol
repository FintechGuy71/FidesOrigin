// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title FeeOnTransferToken
 * @notice Mock ERC20 that deducts a fee on every transfer (e.g., 10% fee)
 * @dev Used to test QuarantineVault's fee-on-transfer handling
 */
contract FeeOnTransferToken is ERC20 {
    uint256 public constant FEE_BPS = 1000; // 10% fee
    uint256 public constant BPS_DENOMINATOR = 10000;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = (amount * FEE_BPS) / BPS_DENOMINATOR;
            uint256 netAmount = amount - fee;
            super._update(from, address(this), amount); // burn full amount from sender
            _mint(to, netAmount); // mint net to recipient
            // fee stays in contract
        } else {
            super._update(from, to, amount);
        }
    }
}
