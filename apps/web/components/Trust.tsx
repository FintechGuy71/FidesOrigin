"use client";

import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   TRUST v4 — Regulatory coverage band + institutional quote.
   ================================================================ */

export default function Trust({ d }: { d: Dict["home"]["trust"] }) {
  const badges = [
    { label: d.badge1Label, status: d.badge1Status },
    { label: d.badge2Label, status: d.badge2Status },
    { label: d.badge3Label, status: d.badge3Status },
    { label: d.badge4Label, status: d.badge4Status },
  ];
  const coverage = [d.coverage1, d.coverage2, d.coverage3, d.coverage4];
  return (
    <section id="security" style={{ background: "var(--fio-ink-soft)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="py-24 md:py-32">
          {/* Coverage band */}
          <div className="mb-20 text-center">
            <div className="fio-eyebrow mb-8 justify-center" style={{ justifyContent: "center" }}>
              {d.coverageCaption}
            </div>
            <div className="grid grid-cols-2 gap-px md:grid-cols-4" style={{ background: "var(--fio-border-hairline)", border: "1px solid var(--fio-border-hairline)" }}>
              {coverage.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-center px-4 py-6 text-center"
                  style={{ background: "var(--fio-ink-soft)" }}
                >
                  <span className="font-mono text-xs tracking-wider" style={{ color: "var(--fio-text-2)" }}>
                    {c}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Capability badges */}
          <div className="mb-20 flex flex-wrap items-center justify-center gap-3">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2.5 border px-4 py-2.5"
                style={{
                  borderColor: "var(--fio-border-light)",
                  background: "var(--fio-surface)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "var(--fio-gold)",
                    boxShadow: "0 0 6px var(--fio-gold-dim)",
                  }}
                />
                <span className="text-xs font-medium" style={{ color: "var(--fio-text-2)" }}>
                  {badge.label}
                </span>
                <span className="bg-[var(--fio-gold-dim)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--fio-gold)]">
                  {badge.status}
                </span>
              </div>
            ))}
          </div>

          {/* Big quote */}
          <div className="mx-auto max-w-3xl text-center">
            <div
              aria-hidden="true"
              className="mb-8 font-serif text-6xl leading-none"
              style={{ color: "var(--fio-gold)", opacity: 0.25 }}
            >
              &ldquo;
            </div>
            <p className="mb-8 font-serif text-xl leading-relaxed sm:text-2xl" style={{ color: "var(--fio-text)", fontStyle: "normal" }}>
              {d.quote}
            </p>
            <div className="flex items-center justify-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--fio-gold-dim)] bg-[var(--fio-gold-glow)] text-xs font-medium text-[var(--fio-gold)]"
              >
                {d.quoteName.slice(0, 1)}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: "var(--fio-text)" }}>
                  {d.quoteName}
                </div>
                <div className="text-xs" style={{ color: "var(--fio-text-3)" }}>{d.quoteRole}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
