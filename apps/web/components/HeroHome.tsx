"use client";

import { useEffect, useRef } from "react";
import CountUp from "@/components/CountUp";
import HeroScreen from "@/components/HeroScreen";
import type { Dict } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/locales";

/* ================================================================
   HERO v4 — "Compliance Mesh"
   Canvas 粒子网络（风险情报网格）：节点漂移、近距连线、
   高亮节点脉冲。下方是等宽数字指标带 + 旋转监管封印。
   ================================================================ */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hot: boolean; // 高亮节点（被筛查命中的风险点）
  phase: number;
};

export default function HeroHome({
  d,
  lang,
}: {
  d: Dict["home"]["hero"];
  lang: Locale;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ---- Compliance mesh: particle network with proximity links ---- */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* Canvas 2D 不支持 var() —— 用 getComputedStyle 解析一次令牌色值。 */
    const cs = getComputedStyle(document.documentElement);
    const cLine = cs.getPropertyValue("--fio-border-light").trim();
    const cNode = cs.getPropertyValue("--fio-steel").trim();
    const cHot = cs.getPropertyValue("--fio-gold").trim();
    const cHotDim = cs.getPropertyValue("--fio-gold-dim").trim();
    const cCream = cs.getPropertyValue("--fio-accent").trim();
    if (!cLine || !cNode || !cHot || !cHotDim || !cCream) return; // [AUDIT FIX 2026-09-18 R3] 原漏 cHotDim → 金色光晕静默消失

    let w = 0, h = 0;
    let particles: Particle[] = [];

    const seed = () => {
      const count = Math.max(36, Math.min(90, Math.floor((w * h) / 26000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.4,
        hot: Math.random() < 0.12,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.width = canvas.offsetWidth * dpr;
      h = canvas.height = canvas.offsetHeight * dpr;
      seed();
    };
    resize();
    window.addEventListener("resize", resize);

    const LINK_DIST = () => Math.min(w, h) * 0.16;
    let frame = 0;
    let t = 0;
    /* [AUDIT FIX 2026-09-25 R6-11] 性能精修：首屏粒子网络是常驻 rAF 循环。
       ① 文档隐藏（切后台标签）时 rAF 已被浏览器节流但回调仍排队，显式暂停；
       ② hero 滚出视口后继续绘制纯浪费 GPU/CPU —— IO 观察，离屏即停，
       回屏恢复。两者都不改变任何视觉结果（回屏后从当前状态续画）。 */
    let running = true;
    let inView = true;

    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!running || !inView) return;
      t += 0.016;
      drawFrame();
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, w, h);

      const dpr = window.devicePixelRatio || 1;
      const linkDist = LINK_DIST();

      /* links */
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = a.hot || b.hot ? cHot : cLine;
            ctx.lineWidth = (a.hot || b.hot ? 0.7 : 0.5) * dpr;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      /* nodes */
      for (const p of particles) {
        p.x += p.vx * dpr;
        p.y += p.vy * dpr;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        if (p.hot) {
          /* 高亮节点：金色脉冲光晕 */
          const pulse = 0.5 + 0.5 * Math.sin(t * 2 + p.phase);
          ctx.globalAlpha = 0.25 + pulse * 0.3;
          ctx.fillStyle = cHotDim;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (6 + pulse * 5) * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = cHot;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (p.r + 0.6) * dpr, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = cNode;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };

    const onVisibility = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      (entries) => { inView = entries[0].isIntersecting; },
      { threshold: 0 }
    );
    io.observe(canvas);

    loop();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
    };
  }, []);

  return (
    <section className="relative overflow-hidden fio-gradient-hero">
      <canvas
        ref={canvasRef}
        /* [AUDIT FIX 2026-09-25 R6-1] 必须显式 h-full w-full：canvas 是 replaced
           element，absolute + inset-0 不会拉伸它（CSS2.1 §10.3.8：绝对定位替换元素
           width:auto 取固有尺寸，over-constrained 时忽略 right）→ 此前恒为默认
           300×150 贴在左上角；且 resize() 把 offsetWidth×dpr 写回 width 属性，
           HiDPI 下固有尺寸每轮 resize 翻倍（dpr=2 → 600px）造成移动端横向溢出。
           显式 CSS 尺寸切断「属性尺寸=固有尺寸=布局尺寸」的自反馈环。 */
        className="pointer-events-none absolute inset-0 h-full w-full z-[var(--z-decor)]"
        aria-label={d.canvasLabel}
        role="img"
      />

      <div className="relative z-[var(--z-content)] mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-[92svh] flex-col justify-center py-28 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
          {/* LEFT — Positioning */}
          <div className="text-center lg:col-span-7 lg:text-left">
            <div className="fio-animate-fade-up fio-delay-1 mb-9">
              <span className="fio-eyebrow">{d.badge}</span>
            </div>

            <h1
              className="fio-animate-fade-up fio-delay-2 fio-heading-xl"
              style={{ color: "var(--fio-text)" }}
            >
              {d.titlePre}
              <br />
              <span style={{ color: "var(--fio-cream)" }}>{d.titleEm}</span>
            </h1>

            <p
              className="fio-animate-fade-up fio-delay-3 mx-auto mt-7 max-w-xl text-base leading-relaxed lg:mx-0"
              style={{ color: "var(--fio-text-2)" }}
            >
              {d.sub}
            </p>

            <div
              className="fio-animate-fade-up fio-delay-4 mt-10 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
            >
              <a href="mailto:contact@fidesorigin.com" className="fio-btn fio-btn-primary group">
                {d.ctaPrimary}
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </a>
              <a href="/admin/dashboard" className="fio-btn fio-btn-ghost">
                {d.ctaGhost}
              </a>
            </div>

            {/* Live screening — 真实产品能力前置 */}
            <HeroScreen d={d.screen} lang={lang} />
          </div>

          {/* RIGHT — Live screening panel + rotating seal */}
          <div className="fio-animate-fade-up fio-delay-3 relative mt-16 w-full lg:col-span-5 lg:mt-0">
            <div
              className="fio-ticks relative rounded-sm border"
              style={{
                borderColor: "var(--fio-border-light)",
                background: "var(--fio-ink-scrim)",
                boxShadow: "var(--fio-panel-shadow)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              {/* Window chrome */}
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: "1px solid var(--fio-border-hairline)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--fio-elevated)" }} />
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--fio-elevated)" }} />
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--fio-elevated)" }} />
                </div>
                <span className="font-mono text-[0.6875rem] tracking-wider" style={{ color: "var(--fio-text-3)" }}>
                  fidesorigin.com/admin
                </span>
              </div>

              <div className="px-5 py-5">
                {/* Stats row */}
                <div className="mb-5 grid grid-cols-3 gap-3">
                  {[
                    { label: d.statRisk, value: d.statRiskValue, color: "var(--fio-gold)" },
                    { label: d.statTx, value: d.statTxValue, color: "var(--fio-accent)" },
                    { label: d.statAlerts, value: d.statAlertsValue, color: "var(--fio-danger)" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="p-3"
                      style={{ background: "var(--fio-surface)", border: "1px solid var(--fio-border-hairline)" }}
                    >
                      <div className="font-mono text-[0.6875rem] uppercase tracking-wider" style={{ color: "var(--fio-text-3)" }}>
                        {s.label}
                      </div>
                      <div className="fio-num mt-1 text-lg font-semibold" style={{ color: s.color }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scanning bar */}
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[0.6875rem]" style={{ color: "var(--fio-text-3)" }}>
                    <span>{d.scanLabel}</span>
                    <span style={{ color: "var(--fio-gold)" }}>{d.scanActive}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden" style={{ background: "var(--fio-surface-2)" }}>
                    <div
                      className="h-full"
                      style={{
                        width: "72%",
                        background: "linear-gradient(90deg, var(--fio-steel), var(--fio-gold))",
                      }}
                    />
                  </div>
                </div>

                {/* Transaction stream */}
                <div className="space-y-2">
                  {[
                    { addr: "0x7a2f...9e3d", status: d.statusCleared, risk: "Low" },
                    { addr: "0x3b1c...7a2e", status: d.statusFlagged, risk: "High" },
                    { addr: "0x9f4d...2c1b", status: d.statusCleared, risk: "Low" },
                  ].map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2"
                      style={{ background: "var(--fio-surface)", border: "1px solid var(--fio-border-hairline)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: tx.risk === "Low" ? "var(--fio-gold)" : "var(--fio-danger)",
                            boxShadow: `0 0 4px ${tx.risk === "Low" ? "var(--fio-gold-dim)" : "var(--fio-danger-dim)"}`,
                          }}
                        />
                        <span className="font-mono text-xs" style={{ color: "var(--fio-text-2)" }}>
                          {tx.addr}
                        </span>
                      </div>
                      <span
                        className="px-2 py-0.5 font-mono text-[0.6875rem]"
                        style={{
                          color: tx.risk === "Low" ? "var(--fio-accent)" : "var(--fio-danger-light)",
                          background: tx.risk === "Low" ? "var(--fio-gold-dim)" : "var(--fio-danger-dim)",
                        }}
                      >
                        {tx.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rotating regulatory seal */}
            <div
              aria-hidden="true"
              className="absolute -right-5 -top-8 hidden h-28 w-28 sm:block"
            >
              <svg viewBox="0 0 120 120" className="h-full w-full">
                <defs>
                  <path id="fio-seal-circle" d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0" />
                </defs>
                <circle cx="60" cy="60" r="59" fill="var(--fio-ink-scrim)" stroke="var(--fio-gold-dim)" strokeWidth="1" />
                <circle cx="60" cy="60" r="33" fill="none" stroke="var(--fio-gold-dim)" strokeWidth="0.5" />
                <g className="fio-seal-ring">
                  <text fontSize="9.5" letterSpacing="2.2" fill="var(--fio-gold)" fontFamily="var(--font-mono)">
                    <textPath href="#fio-seal-circle">{d.sealText}</textPath>
                  </text>
                </g>
                {/* Center mark — shield check */}
                <path
                  d="M60 46 L72 52 L72 64 Q72 74 60 78 Q48 74 48 64 L48 52 Z"
                  fill="none"
                  stroke="var(--fio-gold)"
                  strokeWidth="1.2"
                />
                <path
                  d="M55 61 L58.5 64.5 L66 56.5"
                  fill="none"
                  stroke="var(--fio-cream)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Metrics strip — hairline grid, tabular numerals */}
        <div
          className="fio-animate-fade-up fio-delay-5 relative z-[var(--z-content)] grid grid-cols-2 border-t md:grid-cols-4"
          style={{ borderColor: "var(--fio-border-hairline)" }}
        >
          {d.metrics.map((m, i) => (
            <div
              key={m.label}
              /* [AUDIT FIX 2026-09-25 R6-9] 原条件类串会产出重复的
                 md:border-l（i 为奇数时两个分支都追加）；化简为单一表达式：
                 移动端奇数列加左分隔线，桌面端除首列外加左分隔线。 */
              className={`py-7 md:py-9 ${i % 2 === 1 ? "border-l" : ""} ${i > 0 ? "md:border-l" : ""}`}
              style={{ borderColor: "var(--fio-border-hairline)" }}
            >
              <div className="px-2 text-center md:px-4">
                <div className="fio-num text-2xl font-semibold md:text-3xl" style={{ color: "var(--fio-cream)" }}>
                  <CountUp value={m.value} />
                </div>
                <div className="mt-2 font-mono text-[0.6875rem] uppercase tracking-widest" style={{ color: "var(--fio-text-3)" }}>
                  {m.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[var(--z-decor)] h-24"
        style={{ background: "linear-gradient(to top, var(--fio-ink), transparent)" }}
      />
    </section>
  );
}
