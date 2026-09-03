"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   ADDRESS CHECK — real address risk check (all locales).
   Faithful React port of legacy address-check.js: layered fallback
   backend API -> subgraph -> local JSON cache -> "not in database".
   ================================================================ */

const AC_CSS = `
.ac-hero { padding: 140px 0 60px; text-align: center; }
.ac-hero h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); margin-bottom: 12px; }
.ac-hero p.lead { color: var(--text-secondary); max-width: 500px; margin: 0 auto; }
.ac-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
@media (max-width: 600px) { .ac-stats { grid-template-columns: 1fr; } }
.ac-stat-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; text-align: center; }
.ac-stat-box .num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.ac-stat-box .label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }
.ac-search { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px; }
/* font-family 走 var(--font-mono)：硬编码 'JetBrains Mono' 绕过了 next/font
   注入变量与 CJK 回退栈（JetBrains Mono 只加载 latin 子集）。 */
.ac-search input { width: 100%; padding: 14px 18px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text); font-size: 1rem; font-family: var(--font-mono); }
.ac-search input:focus { outline: none; border-color: var(--accent); }
/* 仅改 border-color 不足以作为焦点指示（WCAG 2.4.7），补金色焦点环 */
.ac-search input:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }
/* 原为 color: #0a0a0a（孤儿 styles.css 的遗留值），与全站 --bg 系按钮不一致 */
.ac-search button { width: 100%; margin-top: 12px; padding: 14px; background: var(--accent); color: var(--bg); border: none; border-radius: var(--radius-md); font-size: 1rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.ac-search button:disabled { opacity: 0.6; cursor: not-allowed; }
.ac-search button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }
/* 基础态 display:none 是不可达分支：JSX 恒以 "ac-result show" 渲染 */
.ac-result { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; }
.risk-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 0.9rem; }
/* 语义色走 --*-dim 令牌：原先硬编码 rgba(...) 与 --danger/--success 不同值 */
.risk-black { background: var(--danger-dim); color: var(--danger); }
.risk-grey { background: var(--bg-elevated); color: var(--text); }
.risk-safe { background: var(--success-dim); color: var(--success); }
.detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--text-secondary); }
.detail-value { font-family: var(--font-mono); word-break: break-all; }
@media (max-width: 600px) { .detail-row { flex-direction: column; gap: 4px; } }
.spinner { /* 半透明白 + 实色白顶：加载圈必须在金色按钮上可读，无对应令牌，刻意保留字面值 */ width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: ac-spin 0.8s linear infinite; display: inline-block; }
/* ⚠ 不能命名为 spin：Tailwind v4 内置同名关键帧，同名后者覆盖前者。
   本块经 <style precedence="legacy-page"> 注入，位置晚于全部外链 CSS，
   会静默覆盖 Tailwind 的 spin（含 transform 关键帧）。 */
@keyframes ac-spin { to { transform: rotate(360deg); } }
/* z-index 改用 --z-toast(300)：原裸数字 1000 高于 --z-modal(500)，
   toast 会盖住任何模态框。基础 display:none 同样是不可达分支。 */
.toast { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); padding: 12px 20px; border-radius: var(--radius-md); font-size: 0.9rem; z-index: var(--z-toast); max-width: 90%; }
.toast-error { background: var(--danger-dim); color: var(--danger); border: 1px solid var(--danger-dim); }
.toast-info { background: var(--warning-dim); color: var(--warning); border: 1px solid var(--warning-dim); }
`;

// 公开只读风险查询端点（apps/api 的 SCOPE.PUBLIC 通道，免 key，CORS+双限流保护）
const PUBLIC_RISK_CHECK_URL = "https://fidesorigin-api.vercel.app/v1/public/risk-check";
// [H-6 Fix] Subgraph URL from runtime config — no hardcoded URLs
const SUBGRAPH_URL =
  (typeof window !== "undefined" && (window as any).FIDESORIGIN_SUBGRAPH_URL) || "";

type D = Dict["addressCheck"];

type Result = {
  badgeClass: "risk-black" | "risk-grey" | "risk-safe";
  badgeText: string;
  address: string;
  score: string;
  tier: string;
  source: string;
  tags: string;
  entity: string;
};

