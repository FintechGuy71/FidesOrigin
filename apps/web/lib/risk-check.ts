/* [AUDIT FIX 2026-09-17 R1-019] 公开只读风险查询端点的单一真源。
   此前同一端点三处配置口径不一：AddressCheck 支持 NEXT_PUBLIC_RISK_CHECK_URL
   覆盖，HeroScreen 与 DemoExperience 纯硬编码。现统一收口到本模块，
   三处组件均从此导入（构建期 env 覆盖 > 已部署网关默认值）。 */
export const PUBLIC_RISK_CHECK_URL =
  process.env.NEXT_PUBLIC_RISK_CHECK_URL ||
  "https://fidesorigin-api.vercel.app/v1/public/risk-check";
