"use client";

import { useEffect, useState } from "react";
import { siteMetrics } from "@/i18n/metrics.generated";
import { SUBGRAPH_URL } from "@/lib/deployment";

export type MetricStatus = "snapshot" | "updating" | "live" | "cached";

export interface RuntimeMetricState {
  riskAddresses: string;
  onchainProfiles: string;
  status: MetricStatus;
  updatedAt: string;
}

const STATS_URL = process.env.NEXT_PUBLIC_METRICS_URL || "/api/v1/public/stats";
const MAX_PROFILES = 100000;

async function fetchJson(url: string, signal: AbortSignal, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Metrics HTTP ${response.status}`);
  return response.json();
}

export async function fetchOnchainProfileCount(signal: AbortSignal): Promise<number> {
  let lastId = "";
  let total = 0;
  while (true) {
    const query = `query($lastId:ID!){riskProfiles(first:1000,orderBy:id,orderDirection:asc,where:{id_gt:$lastId}){id}}`;
    const payload = await fetchJson(SUBGRAPH_URL, signal, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { lastId } }),
    });
    if (payload.errors) throw new Error("Subgraph metrics query failed");
    const rows = payload.data?.riskProfiles;
    if (!Array.isArray(rows)) throw new Error("Unexpected Subgraph metrics payload");
    total += rows.length;
    if (total > MAX_PROFILES) throw new Error("Metrics profile count exceeds safety bound");
    if (rows.length < 1000) return total;
    const nextId = rows[rows.length - 1].id;
    if (nextId === lastId) throw new Error("Subgraph metrics pagination did not advance");
    lastId = nextId;
  }
}

export function useLiveMetrics(): RuntimeMetricState {
  const [state, setState] = useState<RuntimeMetricState>({
    riskAddresses: siteMetrics.riskAddresses,
    onchainProfiles: siteMetrics.onchainProfiles,
    status: "snapshot",
    updatedAt: siteMetrics.generatedAt,
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    // 网关只读请求允许 25s × 2 的冷启动窗口；前端不能更早放弃。
    const timeout = setTimeout(() => controller.abort(), 60000);
    setState(current => ({ ...current, status: "updating" }));

    async function verify() {
      try {
        const [stats, onchainCount] = await Promise.all([
          fetchJson(STATS_URL, controller.signal),
          fetchOnchainProfileCount(controller.signal),
        ]);
        const values = [stats.risk_addresses_total, onchainCount];
        if (!values.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
          throw new Error("Invalid runtime metrics");
        }
        if (active) {
          const verifiedAt = typeof stats.generated_at === "string" && Number.isFinite(Date.parse(stats.generated_at))
            ? stats.generated_at
            : new Date().toISOString();
          setState({
            riskAddresses: stats.risk_addresses_total.toLocaleString("en-US"),
            onchainProfiles: onchainCount.toLocaleString("en-US"),
            status: "live",
            updatedAt: verifiedAt,
          });
        }
      } catch {
        if (active) setState(current => ({ ...current, status: "cached" }));
      } finally {
        clearTimeout(timeout);
      }
    }

    void verify();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  return state;
}
