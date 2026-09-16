import type { MetadataRoute } from "next";

import { pageDefs } from "@/i18n/registry";
import { hreflangAlternates, localize, type Locale } from "@/i18n/locales";

/* ================================================================
   SITEMAP — generated from the page registry (replaces the
   hand-maintained public/sitemap.xml).

   ⚠ 两条硬性约束：
   1) URL 一律不带尾斜杠。静态导出未开 trailingSlash，产物是 out/cn.html
      而不是 out/cn/index.html。2026-09-17 起 localize("/", l) 已修复为
      无尾斜杠，sitemap、canonical、hreflang 三方口径一致（均为 /cn）。
   2) 必须输出 hreflang alternates。多语言信号一半在 <head>、一半在
      sitemap；原先 74 条 URL 全无 alternates，等于放弃了一半。
   ================================================================ */

const BASE = "https://fidesorigin.com";
const LOCALES: Locale[] = ["en", "cn", "tw", "jp"];

export const dynamic = "force-static";

/* [AUDIT FIX R2-054] changeFrequency 按页面类型区分，不再全站 weekly：
   首页/产品页内容相对稳定（monthly），博客文章发布后基本不再改动（yearly），
   法务页（privacy/terms）极少变更（yearly）。 */
function changeFreqFor(slug: string): "daily" | "weekly" | "monthly" | "yearly" {
  if (slug === "/") return "weekly";
  if (slug.startsWith("blog")) return "yearly";
  if (slug === "privacy" || slug === "terms") return "yearly";
  if (slug === "changelog") return "weekly";
  return "monthly";
}

/* [AUDIT FIX R2-054] lastModified 按页维护，不再全站硬编码同一天。
   博客文章用其真实发布月份（与 blog 索引卡片日期一致）；
   法务页用保守的固定日期；其余页面回退到构建期当前日期。
   ⚠ 静态导出下该值随每次构建冻结，但至少各页之间不再雷同、
   且博客/法务页反映真实更新节奏，避免 Google 因 lastmod 恒定不变而降权。 */
const BLOG_LASTMOD: Record<string, string> = {
  "blog/why-on-chain-compliance": "2026-06-15",
  "blog/hong-kong-stablecoin-license": "2026-07-10",
  "blog/mica-stablecoin-compliance": "2026-07-18",
  "blog/ofac-sanctions-screening-blockchain": "2026-07-25",
  "blog/travel-rule-on-chain": "2026-08-05",
};
const LEGAL_LASTMOD = "2026-01-01";

/* [FOLLOW-UP T3] 非博客/法务页的 lastModified 由「构建时刻 new Date()」改为
   读取对应内容源文件（components/legacy/pages/<slug>.en.tsx）的 mtime。
   ⚠ 诚实声明效果边界：本优化只在本地/保留 mtime 的构建环境生效；
   在 Vercel/CI 上 git checkout 会把所有文件 mtime 统一为检出时刻，
   此时退化为「全站同一时刻」（与原 new Date() 等价，不更差也不更好）。
   博客页（真实发布日期表）与法务页（保守固定日期）的区分不受此影响——
   那两类才是 sitemap 分级的实际价值所在。读文件失败回退构建时刻，不中断构建。 */
function contentFileMtime(slug: string): Date | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    const file = path.join(
      process.cwd(),
      "components/legacy/pages",
      `${slug.replace(/\//g, "-")}.en.tsx`
    );
    return fs.statSync(file).mtime;
  } catch {
    return null;
  }
}

function lastModFor(slug: string): Date {
  if (slug.startsWith("blog/") && BLOG_LASTMOD[slug]) return new Date(BLOG_LASTMOD[slug]);
  if (slug === "blog") return new Date("2026-08-05");
  if (slug === "privacy" || slug === "terms") return new Date(LEGAL_LASTMOD);
  return contentFileMtime(slug) || new Date();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const push = (path: string, locale: Locale, priority: number, available?: readonly Locale[]) => {
    /* [AUDIT FIX 2026-09-17 R1-005/B2-002] localize("/", l) 已修复为无尾斜杠
       （"/cn" 而非 "/cn/"），sitemap 的 <loc>、xhtml:link 与页面 canonical/
       hreflang 现为同一 URL，首页特判随之简化为直接调 localize。 */
    const localized = localize(path, locale);
    // slug 键：首页用 "/"，其余去掉前导斜杠以匹配 BLOG_LASTMOD 等表
    const slugKey = path === "/" ? "/" : path.replace(/^\//, "");
    entries.push({
      url: `${BASE}${localized === "" ? "/" : localized}`,
      lastModified: lastModFor(slugKey),
      changeFrequency: changeFreqFor(slugKey),
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
