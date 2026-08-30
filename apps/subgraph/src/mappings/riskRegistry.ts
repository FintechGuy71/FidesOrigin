import {
  RiskProfile,
  RiskProfileUpdate,
  SanctionedAddress,
  ProtocolStats,
} from '../../generated/schema';
import {
  RiskProfileUpdated,
  AddressTagged,
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
  // [AUDIT-FIX] 事件签名对齐合约后 riskScore 为 BigInt（原 uint8 误写导致该 handler
  // 从未被链上事件触发过），直接赋值，不再经 BigInt.fromI32 转换。
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
      // [FIX] 缺失的持久化：此前只建实体未保存，SanctionedAddress 永不落库
      // （riskRegistry 测试 handleRiskProfileUpdated/creates SanctionedAddress 捕获）
      sanctioned.save();

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
    profile.riskScore = BigInt.zero();
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
  let existingUpdate = RiskProfileUpdate.load(updateId);
  if (!existingUpdate) {
    let newUpdate = new RiskProfileUpdate(updateId);
    newUpdate.account = account;
    newUpdate.riskScore = profile.riskScore;
    newUpdate.tier = profile.tier;
    newUpdate.tags = tags;
    newUpdate.timestamp = event.block.timestamp;
    newUpdate.blockNumber = event.block.number;
    newUpdate.transactionHash = event.transaction.hash.toHexString();
    newUpdate.oracle = event.transaction.from.toHexString();
    newUpdate.save();
  }

  log.info('[handleAddressTagged] account={} tag={}', [account, tag]);
}



