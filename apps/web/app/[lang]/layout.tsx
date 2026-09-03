import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";

import { htmlLang, isPrefixedLocale, prefixedLocales } from "@/i18n/locales";

import { fontVariableClassNames } from "../_lib/fonts";
import { jsonLd, localeMetadata } from "../_lib/site";

import "@/css/style.css";

/* ================================================================
   ROOT LAYOUT — 多语言（/cn /tw /jp）

   <html lang> 在此按路由段解析，构建期即可确定，
   不再依赖客户端 LangSetter 在 hydration 之后补写。
   ================================================================ */

/* ⚠ 此前这里直接 `export const metadata = siteMetadata`，导致 /cn /tw /jp
   的 title / description / OG 全是英文。改为按 lang 生成。 */
/* ⚠ Next 15 起 layout/page 的 params 是 Promise，generateMetadata 的签名
   必须与之匹配，否则类型检查报 "missing then/catch/finally"。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isPrefixedLocale(lang) ? localeMetadata(lang) : {};
}

export function generateStaticParams() {
  return prefixedLocales.map((lang) => ({ lang }));
}

export default async function LocaleRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  return (
    /* 同上：scroll-behavior 由 css/fio-design-system.css 的 @layer base 提供 */
    <html lang={htmlLang[lang]}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${fontVariableClassNames} font-sans antialiased`}>
        {children}
        <Script
          defer
          data-domain="fidesorigin.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
