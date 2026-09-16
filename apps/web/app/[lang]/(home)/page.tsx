import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Features from "@/components/Features";
import Hero from "@/components/HeroHome";
import HomeContact from "@/components/HomeContact";
import Segments from "@/components/Segments";
import Testimonials from "@/components/Testimonials";
import Trust from "@/components/Trust";
import Workflows from "@/components/Workflows";
import { getDictionary } from "@/i18n/dictionaries";
import {
  canonicalUrl,
  hreflangAlternates,
  isPrefixedLocale,
} from "@/i18n/locales";
/* [AUDIT FIX 2026-09-17 R1-023] 首页 title/description 单一真源收口到
   app/_lib/site.ts 的 homeMeta（原 HOME_META 与 site.ts localeCopy 双真源
   且文案互相矛盾）。 */
import { homeMeta } from "@/app/_lib/site";

/* Localized homepages: /cn/ /tw/ /jp/ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) return {};
  const m = homeMeta[lang];
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: canonicalUrl("/", lang),
      languages: hreflangAlternates("/"),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      type: "website",
      url: canonicalUrl("/", lang),
      images: ["https://fidesorigin.com/brand/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      site: "@fidesorigin",
      images: ["https://fidesorigin.com/brand/og-image.png"],
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
      <Hero d={dict.home.hero} lang={lang} />
      <Workflows d={dict.home.workflows} />
      <Features d={dict.home.features} />
      <Segments d={dict.home.segments} />
      <Trust d={dict.home.trust} />
      <Testimonials d={dict.home.journey} />
      <HomeContact d={dict.home.contact} lang={lang} />
    </>
  );
}
