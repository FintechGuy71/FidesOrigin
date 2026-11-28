"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";
import { PUBLIC_RISK_CHECK_URL } from "@/lib/risk-check";

type ApiResponse = { risk_score?: number; risk_level?: string; tags?: string[] };
type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; score: number; level: string; tag: string | null }
  | { kind: "invalid" }
  | { kind: "error" };

function isAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export default function HeroScreen({ d, lang }: { d: Dict["home"]["hero"]["screen"]; lang: Locale }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state.kind === "checking") return;
    if (!isAddress(value)) {
      setState({ kind: "invalid" });
      return;
    }
    setState({ kind: "checking" });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(
        `${PUBLIC_RISK_CHECK_URL}?address=${encodeURIComponent(value.trim())}&chainId=11155111`,
        { headers: { Accept: "application/json" }, signal: controller.signal },
      );
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as ApiResponse;
      setState({ kind: "done", score: data.risk_score ?? 0, level: (data.risk_level ?? "UNKNOWN").toUpperCase(), tag: data.tags?.[0] ?? null });
    } catch {
      setState({ kind: "error" });
    } finally {
      clearTimeout(timeout);
    }
  };

  const levelColor = (level: string) =>
    level === "CRITICAL" || level === "HIGH" ? "var(--fio-danger)" : level === "MEDIUM" ? "var(--fio-warn)" : "var(--fio-success)";

  return (
    <div className="origin-screen">
      <div className="origin-screen-heading">
        <span>{d.label}</span>
        <span aria-hidden="true">⌁</span>
      </div>
      <form onSubmit={submit} noValidate className="origin-screen-form">
        <label htmlFor="hero-address" className="sr-only">{d.label}</label>
        <input
          id="hero-address"
          type="text"
          value={value}
          onChange={(event) => { setValue(event.target.value); if (state.kind === "invalid") setState({ kind: "idle" }); }}
          placeholder={d.placeholder}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          aria-invalid={state.kind === "invalid"}
          aria-describedby="hero-screen-result"
          className="fio-input"
        />
        <button type="submit" disabled={state.kind === "checking"} className="fio-btn fio-btn-primary">
          {state.kind === "checking" ? d.checking : d.button}
        </button>
      </form>
      <div id="hero-screen-result" className="origin-screen-result" role="status" aria-live="polite">
        {state.kind === "checking" && <span>{d.checking}</span>}
        {state.kind === "invalid" && <span className="origin-result-warning">{d.invalid}</span>}
        {state.kind === "error" && <span className="origin-result-error">{d.error}</span>}
        {state.kind === "done" && (
          <>
            <strong style={{ color: levelColor(state.level) }}>{state.level}</strong>
            <span className="fio-num">{d.scoreLabel} {state.score}/100</span>
            {state.tag && <span>{state.tag}</span>}
            <Link href={localize("/demo", lang)} prefetch={false}>{d.fullDemo} ↗</Link>
          </>
        )}
      </div>
    </div>
  );
}
