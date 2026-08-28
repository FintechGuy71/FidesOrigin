"use client";

import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   TESTIMONIALS v3 — One deep case study. A user's journey.
   ================================================================ */

export default function Testimonials({ d }: { d: Dict["home"]["journey"] }) {
  const journeySteps = [
    { step: "01", title: d.j1Title, desc: d.j1Desc, detail: d.j1Detail },
    { step: "02", title: d.j2Title, desc: d.j2Desc, detail: d.j2Detail },
    { step: "03", title: d.j3Title, desc: d.j3Desc, detail: d.j3Detail },
    { step: "04", title: d.j4Title, desc: d.j4Desc, detail: d.j4Detail },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="border-t py-28 md:py-36" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        {/* Section header */}
        <div className="mx-auto max-w-2xl pb-20 text-center md:pb-28">
          <div className="fio-caption mb-4" data-aos="fade-up">
            {d.caption}
          </div>
          <h2
            className="fio-heading-lg mb-5"
            style={{ color: "var(--fio-text)" }}
            data-aos="fade-up"
            data-aos-delay={100}
          >
            {d.title}
          </h2>
          <p
            className="fio-body-lg"
            data-aos="fade-up"
            data-aos-delay={200}
          >
            {d.body}
          </p>
        </div>

        {/* Journey timeline */}
        <div className="relative mx-auto max-w-3xl" data-aos="fade-up" data-aos-delay={300}>
          {/* Vertical line */}
          <div
            className="absolute left-6 top-0 hidden h-full w-px md:left-8 lg:block"
            style={{ background: "linear-gradient(to bottom, var(--fio-accent), var(--fio-gold), transparent)", opacity: 0.2 }}
          />

          <div className="space-y-10">
            {journeySteps.map((item, _i) => (
              <div key={item.step} className="relative flex gap-6 lg:gap-10">
                {/* Step number circle */}
                <div className="flex-shrink-0">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-mono font-medium md:h-16 md:w-16 md:text-base"
                    style={{
                      background: "rgba(139,126,200,0.06)",
                      border: "1px solid rgba(139,126,200,0.15)",
                      color: "var(--fio-accent)",
                    }}
                  >
                    {item.step}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <h3
                    className="mb-2 text-lg font-medium"
                    style={{ color: "var(--fio-text)", fontFamily: "var(--font-serif)" }}
                  >
                    {item.title}
                  </h3>
                  <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--fio-text-2)" }}>
                    {item.desc}
                  </p>
                  <div
                    className="inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-[0.65rem] font-mono"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.04)",
                      color: "var(--fio-text-3)",
                    }}
                  >
                    <span className="h-1 w-1 rounded-full" style={{ background: "var(--fio-gold)" }} />
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div
          className="mx-auto mt-20 max-w-2xl text-center"
          data-aos="fade-up"
          data-aos-delay={400}
        >
          <div
            className="mb-6 text-5xl font-serif leading-none"
            style={{ color: "var(--fio-accent)", opacity: 0.3 }}
          >
            &ldquo;
          </div>
          <p
            className="text-lg leading-relaxed italic"
            style={{ color: "var(--fio-text)", fontFamily: "var(--font-serif)" }}
          >
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
      </div>
    </div>
  );
}
