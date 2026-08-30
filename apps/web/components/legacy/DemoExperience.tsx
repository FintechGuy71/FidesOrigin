"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   DEMO EXPERIENCE — interactive demo page content (all locales).
   Faithful port of the legacy demo.html behavior: cosmetic tabs and
   simulated screening / risk-score results.
   ================================================================ */

const DEMO_CSS = `
.demo-hero { padding: 140px 0 60px; text-align: center; }
.demo-hero .display { font-size: clamp(2rem, 4.5vw, 3.2rem); }
.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-top: 48px;
}
.demo-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
}
.demo-card h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; }
.demo-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  margin-bottom: 12px;
}
.demo-input:focus { outline: none; border-color: var(--accent); }
.demo-btn {
  width: 100%;
  padding: 12px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.demo-btn:hover { background: var(--gold); }
.demo-result {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  display: none;
}
.demo-result.show { display: block; }
.demo-result.safe { border-color: rgba(74,222,128,0.3); }
.demo-result.warning { border-color: rgba(251,191,36,0.3); }
.demo-result.danger { border-color: rgba(248,113,113,0.3); }
.demo-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.demo-tab {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.demo-tab.active { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
.demo-panel { display: none; }
.demo-panel.active { display: block; }
@media (max-width: 900px) {
  .demo-grid { grid-template-columns: 1fr; }
}
`;

const SAMPLE_ADDRESS = "0x0330070fd38ec3bb94f58fa55d40368271e9e54a"; // OFAC 在册制裁地址（链上 sanctioned=true，演示即出真实 HIGH 结果）

// 公开只读风险查询端点（apps/api SCOPE.PUBLIC，免 key）
const PUBLIC_RISK_CHECK_URL = "https://fidesorigin-api.vercel.app/v1/public/risk-check";

type D = Dict["demo"];

type RiskApiResponse = {
  risk_score?: number;
  risk_level?: string;
  risk_factors?: { name?: string; type?: string; severity?: string }[];
  tags?: string[];
  transactions_count?: number;
  last_updated_at?: string | null;
};

