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
      {/* Classic-site fonts (legacy.css references Inter / JetBrains Mono).
          React 19 hoists these <link> elements into <head>. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <a href="#main-content" className="skip-link">
        {dict.nav.skip}
      </a>
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
