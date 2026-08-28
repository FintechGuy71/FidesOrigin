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

export function legacyMetadata(locale: Locale, slugParts: string[]): Metadata {
  const slug = slugParts.join("/");
  const def = pageDefs[slug];
  if (!def || !def.available.includes(locale)) return {};
  const m = def.meta[locale] ?? def.meta.en ?? { title: "FidesOrigin", description: "" };
  const url = canonicalUrl(`/${slug}`, locale);
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
      images: ["https://fidesorigin.com/brand/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      site: "@fidesorigin",
      images: ["https://fidesorigin.com/brand/og-image.png"],
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
