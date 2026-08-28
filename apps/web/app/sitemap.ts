import type { MetadataRoute } from "next";

import { pageDefs } from "@/i18n/registry";
import { localize, type Locale } from "@/i18n/locales";

/* ================================================================
   SITEMAP — generated from the page registry (replaces the
   hand-maintained public/sitemap.xml).
   ================================================================ */

const BASE = "https://fidesorigin.com";
const LOCALES: Locale[] = ["en", "cn", "tw", "jp"];

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const push = (path: string, locale: Locale, priority: number) => {
    entries.push({
      url: `${BASE}${localize(path, locale)}`,
      lastModified: new Date("2026-08-28"),
      changeFrequency: "weekly",
      priority,
    });
  };

  for (const l of LOCALES) push("", l, 1.0);

  for (const [slug, def] of Object.entries(pageDefs)) {
    for (const l of def.available) {
      push(`/${slug}`, l, slug.startsWith("blog/") ? 0.6 : 0.8);
    }
  }

  return entries;
}
