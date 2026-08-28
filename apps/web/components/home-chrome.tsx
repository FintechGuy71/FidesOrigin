"use client";

import { useEffect } from "react";

import AOS from "aos";
import "aos/dist/aos.css";

import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";

/* ================================================================
   HOME CHROME — shared new-design header/AOS/footer for all four
   localized homepages (EN at / via (default), cn/tw/jp via (home)).
   ================================================================ */

export default function HomeChrome({
  lang,
  children,
}: {
  lang: Locale;
  children: React.ReactNode;
}) {
  useEffect(() => {
    AOS.init({
      once: true,
      disable: "phone",
      duration: 600,
      easing: "ease-out-sine",
    });
  });

  const dict = getDictionary(lang);

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {dict.nav.skip}
      </a>
      <div className="flex min-h-screen flex-col overflow-hidden supports-[overflow:clip]:overflow-clip">
        <Header lang={lang} d={dict.home.chrome} />
        <main id="main-content" className="relative flex grow flex-col">
          {children}
        </main>
        <Footer lang={lang} d={dict.home.chrome} />
      </div>
    </>
  );
}
