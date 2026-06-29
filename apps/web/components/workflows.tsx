"use client";

/* ================================================================
   WORKFLOWS v3 — System architecture diagram. One visual, one story.
   ================================================================ */

const flowSteps = [
  { id: "risk", label: "Risk Data", sub: "Chainalysis · Elliptic · OFAC", icon: "◎" },
  { id: "engine", label: "FidesOrigin Engine", sub: "Policy · Risk · Execution", icon: "◈" },
  { id: "chain", label: "On-Chain Action", sub: "Smart Contract · Wallet", icon: "◇" },
];

export default function Workflows() {
  return (
    <section id="capabilities" style={{ background: "var(--fio-ink)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="pb-28 pt-20 md:pb-36 md:pt-28">
          {/* Section header */}
          <div className="mx-auto max-w-2xl pb-20 text-center md:pb-28">
            <div className="fio-caption mb-4" data-aos="fade-up">
              How It Works
            </div>
            <h2
              className="fio-heading-lg mb-5"
              style={{ color: "var(--fio-text)" }}
              data-aos="fade-up"
              data-aos-delay={100}
            >
              Risk Data → Engine → On-Chain Action
            </h2>
            <p
              className="fio-body-lg"
              data-aos="fade-up"
              data-aos-delay={200}
            >
              FidesOrigin 将链外风险数据与链上执行无缝连接，
              实现从检测到拦截的端到端自动化。
            </p>
          </div>

          {/* Architecture Flow */}
          <div className="relative mx-auto max-w-4xl" data-aos="fade-up" data-aos-delay={300}>
            {/* Connecting line background */}
            <div
              className="absolute left-1/2 top-12 hidden h-1 w-[70%] -translate-x-1/2 md:block"
              style={{
                background: "linear-gradient(90deg, var(--fio-accent), var(--fio-gold), var(--fio-steel))",
                opacity: 0.15,
              }}
            />

            <div className="grid gap-8 md:grid-cols-3 md:gap-6">
              {flowSteps.map((step, i) => (
                <div key={step.id} className="relative text-center">
                  {/* Node */}
                  <div
                    className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg text-2xl font-light"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: i === 1 ? "var(--fio-accent)" : "var(--fio-text-2)",
                      boxShadow: i === 1 ? "0 0 30px rgba(139,126,200,0.1)" : "none",
                    }}
                  >
                    {step.icon}
                  </div>

                  {/* Arrow between nodes (mobile) */}
                  {i < 2 && (
                    <div
                      className="mx-auto my-4 block h-8 w-px md:hidden"
                      style={{
                        background: "linear-gradient(to bottom, var(--fio-accent), var(--fio-gold))",
                        opacity: 0.3,
                      }}
                    />
                  )}

                  {/* Label */}
                  <h3
                    className="mb-2 text-lg font-medium"
                    style={{ color: "var(--fio-text)", fontFamily: "var(--font-serif)" }}
                  >
                    {step.label}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--fio-text-3)", fontFamily: "var(--font-mono)" }}>
                    {step.sub}
                  </p>

                  {/* Detail bullets */}
                  <div className="mt-4 space-y-2">
                    {i === 0 && [
                      "实时地址风险评分",
                      "多数据源交叉验证",
                      "Sub-50ms 延迟",
                    ].map((t) => (
                      <div key={t} className="text-xs" style={{ color: "var(--fio-text-2)" }}>
                        {t}
                      </div>
                    ))}
                    {i === 1 && [
                      "可编程合规策略",
                      "自动规则执行",
                      "四级风险标签",
                    ].map((t) => (
                      <div key={t} className="text-xs" style={{ color: "var(--fio-text-2)" }}>
                        {t}
                      </div>
                    ))}
                    {i === 2 && [
                      "交易前拦截",
                      "交易后审计",
                      "不可篡改记录",
                    ].map((t) => (
                      <div key={t} className="text-xs" style={{ color: "var(--fio-text-2)" }}>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom data flow visual */}
          <div
            className="mx-auto mt-20 max-w-3xl overflow-hidden rounded-lg border p-6"
            style={{
              borderColor: "rgba(255,255,255,0.04)",
              background: "rgba(255,255,255,0.01)",
            }}
            data-aos="fade-up"
            data-aos-delay={400}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--fio-text-3)" }}>
                Real-Time Data Flow
              </span>
              <span className="flex items-center gap-1.5 text-[0.65rem] font-mono" style={{ color: "var(--fio-gold)" }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--fio-gold)" }} />
                Live
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono" style={{ color: "var(--fio-text-2)" }}>
              <span className="rounded-sm px-2.5 py-1" style={{ background: "rgba(139,126,200,0.06)", border: "1px solid rgba(139,126,200,0.1)" }}>
                Risk Oracle
              </span>
              <span style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="rounded-sm px-2.5 py-1" style={{ background: "rgba(139,126,200,0.06)", border: "1px solid rgba(139,126,200,0.1)" }}>
                Policy Engine
              </span>
              <span style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="rounded-sm px-2.5 py-1" style={{ background: "rgba(139,126,200,0.06)", border: "1px solid rgba(139,126,200,0.1)" }}>
                Compliance Engine
              </span>
              <span style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="rounded-sm px-2.5 py-1" style={{ background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.1)", color: "var(--fio-gold)" }}>
                On-Chain Execution
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
