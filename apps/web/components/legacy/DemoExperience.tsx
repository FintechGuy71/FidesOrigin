"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/dictionaries/en";
// [AUDIT FIX 2026-09-17 R1-019] 端点配置收口到共享模块（原三处口径不一）
import { PUBLIC_RISK_CHECK_URL } from "@/lib/risk-check";

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
.demo-input:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }
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
/* ⚠ 原为 background: var(--gold) —— 与基线 var(--accent) 同为
   var(--fio-gold) #c9a96e，hover 零视觉反馈，用户以为按钮点不动。 */
.demo-btn:hover { background: var(--gold-bright); }
.demo-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }
/* 基础态 display:none 是不可达分支：JSX 恒以 "demo-result safe/warning/danger" 渲染 */
.demo-result {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8rem;
}
.demo-result.safe { border-color: var(--success); }
.demo-result.warning { border-color: var(--warning); }
.demo-result.danger { border-color: var(--danger); }
/* flex-wrap: 三个页签在 375px 视口需约 430px（JP 文案更长），
   溢出后被 body{overflow-x:hidden} 裁掉，第三个页签不可见不可点。 */
.demo-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}
/* padding 8px 16px + 行高 ≈ 40px，低于 44×44 触控目标下限 */
.demo-tab {
  padding: 12px 16px;
  min-height: 44px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.demo-tab:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }
.demo-tab.active { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
@media (max-width: 900px) {
  .demo-grid { grid-template-columns: 1fr; }
}
`;

const SAMPLE_ADDRESS = "0x0330070fd38ec3bb94f58fa55d40368271e9e54a"; // OFAC 在册制裁地址（链上 sanctioned=true，演示即出真实 HIGH 结果）

// 公开只读风险查询端点（apps/api SCOPE.PUBLIC，免 key）
// 端点定义见 @/lib/risk-check（[AUDIT FIX 2026-09-17 R1-019] 单一真源）

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
    // [AUDIT FIX 2026-09-18 R3-M4] 重入守卫（与 AddressCheck 同口径）
    if (screen.kind === "checking") return;
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
    const safe = !(sanctioned || level === "HIGH" || level === "CRITICAL" || score >= 70); // [R3-L14] 阈值统一 + CRITICAL 兜底
    setScreen({
      kind: "done",
      address,
      safe,
      score,
      level,
      flags: (data.tags || []).join(", ") || dict.sanctionsNone,
      /* [AUDIT FIX 2026-09-17 R1-020] API 未返回更新时间时原实现用**当天日期**
         填充「Last updated」，虚报数据新鲜度。缺失时显示占位符。 */
      date: (data.last_updated_at || "").slice(0, 10) || "—",
    });
  };

  const runRisk = async () => {
    // [AUDIT FIX 2026-09-18 R3-M4] 重入守卫
    if (risk.kind === "analyzing") return;
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

  /* [AUDIT FIX R2-055] 原 tabs 有三个（screen/risk/policy），但：
     ① role="tab"/aria-selected 不切换任何内容——两块面板恒并排显示，
        是"假 tablist"（向读屏承诺了 tab 语义却无对应交互）；
     ② policy tab 根本没有对应面板。
     改为真实 tab：screen/risk 两个面板按 activeTab 切换显示，移除无内容的
     policy tab，并补标准键盘导航（←/→ 切换、Home/End 跳首尾）。
     dict.tabPolicy 键保留（四语言字典结构对齐），此处不再消费。 */
  const tabs = [
    { id: "screen", label: dict.tabScreen },
    { id: "risk", label: dict.tabRisk },
  ];

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setActiveTab(tabs[next].id);
      document.getElementById(`demo-tab-${tabs[next].id}`)?.focus();
    }
  };

  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + DEMO_CSS + "}" }} />
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
          <div className="demo-tabs reveal" role="tablist" aria-label={dict.howTitle} onKeyDown={onTabKeyDown}>
            {tabs.map((t) => (
              <button
                key={t.id}
                id={`demo-tab-${t.id}`}
                className={`demo-tab${activeTab === t.id ? " active" : ""}`}
                role="tab"
                type="button"
                aria-selected={activeTab === t.id}
                aria-controls={`demo-panel-${t.id}`}
                tabIndex={activeTab === t.id ? 0 : -1}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="demo-grid">
            {/* Address Screening */}
            {activeTab === "screen" && (
            <div
              className="demo-card reveal"
              id="demo-panel-screen"
              role="tabpanel"
              aria-labelledby="demo-tab-screen"
              style={{ gridColumn: "1 / -1" }}
            >
              <h3>{dict.screenTitle}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "16px" }}>
                {dict.screenDesc}
              </p>
              <input
                type="text"
                className="demo-input"
                placeholder="0x..."
                aria-label={dict.screenAddressLabel}
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
            )}

            {/* Risk Score */}
            {activeTab === "risk" && (
            <div
              className="demo-card reveal"
              id="demo-panel-risk"
              role="tabpanel"
              aria-labelledby="demo-tab-risk"
              style={{ gridColumn: "1 / -1" }}
            >
              <h3>{dict.riskTitle}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "16px" }}>
                {dict.riskDesc}
              </p>
              <input
                type="text"
                className="demo-input"
                placeholder="0x..."
                aria-label={dict.riskAddressLabel}
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
            )}
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
