import type { Metadata } from "next";

import type { Locale } from "@/i18n/locales";
import { canonicalUrl, hreflangCode } from "@/i18n/locales";

/**
 * 站点级默认 metadata 与 JSON-LD。
 *
 * 拆到这里是因为本项目有 4 个 root layout（英文首页 / 英文经典站 /
 * 多语言 / 后台，见 app/(default)/layout.tsx 顶部注释）：每个 root layout
 * 都要导出 metadata，集中定义可避免四处复制后出现漂移。
 *
 * ⚠ 四个分组场景差异很大，不能无脑共用 siteMetadata：
 *   · 多语言 layout 用它 → /cn /tw /jp 的 title/description 是英文
 *   · 后台 layout 用它   → 运营后台的 OG 卡片显示营销文案，且可被索引
 * 因此下面按场景派生三个变体。
 */
export const siteMetadata: Metadata = {
  metadataBase: new URL("https://fidesorigin.com"),
  title: "FidesOrigin — Programmable On-Chain Compliance",
  description:
    "Execution-grade programmable compliance protocol for tokenized assets, stablecoins, and DeFi. Real-time risk control, autonomous policy enforcement, immutable audit trails.",
  openGraph: {
    title: "FidesOrigin — Programmable On-Chain Compliance",
    description:
      "Execution-grade programmable compliance protocol for on-chain finance.",
    type: "website",
    images: ["https://fidesorigin.com/brand/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@fidesorigin",
    images: ["https://fidesorigin.com/brand/og-image.png"],
  },
};

/** 各语言的 title / description —— 供多语言 root layout 使用。 */
const localeCopy: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "FidesOrigin — Programmable On-Chain Compliance",
    description:
      "Execution-grade programmable compliance protocol for tokenized assets, stablecoins, and DeFi. Real-time risk control, autonomous policy enforcement, immutable audit trails.",
  },
  cn: {
    title: "FidesOrigin — 可编程的链上合规",
    description:
      "面向代币化资产、稳定币与 DeFi 的执行级可编程合规协议。实时风控、策略自动执行、不可篡改的审计留痕。",
  },
  tw: {
    title: "FidesOrigin — 可編程的鏈上合規",
    description:
      "面向代幣化資產、穩定幣與 DeFi 的執行級可編程合規協議。即時風控、策略自動執行、不可篡改的審計留痕。",
  },
  jp: {
    title: "FidesOrigin — プログラマブルなオンチェーン・コンプライアンス",
    description:
      "トークン化資産・ステーブルコイン・DeFi 向けの実行級プログラマブル・コンプライアンスプロトコル。リアルタイムリスク管理、自律的ポリシー執行、改ざん不可能な監査証跡。",
  },
};

/**
 * 多语言 root layout 的 metadata。
 * 带 alternates（canonical + hreflang），替代原先直接复用英文 siteMetadata 的做法。
 */
export function localeMetadata(lang: Locale): Metadata {
  const copy = localeCopy[lang];
  return {
    ...siteMetadata,
    title: copy.title,
    description: copy.description,
    openGraph: {
      ...siteMetadata.openGraph,
      title: copy.title,
      description: copy.description,
      locale: hreflangCode[lang],
    },
    alternates: {
      canonical: canonicalUrl("/", lang),
      languages: {
        en: canonicalUrl("/", "en"),
        "zh-CN": canonicalUrl("/", "cn"),
        "zh-TW": canonicalUrl("/", "tw"),
        ja: canonicalUrl("/", "jp"),
        "x-default": canonicalUrl("/", "en"),
      },
    },
  };
}

/**
 * 后台 root layout 的 metadata。
 * ⚠ 必须 noindex：运营后台（合约管理 / 风险扫描 / 钱包连接）不应被搜索引擎
 *   收录，也不应带营销 OG 卡片。
 */
export const adminMetadata: Metadata = {
  title: "FidesOrigin Admin",
  description: "FidesOrigin operations console.",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * 语言首页的 title/description 单一真源（供 app/[lang]/(home)/page.tsx 使用）。
 * [AUDIT FIX 2026-09-17 R1-023] 此前此处 localeCopy 与 page.tsx 的 HOME_META
 * 是两处真源且文案互相矛盾（page 级覆盖 layout 级，localeCopy 被永久遮蔽）。
 * 现统一到本模块：layout 回退用 localeCopy，首页用 homeMeta。
 */
export const homeMeta: Record<Locale, { title: string; description: string }> = {
  en: {
    title: siteMetadata.title as string,
    description: siteMetadata.description as string,
  },
  cn: {
    title: "FidesOrigin — 实时链上合规",
    description: "原生链上执行的可编程合规。面向稳定币、RWA和AI智能体。",
  },
  tw: {
    title: "FidesOrigin — 可程式化鏈上合規",
    description: "原生鏈上執行的可程式合規。面向穩定幣、RWA和AI智能體。",
  },
  jp: {
    title: "FidesOrigin — プログラマブル・オンチェーン・コンプライアンス",
    description:
      "オンチェーンリスクコントロールエンジン。すべての取引を即時スクリーニングし、疑わしい資金を隔離し、ポリシーを決定論的に実行——オフチェーンへの依存はゼロ。",
  },
};

/** JSON-LD structured data for SEO */
export const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "FidesOrigin",
      url: "https://fidesorigin.com",
      logo: "https://fidesorigin.com/brand/logo-dark-icon.png",
      description:
        "Programmable on-chain compliance protocol for tokenized assets and DeFi.",
    },
    {
      "@type": "WebSite",
      url: "https://fidesorigin.com",
      name: "FidesOrigin",
      /* [AUDIT FIX 2026-09-17 B2-011] 移除 potentialAction SearchAction：
         全站不存在搜索功能，?q= 无消费者——虚假结构化数据可被 Google
         判为 spammy markup。 */
    },
    {
      "@type": "SoftwareApplication",
      name: "FidesOrigin Protocol",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web3",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};
