"use client";

import type { Dict } from "@/i18n/dictionaries/en";

// 动画和视觉常量
const AOS_DELAY_MULTIPLIER = 150;
const MIN_HEIGHT_PX = 280;
const RADAR_CIRCLES = [40, 70, 100];
const RADAR_CENTER = 100;
// const _ANIMATION_DURATIONS = [60, 120, 180, 240, 300];
// const _SCAN_LINE_Y = 180;
// const _GRID_SIZE = 100;
// const _RISK_COLORS = [35, 55, 75];
// const _DASH_OFFSET = 120000;
// const _DASH_SPEED = 1500;
const SVG_VIEWBOX = 200;
// const _ICON_SIZE = 24;

/* ================================================================
   FEATURES v3 — Three core capabilities, each with visual anchor.
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
      className="group relative grid gap-8 lg:grid-cols-2 lg:gap-12"
      data-aos="fade-up"
      data-aos-delay={index * AOS_DELAY_MULTIPLIER}
    >
      {/* Visual side — alternating left/right */}
      <div
        className={`relative flex items-center justify-center rounded-lg border p-8 ${index % 2 === 1 ? "lg:order-2" : ""}`}
        style={{
          borderColor: "rgba(255,255,255,0.04)",
          background: "rgba(255,255,255,0.01)",
          minHeight: `${MIN_HEIGHT_PX}px`,
        }}
      >
        {/* Placeholder visual */}
        {feature.visual === "radar" && (
          <div className="relative h-48 w-48">
            <svg viewBox={`0 0 ${SVG_VIEWBOX} ${SVG_VIEWBOX}`} className="h-full w-full">
              {/* Radar rings */}
              {RADAR_CIRCLES.map((r) => (
                <circle
                  key={r}
                  cx={`${RADAR_CENTER}`}
                  cy={`${RADAR_CENTER}`}
                  r={r}
                  fill="none"
                  stroke="rgba(139,126,200,0.1)"
                  strokeWidth="0.5"
                />
              ))}
              {/* Radar spokes */}
              {[0, 60, 120, 180, 240, 300].map((angle) => {
                const rad = (angle * Math.PI) / 180;
                return (
                  <line
                    key={angle}
                    x1="100"
                    y1="100"
                    x2={100 + 100 * Math.cos(rad)}
                    y2={100 + 100 * Math.sin(rad)}
                    stroke="rgba(139,126,200,0.08)"
                    strokeWidth="0.5"
                  />
                );
              })}
              {/* Data polygon */}
              <polygon
                points="100,45 145,75 135,125 85,140 55,95"
                fill="rgba(139,126,200,0.06)"
                stroke="var(--fio-accent)"
                strokeWidth="1"
              />
              {/* Center dot */}
              <circle cx={`${RADAR_CENTER}`} cy={`${RADAR_CENTER}`} r="3" fill="var(--fio-accent)" />
            </svg>
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-sm px-2 py-1 text-[0.6rem] font-mono"
              style={{ background: "rgba(7,8,16,0.9)", color: "var(--fio-text-3)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {d.radarCaption}
            </div>
          </div>
        )}
        {feature.visual === "chain" && (
          <div className="w-full max-w-xs space-y-3">
            {[
              { label: "KYC Verified", status: "PASS", color: "var(--fio-gold)" },
              { label: "Tx Limit ≤ $10K", status: "PASS", color: "var(--fio-gold)" },
              { label: "Risk Score ≤ 3", status: "PASS", color: "var(--fio-gold)" },
              { label: "Execute Transfer", status: "→", color: "var(--fio-accent)" },
            ].map((rule, i) => (
              <div
                key={rule.label}
                className="flex items-center justify-between rounded-md px-4 py-2.5"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  animationDelay: `${i * 150}ms`,
                }}
              >
                <span className="text-xs" style={{ color: "var(--fio-text-2)" }}>
                  {rule.label}
                </span>
                <span
                  className="rounded-sm px-2 py-0.5 text-[0.65rem] font-mono"
                  style={{ color: rule.color, background: `${rule.color}15` }}
                >
                  {rule.status}
                </span>
              </div>
            ))}
            <div
              className="mt-2 text-center text-[0.6rem] font-mono"
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
                stroke="var(--fio-accent)"
                strokeWidth="1"
                opacity="0.3"
              />
              <path
                d="M60 25 L90 40 L90 75 Q90 105 60 115 Q30 105 30 75 L30 40 Z"
                fill="rgba(139,126,200,0.05)"
                stroke="var(--fio-accent)"
                strokeWidth="0.5"
              />
              <text x="60" y="75" textAnchor="middle" fill="var(--fio-accent)" fontSize="14" fontFamily="monospace">
                AUDIT
              </text>
              {/* Check marks */}
              {[35, 55, 75].map((y, i) => (
                <g key={i}>
                  <circle cx="25" cy={y} r="3" fill="var(--fio-gold)" opacity="0.6" />
                  <text x="35" y={y + 3} fill="var(--fio-text-3)" fontSize="6" fontFamily="monospace">
                    Block #{120000 + i * 1500}
                  </text>
                </g>
              ))}
            </svg>
            <div
              className="mt-3 rounded-sm px-2 py-1 text-[0.6rem] font-mono"
              style={{ background: "rgba(7,8,16,0.9)", color: "var(--fio-text-3)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {d.shieldCaption}
            </div>
          </div>
        )}
      </div>

      {/* Text side */}
      <div className={`flex flex-col justify-center ${index % 2 === 1 ? "lg:order-1 lg:text-right" : ""}`}>
        <div
          className="mb-3 font-mono text-sm font-medium"
          style={{ color: "var(--fio-text-4)" }}
        >
          {feature.num}
        </div>
        <h3
          className="mb-1 text-2xl font-medium tracking-tight"
          style={{ color: "var(--fio-text)", fontFamily: "var(--font-serif)" }}
        >
          {feature.title}
        </h3>
        <div
          className="mb-5 text-xs font-medium"
          style={{ color: "var(--fio-text-3)", fontFamily: "var(--font-mono)" }}
        >
          {feature.subtitle}
        </div>
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--fio-text-2)" }}>
          {feature.desc}
        </p>
        <div className={`flex flex-wrap gap-2 ${index % 2 === 1 ? "lg:justify-end" : ""}`}>
          {feature.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-sm px-2.5 py-1 text-xs font-medium"
              style={{
                background: "rgba(139,126,200,0.06)",
                color: "var(--fio-accent)",
                border: "1px solid rgba(139,126,200,0.1)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Section divider */}
      {index < 2 && (
        <div
          className="col-span-full my-8 h-px lg:my-16"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)" }}
        />
      )}
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
    <section
      id="features"
      style={{
        background:
          "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(139,126,200,0.03) 0%, transparent 60%), var(--fio-ink-soft)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="border-t py-28 md:py-36" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          {/* Header */}
          <div className="mx-auto max-w-2xl pb-24 text-center md:pb-32">
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
            <p className="fio-body-lg" data-aos="fade-up" data-aos-delay={200}>
              {d.body}
            </p>
          </div>

          {/* Feature blocks */}
          <div className="space-y-0">
            {features.map((f, i) => (
              <FeatureCard key={f.num} feature={f} index={i} d={d} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
