import {
  RiskProfile,
  RiskProfileUpdate,
  SanctionedAddress,
  ProtocolStats,
} from '../../generated/schema';
import {
  RiskProfileUpdated,
  RiskProfileRemoved,
  AddressTagged,
  RiskRegistry,
} from '../../generated/RiskRegistry/RiskRegistry';
import { ethereum, BigInt, Address, Bytes, log, store } from '@graphprotocol/graph-ts';
import { getRiskTier } from './shared/riskTier';
import { bytes32ToString } from './shared/bytes32';

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

/**
 * 解码链上 bytes32[] 标签为可读字符串数组（跳过空槽位、去重、排序保证确定性）。
 *
 * 为什么必须回读链上而不能靠 AddressTagged 事件累积：
 *   合约 `_updateRiskProfileInternal` 的语义是【先 `delete profile.tags` 再逐个 push】
 *   （RiskRegistry.sol:362-369），即每次更新都是"全量替换"。但它只 emit
 *   `AddressTagged`（新增侧），`AddressUntagged` 虽已声明却**从未 emit**。
 *   因此仅靠 handleAddressTagged 追加，subgraph 的 tags 会变成只增不减：
 *     - 某来源从名单移除后，链上已无该标签，subgraph 却永久残留；
 *     - 更严重的是下架路径：data-sync 调 updateRiskProfile(addr,0,0,[],false)，
 *       链上 tags 清空为 []，而 subgraph 仍残留 "sanctioned" —— 一个已解除制裁的
 *       地址在索引里看起来仍被制裁，属安全性错误。
 *   回读链上状态是唯一能表达"删除"的办法（事件流不含删除信息）。
 *
 * 事件顺序保证正确性：合约内 `_updateRiskProfileInternal`（改 tags、发 AddressTagged）
 * 在 `emit RiskProfileUpdated` 之前执行，故本 handler 里回读到的已是最终态。
 */
function decodeTagList(rawTags: Array<Bytes>): Array<string> {
  let decoded: Array<string> = [];
  for (let i = 0; i < rawTags.length; i++) {
    let t = bytes32ToString(rawTags[i]);
    // 跳过空串（bytes32 全零槽位），避免索引里出现无意义的 "" 标签
    if (t.length > 0 && !decoded.includes(t)) decoded.push(t);
  }
  decoded.sort();
  return decoded;
}

export function handleRiskProfileUpdated(event: RiskProfileUpdated): void {
  let accountAddr = event.params.account;
  let account = accountAddr.toHexString();
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

  // [FIX] 以链上状态为准全量替换 tags（修复只增不减导致的残留，含下架后仍显示 sanctioned）。
  // 回读失败时保留 profile 现有 tags，不臆测、不清空。
  let registry = RiskRegistry.bind(event.address);
  let profileResult = registry.try_getRiskProfile(accountAddr);
  if (!profileResult.reverted) {
    profile.tags = decodeTagList(profileResult.value.tags);
  } else {
    log.warning(
      '[handleRiskProfileUpdated] getRiskProfile reverted for {} — keeping existing tags',
      [account]
    );
  }

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
    } else if (!sanctioned.isActive) {
      // [S-L1 FIX] 再制裁复活：地址曾被解除（isActive=false）后再次制裁时，
      // 原实现无此分支——isActive 永停 false，totalSanctioned 也不再增加
      sanctioned.isActive = true;
      sanctioned.addedAt = event.block.timestamp;
      sanctioned.removedAt = null;
      sanctioned.addedBy = event.transaction.from.toHexString();
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
  // [FIX] 原为 event.params.tag.toHexString() —— 存成 0x4f4641435f... 十六进制串，
  // 前端 tags.join() 显示乱码。链上 tags 是 ethers.encodeBytes32String 编码的短字符串
  // （如 "OFAC_SDN_ADVANCED"），必须解码回 ASCII 才可读、才能与后端库 tags 对齐。
  let tag = bytes32ToString(event.params.tag);

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

// [AUDIT FIX 2026-09-18 R3-L13] 原未订阅删除事件 → 删除的档案在索引中永久残留
export function handleRiskProfileRemoved(event: RiskProfileRemoved): void {
  let account = event.params.addr.toHexString();
  let profile = RiskProfile.load(account);
  if (profile) {
    // 物理删除档案实体；审计痕迹由链上事件本身承载
    store.remove('RiskProfile', account);
  }
  let sanctioned = SanctionedAddress.load(account);
  if (sanctioned) {
    sanctioned.isActive = false;
    sanctioned.removedAt = event.block.timestamp;
    sanctioned.save();
  }
}
