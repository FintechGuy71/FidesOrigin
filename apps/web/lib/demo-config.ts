/**
 * Demo configuration and mock data constants
 * Used by LiveTransactionStream and other demo components
 */

export const MOCK_ADDRESSES = [
  /* [AUDIT FIX 2026-09-17 R1-022] 前两项原为非法地址（39 位 hex / 含非 hex
     字符 H），已替换为合法的 40 位 hex 演示地址。 */
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
  "0x8ba1f109551bD4328030126456aC136c82C3e8Ca",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
  "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
];

export const MOCK_RISK_LEVELS: Array<"low" | "medium" | "high" | "critical"> = [
  "low",
  "medium",
  "high",
  "critical",
];

export const MOCK_TRANSACTION_STATUSES: Array<
  "pending" | "confirmed" | "failed" | "flagged"
> = ["pending", "confirmed", "failed", "flagged"];

export const MOCK_TOKENS = ["ETH", "USDC", "USDT", "DAI", "WBTC", "LINK", "AAVE", "UNI"];

export const MOCK_CHAINS = ["ethereum", "bsc", "polygon", "arbitrum"];

/* [AUDIT FIX 2026-09-17 R1-022 说明] MOCK_RISK_TAGS 为中文标签，消费方是
   全中文的 /admin/dashboard（LiveTransactionStream 仅此一处使用）。
   「中文硬编码清零」不变量（_crosscheck.py #8b）的作用域是
   LiveTransactionStream.tsx 组件文件本身——本文件不在该规则扫描范围内，
   二者不构成冲突；此处中文标签与其中文 UI 一致，属有意为之。 */
export const MOCK_RISK_TAGS = [
  ["混币器"],
  ["制裁名单"],
  ["暗网"],
  ["钓鱼"],
  ["闪电贷"],
  ["洗钱"],
  [],
  [],
];

export const MOCK_TRANSACTION_TYPES = ["转账", "合约调用", "代币交换", "流动性添加"];
