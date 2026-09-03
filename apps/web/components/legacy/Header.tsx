"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import {
  Locale,
  locales,
  langNames,
  langShort,
  langPrefix,
  localize,
} from "@/i18n/locales";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   LEGACY HEADER — unified classic-site navigation, dictionary-driven
   across all four locales. The wallet cluster renders only on pages
   with real on-chain interaction (address-check).
   ================================================================ */

/* ⚠ 全站 URL 一律不带尾斜杠：静态导出未开 trailingSlash，产物是
   out/cn.html / out/docs.html，而不是 out/cn/index.html / out/docs/index.html。
   EN 的前缀是空串，必须显式回退到 "/"。 */
function homeHref(lang: Locale): string {
  return langPrefix(lang) || "/";
}

type Props = {
  lang: Locale;
  dict: Dict;
  /** Current page path without locale prefix, e.g. "/pricing" */
  pagePath: string;
  /** Locales where this page exists; others fall back to locale home */
  availableLocales?: readonly Locale[];
  /** Render the wallet connect cluster (address-check only) */
  wallet?: boolean;
};

export default function LegacyHeader({ lang, dict, pagePath, availableLocales, wallet }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const prefix = langPrefix(lang);
  const available = availableLocales ?? locales;

  /* 该语言没有此页时回退到该语言首页。⚠ 不能写 langPrefix(l) + "/"。 */
  const langHref = (l: Locale) =>
    available.includes(l) ? localize(pagePath, l) : homeHref(l);

  const links = [
    { href: `${homeHref(lang)}#features`, label: dict.nav.features },
    { href: localize("/use-cases/stablecoin-compliance", lang), label: dict.nav.useCases },
    { href: localize("/pricing", lang), label: dict.nav.pricing },
    { href: localize("/docs", lang), label: dict.nav.docs },
    { href: localize("/blog", lang), label: dict.nav.blog },
  ];

  // EN has a dedicated /contact page; other locales jump to the
  // localized homepage contact section.
  const ctaHref = lang === "en" ? "/contact" : `${homeHref(lang)}#contact`;

  /* 移动菜单：Esc 关闭 + 打开时锁滚动。
     该菜单是常驻 DOM 的 role="dialog" aria-modal="true"（靠 .active 显隐），
     此前没有任何键盘关闭路径，键盘用户被困在里面。 */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const walletSvg = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 7h1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13v2M19 7V5M19 7h-5.5a1.5 1.5 0 0 0 0 3H19" />
    </svg>
  );

  return (
    <>
      <nav className="nav" aria-label={dict.nav.mainNav}>
        <div className="nav-inner">
          <a href={homeHref(lang)} className="nav-logo">
            <img
              src="/brand/logo-dark-icon.png"
              alt="FidesOrigin"
              className="nav-logo-icon"
              width={28}
              height={28}
            />
            FidesOrigin
          </a>
          <div className="nav-left">
            {links.map((l) => (
              <a key={l.href + l.label} href={l.href}>
                {l.label}
              </a>
            ))}
          </div>
          <div className="nav-actions">
            <div className="lang-dropdown">
              <button
                id="langToggleBtn"
                aria-label={dict.nav.language}
                aria-expanded={langOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setLangOpen(!langOpen);
                }}
              >
                {langShort[lang]}
                <svg className="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {/* ⚠ legacy.css 里曾有 `#langMenu a:first-child { color: var(--accent) }`，
                  无条件高亮第一项（English）。在 /cn /tw /jp 页面上会显示
                  "当前语言 = English" 的错误状态。改为按当前 lang 打 .active，
                  CSS 同步改为 `.active`（见 css/legacy.css）。 */}
              <div id="langMenu" style={{ display: langOpen ? "block" : "none" }}>
                {locales.map((l) => (
                  <a
                    key={l}
                    href={langHref(l)}
                    className={l === lang ? "active" : undefined}
                    aria-current={l === lang ? "true" : undefined}
                    onClick={() => setLangOpen(false)}
                  >
                    {langNames[l]}
                  </a>
                ))}
              </div>
            </div>
            <div className="nav-divider"></div>
            {wallet && (
              <div className="wallet-connect-wrap">
                <button className="wallet-btn" id="wallet-btn" aria-label={dict.nav.connect}>
                  {walletSvg}
                  {dict.nav.connect}
                </button>
                <div className="wallet-connected" id="wallet-connected">
                  <div className="wallet-info">
                    <span className="wallet-address" id="wallet-address"></span>
                    <span className="wallet-network-badge" id="wallet-network">
                      Sepolia
                    </span>
                  </div>
                  <button className="wallet-disconnect" id="wallet-disconnect" aria-label={dict.nav.disconnect}>
                    {dict.nav.disconnect}
                  </button>
                </div>
              </div>
            )}
            <a href={ctaHref} className="nav-cta">
              {dict.nav.getStarted}
            </a>
          </div>
          <button
            className="nav-mobile-btn"
            aria-label={dict.nav.toggleMenu}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`mobile-menu${mobileOpen ? " active" : ""}`}
        id="mobileMenu"
        role="dialog"
        aria-modal="true"
        aria-label={dict.nav.mobileNav}
        /* 关闭时对读屏与 Tab 序隐藏：该节点常驻 DOM，仅靠 .active 控制显隐 */
        aria-hidden={mobileOpen ? undefined : "true"}
      >
        <button
          type="button"
          className="mobile-menu-close"
          aria-label={dict.nav.closeMenu}
          onClick={() => setMobileOpen(false)}
        >
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
        {links.map((l) => (
          <a key={l.href + l.label} href={l.href} onClick={() => setMobileOpen(false)}>
            {l.label}
          </a>
        ))}
        <div className="lang-row">
          {locales.map((l) => (
            <a key={l} href={langHref(l)}>
              {langShort[l]}
            </a>
          ))}
        </div>
        {wallet && (
          <>
            <div className="mobile-wallet-area" id="mobile-wallet-connected">
              <span id="mobile-wallet-address"></span>
              <button id="mobile-wallet-disconnect" aria-label={dict.nav.disconnect}>
                {dict.nav.disconnect}
              </button>
            </div>
            <button className="wallet-btn" id="mobile-wallet-btn" aria-label={dict.nav.connect}>
              {walletSvg}
              {dict.nav.connect}
            </button>
          </>
        )}
      </div>

      {/* Close lang menu on outside click
          原 zIndex: 998 低于 .nav 的 1000，导致点击导航栏区域无法关闭菜单，
          且与 .scroll-top 撞值。改用层级令牌 --z-backdrop(55)：
          高于 --z-nav(50)、低于 --z-dropdown(60)，
          既盖住导航栏，又不会盖住菜单本身。 */}
      {langOpen && (
        <div
          className="fixed inset-0 z-[var(--z-backdrop)]"
          aria-hidden="true"
          onClick={() => setLangOpen(false)}
        />
      )}

      {/* Wallet connect behavior (self-hosted, lazy-loads ethers on demand) */}
      {wallet && <Script src="/wallet-connect.js" strategy="afterInteractive" />}
    </>
  );
}
