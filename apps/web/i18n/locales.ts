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
  return `${langPrefix(locale)}${p}`;
}

const SITE = "https://fidesorigin.com";

/** Absolute canonical URL for a localized path */
export function canonicalUrl(path: string, locale: Locale): string {
  const p = localize(path, locale);
  return `${SITE}${p === "" ? "/" : p}`;
}

/**
 * hreflang alternates for a path. Falls back to the locale homepage
 * for locales where the page does not exist (EN-only pages).
 */
export function hreflangAlternates(
  path: string,
  available: readonly Locale[] = locales
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) {
    /* 回退到该语言首页。⚠ 不能写成 langPrefix(l) + "/" —— 静态导出未开
       trailingSlash，产物是 out/cn.html 而不是 out/cn/index.html，
       带尾斜杠的 URL 会 404。EN 的前缀是空串，必须显式回退到 "/"。 */
    const target = available.includes(l) ? localize(path, l) : langPrefix(l) || "/";
    out[hreflangCode[l]] = `${SITE}${target === "" ? "/" : target}`;
  }
  out["x-default"] = `${SITE}${path === "/" ? "/" : path}`;
  return out;
}
