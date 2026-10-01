/* ⚠ 本文件由 scripts/fetch-metrics.mjs 生成，请勿手改。
   数据源：GET https://fidesorigin-api.vercel.app/v1/public/stats（公开聚合计数，无地址级明细）
   最近成功拉取：fallback (committed default) */
export const siteMetrics = {
  /** 链上风险地址总数（address_risks 全量），带 "+" 后缀表示持续增长 */
  riskAddresses: "20,645+",
  /** 已监控交易总数（transactions 全量） */
  txMonitored: "12,847",
  /** 今日高危拦截数（risk_events 今日 HIGH/CRITICAL） */
  alertsToday: "3",
} as const;
