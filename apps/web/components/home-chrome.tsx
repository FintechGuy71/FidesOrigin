"use client";

import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";

/* ================================================================
   HOME CHROME — shared new-design header/footer for all four
   localized homepages (EN at / via (default), cn/tw/jp via (home)).
   AOS 已于 v4 重设计移除（新组件零 data-aos 消费），
   省下 ~29KB CSS + ~15KB JS。
   ================================================================ */

export default function HomeChrome({
  lang,
  children,
}: {
  lang: Locale;
  children: React.ReactNode;
}) {
  const dict = getDictionary(lang);

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[var(--z-skip)] focus:rounded-md focus:bg-[var(--fio-gold)] focus:px-4 focus:py-2 focus:text-[var(--fio-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--fio-gold)]"
      >
        {dict.nav.skip}
      </a>
      {/* 只裁剪横向：overflow-hidden 会让内部任何 position:sticky 失效，
          overflow-x-clip 不创建滚动容器，因此不影响 sticky 与 fixed。 */}
      <div className="flex min-h-screen flex-col overflow-x-clip">
        <Header lang={lang} d={dict.home.chrome} />
        <main id="main-content" className="relative flex grow flex-col">
          {children}
        </main>
        <Footer lang={lang} d={dict.home.chrome} />
      </div>
    </>
  );
}
