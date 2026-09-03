"use client";

import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   WORKFLOWS v3 — System architecture diagram. One visual, one story.
   ================================================================ */

export default function Workflows({ d }: { d: Dict["home"]["workflows"] }) {
  const flowSteps = [
    { id: "risk", label: d.step1Label, sub: d.step1Sub, icon: "◎" },
    { id: "engine", label: d.step2Label, sub: d.step2Sub, icon: "◈" },
    { id: "chain", label: d.step3Label, sub: d.step3Sub, icon: "◇" },
  ];
  return (
    <section id="capabilities" style={{ background: "var(--fio-ink)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="pb-28 pt-20 md:pb-36 md:pt-28">
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

          {/* Architecture Flow */}
          <div className="relative mx-auto max-w-4xl" data-aos="fade-up" data-aos-delay={300}>
            {/* Connecting line background
                节点为 h-16(64px)，几何中心在 y=32px；原 top-12(48px) 落在
                节点下缘而非中心，视觉上偏低 16px。改为 top-8(32px)。 */}
            <div
              className="absolute left-1/2 top-8 hidden h-1 w-[70%] -translate-x-1/2 md:block"
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
                      background: "var(--fio-surface)",
                      border: "1px solid var(--fio-border-light)",
                      color: i === 1 ? "var(--fio-accent)" : "var(--fio-text-2)",
                      boxShadow: i === 1 ? "0 0 30px var(--fio-accent-dim)" : "none",
                    }}
                  >
                    {step.icon}
                  </div>

                  {/* Label */}
                  <h3 className="mb-2 font-serif text-lg font-medium text-[var(--fio-text)]">
                    {step.label}
                  </h3>
                  <p className="font-mono text-sm text-[var(--fio-text-3)]">{step.sub}</p>

                  {/* Arrow between nodes (mobile)
                      ⚠ 必须放在【整个 step 内容之后】：原先夹在节点与标题之间，
                      渲染序变成 节点1→箭头→标题1→节点2…，视觉上箭头落在
                      "节点 → 自身标题" 之间，而不是两个节点之间。
                      `block` 是死类 —— 容器本来就是 <div>，默认即 display:block。 */}
                  {i < 2 && (
                    <div
                      className="mx-auto my-4 h-8 w-px md:hidden"
                      style={{
                        background: "linear-gradient(to bottom, var(--fio-accent), var(--fio-gold))",
                        opacity: 0.3,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom data flow visual */}
          <div
            className="mx-auto mt-20 max-w-3xl overflow-hidden rounded-lg border p-6"
            style={{
              borderColor: "var(--fio-border-hairline)",
              background: "var(--fio-surface-2)",
            }}
            data-aos="fade-up"
            data-aos-delay={400}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--fio-text-3)" }}>
                {d.flowLabel}
              </span>
              <span className="flex items-center gap-1.5 text-[0.6875rem] font-mono" style={{ color: "var(--fio-gold)" }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--fio-gold)" }} />
                {d.flowLive}
              </span>
            </div>
            {/* 节点名原先硬编码英文，而同 section 的 d.title / d.body 已翻译
                → 中日文页面出现中英同屏。改为读字典。
                箭头 aria-hidden（读屏念"右箭头"纯属噪音）+ shrink-0
                （flex-wrap 下箭头可独立折行成孤立的 "→"）。 */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono" style={{ color: "var(--fio-text-2)" }}>
              <span className="shrink-0 rounded-sm px-2.5 py-1" style={{ background: "var(--fio-accent-glow)", border: "1px solid var(--fio-accent-dim)" }}>
                {d.flowNode1}
              </span>
              <span aria-hidden="true" className="shrink-0" style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="shrink-0 rounded-sm px-2.5 py-1" style={{ background: "var(--fio-accent-glow)", border: "1px solid var(--fio-accent-dim)" }}>
                {d.flowNode2}
              </span>
              <span aria-hidden="true" className="shrink-0" style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="shrink-0 rounded-sm px-2.5 py-1" style={{ background: "var(--fio-accent-glow)", border: "1px solid var(--fio-accent-dim)" }}>
                {d.flowNode3}
              </span>
              <span aria-hidden="true" className="shrink-0" style={{ color: "var(--fio-text-3)" }}>→</span>
              <span className="shrink-0 rounded-sm px-2.5 py-1" style={{ background: "var(--fio-gold-glow)", border: "1px solid var(--fio-gold-dim)", color: "var(--fio-gold)" }}>
                {d.flowNode4}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
