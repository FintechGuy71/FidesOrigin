#!/usr/bin/env node
/* ================================================================
   fetch-metrics.mjs — 构建期拉取真实数据库指标与 Sepolia 链上档案数。

   - 数据库指标：公开统计 API；优先自定义域名，失败后直连同一 Render 后端。
   - 链上档案数：Subgraph riskProfiles 的 keyset 分页全集。
   - 任一来源失败时保留上次完整快照；首次克隆仅使用明确的未知值。
   ================================================================ */
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../i18n/metrics.generated.ts");
const STATS_ENDPOINTS = process.env.FIO_METRICS_URL
  ? [process.env.FIO_METRICS_URL]
  : [
      "https://fidesorigin.com/api/v1/public/stats",
      "https://fidesorigin-backend.onrender.com/api/v1/public/stats",
    ];
const SUBGRAPH_ENDPOINT =
  process.env.FIO_SUBGRAPH_URL ??
  "https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/version/latest";
const TIMEOUT_MS = 20000;
const MAX_ONCHAIN_PROFILES = 100000;

const fmt = (n) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n.toLocaleString("en-US") : null);

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers ?? {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStats() {
  let lastError;
  for (const endpoint of STATS_ENDPOINTS) {
    try {
      return await fetchJson(endpoint);
    } catch (error) {
      lastError = error;
      console.warn(`[fetch-metrics] statistics route failed: ${error.message}`);
    }
  }
  throw lastError;
}

async function fetchOnchainProfileCount() {
  let lastId = "";
  let total = 0;
  while (true) {
    const query = `query($lastId:ID!){
      riskProfiles(first:1000,orderBy:id,orderDirection:asc,where:{id_gt:$lastId}){id}
    }`;
    const payload = await fetchJson(SUBGRAPH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { lastId } }),
    });
    if (payload.errors) throw new Error("Subgraph returned query errors");
    const rows = payload.data?.riskProfiles;
    if (!Array.isArray(rows)) throw new Error("Unexpected Subgraph payload");
    total += rows.length;
    if (total > MAX_ONCHAIN_PROFILES) throw new Error("On-chain profile count exceeds safety bound");
    if (rows.length < 1000) return total;
    const nextId = rows[rows.length - 1].id;
    if (nextId === lastId) throw new Error("Subgraph pagination did not advance");
    lastId = nextId;
  }
}

function render({ riskAddresses, onchainProfiles, txMonitored, alertsToday, generatedAt }) {
  return `/* ⚠ 本文件由 scripts/fetch-metrics.mjs 生成，请勿手改。
   数据源：公开统计 API（数据库情报）+ Sepolia Subgraph（链上当前档案）。
   最近成功拉取：${generatedAt} */
export const siteMetrics = {
  /** 风险情报库记录数（address_risks 全量），非链上档案数 */
  riskAddresses: "${riskAddresses}",
  /** Sepolia RiskRegistry 当前存在的链上档案数，经 Subgraph 全集分页 */
  onchainProfiles: "${onchainProfiles}",
  /** 已监控交易总数（transactions 全量） */
  txMonitored: "${txMonitored}",
  /** 今日高危拦截数（risk_events 今日 HIGH/CRITICAL） */
  alertsToday: "${alertsToday}",
  /** 最近完整拉取时间 */
  generatedAt: "${generatedAt}",
} as const;
`;
}

async function main() {
  try {
    const [data, onchainCount] = await Promise.all([fetchStats(), fetchOnchainProfileCount()]);
    const riskAddresses = fmt(data.risk_addresses_total);
    const onchainProfiles = fmt(onchainCount);
    const txMonitored = fmt(data.monitored_transactions);
    const alertsToday = fmt(data.blocked_today);
    if (!riskAddresses || !onchainProfiles || !txMonitored || !alertsToday) {
      throw new Error("unexpected payload shape");
    }
    writeFileSync(
      OUT,
      render({
        riskAddresses,
        onchainProfiles,
        txMonitored,
        alertsToday,
        generatedAt: data.generated_at ?? new Date().toISOString(),
      }),
      "utf8"
    );
    console.log(`[fetch-metrics] updated: intelligence=${riskAddresses} onchain=${onchainProfiles} tx=${txMonitored} alerts=${alertsToday}`);
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`[fetch-metrics] fetch failed (${err.message}) — keeping the last complete metrics snapshot`);
    } else {
      writeFileSync(
        OUT,
        render({
          riskAddresses: "—",
          onchainProfiles: "—",
          txMonitored: "—",
          alertsToday: "—",
          generatedAt: "unavailable (never fetched)",
        }),
        "utf8"
      );
      console.warn("[fetch-metrics] fetch failed — wrote explicit unknown values, never fabricated counts");
    }
  }
  /* 自然返回，避免 Windows + 代理运行时强退触发 libuv 句柄关闭问题。 */
}

await main();
