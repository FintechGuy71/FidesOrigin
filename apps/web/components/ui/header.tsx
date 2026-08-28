"use client";

import { useState } from "react";

import Link from "next/link";

import type { Dict } from "@/i18n/dictionaries/en";
import { langPrefix, localize, type Locale } from "@/i18n/locales";

/* ================================================================
   HEADER v2 — Minimal, institutional, with quiet confidence.
   Dictionary-driven; locale-aware links on localized homepages.
   ================================================================ */

export default function Header({
  lang,
  d,
}: {
  lang: Locale;
  d: Dict["home"]["chrome"];
}) {
  const prefix = langPrefix(lang);
  const navLinks = [
    { href: `${prefix}/#capabilities`, label: d.capabilities },
    { href: localize("/pricing", lang), label: d.pricing },
    { href: `${localize("/docs", lang)}/`, label: d.docs },
    { href: `${localize("/blog", lang)}/`, label: d.blog },
    { href: localize("/demo", lang), label: d.demo },
    { href: "https://github.com/FintechGuy71/FidesOrigin", label: d.github, external: true },
  ];

  const langLinks = [
    { href: "/", label: "English", short: "EN" },
    { href: "/cn/", label: "简体中文", short: "CN" },
    { href: "/tw/", label: "繁體中文", short: "TW" },
    { href: "/jp/", label: "日本語", short: "JP" },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const mobileMenuId = "mobile-menu";

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50"
      style={{
        background: "rgba(7, 8, 16, 0.8)",
        backdropFilter: "blur(24px) saturate(1.2)",
        WebkitBackdropFilter: "blur(24px) saturate(1.2)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href={`${prefix}/`} className="flex items-center gap-2.5">
          <img
            src="/brand/logo-dark-icon.png"
            alt="FidesOrigin"
            width="28"
            height="28"
            className="rounded-sm"
          />
          <div className="flex flex-col">
            <span 
              className="text-sm font-medium tracking-tight leading-none" 
              style={{ color: "var(--fio-text)", fontFamily: "var(--font-serif)" }}
            >
              FidesOrigin
            </span>
            <span 
              className="text-[0.65rem] tracking-wider" 
              style={{ color: "var(--fio-text-3)", fontFamily: "var(--font-mono)" }}
            >
              ON-CHAIN COMPLIANCE
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                style={{ color: "var(--fio-text-2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fio-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fio-text-2)")}
              >
                {link.label}
              </a>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                style={{ color: "var(--fio-text-2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fio-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fio-text-2)")}
              >
                {link.label}
              </a>
            )
          )}
          {/* Language dropdown */}
          <div className="relative ml-2">
            <button
              onClick={() => setLangOpen(!langOpen)}
              aria-label="Language"
              aria-expanded={langOpen}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              style={{ color: "var(--fio-text-2)" }}
            >
              {lang.toUpperCase()}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {langOpen && (
              <div
                className="absolute right-0 top-full mt-1 min-w-[120px] rounded-md border py-1"
                style={{
                  background: "rgba(7,8,16,0.97)",
                  borderColor: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                }}
              >
                {langLinks.map((l) => (
                  <a
                    key={l.short}
                    href={l.href}
                    className="block px-4 py-2 text-sm transition-colors hover:bg-white/5"
                    style={{ color: "var(--fio-text-2)" }}
                    onClick={() => setLangOpen(false)}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <a
            href="/admin/dashboard"
            className="ml-3 rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            style={{
              background: "rgba(201,169,110,0.06)",
              color: "var(--fio-gold)",
              border: "1px solid rgba(201,169,110,0.12)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(201,169,110,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(201,169,110,0.06)";
            }}
          >
            {d.dashboard}
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md md:hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          style={{ color: "var(--fio-text-2)", minHeight: "44px", minWidth: "44px" }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={d.toggleMenu}
          aria-expanded={mobileOpen}
          aria-controls={mobileMenuId}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id={mobileMenuId}
          role="navigation"
          className="border-t px-4 py-4 md:hidden"
          style={{
            background: "rgba(7,8,16,0.95)",
            borderColor: "rgba(255,255,255,0.04)",
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="block rounded-md px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              style={{ color: "var(--fio-text-2)" }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/admin/dashboard"
            className="mt-2 block rounded-md px-3 py-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            style={{ color: "var(--fio-gold)" }}
            onClick={() => setMobileOpen(false)}
          >
            {d.dashboard} →
          </a>
          <div
            className="mt-3 flex items-center gap-1 border-t pt-3"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            {langLinks.map((l) => (
              <a
                key={l.short}
                href={l.href}
                className="rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                style={{ color: "var(--fio-text-3)" }}
                onClick={() => setMobileOpen(false)}
              >
                {l.short}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
