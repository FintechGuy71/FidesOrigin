// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IQuarantineVault {
    function deposit(
        address originalOwner,
        address token,
        uint256 amount,
        bytes32 reasonHash
    ) external returns (bytes32 recordId);
}

/**
 * @title ReentrancyAttacker
 * @notice Malicious contract that attempts reentrancy on QuarantineVault.deposit
 * @dev Implements IERC20 with a callback hook to trigger reentrancy
 */
contract ReentrancyAttacker {
    IQuarantineVault public vault;
    uint256 public attackCount;
    uint256 public constant MAX_ATTACKS = 3;

    constructor(address _vault) {
        vault = IQuarantineVault(_vault);
    }

    function attack(address /* originalOwner */, uint256 /* amount */) external {
        attackCount = 0;
        // Trigger deposit which will call transferFrom on this contract,
        // but we need a different approach since deposit uses safeTransferFrom
        // which calls transferFrom on the token, not on this contract.
        // Instead, we'll use a token that calls back into this contract.
    }

    receive() external payable {}
}

/**
 * @title ReentrantERC20
 * @notice ERC20 token that calls back into a target during transfer
 * @dev Used with ReentrancyAttacker to test reentrancy protection
 */
contract ReentrantERC20 is IERC20 {
    string public name = "ReentrantToken";
    string public symbol = "RNT";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public callbackTarget;
    bytes public callbackData;
    bool public attacking;

    constructor() {
        totalSupply = 1_000_000 * 10 ** 18;
        balanceOf[msg.sender] = totalSupply;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function setCallback(address _target, bytes calldata _data) external {
        callbackTarget = _target;
        callbackData = _data;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        // Reentrancy hook: if we're the vault and callback is set, call back
        if (to == callbackTarget && callbackTarget != address(0) && !attacking) {
            attacking = true;
            (bool success, ) = callbackTarget.call(callbackData);
            // success intentionally unused — reentrancy test mock
            attacking = false;
            // We don't care about success; we just want to test if reentrancy is blocked
        }
    }
}
