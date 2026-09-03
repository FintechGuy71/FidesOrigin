"use client";

import { useEffect, useRef } from "react";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   HERO v3 — Product-first layout. Left story, right product.
   ================================================================ */

export default function HeroHome({ d }: { d: Dict["home"]["hero"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ---- Subtle grid + scan line animation ---- */
  useEffect(() => {
    try {
      /* 尊重系统"减少动态效果"偏好：扫描线是无限 rAF 重绘，
         对前庭功能敏感的用户构成持续干扰，也应省电。 */
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let w = 0, h = 0;
      const resize = () => {
        w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      };
      resize();
      window.addEventListener("resize", resize);

      let offset = 0;
      let frame = 0;

      const draw = () => {
        try {
          frame = requestAnimationFrame(draw);
          ctx.clearRect(0, 0, w, h);

          const gridSize = 80 * window.devicePixelRatio;
          ctx.strokeStyle = "var(--fio-surface)";
          ctx.lineWidth = 0.5;

          for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          offset = (offset + 0.3) % h;
          const scanGradient = ctx.createLinearGradient(0, offset - 80, 0, offset + 80);
          scanGradient.addColorStop(0, "transparent");
          scanGradient.addColorStop(0.5, "var(--fio-accent-glow)");
          scanGradient.addColorStop(1, "transparent");
          ctx.fillStyle = scanGradient;
          ctx.fillRect(0, offset - 80, w, 160);
        } catch (err) {
          console.error("Canvas draw error:", err);
          cancelAnimationFrame(frame);
        }
      };
      draw();

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
      };
    } catch (err) {
      console.error("Canvas init error:", err);
    }
  }, []);

  return (
    <section className="relative overflow-hidden fio-gradient-hero">
      <canvas
        ref={canvasRef}
        /* inset-0 已等价于 top/right/bottom/left:0，块级 canvas 自动填满，
           原先的内联 width/height:100% 是冗余且无法被响应式覆盖。 */
        className="pointer-events-none absolute inset-0 z-[var(--z-decor)]"
        aria-label={d.canvasLabel}
        role="img"
      />

      <div className="relative z-[var(--z-content)] mx-auto max-w-6xl px-4 sm:px-6">
        {/* svh = 小视口高度。原 vh 在移动浏览器上按"地址栏隐藏时"计算，
            iOS Safari / Chrome Android 显示地址栏时 92vh 会溢出可见区域
            8–15%，用户必须滚动才能看到 CTA 与产品卡底部。 */}
        <div className="flex min-h-[92svh] flex-col items-center justify-center py-24 lg:flex-row lg:items-center lg:gap-16">
          {/* LEFT — Story */}
          <div className="flex-1 text-center lg:text-left">
            {/* Label */}
            <div
              className="fio-animate-fade-up fio-delay-1 mb-8 inline-flex items-center gap-3 rounded-sm px-4 py-2"
              style={{
                background: "var(--fio-gold-glow)",
                border: "1px solid var(--fio-gold-dim)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--fio-gold)", boxShadow: "0 0 6px var(--fio-gold-dim)" }}
              />
              <span className="fio-caption" style={{ color: "var(--fio-gold)" }}>
                {d.badge}
              </span>
            </div>

            {/* Headline */}
            <h1
              className="fio-animate-fade-up fio-delay-2 fio-heading-xl"
              style={{ color: "var(--fio-text)" }}
            >
              {d.titlePre}
              <br />
              <span style={{ color: "var(--fio-accent)", fontStyle: "italic" }}>
                {d.titleEm}
              </span>
            </h1>

            {/* Subheadline */}
            <p
              className="fio-animate-fade-up fio-delay-3 mt-6 max-w-lg text-base leading-relaxed"
              style={{ color: "var(--fio-text-2)" }}
            >
              {d.sub}
            </p>

            {/* Divider */}
            <div
              className="fio-animate-fade-up fio-delay-3 mt-8 h-px w-16 lg:mx-0"
              style={{ background: "linear-gradient(90deg, var(--fio-accent), transparent)" }}
            />

            {/* CTAs */}
            <div
              className="fio-animate-fade-up fio-delay-4 mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start"
            >
              <a
                href="mailto:contact@fidesorigin.com"
                className="fio-btn fio-btn-primary group"
              >
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
              <a
                href="/admin/dashboard"
                className="fio-btn fio-btn-ghost"
              >
                {d.ctaGhost}
              </a>
            </div>
          </div>

          {/* RIGHT — Product Visual */}
          {/* 必须 relative：下方的悬浮徽章用 absolute -bottom-3 -right-3 定位，
              原先这两层之间没有任何定位祖先，徽章会漂到整个 max-w-6xl
              容器的右下角，而不是产品卡右下角。 */}
          <div
            className="fio-animate-fade-up fio-delay-3 relative mt-14 w-full max-w-lg lg:mt-0 lg:flex-1"
          >
            <div
              className="relative overflow-hidden rounded-lg border p-1"
              style={{
                borderColor: "var(--fio-border-light)",
                background: "linear-gradient(135deg, var(--fio-accent-glow) 0%, var(--fio-ink-scrim) 50%, var(--fio-gold-glow) 100%)",
                boxShadow: "0 0 60px var(--fio-accent-dim), inset 0 1px 0 var(--fio-border-subtle)",
              }}
            >
              {/* Top bar — window chrome */}
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: "1px solid var(--fio-border-hairline)" }}
              >
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--fio-elevated)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--fio-elevated)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--fio-elevated)" }} />
                </div>
                <span className="ml-3 text-xs font-mono" style={{ color: "var(--fio-text-3)" }}>
                  fidesorigin.com/admin
                </span>
              </div>

              {/* Dashboard mockup content */}
              <div className="px-4 py-5">
                {/* Stats row */}
                <div className="mb-5 grid grid-cols-3 gap-3">
                  {[
                    { label: d.statRisk, value: d.statRiskValue, color: "var(--fio-gold)" },
                    { label: d.statTx, value: "12,847", color: "var(--fio-accent)" },
                    { label: d.statAlerts, value: "3", color: "var(--fio-danger)" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-md p-3"
                      style={{ background: "var(--fio-surface)", border: "1px solid var(--fio-border-hairline)" }}
                    >
                      <div className="text-[0.6875rem] font-mono uppercase tracking-wider" style={{ color: "var(--fio-text-3)" }}>
                        {s.label}
                      </div>
                      <div className="mt-1 text-lg font-semibold font-mono" style={{ color: s.color }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scanning animation bar */}
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between text-[0.6875rem] font-mono" style={{ color: "var(--fio-text-3)" }}>
                    <span>{d.scanLabel}</span>
                    <span style={{ color: "var(--fio-gold)" }}>{d.scanActive}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--fio-surface-2)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "72%",
                        background: "linear-gradient(90deg, var(--fio-accent), var(--fio-gold))",
                      }}
                    />
                  </div>
                </div>

                {/* Transaction list mock */}
                <div className="space-y-2">
                  {[
                    { addr: "0x7a2f...9e3d", status: d.statusCleared, risk: "Low" },
                    { addr: "0x3b1c...7a2e", status: d.statusFlagged, risk: "High" },
                    { addr: "0x9f4d...2c1b", status: d.statusCleared, risk: "Low" },
                  ].map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md px-3 py-2"
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
                        <span className="text-xs font-mono" style={{ color: "var(--fio-text-2)" }}>
                          {tx.addr}
                        </span>
                      </div>
                      <span
                        className="rounded-sm px-2 py-0.5 text-[0.6875rem] font-mono"
                        style={{
                          color: tx.risk === "Low" ? "var(--fio-gold)" : "var(--fio-danger)",
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

            {/* Floating badge */}
            <div
              className="absolute -bottom-3 -right-3 flex items-center gap-2 rounded-md border px-3 py-2"
              style={{
                background: "var(--fio-ink-scrim)",
                borderColor: "var(--fio-gold-dim)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--fio-gold)" }} />
              <span className="text-[0.6875rem] font-mono" style={{ color: "var(--fio-gold)" }}>
                {d.floatBadge}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade —— 显式 z-index：原先靠"正 z-index 排在第 9 步、
          auto 排在第 8 步"的隐式规则才恰好压住 canvas 而不压内容，
          没有任何说明，极易在后续改动中被破坏。 */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[var(--z-decor)] h-32"
        style={{
          background: "linear-gradient(to top, var(--fio-ink), transparent)",
        }}
      />
    </section>
  );
}
