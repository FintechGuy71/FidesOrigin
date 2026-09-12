import LegacyHeader from "./Header";
import LegacyFooter from "./Footer";
import LegacyFx from "./LegacyFx";
import DocsFx from "./DocsFx";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";

/* ================================================================
   LEGACY SHELL — classic-site chrome around a migrated page:
   Google Fonts links (React 19 hoists <link> to <head>), skip link,
   header, <main>, footer, scroll effects.
   ================================================================ */

type Props = {
  lang: Locale;
  /** Current page path without locale prefix, e.g. "/pricing" */
  pagePath: string;
  availableLocales?: readonly Locale[];
  wallet?: boolean;
  /** Enable docs-page interactions (sidebar toggle, code copy) */
  docsFx?: boolean;
  children: React.ReactNode;
};

export default function LegacyShell({ lang, pagePath, availableLocales, wallet, docsFx, children }: Props) {
  const dict = getDictionary(lang);
  return (
    <>
      {/* 经典站字体不走 CDN <link>：统一由 next/font 自托管
          （app/_lib/fonts.ts 注入 --font-sans-nf / --font-mono-nf），
          css/legacy.css 的 font-family 全部消费 var(--font-sans) / var(--font-mono)。
          ⚠ Inter 已移除：全仓库零处引用，53 个经典站页面每页白白下载 5 个字重。
          ⚠ JetBrains Mono 也已移除：与自托管版重复下载，字重/度量还可能不一致。
          [AUDIT FIX R2-061] 各页面级 CSS 由页面内联
          <style precedence="legacy-page">@layer legacy{…} 提供。其层叠优先级由
          css/style.css 顶部的 @layer 顺序声明统一固定，与 <style> 标签最终落在
          head 还是 body 无关——因此不依赖、也不应假设 React 的 hoisting 行为
          （实测 React 19 下无 href 的 precedence style 仍渲染在 body，层序不受影响）。 */}
      <a href="#main-content" className="skip-link">
        {dict.nav.skip}
      </a>
      {/* .reveal 的基础态是 opacity:0，完全依赖 LegacyFx 的 IntersectionObserver
          加 .visible 才可见。JS 被禁用 / 水合失败 / 打印时整页内容空白。
          noscript 兜底直接把初始态改回可见（不影响 JS 可用时的滚动动画）。 */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>
      <LegacyHeader
        lang={lang}
        dict={dict}
        pagePath={pagePath}
        availableLocales={availableLocales}
        wallet={wallet}
      />
      <main id="main-content">{children}</main>
      <LegacyFooter lang={lang} dict={dict} />
      <LegacyFx scrollTopLabel={dict.nav.scrollTop} />
      {docsFx && <DocsFx copyLabel={dict.docs.copy} copiedLabel={dict.docs.copied} />}
    </>
  );
}
