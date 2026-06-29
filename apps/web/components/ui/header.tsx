"use client";

import { useState } from "react";
import Link from "next/link";

/* ================================================================
   HEADER v2 — Minimal, institutional, with quiet confidence.
   ================================================================ */

const navLinks = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#features", label: "Features" },
  { href: "https://github.com/FintechGuy71/FidesOrigin", label: "GitHub", external: true },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-sm"
            style={{
              background: "rgba(201,169,110,0.08)",
              border: "1px solid rgba(201,169,110,0.15)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="var(--fio-gold)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
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
                className="rounded-md px-3 py-1.5 text-sm transition-colors"
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
                className="rounded-md px-3 py-1.5 text-sm transition-colors"
                style={{ color: "var(--fio-text-2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fio-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fio-text-2)")}
              >
                {link.label}
              </a>
            )
          )}
          <a
            href="/admin/dashboard"
            className="ml-3 rounded-md px-4 py-1.5 text-sm font-medium transition-all"
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
            Dashboard
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md md:hidden"
          style={{ color: "var(--fio-text-2)", minHeight: "44px", minWidth: "44px" }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
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
              className="block rounded-md px-3 py-2.5 text-sm"
              style={{ color: "var(--fio-text-2)" }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/admin/dashboard"
            className="mt-2 block rounded-md px-3 py-2.5 text-sm font-medium"
            style={{ color: "var(--fio-gold)" }}
            onClick={() => setMobileOpen(false)}
          >
            Dashboard →
          </a>
        </div>
      )}
    </header>
  );
}
