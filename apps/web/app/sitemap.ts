import type { MetadataRoute } from "next";

import { pageDefs } from "@/i18n/registry";
import { hreflangAlternates, localize, type Locale } from "@/i18n/locales";

/* ================================================================
   SITEMAP — generated from the page registry (replaces the
   hand-maintained public/sitemap.xml).

   ⚠ 两条硬性约束：
   1) URL 一律不带尾斜杠。静态导出未开 trailingSlash，产物是 out/cn.html
      而不是 out/cn/index.html；原先 `push("", l)` 会生成 /cn/，与产物
      路径不一致（站内 canonical/hreflang 用 /cn，sitemap 却用 /cn/）。
   2) 必须输出 hreflang alternates。多语言信号一半在 <head>、一半在
      sitemap；原先 74 条 URL 全无 alternates，等于放弃了一半。
   ================================================================ */

const BASE = "https://fidesorigin.com";
const LOCALES: Locale[] = ["en", "cn", "tw", "jp"];

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const push = (path: string, locale: Locale, priority: number, available?: readonly Locale[]) => {
    // 首页特殊处理：localize("", l) 得到 "/cn" 而不是 "/cn/"。
    // 其余页面走 localize("/slug", l)，不会产生尾斜杠。
    const localized = path === "/" ? (locale === "en" ? "" : `/${locale}`) : localize(path, locale);
    entries.push({
      url: `${BASE}${localized === "" ? "/" : localized}`,
      lastModified: new Date("2026-08-28"),
      changeFrequency: "weekly",
      priority,
      alternates: { languages: hreflangAlternates(path, available) },
    });
  };

  for (const l of LOCALES) push("/", l, 1.0);

  for (const [slug, def] of Object.entries(pageDefs)) {
    for (const l of def.available) {
      push(`/${slug}`, l, slug.startsWith("blog/") ? 0.6 : 0.8, def.available);
    }
  }

  return entries;
}