async function fetchRisk(address: string): Promise<RiskApiResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${PUBLIC_RISK_CHECK_URL}?address=${encodeURIComponent(address)}&chainId=11155111`,
      { headers: { Accept: "application/json" }, signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as RiskApiResponse;
  } catch {
    return null;
  }
}

type ScreenState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; address: string; safe: boolean; score: number; level: string; flags: string; date: string }
  | { kind: "error" };

type RiskState =
  | { kind: "idle" }
  | { kind: "analyzing" }
  | { kind: "done"; score: number; tier: string; factors: string[]; txs: number; updated: string }
  | { kind: "error" };

export default function DemoExperience({ dict }: { dict: D }) {
  const [activeTab, setActiveTab] = useState("screen");
  const [screenAddress, setScreenAddress] = useState(SAMPLE_ADDRESS);
  const [riskAddress, setRiskAddress] = useState(SAMPLE_ADDRESS);
  const [screen, setScreen] = useState<ScreenState>({ kind: "idle" });
  const [risk, setRisk] = useState<RiskState>({ kind: "idle" });

  const runScreen = async () => {
    const address = screenAddress.trim().toLowerCase();
    setScreen({ kind: "checking" });
    const data = await fetchRisk(address);
    if (!data) {
      setScreen({ kind: "error" });
      return;
    }
    const score = data.risk_score ?? 0;
    const level = data.risk_level || "UNKNOWN";
    const sanctioned = (data.tags || []).length > 0 || level === "CRITICAL";
    const safe = !(sanctioned || level === "HIGH" || score >= 80);
    setScreen({
      kind: "done",
      address,
      safe,
      score,
      level,
      flags: (data.tags || []).join(", ") || dict.sanctionsNone,
      date: (data.last_updated_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    });
  };

  const runRisk = async () => {
    const address = riskAddress.trim().toLowerCase();
    setRisk({ kind: "analyzing" });
    const data = await fetchRisk(address);
    if (!data) {
      setRisk({ kind: "error" });
      return;
    }
    const score = data.risk_score ?? 0;
    const factors = (data.risk_factors || [])
      .map((f) => f.name || f.type || "")
      .filter(Boolean);
    setRisk({
      kind: "done",
      score,
      tier: data.risk_level || "UNKNOWN",
      factors,
      txs: data.transactions_count ?? 0,
      updated: (data.last_updated_at || "").slice(0, 10),
    });
  };

  const tabs = [
    { id: "screen", label: dict.tabScreen },
    { id: "risk", label: dict.tabRisk },
    { id: "policy", label: dict.tabPolicy },
  ];

  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: DEMO_CSS }} />
      {/* Hero */}
      <section className="demo-hero">
        <div className="container">
          <div className="reveal">
            <p className="micro">{dict.micro}</p>
            <h1 className="display">
              {dict.titlePre} <span>{dict.titleEm}</span>
            </h1>
            <p className="lead" style={{ maxWidth: "600px", margin: "20px auto 0" }}>
              {dict.lead}
            </p>
          </div>
        </div>
      </section>

      {/* Demo Grid */}
      <section className="section" style={{ paddingTop: "0" }}>
        <div className="container">
          <div className="demo-tabs reveal">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`demo-tab${activeTab === t.id ? " active" : ""}`}
                data-tab={t.id}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="demo-grid">
            {/* Address Screening */}
            <div className="demo-card reveal">
              <h3>{dict.screenTitle}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "16px" }}>
                {dict.screenDesc}
              </p>
              <input
                type="text"
                className="demo-input"
                placeholder="0x..."
                value={screenAddress}
                onChange={(e) => setScreenAddress(e.target.value)}
              />
              <button className="demo-btn" onClick={runScreen}>
                {dict.screenBtn}
              </button>
              {screen.kind !== "idle" && (
                <div
                  className={`demo-result show${
                    screen.kind === "done" ? (screen.safe ? " safe" : " danger") : ""
                  }`}
                >
                  {screen.kind === "checking" && dict.checking}
                  {screen.kind === "error" && (
                    <span style={{ color: "var(--warning)" }}>{dict.unavailable}</span>
                  )}
                  {screen.kind === "done" && screen.safe && (
                    <>
                      <span style={{ color: "var(--success)" }}>{dict.compliant}</span>
                      <br />
                      {dict.addressLabel}: {screen.address.slice(0, 20)}...
                      <br />
                      {dict.riskScoreLabel}: {dict.tierLow} ({screen.score}/100)
                      <br />
                      {dict.sanctionsLabel}: {dict.sanctionsNone}
                      <br />
                      {dict.lastUpdatedLabel}: {screen.date}
                    </>
                  )}
                  {screen.kind === "done" && !screen.safe && (
                    <>
                      <span style={{ color: "var(--danger)" }}>{dict.highRiskResult}</span>
                      <br />
                      {dict.addressLabel}: {screen.address.slice(0, 20)}...
                      <br />
                      {dict.riskScoreLabel}: {dict.tierHigh} ({screen.score}/100)
                      <br />
                      {dict.flagsLabel}: {screen.flags}
                      <br />
                      {dict.actionLabel}: {dict.actionBlocked}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Risk Score */}
            <div className="demo-card reveal">
              <h3>{dict.riskTitle}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "16px" }}>
                {dict.riskDesc}
              </p>
              <input
                type="text"
                className="demo-input"
                placeholder="0x..."
                value={riskAddress}
                onChange={(e) => setRiskAddress(e.target.value)}
              />
              <button className="demo-btn" onClick={runRisk}>
                {dict.riskBtn}
              </button>
              {risk.kind !== "idle" && (
                <div
                  className={`demo-result show${
                    risk.kind === "done"
                      ? risk.score < 30
                        ? " safe"
                        : risk.score < 70
                          ? " warning"
                          : " danger"
                      : ""
                  }`}
                >
                  {risk.kind === "analyzing" && dict.analyzing}
                  {risk.kind === "error" && (
                    <span style={{ color: "var(--warning)" }}>{dict.unavailable}</span>
                  )}
                  {risk.kind === "done" && (
                    <>
                      {dict.riskScoreLabel}:{" "}
                      <span
                        style={{
                          color:
                            risk.score < 30
                              ? "var(--success)"
                              : risk.score < 70
                                ? "var(--warning)"
                                : "var(--danger)",
                          fontWeight: 600,
                        }}
                      >
                        {risk.score}/100 ({risk.tier})
                      </span>
                      <br />
                      <br />
                      {dict.breakdownLabel}:
                      <br />
                      • {dict.sanctionsLabel}: {risk.factors.length > 0 ? risk.factors.join(", ") : dict.clean}
                      <br />
                      • {dict.txLabel}: {risk.txs}
                      <br />• {dict.lastUpdatedLabel}: {risk.updated || "-"}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section bg-secondary">
        <div className="container">
          <div className="reveal section-intro">
            <p className="micro">{dict.howMicro}</p>
            <h2 className="h2 section-title">{dict.howTitle}</h2>
          </div>
          <div className="steps">
            <div className="step reveal">
              <div className="step-number">1</div>
              <h3>{dict.step1Title}</h3>
              <p>{dict.step1Desc}</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step reveal">
              <div className="step-number">2</div>
              <h3>{dict.step2Title}</h3>
              <p>{dict.step2Desc}</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step reveal">
              <div className="step-number">3</div>
              <h3>{dict.step3Title}</h3>
              <p>{dict.step3Desc}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
