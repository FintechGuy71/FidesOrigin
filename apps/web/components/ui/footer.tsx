"use client";

/* ================================================================
   FOOTER v2 — Minimal, institutional, quietly authoritative.
   ================================================================ */

export default function Footer() {
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
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/FintechGuy71/FidesOrigin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              GitHub
            </a>
            <a
              href="mailto:contact@fidesorigin.com"
              className="text-sm transition-colors hover-text-2"
              style={{ color: "var(--fio-text-3)" }}
            >
              Contact
            </a>
          </div>

          {/* Right */}
          <div
            className="text-xs"
            style={{ color: "var(--fio-text-4)", fontFamily: "var(--font-mono)" }}
          >
            © 2026 FidesOrigin. MIT License.
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
