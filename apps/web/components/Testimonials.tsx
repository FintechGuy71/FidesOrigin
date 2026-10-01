"use client";

import Reveal from "@/components/Reveal";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   TESTIMONIALS v4 — Client journey as an audit trail.
   ================================================================ */

export default function Testimonials({ d }: { d: Dict["home"]["journey"] }) {
  const journeySteps = [
    { step: "01", title: d.j1Title, desc: d.j1Desc, detail: d.j1Detail },
    { step: "02", title: d.j2Title, desc: d.j2Desc, detail: d.j2Detail },
    { step: "03", title: d.j3Title, desc: d.j3Desc, detail: d.j3Detail },
    { step: "04", title: d.j4Title, desc: d.j4Desc, detail: d.j4Detail },
  ];
  return (
    <section style={{ background: "var(--fio-ink)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 2xl:max-w-7xl">
        <div className="border-t py-[var(--section-py)] md:py-[var(--section-py-lg)]" style={{ borderColor: "var(--fio-border-hairline)" }}>
          {/* Section header — left editorial */}
          <Reveal>
          <div className="grid gap-10 pb-16 md:grid-cols-12 md:pb-24">
            <div className="md:col-span-6">
              <div className="fio-eyebrow mb-5">{d.caption}</div>
              <h2 className="fio-heading-lg" style={{ color: "var(--fio-text)" }}>
                {d.title}
              </h2>
            </div>
            <div className="flex items-end md:col-span-5 md:col-start-7">
              <p className="fio-body-lg">{d.body}</p>
            </div>
          </div>
          </Reveal>

          {/* Journey — audit trail timeline
              [v5] max-w-4xl：1440px 视口下消除右半空白；
              连接线全断点渲染（left-6），不再 md 专属。 */}
          <div className="relative mx-auto max-w-4xl">
            <div
              aria-hidden="true"
              className="absolute left-6 top-0 h-full w-px md:left-8"
              style={{ background: "linear-gradient(to bottom, var(--fio-gold), var(--fio-border-light), transparent)", opacity: 0.35 }}
            />

            <div className="space-y-12">
              {journeySteps.map((item, i) => (
                <Reveal key={item.step} delay={i * 0.08}>
                <div className="relative flex gap-6 lg:gap-10">
                  <div className="flex-shrink-0">
                    <div
                      className="fio-num flex h-12 w-12 items-center justify-center border text-sm font-medium md:h-16 md:w-16 md:text-base"
                      style={{
                        background: "var(--fio-ink)",
                        border: "1px solid var(--fio-gold-dim)",
                        color: "var(--fio-gold)",
                      }}
                    >
                      {item.step}
                    </div>
                  </div>

                  <div className="flex-1 pb-2 pt-1">
                    <h3 className="mb-2 font-serif text-lg font-medium" style={{ color: "var(--fio-text)" }}>
                      {item.title}
                    </h3>
                    <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--fio-text-2)" }}>
                      {item.desc}
                    </p>
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 font-mono text-[0.6875rem]"
                      style={{
                        background: "var(--fio-surface)",
                        border: "1px solid var(--fio-border-hairline)",
                        color: "var(--fio-text-3)",
                      }}
                    >
                      <span className="h-1 w-1 rounded-full" style={{ background: "var(--fio-gold)" }} />
                      {item.detail}
                    </div>
                  </div>
                </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Bottom quote */}
          <Reveal delay={0.1}>
          <div className="mx-auto mt-24 max-w-2xl text-center">
            <div
              aria-hidden="true"
              className="mb-5 font-serif text-6xl leading-none"
              style={{ color: "var(--fio-gold)", opacity: 0.45 }}
            >
              &ldquo;
            </div>
            <p className="font-serif text-lg leading-relaxed" style={{ color: "var(--fio-text)" }}>
              {d.quote}
            </p>
            <div className="mt-6">
              <div className="text-sm font-medium" style={{ color: "var(--fio-text)" }}>
                {d.quoteName}
              </div>
              <div className="text-xs" style={{ color: "var(--fio-text-3)" }}>
                {d.quoteRole}
              </div>
            </div>
          </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
