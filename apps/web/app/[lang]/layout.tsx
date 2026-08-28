import { notFound } from "next/navigation";
import { prefixedLocales, isPrefixedLocale } from "@/i18n/locales";

/* Locale segment layout — validates cn/tw/jp and prerenders each. */
export function generateStaticParams() {
  return prefixedLocales.map((lang) => ({ lang }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  return children;
}
