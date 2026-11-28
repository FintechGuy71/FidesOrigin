import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { htmlLang, isPrefixedLocale, prefixedLocales } from "@/i18n/locales";
import { fontVariableClassNames } from "../_lib/fonts";
import { jsonLd, localeMetadata } from "../_lib/site";
import "@/css/style.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return isPrefixedLocale(lang) ? localeMetadata(lang) : {};
}

export function generateStaticParams() {
  return prefixedLocales.map((lang) => ({ lang }));
}

export default async function LocaleRootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  return (
    <html lang={htmlLang[lang]} suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.classList.add("js");' }} />
      </head>
      <body className={`${fontVariableClassNames} font-sans antialiased`}>{children}</body>
    </html>
  );
}
