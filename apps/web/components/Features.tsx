"use client";

import type { Dict } from "@/i18n/dictionaries/en";

// 动画和视觉常量
const AOS_DELAY_MULTIPLIER = 150;
const RADAR_CIRCLES = [40, 70, 100];
const RADAR_CENTER = 100;
const SVG_VIEWBOX = 200;

/* 入场延迟类查表。
   ⚠ 不要写成 `fio-delay-${i + 1}`：一旦 .fio-delay-* 改为 Tailwind
      @utility 生成，动态拼接的类名不会被按需扫描命中而静默失效。 */
const DELAY_CLASSES = [
  "fio-delay-1",
  "fio-delay-2",
  "fio-delay-3",
  "fio-delay-4",
  "fio-delay-5",
] as const;

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
        /* min-h 走 Tailwind 类而不是内联 style：这是静态值，
           内联样式优先级最高，且无法被响应式/主题覆盖。 */
        className={`relative flex min-h-[280px] items-center justify-center rounded-lg border p-8 ${index % 2 === 1 ? "lg:order-2" : ""}`}
        style={{
          borderColor: "var(--fio-border-hairline)",
          background: "var(--fio-surface)",
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
                  stroke="var(--fio-accent-dim)"
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
                    stroke="var(--fio-accent-dim)"
                    strokeWidth="0.5"
                  />
                );
              })}
              {/* Data polygon */}
              <polygon
                points="100,45 145,75 135,125 85,140 55,95"
                fill="var(--fio-accent-glow)"
                stroke="var(--fio-accent)"
                strokeWidth="1"
              />
              {/* Center dot */}
              <circle cx={`${RADAR_CENTER}`} cy={`${RADAR_CENTER}`} r="3" fill="var(--fio-accent)" />
            </svg>
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-sm px-2 py-1 text-[0.6875rem] font-mono"
              style={{ background: "var(--fio-ink-scrim)", color: "var(--fio-text-3)", border: "1px solid var(--fio-border-light)" }}
            >
              {d.radarCaption}
            </div>
          </div>
        )}
        {feature.visual === "chain" && (
          <div className="w-full max-w-xs space-y-3">
            {[
              { label: "KYC Verified", status: "PASS", color: "var(--fio-gold)", bg: "var(--fio-gold-dim)" },
              { label: "Tx Limit ≤ $10K", status: "PASS", color: "var(--fio-gold)", bg: "var(--fio-gold-dim)" },
              { label: "Risk Score ≤ 3", status: "PASS", color: "var(--fio-gold)", bg: "var(--fio-gold-dim)" },
              { label: "Execute Transfer", status: "→", color: "var(--fio-accent)", bg: "var(--fio-accent-dim)" },
            ].map((rule, i) => (
              <div
                key={rule.label}
                /* 原先只写了 animationDelay，但元素上没有任何 animation，
                   该属性完全无效（既无 transition 也无 animation 可延迟），
                   "规则逐条入场"的效果从未发生。补上入场动画类。
                   ⚠ 延迟类用手写常量表而不是 `fio-delay-${i+1}` 模板字符串：
                   .fio-delay-* 是普通 CSS 类（非 JIT 生成）侥幸有效，
                   一旦改为 Tailwind @utility 就会被按需扫描漏掉。 */
                className={`${DELAY_CLASSES[i] ?? ""} fio-animate-fade-up flex items-center justify-between rounded-md px-4 py-2.5`}
                style={{
                  background: "var(--fio-surface)",
                  border: "1px solid var(--fio-border-hairline)",
                }}
              >
                <span className="text-xs" style={{ color: "var(--fio-text-2)" }}>
                  {rule.label}
                </span>
                {/* ⚠ 原为 background: `${rule.color}15` —— rule.color 是
                    var(--fio-gold)，拼出来是 "var(--fio-gold)15" 这个非法值，
                    整条 background 声明被浏览器丢弃 → 徽章底色完全不渲染。
                    改为显式的 dim 令牌。 */}
                <span
                  className="rounded-sm px-2 py-0.5 text-[0.6875rem] font-mono"
                  style={{ color: rule.color, background: rule.bg }}
                >
                  {rule.status}
                </span>
              </div>
            ))}
            <div
              className="mt-2 text-center text-[0.6875rem] font-mono"
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
                fill="var(--fio-accent-glow)"
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
                  {/* 原 fontSize="6" 在 viewBox 120×140 下等效约 3.4px，不可读 */}
                  <text x="35" y={y + 3} fill="var(--fio-text-3)" fontSize="10" fontFamily="monospace">
                    Block #{120000 + i * 1500}
                  </text>
                </g>
              ))}
            </svg>
            <div
              className="mt-3 rounded-sm px-2 py-1 text-[0.6875rem] font-mono"
              style={{ background: "var(--fio-ink-scrim)", color: "var(--fio-text-3)", border: "1px solid var(--fio-border-light)" }}
            >
              {d.shieldCaption}
            </div>
          </div>
        )}
      </div>

      {/* Text side */}
      <div className={`flex flex-col justify-center ${index % 2 === 1 ? "lg:order-1 lg:text-right" : ""}`}>
        {/* 原用 --fio-text-4(#3a4050)，对 --fio-ink-soft 底色对比度仅 1.86:1，
            序号 01/02/03 是语义内容而非纯装饰，改用品牌金（8.6:1）。 */}
        <div className="mb-3 font-mono text-sm font-medium text-[var(--fio-gold)]">
          {feature.num}
        </div>
        <h3 className="mb-1 font-serif text-2xl font-medium tracking-tight text-[var(--fio-text)]">
          {feature.title}
        </h3>
        <div className="mb-5 font-mono text-xs font-medium text-[var(--fio-text-3)]">
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
                background: "var(--fio-accent-glow)",
                color: "var(--fio-accent)",
                border: "1px solid var(--fio-accent-dim)",
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
          style={{ background: "linear-gradient(90deg, transparent, var(--fio-border-hairline), transparent)" }}
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
          "radial-gradient(ellipse 60% 40% at 50% 100%, var(--fio-accent-glow) 0%, transparent 60%), var(--fio-ink-soft)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="border-t py-28 md:py-36" style={{ borderColor: "var(--fio-border-hairline)" }}>
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
