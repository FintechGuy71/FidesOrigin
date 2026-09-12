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

/* [AUDIT FIX R2-070] generateStaticParams 是构建期 API，Next 15 规范就是
   同步 params 对象（非 Promise）——与下方 generateMetadata/page 的
   Promise 签名不同属正常，并非风格漂移。显式注释防止后续维护者
   "顺手统一"成 await 形式导致构建失败。 */
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
