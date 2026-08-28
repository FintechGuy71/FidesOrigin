"use client";

import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";

/* ================================================================
   FOOTER v2 — Minimal, institutional, quietly authoritative.
   Dictionary-driven; locale-aware links on localized homepages.
   ================================================================ */

export default function Footer({
  lang,
  d,
}: {
  lang: Locale;
  d: Dict["home"]["chrome"];
}) {
  return (
    <footer
      style={{
        background: "var(--fio-ink)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Left */}
          <div className="flex items-center gap-2.5">
          {/* Logo */}
          <img
            src="/brand/logo-dark-icon.png"
            alt="FidesOrigin"
            width="24"
            height="24"
            className="rounded-sm"
            style={{
              background: "rgba(201,169,110,0.06)",
              border: "1px solid rgba(201,169,110,0.12)",
            }}
          />
          <div className="flex flex-col">
              <span
                className="text-sm font-medium leading-none"
                style={{ color: "var(--fio-text)", fontFamily: "var(--font-serif)" }}
              >
                FidesOrigin
              </span>
              <span
                className="text-[0.6rem] tracking-wider"
                style={{ color: "var(--fio-text-4)", fontFamily: "var(--font-mono)" }}
              >
                PROGRAMMABLE COMPLIANCE
              </span>
            </div>
          </div>

          {/* Center links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a
              href={localize("/pricing", lang)}
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.pricing}
            </a>
            <a
              href={`${localize("/docs", lang)}/`}
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.docs}
            </a>
            <a
              href={`${localize("/blog", lang)}/`}
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.blog}
            </a>
            <a
              href={localize("/demo", lang)}
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.demo}
            </a>
            <a
              href="https://github.com/FintechGuy71/FidesOrigin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.github}
            </a>
            <a
              href="mailto:contact@fidesorigin.com"
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.contact}
            </a>
          </div>

          {/* Right */}
          <div
            className="text-xs"
            style={{ color: "var(--fio-text-4)", fontFamily: "var(--font-mono)" }}
          >
            {d.rights}
          </div>
        </div>
      </div>
      <style jsx>{`
        .hover-text-2:hover {
          color: var(--fio-text-2) !important;
        }
        @media (hover: hover) {
          .hover-text-2:hover {
            color: var(--fio-text-2) !important;
          }
        }
      `}</style>
    </footer>
  );
}
