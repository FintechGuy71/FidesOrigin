"use client";

import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";

/* ================================================================
   HOME CONTACT v4 — final CTA band. Corner-ticked frame,
   direct business line.
   ================================================================ */

export default function HomeContact({
  d,
  lang,
}: {
  d: Dict["home"]["contact"];
  lang: Locale;
}) {
  return (
    <section id="contact" style={{ background: "var(--fio-ink-soft)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="border-t py-24 md:py-32" style={{ borderColor: "var(--fio-border-hairline)" }}>
          <div
            className="fio-ticks relative mx-auto max-w-4xl border px-6 py-16 text-center md:px-16 md:py-24"
            style={{
              borderColor: "var(--fio-border-light)",
              background:
                "radial-gradient(ellipse 70% 60% at 50% 0%, var(--fio-gold-glow) 0%, transparent 65%), var(--fio-surface)",
            }}
          >
            <div className="fio-eyebrow mb-6" style={{ justifyContent: "center" }}>
              {d.caption}
            </div>
            <h2 className="fio-heading-lg mb-6" style={{ color: "var(--fio-text)" }}>
              {d.title}
            </h2>
            <p className="fio-body-lg mx-auto max-w-xl">
              {d.body}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="mailto:contact@fidesorigin.com" className="fio-btn fio-btn-primary group">
                {d.ctaPrimary}
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </a>
              <a href={localize("/docs", lang)} className="fio-btn fio-btn-ghost">
                {d.ctaDocs}
              </a>
            </div>
            <div className="mt-8 font-mono text-xs tracking-wider" style={{ color: "var(--fio-text-3)" }}>
              contact@fidesorigin.com
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
