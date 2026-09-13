"use client";

import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   SEGMENTS — Who it's for. Three business verticals, hairline
   technical grid, numbered columns.
   ================================================================ */

export default function Segments({ d }: { d: Dict["home"]["segments"] }) {
  const segments = [
    { num: "S.01", title: d.s1Title, desc: d.s1Desc, points: d.s1Points },
    { num: "S.02", title: d.s2Title, desc: d.s2Desc, points: d.s2Points },
    { num: "S.03", title: d.s3Title, desc: d.s3Desc, points: d.s3Points },
  ];
  return (
    <section id="segments" style={{ background: "var(--fio-ink)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="border-t py-28 md:py-36" style={{ borderColor: "var(--fio-border-hairline)" }}>
          {/* Section header — left-aligned, editorial */}
          <div className="grid gap-10 pb-16 md:grid-cols-12 md:pb-20">
            <div className="md:col-span-5">
              <div className="fio-eyebrow mb-5">{d.caption}</div>
              <h2 className="fio-heading-lg" style={{ color: "var(--fio-text)" }}>
                {d.title}
              </h2>
            </div>
            <div className="flex items-end md:col-span-6 md:col-start-7">
              <p className="fio-body-lg">{d.body}</p>
            </div>
          </div>

          {/* Three verticals — hairline columns */}
          <div className="grid gap-px md:grid-cols-3" style={{ background: "var(--fio-border-hairline)", border: "1px solid var(--fio-border-hairline)" }}>
            {segments.map((s) => (
              <div
                key={s.num}
                className="group relative p-8 transition-colors duration-300 md:p-10"
                style={{ background: "var(--fio-ink)" }}
              >
                <div className="fio-num mb-8 text-sm font-medium" style={{ color: "var(--fio-gold)" }}>
                  {s.num}
                </div>
                <h3 className="mb-3 font-serif text-xl font-medium tracking-tight" style={{ color: "var(--fio-text)" }}>
                  {s.title}
                </h3>
                <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--fio-text-2)" }}>
                  {s.desc}
                </p>
                <ul className="space-y-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-3">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                        className="shrink-0"
                      >
                        <path
                          d="M2 6.5 L4.8 9 L10 3.5"
                          stroke="var(--fio-gold)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="font-mono text-xs" style={{ color: "var(--fio-text-2)" }}>
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* hover 底线 */}
                <div
                  className="absolute bottom-0 left-0 h-px w-0 transition-all duration-500 group-hover:w-full"
                  style={{ background: "var(--fio-gold)" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
