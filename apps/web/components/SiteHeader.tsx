"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import BrandMark from "@/components/BrandMark";
import { getDictionary } from "@/i18n/dictionaries";
import { langNames, langPrefix, langShort, locales, localize, type Locale } from "@/i18n/locales";

type Props = {
  lang: Locale;
  pagePath?: string;
  availableLocales?: readonly Locale[];
  wallet?: boolean;
};

function homeHref(lang: Locale) { return langPrefix(lang) || "/"; }

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

export default function SiteHeader({ lang, pagePath, availableLocales, wallet }: Props) {
  const dict = getDictionary(lang);
  const chrome = dict.home.chrome;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const langButtonRef = useRef<HTMLButtonElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const available = availableLocales ?? locales;
  const langHref = (locale: Locale) => pagePath && available.includes(locale) ? localize(pagePath, locale) : homeHref(locale);
  const links = [
    { href: `${homeHref(lang)}#capabilities`, label: chrome.capabilities },
    { href: localize("/pricing", lang), label: chrome.pricing, path: "/pricing" },
    { href: localize("/docs", lang), label: chrome.docs, path: "/docs" },
    { href: localize("/blog", lang), label: chrome.blog, path: "/blog" },
    { href: localize("/demo", lang), label: chrome.demo, path: "/demo" },
    { href: "https://github.com/FintechGuy71/FidesOrigin", label: chrome.github, external: true },
  ];
  const isActive = (path?: string) => Boolean(path && pagePath && (pagePath === path || pagePath.startsWith(`${path}/`)));

  useEffect(() => {
    let ticking = false;
    const update = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { setScrolled(window.scrollY > 24); ticking = false; });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const onOutside = (event: PointerEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) setLangOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [langOpen]);

  useEffect(() => {
    if (!langOpen && !mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (langOpen) { setLangOpen(false); langButtonRef.current?.focus(); }
        if (mobileOpen) { setMobileOpen(false); mobileButtonRef.current?.focus(); }
        return;
      }
      if (langOpen) {
        const items = Array.from(langRef.current?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]') ?? []);
        const index = items.indexOf(document.activeElement as HTMLAnchorElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          items[(index + delta + items.length) % items.length]?.focus();
        } else if (event.key === "Home") { event.preventDefault(); items[0]?.focus(); }
        else if (event.key === "End") { event.preventDefault(); items[items.length - 1]?.focus(); }
      }
      if (mobileOpen && event.key === "Tab") {
        const focusable = Array.from(mobileRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [langOpen, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileRef.current?.querySelector<HTMLButtonElement>(".site-mobile-close")?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  const renderLink = (link: typeof links[number], mobile = false) => {
    const className = mobile ? "site-mobile-link" : "site-nav-link";
    const active = isActive(link.path);
    if (link.external) return <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={className} onClick={() => setMobileOpen(false)}>{link.label}<ArrowIcon /></a>;
    return <Link key={link.label} href={link.href} prefetch={false} aria-current={active ? "page" : undefined} className={`${className}${active ? " active" : ""}`} onClick={() => setMobileOpen(false)}>{link.label}</Link>;
  };

  return (
    <header className={`site-header nav${scrolled ? " scrolled" : ""}`}>
      <div className="site-header-inner">
        <Link href={homeHref(lang)} className="site-brand">
          <BrandMark />
          <span>FidesOrigin<small>ON-CHAIN COMPLIANCE</small></span>
        </Link>
        <nav className="site-nav" aria-label={dict.nav.mainNav}>{links.map((link) => renderLink(link))}</nav>
        <div className="site-actions">
          <div className="site-language" ref={langRef}>
            <button
              ref={langButtonRef}
              type="button"
              aria-label={`${dict.nav.language}: ${langShort[lang]}`}
              aria-expanded={langOpen}
              aria-haspopup="menu"
              aria-controls="lang-menu"
              onClick={() => {
                const next = !langOpen;
                setLangOpen(next);
                if (next) requestAnimationFrame(() => langRef.current?.querySelector<HTMLAnchorElement>('a[role="menuitem"]')?.focus());
              }}
            >
              {langShort[lang]}<svg viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="m1 2 5 5 5-5" stroke="currentColor" /></svg>
            </button>
            {langOpen && <div id="lang-menu" className="site-language-menu" role="menu" aria-label={dict.nav.language}>
              {locales.map((locale) => <a key={locale} href={langHref(locale)} role="menuitem" aria-current={locale === lang ? "true" : undefined} className={locale === lang ? "active" : undefined} onClick={() => setLangOpen(false)}>{langNames[locale]}</a>)}
            </div>}
          </div>
          {wallet && <div className="wallet-connect-wrap">
            <button className="wallet-btn" id="wallet-btn" aria-label={dict.nav.connect}>{dict.nav.connect}</button>
            <div className="wallet-connected" id="wallet-connected"><div className="wallet-info"><span className="wallet-address" id="wallet-address" /><span className="wallet-network-badge" id="wallet-network">Sepolia</span></div><button className="wallet-disconnect" id="wallet-disconnect" aria-label={dict.nav.disconnect}>{dict.nav.disconnect}</button></div>
          </div>}
          <Link href="/admin/dashboard" prefetch={false} className="site-dashboard">{chrome.dashboard}</Link>
        </div>
        <button ref={mobileButtonRef} type="button" className="site-mobile-toggle" aria-label={dict.nav.toggleMenu} aria-expanded={mobileOpen} aria-controls="mobile-menu" onClick={() => setMobileOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h18M3 17h18" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </div>

      {mobileOpen && <div id="mobile-menu" ref={mobileRef} className="site-mobile" role="dialog" aria-modal="true" aria-label={dict.nav.mobileNav}>
        <div className="site-mobile-head"><span>FidesOrigin / Menu</span><button type="button" className="site-mobile-close" aria-label={dict.nav.closeMenu} onClick={() => { setMobileOpen(false); mobileButtonRef.current?.focus(); }}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" stroke="currentColor" strokeWidth="1.5" /></svg></button></div>
        <nav aria-label={dict.nav.mobileNav}>{links.map((link) => renderLink(link, true))}</nav>
        <Link href="/admin/dashboard" prefetch={false} className="site-mobile-dashboard" onClick={() => setMobileOpen(false)}>{chrome.dashboard}<ArrowIcon /></Link>
        <div className="site-mobile-languages">{locales.map((locale) => <a key={locale} href={langHref(locale)} aria-current={locale === lang ? "true" : undefined}>{langShort[locale]}</a>)}</div>
        {wallet && <div className="site-mobile-wallet"><div className="mobile-wallet-area" id="mobile-wallet-connected"><span id="mobile-wallet-address" /><button id="mobile-wallet-disconnect" aria-label={dict.nav.disconnect}>{dict.nav.disconnect}</button></div><button className="wallet-btn" id="mobile-wallet-btn" aria-label={dict.nav.connect}>{dict.nav.connect}</button></div>}
      </div>}
      {wallet && <Script src="/wallet-connect.js" strategy="afterInteractive" />}
    </header>
  );
}
