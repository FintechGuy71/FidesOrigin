import { notFound } from "next/navigation";

import HomeChrome from "@/components/home-chrome";
import { isPrefixedLocale } from "@/i18n/locales";

/* Localized new-design homepage chrome (cn/tw/jp). */
export default async function LocalizedHomeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  return <HomeChrome lang={lang}>{children}</HomeChrome>;
}
