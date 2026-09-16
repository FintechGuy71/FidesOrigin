/* ================================================================
   i18n locales — single source of truth for language routing.
   EN is the default locale and lives at the unprefixed root;
   cn/tw/jp live under their path prefixes.
   ================================================================ */

export const locales = ["en", "cn", "tw", "jp"] as const;
export type Locale = (typeof locales)[number];

export const prefixedLocales = ["cn", "tw", "jp"] as const;
export type PrefixedLocale = (typeof prefixedLocales)[number];

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}

export function isPrefixedLocale(v: string): v is PrefixedLocale {
  return (prefixedLocales as readonly string[]).includes(v);
}

/** <html lang> attribute value per locale */
export const htmlLang: Record<Locale, string> = {
  en: "en",
  cn: "zh-CN",
  tw: "zh-TW",
  jp: "ja",
};

/** hreflang code per locale */
export const hreflangCode: Record<Locale, string> = {
  en: "en",
  cn: "zh-CN",
  tw: "zh-TW",
  jp: "ja",
};

/** Human-readable language names (used in the language switcher) */
export const langNames: Record<Locale, string> = {
  en: "English",
  cn: "简体中文",
  tw: "繁體中文",
  jp: "日本語",
};

/** Short labels for compact switchers */
export const langShort: Record<Locale, string> = {
  en: "EN",
  cn: "CN",
  tw: "TW",
  jp: "JP",
};

/** URL path prefix for a locale ("" for EN) */
export function langPrefix(locale: Locale): string {
  return locale === "en" ? "" : `/${locale}`;
}

/** Build a localized path: localize("pricing", "cn") -> "/cn/pricing" */
export function localize(path: string, locale: Locale): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  /* [AUDIT FIX 2026-09-17 R1-005/B2-002] 语言首页三方口径冲突：
     原实现 localize("/", "cn") = "/cn/"（带尾斜杠），而 vercel.json 把 /cn/
     307 到 /cn、sitemap 的 <loc> 也用 /cn —— canonical/hreflang 指向会跳转的
     URL。统一为无尾斜杠：path="/" 时返回 "/cn"（EN 为 "/"）。 */
  if (p === "/") return langPrefix(locale) || "/";
  return `${langPrefix(locale)}${p}`;
}

const SITE = "https://fidesorigin.com";

/** Absolute canonical URL for a localized path */
export function canonicalUrl(path: string, locale: Locale): string {
  const p = localize(path, locale);
  return `${SITE}${p === "" ? "/" : p}`;
}

/**
 * hreflang alternates for a path.
 *
 * [AUDIT FIX R2-021] EN-only 页（contact / case-studies）此前把 cn/tw/jp 的
 * hreflang 回退指向各语言首页，而首页的 hreflang 组只包含首页自身——
 * 形成非对称 hreflang 组（Google 会忽略整个组，等于白声明）。
 * 改为：页面不存在的语言【直接不声明】，组内只保留真实存在的对应版本
 * （EN-only 页输出 en + x-default）。hreflang 的原则是"组内互相指认"，
 * 少声明优于错声明。语言切换器的首页回退（UI 行为）不受影响。
 */
export function hreflangAlternates(
  path: string,
  available: readonly Locale[] = locales
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) {
    if (!available.includes(l)) continue;
    const target = localize(path, l);
    out[hreflangCode[l]] = `${SITE}${target === "" ? "/" : target}`;
  }
  out["x-default"] = `${SITE}${path === "/" ? "/" : path}`;
  return out;
}