export default function AddressCheck({ dict }: { dict: D }) {
  const [stats, setStats] = useState<{ total: string; black: string; grey: string }>({
    total: "--",
    black: "--",
    grey: "--",
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "info" } | null>(null);

  const showToast = (message: string, type: "error" | "info" = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Load stats on mount
  useEffect(() => {
    loadStatsFromSubgraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBackendRisk = async (address: string) => {
    const url = `${PUBLIC_RISK_CHECK_URL}?address=${encodeURIComponent(address)}&chainId=11155111`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  };

  const loadStatsFromSubgraph = async () => {
    if (!SUBGRAPH_URL) return;
    try {
      const query = `query {
        protocolStats(id: "stats") {
          totalComplianceChecks
          totalBlocked
          totalFlagged
          totalHeld
          totalSanctioned
        }
        sanctionedAddresses(where: {isActive: true}) { id }
      }`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.data && data.data.protocolStats) {
        const s = data.data.protocolStats;
        const total = Number(s.totalComplianceChecks || 0);
        const black = Number(s.totalBlocked || 0) + Number(s.totalSanctioned || 0);
        const grey = Number(s.totalFlagged || 0) + Number(s.totalHeld || 0);
        setStats({
          total: total.toLocaleString(),
          black: black.toLocaleString(),
          grey: grey.toLocaleString(),
        });
      }
    } catch {
      /* stats stay at -- */
    }
  };

  const fetchSubgraphRisk = async (address: string) => {
    if (!SUBGRAPH_URL) return null;
    // [MEDIUM-4 FIX] GraphQL variables instead of string interpolation
    const query = `query GetRiskProfile($id: String!) {
      riskProfile(id: $id) { id riskScore tier isSanctioned tags }
    }`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { id: address.toLowerCase() } }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.data && data.data.riskProfile) return data.data.riskProfile;
    } catch {
      /* fall through */
    }
    return null;
  };

  const checkAddress = async () => {
    const value = input.trim().toLowerCase();

    if (!value || !value.match(/^0x[a-f0-9]{40}$/)) {
      setResult({
        badgeClass: "risk-grey",
        badgeText: dict.invalidAddress,
        address: "-",
        score: "-",
        tier: "-",
        source: "-",
        tags: "-",
        entity: "-",
      });
      return;
    }

    setLoading(true);
    setResult({
      badgeClass: "risk-grey",
      badgeText: dict.checking,
      address: value,
      score: "-",
      tier: "-",
      source: "-",
      tags: "-",
      entity: "-",
    });

    const apiData = await fetchBackendRisk(value);
    let subgraphData: any = null;

    if (!apiData) {
      subgraphData = await fetchSubgraphRisk(value);
      if (!subgraphData) {
        showToast(dict.backendUnavailable, "info");
      }
    }

    if (apiData) {
      const score = apiData.risk_score ?? 0;
      const level = apiData.risk_level || dict.unknown;
      const factors = apiData.risk_factors || [];
      const tags = apiData.tags || [];
      const isHigh = level === "HIGH" || level === "CRITICAL" || score >= 80;
      const isMid = !isHigh && (level === "MEDIUM" || score >= 40);
      setResult({
        badgeClass: isHigh ? "risk-black" : isMid ? "risk-grey" : "risk-safe",
        badgeText: isHigh
          ? `⚠️ ${dict.highRisk}`
          : isMid
            ? `⚡ ${dict.mediumRisk}`
            : `✅ ${dict.lowRisk}`,
        address: value,
        score: String(score),
        tier: level,
        source: dict.backendSource,
        tags: tags.join(", ") || "-",
        entity: factors.map((f: any) => f.name || f.type).join(", ") || "-",
      });
    } else if (subgraphData) {
      const tier = subgraphData.tier;
      const tags: string[] = subgraphData.tags || [];
      const isHigh = tier === "HIGH" || subgraphData.isSanctioned;
      const isMid = !isHigh && tier === "MEDIUM";
      setResult({
        badgeClass: isHigh ? "risk-black" : isMid ? "risk-grey" : "risk-safe",
        badgeText: isHigh
          ? `⚠️ ${dict.highRisk} - ${subgraphData.isSanctioned ? dict.sanctioned : tier}`
          : isMid
            ? `⚡ ${dict.mediumRisk}`
            : `✅ ${dict.lowRisk}`,
        address: value,
        score: String(subgraphData.riskScore),
        tier,
        source: dict.subgraphSource,
        tags: tags.join(", ") || "-",
        entity: subgraphData.isSanctioned ? dict.sanctioned : "-",
      });
    } else {
      setResult({
        badgeClass: "risk-safe",
        badgeText: `✅ ${dict.notInDatabase}`,
        address: value,
        score: "-",
        tier: dict.unknown,
        source: "-",
        tags: "-",
        entity: "-",
      });
    }

    setLoading(false);
  };

  return (
    <>
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: "@layer legacy{" + AC_CSS + "}" }} />
      <section className="ac-hero">
        <div className="container">
          <p className="micro">{dict.micro}</p>
          <h1>{dict.title}</h1>
          <p className="lead">{dict.lead}</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "0" }}>
        <div className="container" style={{ maxWidth: "800px" }}>
          <div className="ac-stats">
            <div className="ac-stat-box">
              <div className="num">{stats.total}</div>
              <div className="label">{dict.totalLabel}</div>
            </div>
            <div className="ac-stat-box">
              <div className="num">{stats.black}</div>
              <div className="label">{dict.blackLabel}</div>
            </div>
            <div className="ac-stat-box">
              <div className="num">{stats.grey}</div>
              <div className="label">{dict.greyLabel}</div>
            </div>
          </div>

          <div className="ac-search">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") checkAddress();
              }}
              placeholder={dict.placeholder}
              /* placeholder 不是可靠的可访问名称：聚焦即消失，读屏可能只播报
                 "编辑框"。这是核心功能入口，必须有真正的 aria-label。 */
              aria-label={dict.placeholder}
              maxLength={42}
              autoComplete="off"
              spellCheck={false}
              autoCorrect="off"
            />
            <button type="button" onClick={checkAddress} disabled={loading}>
              <span>
                {loading && <span className="spinner" aria-hidden="true"></span>}{" "}
                {loading ? dict.checking : dict.checkBtn}
              </span>
            </button>
          </div>

          {result && (
            <div className="ac-result show">
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div className={`risk-badge ${result.badgeClass}`}>{result.badgeText}</div>
              </div>
              <div className="detail-row">
                <span className="detail-label">{dict.addressLabel}</span>
                <span className="detail-value">{result.address}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{dict.scoreLabel}</span>
                <span className="detail-value">{result.score}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{dict.tierLabel}</span>
                <span className="detail-value">{result.tier}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{dict.sourceLabel}</span>
                <span className="detail-value">{result.source}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{dict.tagsLabel}</span>
                <span className="detail-value">{result.tags}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{dict.entityLabel}</span>
                <span className="detail-value">{result.entity}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {toast && (
        <div className={`toast toast-${toast.type} show`} role="status">
          {toast.message}
        </div>
      )}
    </>
  );
}
