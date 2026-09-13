"use client";

import type { Dict } from "@/i18n/dictionaries/en";

const RADAR_CIRCLES = [40, 70, 100];
const RADAR_CENTER = 100;
const SVG_VIEWBOX = 200;

/* ================================================================
   FEATURES v4 — Three protection layers. Technical frames with
   corner ticks, oversized index numerals, mono metadata.
   ================================================================ */

type FeatureItem = {
  num: string;
  title: string;
  subtitle: string;
  desc: string;
  tags: string[];
  visual: string;
};

function FeatureCard({
  feature,
  index,
  d,
}: {
  feature: FeatureItem;
  index: number;
  d: Dict["home"]["features"];
}) {
  return (
    <div
      className="grid gap-10 py-14 md:py-20 lg:grid-cols-2 lg:gap-16"
      style={index > 0 ? { borderTop: "1px solid var(--fio-border-hairline)" } : undefined}
    >
      {/* Visual side — alternating */}
      <div
        className={`fio-ticks relative flex min-h-[300px] items-center justify-center border p-10 ${index % 2 === 1 ? "lg:order-2" : ""}`}
        style={{
          borderColor: "var(--fio-border-light)",
          background: "var(--fio-surface)",
        }}
      >
        {feature.visual === "radar" && (
          <div className="relative h-52 w-52">
            <svg viewBox={`0 0 ${SVG_VIEWBOX} ${SVG_VIEWBOX}`} className="h-full w-full">
              {RADAR_CIRCLES.map((r) => (
                <circle
                  key={r}
                  cx={`${RADAR_CENTER}`}
                  cy={`${RADAR_CENTER}`}
                  r={r}
                  fill="none"
                  stroke="var(--fio-border-light)"
                  strokeWidth="0.5"
                />
              ))}
              {[0, 60, 120, 180, 240, 300].map((angle) => {
                const rad = (angle * Math.PI) / 180;
                return (
                  <line
                    key={angle}
                    x1="100"
                    y1="100"
                    x2={100 + 100 * Math.cos(rad)}
                    y2={100 + 100 * Math.sin(rad)}
                    stroke="var(--fio-border-light)"
                    strokeWidth="0.5"
                  />
                );
              })}
              <polygon
                points="100,45 145,75 135,125 85,140 55,95"
                fill="var(--fio-gold-glow)"
                stroke="var(--fio-gold)"
                strokeWidth="1"
              />
              <circle cx={`${RADAR_CENTER}`} cy={`${RADAR_CENTER}`} r="3" fill="var(--fio-cream)" />
            </svg>
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 font-mono text-[0.6875rem]"
              style={{ background: "var(--fio-ink-scrim)", color: "var(--fio-text-3)", border: "1px solid var(--fio-border-light)" }}
            >
              {d.radarCaption}
            </div>
          </div>
        )}
        {feature.visual === "chain" && (
          <div className="w-full max-w-xs space-y-2.5">
            {[
              { label: "KYC Verified", status: "PASS", color: "var(--fio-gold)", bg: "var(--fio-gold-dim)" },
              { label: "Tx Limit ≤ $10K", status: "PASS", color: "var(--fio-gold)", bg: "var(--fio-gold-dim)" },
              { label: "Risk Score ≤ 3", status: "PASS", color: "var(--fio-gold)", bg: "var(--fio-gold-dim)" },
              { label: "Execute Transfer", status: "→", color: "var(--fio-accent)", bg: "var(--fio-accent-dim)" },
            ].map((rule) => (
              <div
                key={rule.label}
                className="flex items-center justify-between px-4 py-2.5"
                style={{
                  background: "var(--fio-ink)",
                  border: "1px solid var(--fio-border-hairline)",
                }}
              >
                <span className="font-mono text-xs" style={{ color: "var(--fio-text-2)" }}>
                  {rule.label}
                </span>
                <span
                  className="px-2 py-0.5 font-mono text-[0.6875rem]"
                  style={{ color: rule.color, background: rule.bg }}
                >
                  {rule.status}
                </span>
              </div>
            ))}
            <div
              className="pt-1 text-center font-mono text-[0.6875rem]"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.policyCaption}
            </div>
          </div>
        )}
        {feature.visual === "shield" && (
          <div className="relative flex flex-col items-center justify-center">
            <svg width="120" height="140" viewBox="0 0 120 140">
              <path
                d="M60 5 L110 30 L110 80 Q110 120 60 135 Q10 120 10 80 L10 30 Z"
                fill="none"
                stroke="var(--fio-gold)"
                strokeWidth="1"
                opacity="0.4"
              />
              <path
                d="M60 25 L90 40 L90 75 Q90 105 60 115 Q30 105 30 75 L30 40 Z"
                fill="var(--fio-gold-glow)"
                stroke="var(--fio-gold)"
                strokeWidth="0.75"
              />
              <text x="60" y="75" textAnchor="middle" fill="var(--fio-cream)" fontSize="13" fontFamily="monospace" letterSpacing="2">
                AUDIT
              </text>
              {[35, 55, 75].map((y, i) => (
                <g key={i}>
                  <circle cx="25" cy={y} r="3" fill="var(--fio-gold)" opacity="0.7" />
                  <text x="35" y={y + 3} fill="var(--fio-text-3)" fontSize="10" fontFamily="monospace">
                    Block #{120000 + i * 1500}
                  </text>
                </g>
              ))}
            </svg>
            <div
              className="mt-4 px-2 py-1 font-mono text-[0.6875rem]"
              style={{ background: "var(--fio-ink-scrim)", color: "var(--fio-text-3)", border: "1px solid var(--fio-border-light)" }}
            >
              {d.shieldCaption}
            </div>
          </div>
        )}
      </div>

      {/* Text side */}
      <div className={`flex flex-col justify-center ${index % 2 === 1 ? "lg:order-1" : ""}`}>
        <div
          className="fio-num mb-4 text-5xl font-light leading-none"
          style={{ color: "var(--fio-surface-3)", WebkitTextStroke: "1px var(--fio-border-light)" }}
          aria-hidden="true"
        >
          {feature.num}
        </div>
        <h3 className="mb-2 font-serif text-2xl font-medium tracking-tight" style={{ color: "var(--fio-text)" }}>
          {feature.title}
        </h3>
        <div className="mb-5 font-mono text-xs tracking-wider" style={{ color: "var(--fio-gold)" }}>
          {feature.subtitle}
        </div>
        <p className="mb-7 max-w-md text-sm leading-relaxed" style={{ color: "var(--fio-text-2)" }}>
          {feature.desc}
        </p>
        <div className="flex flex-wrap gap-2">
          {feature.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 font-mono text-xs"
              style={{
                background: "var(--fio-accent-glow)",
                color: "var(--fio-accent)",
                border: "1px solid var(--fio-accent-dim)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Features({ d }: { d: Dict["home"]["features"] }) {
  const features: FeatureItem[] = [
    {
      num: "01",
      title: d.f1Title,
      subtitle: d.f1Sub,
      desc: d.f1Desc,
      tags: ["Chainalysis", "Elliptic", "OFAC"],
      visual: "radar",
    },
    {
      num: "02",
      title: d.f2Title,
      subtitle: d.f2Sub,
      desc: d.f2Desc,
      tags: ["KYC/AML", "Tx Limits", "Timelock"],
      visual: "chain",
    },
    {
      num: "03",
      title: d.f3Title,
      subtitle: d.f3Sub,
      desc: d.f3Desc,
      tags: ["SEC", "HKMA", "MiCA"],
      visual: "shield",
    },
  ];
  return (
    <section id="features" style={{ background: "var(--fio-ink)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="border-t py-28 md:py-36" style={{ borderColor: "var(--fio-border-hairline)" }}>
          {/* Header — left editorial */}
          <div className="grid gap-10 md:grid-cols-12">
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

          <div>
            {features.map((f, i) => (
              <FeatureCard key={f.num} feature={f} index={i} d={d} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
