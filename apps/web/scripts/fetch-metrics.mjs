#!/usr/bin/env node
/* ================================================================
   fetch-metrics.mjs — 构建期从公开 API 拉取真实聚合指标，
   生成 i18n/metrics.generated.ts 供四个语言字典消费。

   设计原则：
   - 永远 exit(0)：离线 / API 故障 / 超时都不允许阻断构建；
   - 拉取失败时【保留现有文件】（上次成功值），不写入陈旧假值；
   - 首次克隆无文件时写入一组保守兜底值。
   ================================================================ */
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../i18n/metrics.generated.ts");
const ENDPOINT =
  process.env.FIO_METRICS_URL ??
  "https://fidesorigin-api.vercel.app/v1/public/stats";
const TIMEOUT_MS = 8000;

const fmt = (n) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : null);

function render({ riskAddresses, txMonitored, alertsToday, generatedAt }) {
  return `/* ⚠ 本文件由 scripts/fetch-metrics.mjs 生成，请勿手改。
   数据源：GET ${ENDPOINT}（公开聚合计数，无地址级明细）
   最近成功拉取：${generatedAt} */
export const siteMetrics = {
  /** 链上风险地址总数（address_risks 全量），带 "+" 后缀表示持续增长 */
  riskAddresses: "${riskAddresses}",
  /** 已监控交易总数（transactions 全量） */
  txMonitored: "${txMonitored}",
  /** 今日高危拦截数（risk_events 今日 HIGH/CRITICAL） */
  alertsToday: "${alertsToday}",
} as const;
`;
}

async function main() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(ENDPOINT, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const riskAddresses = fmt(data.risk_addresses_total);
    const txMonitored = fmt(data.monitored_transactions);
    const alertsToday = fmt(data.blocked_today);
    if (!riskAddresses || !txMonitored || !alertsToday) {
      throw new Error("unexpected payload shape");
    }

    writeFileSync(
      OUT,
      render({
        riskAddresses: `${riskAddresses}+`,
        txMonitored,
        alertsToday,
        generatedAt: data.generated_at ?? new Date().toISOString(),
      }),
      "utf8"
    );
    console.log(`[fetch-metrics] updated: risk=${riskAddresses} tx=${txMonitored} alerts=${alertsToday}`);
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`[fetch-metrics] fetch failed (${err.message}) — keeping existing metrics.generated.ts`);
    } else {
      /* 首次克隆兜底：写入一组保守值，构建不受影响 */
      writeFileSync(
        OUT,
        render({
          riskAddresses: "20,000+",
          txMonitored: "—",
          alertsToday: "—",
          generatedAt: "fallback (never fetched)",
        }),
        "utf8"
      );
      console.warn(`[fetch-metrics] fetch failed (${err.message}) — wrote fallback values`);
    }
  }
  /* ⚠ 不用 process.exit(0)：Windows + 代理环境变量（NODE_USE_ENV_PROXY）
     下强退会触发 libuv UV_HANDLE_CLOSING 断言崩溃。自然返回即可——
     fetch 的 keep-alive agent 由 undici 自动回收，进程数秒内退出。 */
}

await main();
