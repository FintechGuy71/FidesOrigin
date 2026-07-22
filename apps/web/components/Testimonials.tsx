"use client";

/* ================================================================
   TESTIMONIALS v3 — One deep case study. A user's journey.
   ================================================================ */

const journeySteps = [
  {
    step: "01",
    title: "KYC Onboarding",
    desc: "用户完成身份验证，系统为其分配风险等级和交易限额。",
    detail: "Identity verified · Risk tier: Normal · Daily limit: $50K",
  },
  {
    step: "02",
    title: "Real-Time Risk Scan",
    desc: "每笔交易触发实时风险扫描，聚合多源数据评估地址信誉。",
    detail: "Chainalysis · Elliptic · OFAC · Sub-50ms latency",
  },
  {
    step: "03",
    title: "Policy Execution",
    desc: "合规策略自动执行：限额检查、地域限制、黑名单拦截。",
    detail: "Tx limit check · Geo-fencing · Blacklist screening",
  },
  {
    step: "04",
    title: "On-Chain Settlement",
    desc: "通过的智能合约自动执行转账，记录不可篡改的审计日志。",
    detail: "Smart contract execution · Immutable audit log",
  },
  {
    step: "05",
    title: "Regulatory Report",
    desc: "一键生成 HKMA / SEC / MiCA 合规报告，满足监管报送要求。",
    detail: "HKMA · SEC · MiCA · One-click generation",
  },
];

export default function Testimonials() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="border-t py-28 md:py-36" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        {/* Section header */}
        <div className="mx-auto max-w-2xl pb-20 text-center md:pb-28">
          <div className="fio-caption mb-4" data-aos="fade-up">
            Use Case
          </div>
          <h2
            className="fio-heading-lg mb-5"
            style={{ color: "var(--fio-text)" }}
            data-aos="fade-up"
            data-aos-delay={100}
          >
            A Stablecoin Issuer&apos;s Journey
          </h2>
          <p
            className="fio-body-lg"
            data-aos="fade-up"
            data-aos-delay={200}
          >
            一家香港合规稳定币发行商，如何使用 FidesOrigin 实现从 KYC 到监管报告的全链路自动化。
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
            {journeySteps.map((item, i) => (
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
            FidesOrigin 让我们从手工合规审查转向全自动执行，
            风控延迟从小时级降到毫秒级。
          </p>
          <div className="mt-6">
            <div className="text-sm font-medium" style={{ color: "var(--fio-text)" }}>
              Chief Compliance Officer
            </div>
            <div className="text-xs" style={{ color: "var(--fio-text-3)" }}>
              Hong Kong Licensed Stablecoin Issuer
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
