/* ⚠ 本文件由 scripts/fetch-metrics.mjs 生成，请勿手改。
   数据源：公开统计 API（数据库情报）+ Sepolia Subgraph（链上当前档案）。
   最近成功拉取：2026-11-24T15:35:59.412862+00:00 */
export const siteMetrics = {
  /** 风险情报库记录数（address_risks 全量），非链上档案数 */
  riskAddresses: "5,348",
  /** Sepolia RiskRegistry 当前存在的链上档案数，经 Subgraph 全集分页 */
  onchainProfiles: "145",
  /** 已监控交易总数（transactions 全量） */
  txMonitored: "0",
  /** 今日高危拦截数（risk_events 今日 HIGH/CRITICAL） */
  alertsToday: "0",
  /** 最近完整拉取时间 */
  generatedAt: "2026-11-24T15:35:59.412862+00:00",
} as const;
