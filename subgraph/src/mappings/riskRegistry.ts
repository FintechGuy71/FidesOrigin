import {
  RiskProfile,
  RiskProfileUpdate,
  SanctionedAddress,
  ProtocolStats,
} from '../../generated/schema';
import {
  RiskProfileUpdated,
  AddressTagged,
  SanctionAdded,
  SanctionRemoved,
  ContractRegistered,
} from '../../generated/RiskRegistry/RiskRegistry';
import { ethereum, BigInt, Address, Bytes } from '@graphprotocol/graph-ts';
import { getRiskTier } from './shared/riskTier';

// Get or create protocol stats
function getOrCreateStats(): ProtocolStats {
  let stats = ProtocolStats.load('stats');
  if (!stats) {
    stats = new ProtocolStats('stats');
    stats.totalComplianceChecks = BigInt.zero();
    stats.totalBlocked = BigInt.zero();
    stats.totalFlagged = BigInt.zero();
    stats.totalHeld = BigInt.zero();
    stats.totalSanctioned = 0;
    stats.totalFundsHeld = BigInt.zero();
    stats.lastUpdated = BigInt.zero();
  }
  return stats;
}

// Handle RiskProfileUpdated event
export function handleRiskProfileUpdated(event: RiskProfileUpdated): void {
  let account = event.params.account.toHexString();
  let riskScore = event.params.riskScore;
  let tier = getRiskTier(event.params.tier as i32);
  let isSanctioned = event.params.isSanctioned;

  // Update or create RiskProfile
  let profile = RiskProfile.load(account);
  if (!profile) {
    profile = new RiskProfile(account);
    profile.tags = [];
  }

  profile.riskScore = riskScore;
  profile.tier = tier;
  profile.lastUpdated = event.block.timestamp;
  profile.isSanctioned = isSanctioned;

  if (isSanctioned) {
    // Also update SanctionedAddress
    let sanctioned = SanctionedAddress.load(account);
    if (!sanctioned) {
      sanctioned = new SanctionedAddress(account);
      sanctioned.account = account;
      sanctioned.addedAt = event.block.timestamp;
      sanctioned.isActive = true;
      sanctioned.reason = 'Oracle update - HIGH risk';
      sanctioned.addedBy = event.transaction.from.toHexString();

      // Update stats
      let stats = getOrCreateStats();
      stats.totalSanctioned += 1;
      stats.lastUpdated = event.block.timestamp;
      stats.save();
    }
  }

  profile.save();

  // Create update record
  let updateId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let update = new RiskProfileUpdate(updateId);
  update.account = account;
  update.riskScore = riskScore;
  update.tier = tier;
  update.tags = profile.tags;
  update.timestamp = event.block.timestamp;
  update.blockNumber = event.block.number;
  update.transactionHash = event.transaction.hash.toHexString();
  update.oracle = event.transaction.from.toHexString();
  update.save();

  log.info('[handleRiskProfileUpdated] account={} score={} tier={} sanctioned={}', [
    account,
    riskScore.toString(),
    tier,
    isSanctioned ? 'true' : 'false',
  ]);
}

// Handle AddressTagged event
export function handleAddressTagged(event: AddressTagged): void {
  let account = event.params.account.toHexString();
  let tag = event.params.tag.toHexString();

  let profile = RiskProfile.load(account);
  if (profile) {
    let tags = profile.tags;
    if (!tags.includes(tag)) {
      tags.push(tag);
      profile.tags = tags;
      profile.save();
    }
  }

  log.info('[handleAddressTagged] account={} tag={}', [account, tag]);
}

// Handle SanctionAdded event
export function handleSanctionAdded(event: SanctionAdded): void {
  let account = event.params.account.toHexString();
  let reason = event.params.reason;

  // Update RiskProfile
  let profile = RiskProfile.load(account);
  if (profile) {
    profile.isSanctioned = true;
    profile.sanctionedAt = event.block.timestamp;
    profile.sanctionReason = reason;
    profile.save();
  }

  // Create/update SanctionedAddress
  let sanctioned = SanctionedAddress.load(account);
  if (!sanctioned) {
    sanctioned = new SanctionedAddress(account);
    sanctioned.account = account;
    sanctioned.addedAt = event.block.timestamp;
    sanctioned.isActive = true;
    sanctioned.addedBy = event.transaction.from.toHexString();

    // Update stats
    let stats = getOrCreateStats();
    stats.totalSanctioned += 1;
    stats.lastUpdated = event.block.timestamp;
    stats.save();
  }
  sanctioned.reason = reason;
  sanctioned.save();

  log.info('[handleSanctionAdded] account={} reason={}', [account, reason]);
}

// Handle SanctionRemoved event
export function handleSanctionRemoved(event: SanctionRemoved): void {
  let account = event.params.account.toHexString();

  // Update RiskProfile
  let profile = RiskProfile.load(account);
  if (profile) {
    profile.isSanctioned = false;
    profile.save();
  }

  // Update SanctionedAddress
  let sanctioned = SanctionedAddress.load(account);
  if (sanctioned) {
    sanctioned.isActive = false;
    sanctioned.removedAt = event.block.timestamp;
    sanctioned.save();

    // Update stats
    // [P2 Fix] 添加下溢保护，防止 totalSanctioned 变成负数
    let stats = getOrCreateStats();
    if (stats.totalSanctioned > 0) {
      stats.totalSanctioned -= 1;
    } else {
      log.warning('[handleSanctionRemoved] totalSanctioned already 0, skipping decrement', []);
    }
    stats.lastUpdated = event.block.timestamp;
    stats.save();
  }

  log.info('[handleSanctionRemoved] account={}', [account]);
}

// Handle ContractRegistered event
export function handleContractRegistered(event: ContractRegistered): void {
  let contractAddr = event.params.contractAddr.toHexString();
  let contractType = event.params.contractType.toHexString();
  let isVerified = event.params.verified;

  // Create a RiskProfile for the contract
  let profile = RiskProfile.load(contractAddr);
  if (!profile) {
    profile = new RiskProfile(contractAddr);
    profile.tags = [];
  }

  profile.lastUpdated = event.block.timestamp;
  let tags = profile.tags;
  if (!tags.includes(contractType)) {
    tags.push(contractType);
  }
  if (isVerified && !tags.includes('verified')) {
    tags.push('verified');
  }
  profile.tags = tags;
  profile.save();

  log.info('[handleContractRegistered] contract={} type={} verified={}', [
    contractAddr,
    contractType,
    isVerified ? 'true' : 'false',
  ]);
}
