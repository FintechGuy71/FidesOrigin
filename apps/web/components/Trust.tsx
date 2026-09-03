"use client";

import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   TRUST — Social proof, credibility anchors. (#security anchor)
   ================================================================ */

export default function Trust({ d }: { d: Dict["home"]["trust"] }) {
  const badges = [
    { label: d.badge1Label, status: d.badge1Status },
    { label: d.badge2Label, status: d.badge2Status },
    { label: d.badge3Label, status: d.badge3Status },
    { label: d.badge4Label, status: d.badge4Status },
  ];
  return (
    <section id="security" style={{ background: "var(--fio-ink)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="border-t py-20 md:py-28" style={{ borderColor: "var(--fio-border-hairline)" }}>
          {/* Badges row */}
          <div
            className="mb-16 flex flex-wrap items-center justify-center gap-4"
            data-aos="fade-up"
          >
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2.5 rounded-md border px-4 py-2.5"
                style={{
                  borderColor: "var(--fio-border-light)",
                  background: "var(--fio-surface-2)",
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
                <span className="rounded-sm bg-[var(--fio-gold-dim)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--fio-gold)]">
                  {badge.status}
                </span>
              </div>
            ))}
          </div>

          {/* Big quote */}
          <div className="mx-auto max-w-3xl text-center" data-aos="fade-up" data-aos-delay={150}>
            <div
              className="mb-8 text-6xl font-serif leading-none"
              style={{ color: "var(--fio-accent)", opacity: 0.2 }}
            >
              &ldquo;
            </div>
            <p className="mb-8 font-serif text-xl leading-relaxed italic text-[var(--fio-text)] sm:text-2xl">
              {d.quote}
            </p>
            <div className="flex items-center justify-center gap-3">
              {/* 原为一个无图片、无文字、无 aria-hidden 的空圆环，读屏会渲染无意义节点。
                装饰性占位改为首字母头像。 */}
              <div
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--fio-accent-dim)] bg-[var(--fio-accent-dim)] text-xs font-medium text-[var(--fio-accent)]"
              >
                {d.quoteName.slice(0, 1)}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-[var(--fio-text)]">
                  {d.quoteName}
                </div>
                <div className="text-xs text-[var(--fio-text-3)]">{d.quoteRole}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
