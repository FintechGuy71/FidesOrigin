"use client";

import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   WORKFLOWS v4 — Compliance blueprint. Numbered technical columns,
   hairline connectors, mono metadata.
   ================================================================ */

export default function Workflows({ d }: { d: Dict["home"]["workflows"] }) {
  const flowSteps = [
    { id: "risk", num: "01", label: d.step1Label, sub: d.step1Sub },
    { id: "engine", num: "02", label: d.step2Label, sub: d.step2Sub },
    { id: "chain", num: "03", label: d.step3Label, sub: d.step3Sub },
  ];
  return (
    <section id="capabilities" style={{ background: "var(--fio-ink-soft)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="py-28 md:py-36">
          {/* Section header — left-aligned editorial grid */}
          <div className="grid gap-10 pb-16 md:grid-cols-12 md:pb-24">
            <div className="md:col-span-6">
              <div className="fio-eyebrow mb-5">{d.caption}</div>
              <h2 className="fio-heading-lg" style={{ color: "var(--fio-text)" }}>
                {d.title}
              </h2>
            </div>
            <div className="flex items-end md:col-span-5 md:col-start-8">
              <p className="fio-body-lg">{d.body}</p>
            </div>
          </div>

          {/* Pipeline — numbered technical columns */}
          <div className="relative">
            {/* Connecting hairline (desktop) */}
            <div
              aria-hidden="true"
              className="absolute left-0 top-6 hidden h-px w-full md:block"
              style={{ background: "var(--fio-border-light)" }}
            />
            <div className="grid gap-12 md:grid-cols-3 md:gap-8">
              {flowSteps.map((step, i) => (
                <div key={step.id} className="relative">
                  {/* Node on the line */}
                  <div className="mb-8 flex items-center gap-4">
                    <span
                      className="fio-num relative z-[var(--z-content)] flex h-12 w-12 items-center justify-center border text-sm font-medium"
                      style={{
                        background: "var(--fio-ink-soft)",
                        borderColor: i === 1 ? "var(--fio-gold)" : "var(--fio-border-light)",
                        color: i === 1 ? "var(--fio-gold)" : "var(--fio-text)",
                        boxShadow: i === 1 ? "0 0 24px var(--fio-gold-dim)" : "none",
                      }}
                    >
                      {step.num}
                    </span>
                    {i < 2 && (
                      <svg
                        aria-hidden="true"
                        width="24"
                        height="12"
                        viewBox="0 0 24 12"
                        fill="none"
                        className="md:hidden"
                      >
                        <path d="M0 6 H20 M16 1 L21 6 L16 11" stroke="var(--fio-gold)" strokeWidth="1" opacity="0.5" />
                      </svg>
                    )}
                  </div>
                  <h3 className="mb-2 font-serif text-xl font-medium tracking-tight" style={{ color: "var(--fio-text)" }}>
                    {step.label}
                  </h3>
                  <p className="font-mono text-xs tracking-wide" style={{ color: "var(--fio-text-3)" }}>
                    {step.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Data flow strip — blueprint panel */}
          <div
            className="fio-ticks mx-auto mt-20 max-w-3xl border p-7"
            style={{
              borderColor: "var(--fio-border-light)",
              background: "var(--fio-surface)",
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="font-mono text-[0.6875rem] uppercase tracking-widest" style={{ color: "var(--fio-text-3)" }}>
                {d.flowLabel}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[0.6875rem]" style={{ color: "var(--fio-gold)" }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--fio-gold)" }} />
                {d.flowLive}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs" style={{ color: "var(--fio-text-2)" }}>
              <span className="shrink-0 px-2.5 py-1" style={{ background: "var(--fio-accent-glow)", border: "1px solid var(--fio-accent-dim)" }}>
                {d.flowNode1}
              </span>
              <span aria-hidden="true" className="shrink-0" style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="shrink-0 px-2.5 py-1" style={{ background: "var(--fio-accent-glow)", border: "1px solid var(--fio-accent-dim)" }}>
                {d.flowNode2}
              </span>
              <span aria-hidden="true" className="shrink-0" style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="shrink-0 px-2.5 py-1" style={{ background: "var(--fio-accent-glow)", border: "1px solid var(--fio-accent-dim)" }}>
                {d.flowNode3}
              </span>
              <span aria-hidden="true" className="shrink-0" style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="shrink-0 px-2.5 py-1" style={{ background: "var(--fio-gold-glow)", border: "1px solid var(--fio-gold-dim)", color: "var(--fio-gold)" }}>
                {d.flowNode4}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
