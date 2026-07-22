"use client";

/* ================================================================
   TRUST — Social proof, credibility anchors.
   ================================================================ */

const badges = [
  { label: "Hong Kong Stablecoin License", status: "Ready" },
  { label: "Open Source", status: "MIT License" },
  { label: "Multi-Chain", status: "6 Networks" },
  { label: "Real-Time", status: "<50ms" },
];

export default function Trust() {
  return (
    <section style={{ background: "var(--fio-ink)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="border-t py-20 md:py-28" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
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
                  borderColor: "rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.01)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "var(--fio-gold)",
                    boxShadow: "0 0 6px rgba(201,169,110,0.3)",
                  }}
                />
                <span className="text-xs font-medium" style={{ color: "var(--fio-text-2)" }}>
                  {badge.label}
                </span>
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[0.6rem] font-mono"
                  style={{
                    background: "rgba(201,169,110,0.08)",
                    color: "var(--fio-gold)",
                  }}
                >
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
            <p
              className="mb-8 text-xl leading-relaxed italic sm:text-2xl"
              style={{ color: "var(--fio-text)", fontFamily: "var(--font-serif)" }}
            >
              The intersection of compliance and DeFi is where the next
              trillion dollars of institutional capital will enter.
            </p>
            <div className="flex items-center justify-center gap-3">
              <div
                className="h-8 w-8 rounded-full"
                style={{
                  background: "rgba(139,126,200,0.1)",
                  border: "1px solid rgba(139,126,200,0.15)",
                }}
              />
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: "var(--fio-text)" }}>
                  Wesley Yang
                </div>
                <div className="text-xs" style={{ color: "var(--fio-text-3)" }}>
                  Founder, FidesOrigin
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
