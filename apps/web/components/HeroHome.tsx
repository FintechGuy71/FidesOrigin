"use client";

import { useEffect, useRef } from "react";

/* ================================================================
   HERO v3 — Product-first layout. Left story, right product.
   ================================================================ */

export default function HeroHome() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ---- Subtle grid + scan line animation ---- */
  useEffect(() => {
    try {
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
          ctx.strokeStyle = "rgba(255,255,255,0.015)";
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
          scanGradient.addColorStop(0, "rgba(139,126,200,0)");
          scanGradient.addColorStop(0.5, "rgba(139,126,200,0.02)");
          scanGradient.addColorStop(1, "rgba(139,126,200,0)");
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
        className="pointer-events-none absolute inset-0 z-0"
        style={{ width: "100%", height: "100%" }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-[92vh] flex-col items-center justify-center py-24 lg:flex-row lg:items-center lg:gap-16">
          {/* LEFT — Story */}
          <div className="flex-1 text-center lg:text-left">
            {/* Label */}
            <div
              className="fio-animate-fade-up fio-delay-1 mb-8 inline-flex items-center gap-3 rounded-sm px-4 py-2"
              style={{
                background: "rgba(201,169,110,0.06)",
                border: "1px solid rgba(201,169,110,0.12)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--fio-gold)", boxShadow: "0 0 6px rgba(201,169,110,0.4)" }}
              />
              <span className="fio-caption" style={{ color: "var(--fio-gold)" }}>
                v1.0 — 香港稳定币法案合规就绪
              </span>
            </div>

            {/* Headline */}
            <h1
              className="fio-animate-fade-up fio-delay-2 fio-heading-xl"
              style={{ color: "var(--fio-text)" }}
            >
              On-Chain Compliance,
              <br />
              <span style={{ color: "var(--fio-accent)", fontStyle: "italic" }}>
                Executed in Real-Time
              </span>
            </h1>

            {/* Subheadline */}
            <p
              className="fio-animate-fade-up fio-delay-3 mt-6 max-w-lg text-base leading-relaxed"
              style={{ color: "var(--fio-text-2)" }}
            >
              链上执行级可编程合规协议。实时风控、智能策略执行、
              不可篡改审计追踪 — 为稳定币、RWA 代币化与 DeFi 协议而生。
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
                Request Demo
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
                href="https://github.com/FintechGuy71/FidesOrigin"
                target="_blank"
                rel="noopener noreferrer"
                className="fio-btn fio-btn-ghost"
              >
                View Documentation
              </a>
            </div>
          </div>

          {/* RIGHT — Product Visual */}
          <div
            className="fio-animate-fade-up fio-delay-3 mt-14 w-full max-w-lg lg:mt-0 lg:flex-1"
          >
            <div
              className="relative overflow-hidden rounded-lg border p-1"
              style={{
                borderColor: "rgba(255,255,255,0.06)",
                background: "linear-gradient(135deg, rgba(139,126,200,0.04) 0%, rgba(7,8,16,0.8) 50%, rgba(201,169,110,0.03) 100%)",
                boxShadow: "0 0 60px rgba(139,126,200,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              {/* Top bar — window chrome */}
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
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
                    { label: "Risk Score", value: "Low", color: "var(--fio-gold)" },
                    { label: "Tx Monitored", value: "12,847", color: "var(--fio-accent)" },
                    { label: "Alerts", value: "3", color: "var(--fio-danger)" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-md p-3"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="text-[0.65rem] font-mono uppercase tracking-wider" style={{ color: "var(--fio-text-3)" }}>
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
                  <div className="mb-1.5 flex items-center justify-between text-[0.65rem] font-mono" style={{ color: "var(--fio-text-3)" }}>
                    <span>Live Risk Scan</span>
                    <span style={{ color: "var(--fio-gold)" }}>ACTIVE</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.03)" }}>
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
                    { addr: "0x7a2f...9e3d", status: "Cleared", risk: "Low" },
                    { addr: "0x3b1c...7a2e", status: "Flagged", risk: "High" },
                    { addr: "0x9f4d...2c1b", status: "Cleared", risk: "Low" },
                  ].map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: tx.risk === "Low" ? "var(--fio-gold)" : "var(--fio-danger)",
                            boxShadow: `0 0 4px ${tx.risk === "Low" ? "rgba(201,169,110,0.4)" : "rgba(220,38,38,0.4)"}`,
                          }}
                        />
                        <span className="text-xs font-mono" style={{ color: "var(--fio-text-2)" }}>
                          {tx.addr}
                        </span>
                      </div>
                      <span
                        className="rounded-sm px-2 py-0.5 text-[0.65rem] font-mono"
                        style={{
                          color: tx.risk === "Low" ? "var(--fio-gold)" : "var(--fio-danger)",
                          background: tx.risk === "Low" ? "rgba(201,169,110,0.08)" : "rgba(220,38,38,0.08)",
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
                background: "rgba(7,8,16,0.9)",
                borderColor: "rgba(201,169,110,0.15)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--fio-gold)" }} />
              <span className="text-[0.65rem] font-mono" style={{ color: "var(--fio-gold)" }}>
                HKMA License Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: "linear-gradient(to top, var(--fio-ink), transparent)",
        }}
      />
    </section>
  );
}
