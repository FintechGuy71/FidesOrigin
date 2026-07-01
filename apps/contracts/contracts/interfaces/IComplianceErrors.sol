// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error InvalidAddress();
error RegistryNotSet();
error PolicyNotSet();
error DeadlineExpired(uint256 deadline, uint256 currentTime);
error UnauthorizedCaller(address caller);
error BatchSizeExceeded(uint256 size, uint256 maxSize);
error UpgradeTimelockActive(bytes32 proposalId, uint256 executeAfter);
error UpgradeNotProposed(bytes32 proposalId);
error AlreadyReleased();
error QuarantineNotFound();
error IndexOutOfBounds();
error NotAContract();
error MaxTxExceedsDaily();
error CooldownTooLong();
error InvalidDelay();
error RiskBlocked();
