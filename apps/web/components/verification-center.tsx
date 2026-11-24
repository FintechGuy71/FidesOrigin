"use client";

import HeroScreen from "@/components/HeroScreen";
import type { Dict } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/locales";
import {
  COMPLIANCE_ENGINE_ADDRESS,
  MERKLE_RISK_REGISTRY_ADDRESS,
  POLICY_ENGINE_ADDRESS,
  RELEASE_EVIDENCE_URL,
  RELEASE_URL,
  RISK_REGISTRY_ADDRESS,
  SEPOLIA_CHAIN_ID,
  etherscanAddress,
} from "@/lib/deployment";
import { useLiveMetrics } from "@/lib/live-metrics";

type Props = {
  d: Dict["verification"];
  hero: Dict["home"]["hero"];
  lang: Locale;
};

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  );
}

export default function VerificationCenter({ d, hero, lang }: Props) {
  const metrics = useLiveMetrics();
  const contracts = [
    { name: "RiskRegistry", address: RISK_REGISTRY_ADDRESS, role: d.riskRegistryRole },
    { name: "MerkleRiskRegistry", address: MERKLE_RISK_REGISTRY_ADDRESS, role: d.merkleRegistryRole },
    { name: "PolicyEngine", address: POLICY_ENGINE_ADDRESS, role: d.policyEngineRole },
    { name: "ComplianceEngine", address: COMPLIANCE_ENGINE_ADDRESS, role: d.complianceEngineRole },
  ];
  const statusLabel = metrics.status === "live"
    ? hero.metricsLive
    : metrics.status === "cached"
      ? hero.metricsCached
      : hero.metricsSnapshot;

  return (
    <>
      <section className="section" style={{ paddingTop: "140px", paddingBottom: "64px" }}>
        <div className="container">
          <div className="reveal mx-auto max-w-4xl text-center">
            <p className="micro">{d.micro}</p>
            <h1 className="display" style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}>
              {d.title}{" "}<span>{d.titleAccent}</span>
            </h1>
            <p className="lead mx-auto mt-6 max-w-3xl">{d.lead}</p>
          </div>
        </div>
      </section>

      <section className="section bg-secondary" style={{ paddingTop: "72px" }}>
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="reveal">
              <h2 className="h2">{d.liveTitle}</h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>{d.liveBody}</p>
              <div className="mt-8 grid grid-cols-2 gap-px border" style={{ borderColor: "var(--border)", background: "var(--border)" }}>
                {[
                  { value: metrics.riskAddresses, label: d.intelligenceLabel, source: d.sourcePublicApi },
                  { value: metrics.onchainProfiles, label: d.profilesLabel, source: d.sourceSubgraph },
                ].map(item => (
                  <div key={item.label} className="min-w-0 p-5 sm:p-7" style={{ background: "var(--bg-card)" }}>
                    <div className="fio-num text-3xl font-semibold sm:text-4xl" style={{ color: "var(--accent)" }}>{item.value}</div>
                    <div className="mt-3 text-sm font-medium">{item.label}</div>
                    <div className="mt-2 break-words font-mono text-xs" style={{ color: "var(--text-muted)" }}>{item.source}</div>
                  </div>
                ))}
              </div>
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-t-0 px-5 py-3 font-mono text-xs"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                role="status"
                aria-live="polite"
                data-metrics-status={metrics.status}
              >
                <span style={{ color: metrics.status === "live" ? "var(--success)" : undefined }}>{statusLabel}</span>
                <time dateTime={metrics.updatedAt}>{metrics.updatedAt.slice(0, 16).replace("T", " ")} UTC</time>
              </div>
            </div>

            <div className="reveal lg:pt-1">
              <h2 className="h2">{d.queryTitle}</h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>{d.queryBody}</p>
              <HeroScreen d={hero.screen} lang={lang} />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="reveal mx-auto mb-12 max-w-3xl text-center">
            <h2 className="h2">{d.contractsTitle}</h2>
            <p className="lead mt-5">{d.contractsBody}</p>
            <p className="mt-4 font-mono text-xs" style={{ color: "var(--text-muted)" }} data-chain-id={SEPOLIA_CHAIN_ID}>{d.network}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {contracts.map(contract => (
              <a
                key={contract.name}
                href={etherscanAddress(contract.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="reveal group flex min-h-44 flex-col justify-between border p-6 transition-colors sm:p-7"
                style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
                aria-label={`${contract.name} — ${d.openExplorer}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">{contract.name}</h3>
                    <span style={{ color: "var(--accent)" }}><ExternalIcon /></span>
                  </div>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{contract.role}</p>
                </div>
                <code className="mt-6 break-all font-mono text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{contract.address}</code>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-secondary">
        <div className="container">
          <div className="reveal mx-auto max-w-4xl border p-7 text-center sm:p-12" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <h2 className="h2">{d.evidenceTitle}</h2>
            <p className="lead mx-auto mt-5 max-w-2xl">{d.evidenceBody}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={RELEASE_EVIDENCE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ justifyContent: "center" }}>
                {d.downloadEvidence}<ExternalIcon />
              </a>
              <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ justifyContent: "center" }}>
                {d.releaseNotes}<ExternalIcon />
              </a>
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{d.evidenceNote}</p>
          </div>
        </div>
      </section>
    </>
  );
}
