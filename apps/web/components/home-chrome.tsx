"use client";

import { useEffect } from "react";

import AOS from "aos";
/* ⚠ 不要在这里 import "aos/dist/aos.css"。
   CSS 级联层规则是「未分层声明 > 任何层内声明，与特异性无关」。
   组件内 import 的第三方 CSS 会以 unlayered 形式进入产物（实测 28.7 KB、
   @layer 计数 0），且加载顺序在主样式表之前，会压掉 Tailwind 的
   transition-* / opacity-* / transform-* 全部工具类 —— 与历史上
   legacy.css 未分层是同一个根因，只是换了个文件。
   AOS 样式已由 css/style.css 的 `@import 'aos/dist/aos.css' layer(legacy)`
   统一引入。 */

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
  /* 必须带依赖数组：原先无依赖，每次重渲染都重新 AOS.init()，
     反复注册 scroll/resize 监听与 MutationObserver，并再次改写
     data-aos-* DOM 属性（React 渲染树之外的直接 DOM 变更）。 */
  /* 依赖数组必须带 lang：语言切换后 DOM 结构变化，需要重新初始化。
     cleanup 里不能调用 AOS.refreshHard() —— 它是「重新扫描并重建」而非销毁，
     在卸载后对已删除节点做全量重扫，反而是副作用。AOS 没有 destroy API，
     其 scroll/resize 监听随页面生命周期结束自然回收。 */
  useEffect(() => {
    AOS.init({
      once: true,
      /* 同时尊重系统「减少动态效果」偏好：disable 接受布尔或返回布尔的函数 */
      disable: () =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      duration: 600,
      easing: "ease-out-sine",
    });
  }, [lang]);

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
