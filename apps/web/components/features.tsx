"use client";

/* ================================================================
   FEATURES v3 — Three core capabilities, each with visual anchor.
   ================================================================ */

const features = [
  {
    num: "01",
    title: "Risk Intelligence",
    subtitle: "风险情报",
    desc: "聚合 Chainalysis、Elliptic、OFAC 等多源风险数据，实时评估地址风险等级。四级标签体系（VIP / Normal / Greylist / Blacklist）支持精细化风控策略。",
    tags: ["Chainalysis", "Elliptic", "OFAC", "Sub-50ms"],
    visual: "radar",
  },
  {
    num: "02",
    title: "Policy Engine",
    subtitle: "策略引擎",
    desc: "可编程合规规则链：If-Then-Execute。支持 KYC/AML、交易限额、地域限制、时间锁等策略的灵活组合与链上自动执行。",
    tags: ["KYC/AML", "Tx Limits", "Timelock", "Multi-Sig"],
    visual: "chain",
  },
  {
    num: "03",
    title: "Audit & Compliance",
    subtitle: "审计与合规",
    desc: "不可篡改的链上审计日志，一键生成 SEC、HKMA、MiCA 合规报告。每笔交易可追踪、每个决策可问责。",
    tags: ["SEC", "HKMA", "MiCA", "Immutable"],
    visual: "shield",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  return (
    <div
      className="group relative grid gap-8 lg:grid-cols-2 lg:gap-12"
      data-aos="fade-up"
      data-aos-delay={index * 150}
    >
      {/* Visual side — alternating left/right */}
      <div
        className={`relative flex items-center justify-center rounded-lg border p-8 ${index % 2 === 1 ? "lg:order-2" : ""}`}
        style={{
          borderColor: "rgba(255,255,255,0.04)",
          background: "rgba(255,255,255,0.01)",
          minHeight: "280px",
        }}
      >
        {/* Placeholder visual */}
        {feature.visual === "radar" && (
          <div className="relative h-48 w-48">
            <svg viewBox="0 0 200 200" className="h-full w-full">
              {/* Radar rings */}
              {[40, 70, 100].map((r) => (
                <circle
                  key={r}
                  cx="100"
                  cy="100"
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
              <circle cx="100" cy="100" r="3" fill="var(--fio-accent)" />
            </svg>
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-sm px-2 py-1 text-[0.6rem] font-mono"
              style={{ background: "rgba(7,8,16,0.9)", color: "var(--fio-text-3)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              Risk Radar — Real-time Intelligence
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
              Policy Chain — On-chain Execution
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
              Audit Shield — Immutable Trail
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

export default function Features() {
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
              Core Capabilities
            </div>
            <h2
              className="fio-heading-lg mb-5"
              style={{ color: "var(--fio-text)" }}
              data-aos="fade-up"
              data-aos-delay={100}
            >
              Three Layers of Institutional Protection
            </h2>
            <p className="fio-body-lg" data-aos="fade-up" data-aos-delay={200}>
              从风险情报到策略执行，再到审计追踪 — 三层防护，缺一不可。
            </p>
          </div>

          {/* Feature blocks */}
          <div className="space-y-0">
            {features.map((f, i) => (
              <FeatureCard key={f.num} feature={f} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
