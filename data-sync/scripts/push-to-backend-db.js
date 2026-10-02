// daily-sync 写链后的后端库同步（Neon Postgres，address_risks 表 upsert）
// 唯一事实源：链上 RiskRegistry——本脚本把刚写链的同一批档案推给后端，
// 让 demo/address-check（走后端视角的公开端点）与链上视角一致。
// 幂等：ON CONFLICT (address, chain) DO UPDATE。
// [P1-1] 支持下架：delistedAddresses 中的地址在 DB 置 score=0/清空 tags（与链上 sanctioned=false 同步）
'use strict';

const { Client } = require('pg');
const { sharedRiskLevel, tagsForEntry } = require('../src/riskGrading');

// [FIX] 原实现用链上 tier 映射展示 level：TIER_TO_LEVEL = ['UNKNOWN','LOW','MEDIUM','HIGH','CRITICAL']
// 当时链上 tier 阈值（30/50/80/95）与全站展示阈值（30/70/90）不同，
// 实证：scam 地址 score=75 → 链上 tier=2 → 存库 'MEDIUM'，而引擎重算返回 'HIGH'，
// 同一地址两套档位（直读库与走端点结果不一致）。现统一走 sharedRiskLevel()。
//
// [2026-10-02 更新] 展示阈值已对齐链上（decision：展示对齐链上、不升合约），
// 两套档位边界现一致（50/80/95）。仍必须走 sharedRiskLevel() 而非 TIER_TO_LEVEL：
// 链上有 UNKNOWN(0-29) 档、展示层无（并入 LOW），且展示层直接由 score 判定，
// 用 tier 反查 level 会在 UNKNOWN 档产生偏差。

/**
 * @param {Array<{address:string, riskScore:number, tier:number, reason?:string, sources?:string[]}>} entries
 * @param {string[]} [delistedAddresses] 已从名单移除的地址（DB 清零处理）
 */
async function pushToBackendDb(entries, delistedAddresses = []) {
  const url = process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL_SYNC_VALUE;
  if (!url) {
    console.log('\n⏭️ 后端库未配置（BACKEND_DATABASE_URL），跳过 DB 同步');
    return { skipped: true };
  }
  const hasUpserts = entries && entries.length > 0;
  const hasDelists = delistedAddresses.length > 0;
  if (!hasUpserts && !hasDelists) {
    console.log('\n⏭️ 无数据需要同步到后端库');
    return { skipped: true, reason: 'empty' };
  }

  console.log(`\n🗄️ Syncing ${entries.length} profiles to backend DB...`);

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    let upserted = 0;
    const CHUNK = 25;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const values = [];
      const params = [];
      chunk.forEach((e, idx) => {
        const base = idx * 8;
        // 兼容复数 sources（mergeData 输出）与单数 source（直接 fetch 未 merge），
        // 两者都缺时才兜底 ['OFAC']。
        const srcs = (e.sources && e.sources.length)
          ? e.sources
          : (e.source ? [e.source] : ['OFAC']);
        // 风险源（SCAM_*）默认 75 分，制裁源默认 100 分
        const isRiskSource = srcs.some((s) => String(s).toUpperCase().startsWith('SCAM'));
        const score = e.riskScore ?? (isRiskSource ? 75 : 100);
        // 展示档位走全站阈值（2026-10-02 已对齐链上 tier：50/80/95，无 UNKNOWN 共 4 档），
        // 与后端引擎重算结果一致
        const level = sharedRiskLevel(score);
        // tags 与链上/本地同源：优先用记录自带的规范 tags（mergeData 已算好），
        // 否则由 tagsForEntry 统一推导（含 sanctioned/scam marker 兜底 + 排序 + 限量）。
        // ⚠️ marker 决定后端引擎命中哪个策略：scam 地址绝不能带 'sanctioned'，
        //    否则被 SanctionedListStrategy 误判满分封号（历史 bug，已由 tagsForEntry 按
        //    category 分流保证）。
        const tags = (Array.isArray(e.tags) && e.tags.length)
          ? e.tags
          : tagsForEntry({ ...e, sources: srcs });
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`);
        params.push(
          e.address.toLowerCase(),
          'ethereum',
          score,
          level,
          JSON.stringify(tags),
          'CONFIRMED',
          new Date().toISOString(),
          0 // report_count：DB 列无默认值，缺省会留 NULL 并使响应模型 int 校验 500
        );
      });

      await client.query(
        `INSERT INTO address_risks (id, address, chain, risk_score, risk_level, tags, status, last_updated_at, report_count)
         SELECT gen_random_uuid(), v.address, v.chain, v.risk_score::numeric, v.risk_level, v.tags::jsonb, v.status, v.last_updated_at::timestamptz, v.report_count::int
         FROM (VALUES ${values.join(', ')}) AS v(address, chain, risk_score, risk_level, tags, status, last_updated_at, report_count)
         ON CONFLICT (address, chain)
         DO UPDATE SET
           risk_score = EXCLUDED.risk_score,
           risk_level = EXCLUDED.risk_level,
           tags = EXCLUDED.tags,
           status = EXCLUDED.status,
           last_updated_at = EXCLUDED.last_updated_at,
           report_count = EXCLUDED.report_count`,
        params
      );
      upserted += chunk.length;
      console.log(`   📤 ${upserted}/${entries.length} upserted`);
    }

    // [P1-1] 下架地址清零：score=0 + 清空 tags（引擎 SanctionedListStrategy 按 tags 判定，
    // 必须清干净——任何残留 OFAC/SDN 字样都会继续被判满分）；保留行作审计轨迹
    let delisted = 0;
    if (delistedAddresses.length > 0) {
      console.log(`   🗑️ Zeroing ${delistedAddresses.length} delisted addresses...`);
      const now = new Date().toISOString();
      for (const addr of delistedAddresses) {
        await client.query(
          `UPDATE address_risks
             SET risk_score = 0, risk_level = 'LOW', tags = '[]'::jsonb,
                 status = 'CONFIRMED', last_updated_at = $2
           WHERE address = $1 AND chain = 'ethereum'`,
          [addr.toLowerCase(), now]
        );
        delisted++;
      }
      console.log(`   ✅ ${delisted} delisted addresses zeroed`);
    }

    console.log(`   ✅ Backend DB sync complete: ${upserted} upserted, ${delisted} delisted`);
    return { upserted, delisted };
  } finally {
    await client.end();
  }
}

// 独立运行：node scripts/push-to-backend-db.js（读 cache/risk-database.json）
if (require.main === module) {
  (async () => {
    const fs = require('fs');
    const path = require('path');
    const dbFile = path.join(__dirname, '../cache/risk-database.json');
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const entries = data.addresses || data;
    await pushToBackendDb(entries);
  })().catch((e) => {
    console.error('💥 push-to-backend-db failed:', e.message);
    process.exit(1);
  });
}

module.exports = { pushToBackendDb };
