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
      {/* Classic-site fonts. React 19 hoists these <link> elements into <head>.
          ⚠ Inter 已移除：全仓库零处引用（css/legacy.css 的 13 处 font-family
            全部是 var(--font-sans)，而 --font-sans 由 next/font 的 Plus Jakarta
            Sans 提供）。53 个经典站页面每页都下载 Inter 的 5 个字重，纯属浪费。
          ⚠ JetBrains Mono 也已移除：app/_lib/fonts.ts 已自托管同一字体并注入
            --font-mono-nf，CDN 版是第二份下载，且字重/度量可能与自托管版不同。 */}
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
