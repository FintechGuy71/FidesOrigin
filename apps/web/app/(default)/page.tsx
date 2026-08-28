import type { Metadata } from "next";

import Features from "@/components/Features";
import Hero from "@/components/HeroHome";
import HomeContact from "@/components/HomeContact";
import Testimonials from "@/components/Testimonials";
import Trust from "@/components/Trust";
import Workflows from "@/components/Workflows";
import { getDictionary } from "@/i18n/dictionaries";
import { canonicalUrl, hreflangAlternates } from "@/i18n/locales";

export function generateMetadata(): Metadata {
  return {
    alternates: {
      canonical: canonicalUrl("/", "en"),
      languages: hreflangAlternates("/"),
    },
  };
}

export default function Home() {
  const dict = getDictionary("en");
  return (
    <>
      <Hero d={dict.home.hero} />
      <Workflows d={dict.home.workflows} />
      <Features d={dict.home.features} />
      <Trust d={dict.home.trust} />
      <Testimonials d={dict.home.journey} />
      <HomeContact d={dict.home.contact} lang="en" />
    </>
  );
}
