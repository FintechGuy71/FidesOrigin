"use client";

import Link from "next/link";
import CountUp from "@/components/CountUp";
import HeroScreen from "@/components/HeroScreen";
import OriginField from "@/components/OriginField";
import type { Dict } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/locales";
import { useLiveMetrics } from "@/lib/live-metrics";

export default function HeroHome({ d, lang }: { d: Dict["home"]["hero"]; lang: Locale }) {
  const liveMetrics = useLiveMetrics();

  return (
    <section className="origin-hero" aria-labelledby="origin-hero-title">
      <div className="origin-hero-grid">
        <div className="origin-visual">
          <OriginField label={d.badge} detail="RISK REGISTRY · FINAL-STATE READBACK" />
        </div>

        <div className="origin-copy">
          <div className="origin-copy-inner">
            <p className="origin-kicker">{d.badge}</p>
            <h1 id="origin-hero-title" className="origin-title">
              {d.titlePre} <span>{d.titleEm}</span>
            </h1>
            <p className="origin-lead">{d.sub}</p>
            <div className="origin-actions">
              <Link href="/contact" className="fio-btn fio-btn-primary">
                {d.ctaPrimary}
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </Link>
              <Link href="/admin/dashboard" className="origin-text-link">
                {d.ctaGhost}<span aria-hidden="true">↗</span>
              </Link>
            </div>
            <HeroScreen d={d.screen} lang={lang} />
          </div>
        </div>
      </div>

      <div className="origin-metrics">
        {d.metrics.map((metric, index) => {
          const value = index === 0 ? liveMetrics.riskAddresses : index === 1 ? liveMetrics.onchainProfiles : metric.value;
          return (
            <div className="origin-metric" key={metric.label}>
              <strong className="fio-num"><CountUp value={value} /></strong>
              <span>{metric.label}</span>
            </div>
          );
        })}
      </div>
      <div className="origin-metrics-status" role="status" aria-live="polite" data-metrics-status={liveMetrics.status}>
        <span>{liveMetrics.status === "live" ? d.metricsLive : liveMetrics.status === "cached" ? d.metricsCached : d.metricsSnapshot}</span>
        <time dateTime={liveMetrics.updatedAt}>{liveMetrics.updatedAt.slice(0, 16).replace("T", " ")} UTC</time>
      </div>
    </section>
  );
}
