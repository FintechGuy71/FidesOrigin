/**
 * hooks/useRiskAnalysis.ts - 风险分析 Hook
 * 封装风险查询逻辑，使用 Zustand store 管理状态
 */
import { useCallback, useRef, useEffect } from "react";
import { useRiskStore } from "@/stores/risk";
import { apiPost } from "@/lib/api";
import { getRiskApiUrl, getSubgraphUrl } from "@/lib/env";
import type { RiskReport, RiskLevel } from "@/stores/risk";

// 从分数获取风险等级
function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// 本地演示分析（确定性伪随机）
function performLocalAnalysis(address: string): RiskReport {
  const hash = address.slice(-6);
  const seed = parseInt(hash.slice(0, 4), 16) || 0;
  const pseudoRandom = (n: number) =>
    ((seed * 9301 + 49297) % 233280) / 233280 * n;

  const riskScore = Math.floor(pseudoRandom(100));
  const level = getRiskLevelFromScore(riskScore);

  const tags = [];
  if (pseudoRandom(1) > 0.5) tags.push({ label: "混币器关联", type: "danger" as const });
  if (pseudoRandom(1) > 0.6) tags.push({ label: "暗网交易", type: "danger" as const });
  if (pseudoRandom(1) > 0.4) tags.push({ label: "高风险交易所", type: "warning" as const });
  if (pseudoRandom(1) > 0.7) tags.push({ label: "闪电贷攻击", type: "danger" as const });
  if (tags.length === 0) tags.push({ label: "正常地址", type: "success" as const });

  const details = [
    {
      category: "资金溯源",
      description: `该地址与 ${Math.floor(pseudoRandom(10)) + 1} 个已知风险地址存在资金往来`,
      severity: riskScore > 50 ? ("high" as RiskLevel) : ("low" as RiskLevel),
    },
    {
      category: "交易行为",
      description: `过去 30 天内交易频次 ${Math.floor(pseudoRandom(500)) + 50} 次`,
      severity: "low" as RiskLevel,
    },
    {
      category: "合约交互",
      description: `与 ${Math.floor(pseudoRandom(20)) + 1} 个 DeFi 协议有交互记录`,
      severity: "medium" as RiskLevel,
    },
  ];

  const txTypes = ["转账", "合约调用", "代币交换", "流动性添加"];
  const transactions = Array.from({ length: 5 }, (_, i) => ({
    hash: `0x${hash.slice(0, 4)}${i}...${hash.slice(-4)}`,
    type: txTypes[Math.floor(pseudoRandom(4))],
    amount: `${pseudoRandom(100).toFixed(2)} ETH`,
    risk: (["low", "medium", "high"] as RiskLevel[])[Math.floor(pseudoRandom(3))],
    time: `${Math.floor(pseudoRandom(24))}小时前`,
  }));

  return {
    score: riskScore,
    level,
    tags,
    details,
    transactions,
    dataSource: "demo",
    fetchedAt: new Date().toISOString(),
    address,
  };
}

// 通过 Subgraph 查询
async function fetchSubgraphRiskData(address: string, signal?: AbortSignal): Promise<RiskReport | null> {
  const url = getSubgraphUrl();
  if (!url) return null;

  const query = `
    query GetRiskProfile($address: String!) {
      riskProfile(id: $address) {
        riskScore
        riskTier
        sanctioned
        tags
        lastUpdated
      }
    }
  `;

  try {
    const response = await apiPost(url, {
      query,
      variables: { address: address.toLowerCase() },
    }, { requireSameOrigin: false, signal });
    const json = await response.json();
    if (json.errors || !json.data?.riskProfile) return null;

    const profile = json.data.riskProfile;
    const score = profile.riskScore || 0;
    const level = getRiskLevelFromScore(score);
    const tags = (profile.tags || []).map((t: string) => ({
      label: t,
      type: score > 60 ? ("danger" as const) : score > 40 ? ("warning" as const) : ("info" as const),
    }));
    if (profile.sanctioned) {
      tags.unshift({ label: "制裁名单", type: "danger" as const });
    }

    return {
      score,
      level,
      tags,
      details: [
        {
          category: "链上风险画像",
          description: `风险评分: ${score}，等级: ${profile.riskTier || "UNKNOWN"}`,
          severity: level,
        },
      ],
      transactions: [],
      dataSource: "subgraph",
      fetchedAt: new Date().toISOString(),
      address,
    };
  } catch {
    return null;
  }
}

// 主 Hook
export function useRiskAnalysis() {
  const setRiskData = useRiskStore((state) => state.setRiskData);
  const setLoading = useRiskStore((state) => state.setLoading);
  const setError = useRiskStore((state) => state.setError);
  const setCurrentAddress = useRiskStore((state) => state.setCurrentAddress);
  const addToHistory = useRiskStore((state) => state.addToHistory);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const analyze = useCallback(
    async (address: string): Promise<RiskReport> => {
      // [High Fix] Cancel previous request and create new abort controller
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setError(null);
      setCurrentAddress(address);

      try {
        // 1. 尝试 API
        const apiUrl = getRiskApiUrl();
        if (apiUrl) {
          try {
            const response = await apiPost(`${apiUrl}/analyze`, { address }, { signal: controller.signal });
            const data = await response.json();
            // [High Fix] Discard stale responses
            if (requestId !== requestIdRef.current) return performLocalAnalysis(address);
            const report: RiskReport = {
              score: data.riskScore || data.score || 0,
              level: data.riskLevel || getRiskLevelFromScore(data.riskScore || data.score || 0),
              tags: data.tags || [],
              details: data.details || [],
              transactions: data.transactions || [],
              dataSource: "api",
              fetchedAt: new Date().toISOString(),
              address,
            };
            setRiskData(report);
            addToHistory(address);
            return report;
          } catch (e) {
            console.warn("[RiskAnalysis] API 调用失败:", e);
          }
        }

        // 2. 尝试 Subgraph
        try {
          const subgraphData = await fetchSubgraphRiskData(address, controller.signal);
          if (subgraphData) {
            if (requestId !== requestIdRef.current) return performLocalAnalysis(address);
            setRiskData(subgraphData);
            addToHistory(address);
            return subgraphData;
          }
        } catch (e) {
          console.warn("[RiskAnalysis] Subgraph 查询失败:", e);
        }

        // 3. 回退到本地演示
        if (requestId !== requestIdRef.current) return performLocalAnalysis(address);
        console.info("[RiskAnalysis] 回退到演示模式");
        const demoReport = performLocalAnalysis(address);
        setRiskData(demoReport);
        addToHistory(address);
        return demoReport;
      } catch (err) {
        if (requestId !== requestIdRef.current) throw err;
        const errorMsg = err instanceof Error ? err.message : "分析失败";
        setError(errorMsg);
        throw err;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [setRiskData, setLoading, setError, setCurrentAddress, addToHistory]
  );

  const clear = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setRiskData(null);
    setError(null);
    setCurrentAddress(null);
  }, [setRiskData, setError, setCurrentAddress]);

  // Cleanup on unmount
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  return { analyze, clear };
}

export default useRiskAnalysis;
