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
.ac-stat-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; }
.ac-stat-box .num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.ac-stat-box .label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }
.ac-search { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.ac-search input { width: 100%; padding: 14px 18px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 1rem; font-family: 'JetBrains Mono', monospace; }
.ac-search input:focus { outline: none; border-color: var(--accent); }
.ac-search button { width: 100%; margin-top: 12px; padding: 14px; background: var(--accent); color: #0a0a0a; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.ac-search button:disabled { opacity: 0.6; cursor: not-allowed; }
.ac-result { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; display: none; }
.ac-result.show { display: block; }
.risk-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 0.9rem; }
.risk-black { background: rgba(239,68,68,0.2); color: var(--danger); }
.risk-grey { background: rgba(148,163,184,0.2); color: var(--text-secondary); }
.risk-safe { background: rgba(34,197,94,0.2); color: var(--success); }
.detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--text-secondary); }
.detail-value { font-family: 'JetBrains Mono', monospace; word-break: break-all; }
@media (max-width: 600px) { .detail-row { flex-direction: column; gap: 4px; } }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.toast { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; z-index: 1000; display: none; max-width: 90%; }
.toast.show { display: block; }
.toast-error { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
.toast-info { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.3); }
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
      <style precedence="legacy-page" dangerouslySetInnerHTML={{ __html: AC_CSS }} />
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
