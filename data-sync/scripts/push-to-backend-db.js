// daily-sync 写链后的后端库同步（Neon Postgres，address_risks 表 upsert）
// 唯一事实源：链上 RiskRegistry——本脚本把刚写链的同一批档案推给后端，
// 让 demo/address-check（走后端视角的公开端点）与链上视角一致。
// 幂等：ON CONFLICT (address, chain) DO UPDATE。
'use strict';

const { Client } = require('pg');

// 链上 RiskTier 枚举（合约）：0 UNKNOWN / 1 LOW / 2 MEDIUM / 3 HIGH / 4 CRITICAL
const TIER_TO_LEVEL = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * @param {Array<{address:string, riskScore:number, tier:number, reason?:string, sources?:string[]}>} entries
 */
async function pushToBackendDb(entries) {
  const url = process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL_SYNC_VALUE;
  if (!url) {
    console.log('\n⏭️ 后端库未配置（BACKEND_DATABASE_URL），跳过 DB 同步');
    return { skipped: true };
  }
  if (!entries || entries.length === 0) {
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
        const base = idx * 7;
        const level = TIER_TO_LEVEL[Math.min(Math.max(e.tier || 3, 0), 4)];
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
        params.push(
          e.address.toLowerCase(),
          'ethereum',
          e.riskScore ?? 100,
          level,
          JSON.stringify(e.sources && e.sources.length ? e.sources : ['OFAC', 'sanctioned']),
          'CONFIRMED',
          new Date().toISOString()
        );
      });

      await client.query(
        `INSERT INTO address_risks (id, address, chain, risk_score, risk_level, tags, status, last_updated_at)
         SELECT gen_random_uuid(), v.address, v.chain, v.risk_score::numeric, v.risk_level, v.tags::jsonb, v.status, v.last_updated_at::timestamptz
         FROM (VALUES ${values.join(', ')}) AS v(address, chain, risk_score, risk_level, tags, status, last_updated_at)
         ON CONFLICT (address, chain)
         DO UPDATE SET
           risk_score = EXCLUDED.risk_score,
           risk_level = EXCLUDED.risk_level,
           tags = EXCLUDED.tags,
           status = EXCLUDED.status,
           last_updated_at = EXCLUDED.last_updated_at`,
        params
      );
      upserted += chunk.length;
      console.log(`   📤 ${upserted}/${entries.length} upserted`);
    }
    console.log(`   ✅ Backend DB sync complete: ${upserted} profiles`);
    return { upserted };
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
