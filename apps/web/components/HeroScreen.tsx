"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";

/* ================================================================
   HERO LIVE SCREENING — 首屏内嵌真实地址筛查。
   直接调用公开只读端点（SCOPE.PUBLIC，免 key），
   让访客 10 秒内体验产品 —— "This is live" 是最强信任信号。
   ================================================================ */

const PUBLIC_RISK_CHECK_URL =
  "https://fidesorigin-api.vercel.app/v1/public/risk-check";

type ApiResponse = {
  risk_score?: number;
  risk_level?: string;
  tags?: string[];
};

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; score: number; level: string; tag: string | null }
  | { kind: "invalid" }
  | { kind: "error" };

function isAddress(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v.trim());
}

export default function HeroScreen({
  d,
  lang,
}: {
  d: Dict["home"]["hero"]["screen"];
  lang: Locale;
}) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async () => {
    if (!isAddress(value)) {
      setState({ kind: "invalid" });
      return;
    }
    setState({ kind: "checking" });
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(
        `${PUBLIC_RISK_CHECK_URL}?address=${encodeURIComponent(value.trim())}&chainId=11155111`,
        { headers: { Accept: "application/json" }, signal: controller.signal }
      );
      clearTimeout(t);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ApiResponse;
      setState({
        kind: "done",
        score: data.risk_score ?? 0,
        level: (data.risk_level ?? "UNKNOWN").toUpperCase(),
        tag: data.tags?.[0] ?? null,
      });
    } catch {
      setState({ kind: "error" });
    }
  };

  const levelColor = (level: string) =>
    level === "CRITICAL" || level === "HIGH"
      ? "var(--fio-danger-light)"
      : level === "MEDIUM"
        ? "var(--fio-warn)"
        : "var(--fio-success)";

  return (
    <div
      className="fio-animate-fade-up fio-delay-5 mt-10 w-full max-w-xl"
      style={{
        border: "1px solid var(--fio-border-light)",
        background: "var(--fio-ink-scrim)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* header row */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--fio-border-hairline)" }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: "var(--fio-gold)" }}
        />
        <span
          className="font-mono text-[0.6875rem] uppercase tracking-widest"
          style={{ color: "var(--fio-text-3)" }}
        >
          {d.label}
        </span>
      </div>

      {/* input row */}
      <div className="flex items-stretch gap-2 p-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={d.placeholder}
          aria-label={d.label}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 border px-3 py-2 font-mono text-xs outline-none transition-colors"
          style={{
            background: "var(--fio-surface)",
            borderColor: "var(--fio-border)",
            color: "var(--fio-text)",
          }}
        />
        <button
          onClick={submit}
          disabled={state.kind === "checking"}
          className="fio-btn fio-btn-primary shrink-0 px-4 py-2 text-xs"
        >
          {state.kind === "checking" ? d.checking : d.button}
        </button>
      </div>

      {/* result row */}
      {state.kind !== "idle" && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-1"
          role="status"
          aria-live="polite"
        >
          {state.kind === "checking" && (
            <span className="font-mono text-xs" style={{ color: "var(--fio-text-3)" }}>
              {d.checking}
            </span>
          )}
          {state.kind === "invalid" && (
            <span className="font-mono text-xs" style={{ color: "var(--fio-warn)" }}>
              {d.invalid}
            </span>
          )}
          {state.kind === "error" && (
            <span className="font-mono text-xs" style={{ color: "var(--fio-danger-light)" }}>
              {d.error}
            </span>
          )}
          {state.kind === "done" && (
            <>
              <span
                className="px-2 py-0.5 font-mono text-[0.6875rem] font-semibold"
                style={{
                  color: levelColor(state.level),
                  border: `1px solid ${levelColor(state.level)}`,
                }}
              >
                {state.level}
              </span>
              <span className="fio-num text-xs" style={{ color: "var(--fio-text-2)" }}>
                {d.scoreLabel} {state.score}/100
              </span>
              {state.tag && (
                <span
                  className="px-1.5 py-0.5 font-mono text-[0.6875rem]"
                  style={{ color: "var(--fio-text-3)", background: "var(--fio-surface-2)" }}
                >
                  {state.tag}
                </span>
              )}
              <a
                href={localize("/demo", lang)}
                className="ml-auto font-mono text-xs transition-colors"
                style={{ color: "var(--fio-accent)" }}
              >
                {d.fullDemo} →
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
