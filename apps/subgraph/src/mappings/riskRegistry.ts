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
import { ethereum, BigInt, Address, Bytes, log } from '@graphprotocol/graph-ts';
import { getRiskTier } from './shared/riskTier';

function getOrCreateStats(): ProtocolStats {
  let stats = ProtocolStats.load('stats');
  if (!stats) {
    stats = new ProtocolStats('stats');
    stats.totalComplianceChecks = BigInt.zero();
    stats.totalBlocked = BigInt.zero();
    stats.totalFlagged = BigInt.zero();
    stats.totalHeld = BigInt.zero();
    stats.totalAllowed = BigInt.zero();
    stats.totalSanctioned = 0;
    stats.totalFundsHeld = BigInt.zero();
    stats.lastUpdated = BigInt.zero();
  }
  return stats;
}

export function handleRiskProfileUpdated(event: RiskProfileUpdated): void {
  let account = event.params.account.toHexString();
  let riskScore = event.params.riskScore;
  let tier = getRiskTier(event.params.tier as i32);
  let isSanctioned = event.params.isSanctioned;

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
    let sanctioned = SanctionedAddress.load(account);
    if (!sanctioned) {
      sanctioned = new SanctionedAddress(account);
      sanctioned.account = account;
      sanctioned.addedAt = event.block.timestamp;
      sanctioned.isActive = true;
      sanctioned.reason = 'Oracle update - HIGH risk';
      sanctioned.addedBy = event.transaction.from.toHexString();

      let stats = getOrCreateStats();
      stats.totalSanctioned += 1;
      stats.lastUpdated = event.block.timestamp;
      stats.save();
    }
  } else {
    let sanctioned = SanctionedAddress.load(account);
    if (sanctioned && sanctioned.isActive) {
      sanctioned.isActive = false;
      sanctioned.removedAt = event.block.timestamp;
      sanctioned.save();

      let stats = getOrCreateStats();
      if (stats.totalSanctioned > 0) {
        stats.totalSanctioned -= 1;
      } else {
        log.warning('[handleRiskProfileUpdated] totalSanctioned already 0, skipping decrement', []);
      }
      stats.lastUpdated = event.block.timestamp;
      stats.save();

      log.info('[handleRiskProfileUpdated] SanctionedAddress deactivated for account={}', [account]);
    }
  }

  profile.save();

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

export function handleAddressTagged(event: AddressTagged): void {
  let account = event.params.account.toHexString();
  let tag = event.params.tag.toHexString();

  // [High Fix #24] Ensure RiskProfile entity is created if it doesn't exist.
  let profile = RiskProfile.load(account);
  if (!profile) {
    profile = new RiskProfile(account);
    profile.tags = [];
    profile.riskScore = BigInt.fromI32(0);
    profile.tier = 'UNKNOWN';
    profile.lastUpdated = event.block.timestamp;
    profile.isSanctioned = false;
  }

  let tags = profile.tags;
  if (!tags.includes(tag)) {
    tags.push(tag);
    profile.tags = tags;
    profile.lastUpdated = event.block.timestamp;
    profile.save();
  }

  // [High Fix #24] Create a RiskProfileUpdate record for audit trail.
  let updateId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let update = RiskProfileUpdate.load(updateId);
  if (!update) {
    let update = new RiskProfileUpdate(updateId);
    update.account = account;
    update.riskScore = profile.riskScore;
    update.tier = profile.tier;
    update.tags = tags;
    update.timestamp = event.block.timestamp;
    update.blockNumber = event.block.number;
    update.transactionHash = event.transaction.hash.toHexString();
    update.oracle = event.transaction.from.toHexString();
    update.save();
  }

  log.info('[handleAddressTagged] account={} tag={}', [account, tag]);
}

export function handleSanctionAdded(event: SanctionAdded): void {
  let account = event.params.account.toHexString();
  let reason = event.params.reason;

  let profile = RiskProfile.load(account);
  if (profile) {
    profile.isSanctioned = true;
    profile.sanctionedAt = event.block.timestamp;
    profile.sanctionReason = reason;
    profile.save();
  }

  let sanctioned = SanctionedAddress.load(account);
  if (!sanctioned) {
    sanctioned = new SanctionedAddress(account);
    sanctioned.account = account;
    sanctioned.addedAt = event.block.timestamp;
    sanctioned.isActive = true;
    sanctioned.addedBy = event.transaction.from.toHexString();

    let stats = getOrCreateStats();
    stats.totalSanctioned += 1;
    stats.lastUpdated = event.block.timestamp;
    stats.save();
  }
  sanctioned.reason = reason;
  sanctioned.save();

  log.info('[handleSanctionAdded] account={} reason={}', [account, reason]);
}

export function handleSanctionRemoved(event: SanctionRemoved): void {
  let account = event.params.account.toHexString();

  let profile = RiskProfile.load(account);
  if (profile) {
    profile.isSanctioned = false;
    profile.save();
  }

  let sanctioned = SanctionedAddress.load(account);
  if (sanctioned) {
    sanctioned.isActive = false;
    sanctioned.removedAt = event.block.timestamp;
    sanctioned.save();

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

export function handleContractRegistered(event: ContractRegistered): void {
  let contractAddr = event.params.contractAddr.toHexString();
  let contractType = event.params.contractType.toHexString();
  let isVerified = event.params.verified;

  // [High Fix #25] Ensure RiskProfile entity has all fields populated.
  let profile = RiskProfile.load(contractAddr);
  if (!profile) {
    profile = new RiskProfile(contractAddr);
    profile.tags = [];
    profile.riskScore = BigInt.fromI32(0);
    profile.tier = 'UNKNOWN';
    profile.isSanctioned = false;
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

  // [High Fix #25] Create RiskProfileUpdate for audit trail.
  let updateId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let update = RiskProfileUpdate.load(updateId);
  if (!update) {
    update = new RiskProfileUpdate(updateId);
    update.account = contractAddr;
    update.riskScore = profile.riskScore;
    update.tier = profile.tier;
    update.tags = tags;
    update.timestamp = event.block.timestamp;
    update.blockNumber = event.block.number;
    update.transactionHash = event.transaction.hash.toHexString();
    update.oracle = event.transaction.from.toHexString();
    update.save();
  }

  log.info('[handleContractRegistered] contract={} type={} verified={}', [
    contractAddr,
    contractType,
    isVerified ? 'true' : 'false',
  ]);
}
