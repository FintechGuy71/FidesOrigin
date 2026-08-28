import type { Metadata } from "next";
import {
  legacyMetadata,
  legacyStaticParams,
  renderLegacyPage,
} from "@/i18n/legacy-route";
import { isPrefixedLocale } from "@/i18n/locales";
import { notFound } from "next/navigation";

/* Localized legacy pages: /cn/pricing, /jp/docs/api, /tw/blog/..., etc. */

export const dynamicParams = false;

export function generateStaticParams({
  params: { lang },
}: {
  params: { lang: string };
}) {
  if (!isPrefixedLocale(lang)) return [];
  return legacyStaticParams(lang);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isPrefixedLocale(lang)) return {};
  return legacyMetadata(lang, slug);
}

export default async function LegacyLocalizedPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const { lang, slug } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  return renderLegacyPage(lang, slug);
}
