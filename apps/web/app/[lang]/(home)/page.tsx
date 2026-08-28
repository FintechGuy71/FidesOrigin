import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Features from "@/components/Features";
import Hero from "@/components/HeroHome";
import HomeContact from "@/components/HomeContact";
import Testimonials from "@/components/Testimonials";
import Trust from "@/components/Trust";
import Workflows from "@/components/Workflows";
import { getDictionary } from "@/i18n/dictionaries";
import {
  canonicalUrl,
  hreflangAlternates,
  isPrefixedLocale,
  type PrefixedLocale,
} from "@/i18n/locales";

/* Localized homepages: /cn/ /tw/ /jp/ */

const HOME_META: Record<PrefixedLocale, { title: string; description: string }> = {
  cn: {
    title: "FidesOrigin — 实时链上合规",
    description: "原生链上执行的可编程合规。面向稳定币、RWA和AI智能体。",
  },
  tw: {
    title: "FidesOrigin — 可程式化鏈上合規",
    description: "原生鏈上執行的可程式合規。面向穩定幣、RWA和AI智能體。",
  },
  jp: {
    title: "FidesOrigin — プログラマブル・オンチェーン・コンプライアンス",
    description:
      "オンチェーンリスクコントロールエンジン。すべての取引を即時スクリーニングし、疑わしい資金を隔離し、ポリシーを決定論的に実行——オフチェーンへの依存はゼロ。",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) return {};
  const m = HOME_META[lang];
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: canonicalUrl("/", lang),
      languages: hreflangAlternates("/"),
    },
  };
}

export default async function LocalizedHome({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Hero d={dict.home.hero} />
      <Workflows d={dict.home.workflows} />
      <Features d={dict.home.features} />
      <Trust d={dict.home.trust} />
      <Testimonials d={dict.home.journey} />
      <HomeContact d={dict.home.contact} lang={lang} />
    </>
  );
}
