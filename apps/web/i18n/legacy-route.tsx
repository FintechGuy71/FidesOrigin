import { notFound } from "next/navigation";
import type { Metadata } from "next";
import LegacyShell from "@/components/legacy/LegacyShell";
import { pageDefs, pageContent } from "./registry";
import { canonicalUrl, hreflangAlternates, type Locale } from "./locales";

/* Shared logic for the legacy catch-all routes (EN root + /[lang]). */

export function legacyStaticParams(locale: Locale): { slug: string[] }[] {
  return Object.entries(pageDefs)
    .filter(([, d]) => d.available.includes(locale))
    .map(([slug]) => ({ slug: slug.split("/") }));
}

/* 博客文章专属 OG 封面（scripts/generate-blog-covers.py 生成） */
const OG_COVER: Record<string, string> = {
  "blog/travel-rule-on-chain": "travel-rule-on-chain",
  "blog/ofac-sanctions-screening-blockchain": "ofac-sanctions-screening-blockchain",
  "blog/hong-kong-stablecoin-license": "hong-kong-stablecoin-license",
  "blog/mica-stablecoin-compliance": "mica-stablecoin-compliance",
  "blog/why-on-chain-compliance": "why-on-chain-compliance",
};

export function legacyMetadata(locale: Locale, slugParts: string[]): Metadata {
  const slug = slugParts.join("/");
  const def = pageDefs[slug];
  if (!def || !def.available.includes(locale)) return {};
  const m = def.meta[locale] ?? def.meta.en ?? { title: "FidesOrigin", description: "" };
  const url = canonicalUrl(`/${slug}`, locale);
  const ogImage = OG_COVER[slug]
    ? `https://fidesorigin.com/brand/covers/${OG_COVER[slug]}.png`
    : "https://fidesorigin.com/brand/og-image.png";
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: hreflangAlternates(`/${slug}`, def.available),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      type: "website",
      url,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      site: "@fidesorigin",
      images: [ogImage],
    },
  };
}

export function renderLegacyPage(locale: Locale, slugParts: string[]) {
  const slug = slugParts.join("/");
  const def = pageDefs[slug];
  const Content = def && def.available.includes(locale) ? pageContent[slug]?.[locale] : undefined;
  if (!def || !Content) notFound();
  const isDocs = slug === "docs" || slug.startsWith("docs/");
  return (
    <LegacyShell
      lang={locale}
      pagePath={`/${slug}`}
      availableLocales={def.available}
      wallet={def.wallet}
      docsFx={isDocs}
    >
      <Content />
    </LegacyShell>
  );
}
