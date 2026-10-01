"use client";

import Link from "next/link";
import Reveal from "@/components/Reveal";
import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";

/* ================================================================
   TRUST v4 — Regulatory coverage band + institutional quote.
   [v5] 增补「链上自行验证」行：机构级信任背书不依赖口号，
   而是给出可独立核实的入口（Sepolia 合约 / 开源代码 / 文档）。
   ================================================================ */

/* RiskRegistry 主合约（Sepolia 测试网，见 repo CONTRACT_DEPLOYMENT_STATUS.md） */
const RISK_REGISTRY_ADDRESS = "0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3";

export default function Trust({ d, lang }: { d: Dict["home"]["trust"]; lang: Locale }) {
  const badges = [
    { label: d.badge1Label, status: d.badge1Status },
    { label: d.badge2Label, status: d.badge2Status },
    { label: d.badge3Label, status: d.badge3Status },
    { label: d.badge4Label, status: d.badge4Status },
  ];
  const coverage = [d.coverage1, d.coverage2, d.coverage3, d.coverage4];
  return (
    <section id="security" style={{ background: "var(--fio-ink-soft)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 2xl:max-w-7xl">
        <div className="py-[var(--section-py)] md:py-[var(--section-py-lg)]">
          {/* Coverage band */}
          <Reveal>
          <div className="mb-20 text-center">
            {/* [AUDIT FIX 2026-09-25 R6-10] 原写法 className="justify-center"
                + 内联 justifyContent 均无效：.fio-eyebrow 是 inline-flex，
                justify-content 不作用于 inline 级盒；居中由父级 text-center
                承担（本容器已有）。删除两处死声明。 */}
            <div className="fio-eyebrow mb-8">
              {d.coverageCaption}
            </div>
            <div className="grid grid-cols-2 gap-px md:grid-cols-4" style={{ background: "var(--fio-border-hairline)", border: "1px solid var(--fio-border-hairline)" }}>
              {coverage.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-center px-4 py-6 text-center"
                  style={{ background: "var(--fio-ink-soft)" }}
                >
                  <span className="font-mono text-xs tracking-wider" style={{ color: "var(--fio-text-2)" }}>
                    {c}
                  </span>
                </div>
              ))}
            </div>
          </div>
          </Reveal>

          {/* Capability badges */}
          <Reveal delay={0.1}>
          <div className="mb-20 flex flex-wrap items-center justify-center gap-3">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2.5 border px-4 py-2.5"
                style={{
                  borderColor: "var(--fio-border-light)",
                  background: "var(--fio-surface)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "var(--fio-gold)",
                    boxShadow: "0 0 6px var(--fio-gold-dim)",
                  }}
                />
                <span className="text-xs font-medium" style={{ color: "var(--fio-text-2)" }}>
                  {badge.label}
                </span>
                <span className="bg-[var(--fio-gold-dim)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--fio-accent)]">
                  {badge.status}
                </span>
              </div>
            ))}
          </div>
          </Reveal>

          {/* [v5] Verify row — 可独立核实的信任入口（合约浏览器 / 源码 / 文档） */}
          <Reveal delay={0.12}>
            <div className="mb-20">
              <div className="fio-eyebrow mb-6">
                {d.verifyCaption}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {[
                  {
                    key: "contract",
                    label: d.verifyContract,
                    href: `https://sepolia.etherscan.io/address/${RISK_REGISTRY_ADDRESS}`,
                    external: true,
                  },
                  {
                    key: "source",
                    label: d.verifySource,
                    href: "https://github.com/FintechGuy71/FidesOrigin",
                    external: true,
                  },
                  {
                    key: "docs",
                    label: d.verifyDocs,
                    href: localize("/docs", lang),
                    external: false,
                  },
                ].map((v) =>
                  v.external ? (
                    <a
                      key={v.key}
                      href={v.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2.5 border px-4 py-2.5 transition-colors"
                      style={{ borderColor: "var(--fio-border-light)", background: "var(--fio-surface)" }}
                    >
                      <span className="font-mono text-xs" style={{ color: "var(--fio-text-2)" }}>
                        {v.label}
                      </span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: "var(--fio-gold)" }} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                      </svg>
                    </a>
                  ) : (
                    <Link
                      key={v.key}
                      href={v.href}
                      prefetch={false}
                      className="group flex items-center gap-2.5 border px-4 py-2.5 transition-colors"
                      style={{ borderColor: "var(--fio-border-light)", background: "var(--fio-surface)" }}
                    >
                      <span className="font-mono text-xs" style={{ color: "var(--fio-text-2)" }}>
                        {v.label}
                      </span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5" style={{ color: "var(--fio-gold)" }} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                      </svg>
                    </Link>
                  )
                )}
              </div>
            </div>
          </Reveal>

          {/* Big quote */}
          <Reveal delay={0.15}>
          <div className="mx-auto max-w-3xl text-center">
            <div
              aria-hidden="true"
              className="mb-6 font-serif text-7xl leading-none"
              style={{ color: "var(--fio-gold)", opacity: 0.45 }}
            >
              &ldquo;
            </div>
            <p className="mb-8 font-serif text-xl leading-relaxed sm:text-2xl" style={{ color: "var(--fio-text)", fontStyle: "normal" }}>
              {d.quote}
            </p>
            <div className="flex items-center justify-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--fio-gold-dim)] bg-[var(--fio-gold-glow)] text-xs font-medium text-[var(--fio-gold)]"
              >
                {d.quoteName.slice(0, 1)}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: "var(--fio-text)" }}>
                  {d.quoteName}
                </div>
                <div className="text-xs" style={{ color: "var(--fio-text-3)" }}>{d.quoteRole}</div>
              </div>
            </div>
          </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
