"use client";

import { useState, useEffect, useCallback } from "react";
import RiskScore, { RiskBadge } from "@/components/RiskScore";
import AddressInput, { isValidEthereumAddress } from "@/components/AddressInput";
import LiveTransactionStream, { Transaction } from "@/components/LiveTransactionStream";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskTag {
  label: string;
  type: "danger" | "warning" | "info" | "success";
}

interface RiskDetail {
  category: string;
  description: string;
  severity: RiskLevel;
}

interface RiskReport {
  score?: number;
  level?: RiskLevel;
  tags?: RiskTag[];
  details?: RiskDetail[];
  transactions?: {
    hash: string;
    type: string;
    amount: string;
    risk: RiskLevel;
    time: string;
  }[];
  dataSource?: string;
  fetchedAt?: string;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: number;
  action: "flag" | "block" | "review";
}

// API 配置 - 全部从环境变量读取，无硬编码回退值
// 如需本地开发回退，请在 .env.local 中设置
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const RISK_API_URL = process.env.NEXT_PUBLIC_RISK_API_URL || (API_BASE ? `${API_BASE}/risk` : undefined);
const RULES_API_URL = process.env.NEXT_PUBLIC_RULES_API_URL || (API_BASE ? `${API_BASE}/rules` : undefined);

// 初始规则
const initialRules: Rule[] = [
  { id: "1", name: "混币器检测", description: "检测与 Tornado Cash 等混币器的交互", enabled: true, threshold: 1, action: "block" },
  { id: "2", name: "制裁名单", description: "匹配 OFAC 制裁地址列表", enabled: true, threshold: 1, action: "block" },
  { id: "3", name: "暗网关联", description: "检测与已知暗网市场的资金往来", enabled: true, threshold: 1, action: "flag" },
  { id: "4", name: "闪电贷攻击", description: "识别闪电贷攻击模式", enabled: false, threshold: 3, action: "review" },
  { id: "5", name: "钓鱼合约", description: "检测与已知钓鱼合约的交互", enabled: true, threshold: 1, action: "block" },
  { id: "6", name: "异常交易频次", description: "短时间内高频交易检测", enabled: false, threshold: 100, action: "flag" },
];

// 工具函数
const getRiskColor = (level: RiskLevel) => {
  switch (level) {
    case "critical": return "text-red-500";
    case "high": return "text-orange-500";
    case "medium": return "text-yellow-500";
    case "low": return "text-green-500";
  }
};

const getRiskBg = (level: RiskLevel) => {
  switch (level) {
    case "critical": return "bg-red-500/10 border-red-500/30";
    case "high": return "bg-orange-500/10 border-orange-500/30";
    case "medium": return "bg-yellow-500/10 border-yellow-500/30";
    case "low": return "bg-green-500/10 border-green-500/30";
  }
};

const getTagStyle = (type: RiskTag["type"]) => {
  switch (type) {
    case "danger": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "warning": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "info": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "success": return "bg-green-500/20 text-green-400 border-green-500/30";
  }
};

const getActionStyle = (action: Rule["action"]) => {
  switch (action) {
    case "block": return "text-red-400 bg-red-500/20";
    case "flag": return "text-yellow-400 bg-yellow-500/20";
    case "review": return "text-blue-400 bg-blue-500/20";
  }
};

// 加载动画组件
const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="relative">
      <div className="h-16 w-16 rounded-full border-4 border-gray-700 border-t-indigo-500 animate-spin"></div>
      <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{ animationDuration: "1.5s" }}></div>
    </div>
    <p className="mt-4 text-gray-400 animate-pulse">正在分析链上数据...</p>
    <p className="mt-1 text-sm text-gray-500">扫描历史交易 · 关联分析 · 风险评估</p>
  </div>
);

// 错误提示组件
const ErrorMessage = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
    <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <p className="text-red-300 mb-2">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
      >
        重试
      </button>
    )}
  </div>
);

// 调用风险分析 API（增强版：优先连接真实数据源，明确降级提示）
async function fetchRiskAnalysis(address: string): Promise<RiskReport> {
  // 尝试连接真实后端 API
  try {
    const response = await fetch(`${RISK_API_URL}/analyze`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" 
      },
      body: JSON.stringify({ address }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        score: data.riskScore || data.score || 0,
        level: data.riskLevel || getRiskLevelFromScore(data.riskScore || data.score || 0),
        tags: data.tags || [],
        details: data.details || [],
        transactions: data.transactions || [],
        dataSource: "api",
        fetchedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn("API 调用失败:", error);
  }

  // 尝试连接 Subgraph 查询真实链上数据
  try {
    const subgraphData = await fetchSubgraphRiskData(address);
    if (subgraphData) {
      return {
        ...subgraphData,
        dataSource: "subgraph",
        fetchedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn("Subgraph 查询失败:", error);
  }

  // 最后回退到本地模拟分析（明确标注）
  console.info("⚠️ 所有真实数据源不可用，回退到演示模式");
  return performLocalAnalysis(address);
}

// 通过 Subgraph 查询真实链上风险数据
async function fetchSubgraphRiskData(address: string): Promise<Partial<RiskReport> | null> {
  const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!SUBGRAPH_URL) {
    console.warn("Subgraph URL 未配置，跳过 Subgraph 查询");
    return null;
  }
  
  const query = `
    query GetRiskProfile($address: String!) {
      riskProfile(id: $address) {
        riskScore
        riskTier
        sanctioned
        tags
        lastUpdated
      }
      riskProfileUpdates(where: { subject: $address }, orderBy: timestamp, orderDirection: desc, first: 5) {
        timestamp
        newScore
        newTier
      }
    }
  `;

  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { address: address.toLowerCase() } }),
    });

    const json = await response.json();
    if (json.errors || !json.data?.riskProfile) return null;

    const profile = json.data.riskProfile;
    const score = profile.riskScore || 0;
    const level = getRiskLevelFromScore(score);
    const tags: RiskTag[] = (profile.tags || []).map((t: string) => ({
      label: t,
      type: score > 60 ? "danger" : score > 40 ? "warning" : "info",
    }));
    if (profile.sanctioned) {
      tags.unshift({ label: "制裁名单", type: "danger" });
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
        {
          category: "最后更新",
          description: profile.lastUpdated ? new Date(profile.lastUpdated * 1000).toLocaleString() : "未知",
          severity: "low",
        },
      ],
      transactions: [],
    };
  } catch (e) {
    return null;
  }
}

// 本地风险分析（明确标注为演示模式，仅用于UI展示）
function performLocalAnalysis(address: string): RiskReport {
  const hash = address.slice(-6);
  // 使用确定性伪随机（基于地址）替代完全随机，确保同一地址结果一致
  const seed = parseInt(hash.slice(0, 4), 16) || 0;
  const pseudoRandom = (n: number) => ((seed * 9301 + 49297) % 233280) / 233280 * n;
  
  const riskScore = Math.floor(pseudoRandom(100));
  const level = getRiskLevelFromScore(riskScore);

  const tags: RiskTag[] = [];
  if (pseudoRandom(1) > 0.5) tags.push({ label: "混币器关联", type: "danger" });
  if (pseudoRandom(1) > 0.6) tags.push({ label: "暗网交易", type: "danger" });
  if (pseudoRandom(1) > 0.4) tags.push({ label: "高风险交易所", type: "warning" });
  if (pseudoRandom(1) > 0.7) tags.push({ label: "闪电贷攻击", type: "danger" });
  if (tags.length === 0) tags.push({ label: "正常地址", type: "success" });

  const details: RiskDetail[] = [
    {
      category: "资金溯源",
      description: `该地址与 ${Math.floor(pseudoRandom(10)) + 1} 个已知风险地址存在资金往来`,
      severity: riskScore > 50 ? "high" : "low",
    },
    {
      category: "交易行为",
      description: `过去 30 天内交易频次 ${Math.floor(pseudoRandom(500)) + 50} 次`,
      severity: "low",
    },
    {
      category: "合约交互",
      description: `与 ${Math.floor(pseudoRandom(20)) + 1} 个 DeFi 协议有交互记录`,
      severity: "medium",
    },
  ];

  const txTypes = ["转账", "合约调用", "代币交换", "流动性添加"];
  const transactions = Array.from({ length: 5 }, (_, i) => ({
    hash: `0x${hash.slice(0, 4)}${i}...${hash.slice(-4)}`,
    type: txTypes[Math.floor(pseudoRandom(4))],
    amount: `${(pseudoRandom(100)).toFixed(2)} ETH`,
    risk: (["low", "medium", "high"] as RiskLevel[])[Math.floor(pseudoRandom(3))],
    time: `${Math.floor(pseudoRandom(24))}小时前`,
  }));

  return {
    score: riskScore,
    level,
    tags,
    details,
    transactions,
    dataSource: "demo", // 明确标记为演示模式
    fetchedAt: new Date().toISOString(),
  };
}

function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// 保存规则配置（明确说明是本地草稿，非链上配置）
async function saveRules(rules: Rule[]): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${RULES_API_URL}/save`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" 
      },
      body: JSON.stringify({ rules }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: "规则配置已保存到服务器" };
    }
  } catch (error) {
    console.warn("服务器保存失败，回退到本地存储:", error);
  }
  
  // 回退到本地存储（明确标注为本地草稿）
  localStorage.setItem("fidesorigin_rules_draft", JSON.stringify(rules));
  return { 
    success: true, 
    message: "规则配置已保存到本地草稿（仅当前设备有效，未上链）" 
  };
}

// 加载规则配置（对应本地草稿 key）
function loadRules(): Rule[] {
  if (typeof window === "undefined") return initialRules;
  const saved = localStorage.getItem("fidesorigin_rules_draft") || localStorage.getItem("fidesorigin_rules");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return initialRules;
    }
  }
  return initialRules;
}

export default function DemoPage() {
  const [address, setAddress] = useState("");
  const [addressValid, setAddressValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [activeTab, setActiveTab] = useState<"query" | "rules">("query");
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // 加载保存的规则
  useEffect(() => {
    setRules(loadRules());
  }, []);

  const handleAddressChange = useCallback((value: string, isValid: boolean) => {
    setAddress(value);
    setAddressValid(isValid);
    if (error) setError(null);
  }, [error]);

  const handleSearch = useCallback(async () => {
    if (!addressValid) return;
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const result = await fetchRiskAnalysis(address);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [address, addressValid]);

  const toggleRule = (id: string) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  const updateRuleThreshold = (id: string, threshold: number) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, threshold } : rule
    ));
  };

  const updateRuleAction = (id: string, action: Rule["action"]) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, action } : rule
    ));
  };

  const handleSaveRules = async () => {
    setSaveStatus(null);
    const result = await saveRules(rules);
    setSaveStatus({
      type: result.success ? "success" : "error",
      message: result.message,
    });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleTransactionClick = (tx: Transaction) => {
    setSelectedTx(tx);
  };

  // 动态设置 LiveTransactionStream 的 mock 模式
  const useMockData = process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_SUBGRAPH_URL;

  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* 演示模式警告横幅（P0-2 修复：明确标注）*/}
      <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-6 py-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-yellow-200 font-medium">演示模式</p>
            <p className="text-yellow-200/70 text-sm mt-1">
              当前部分数据为模拟数据，仅用于UI展示。真实数据源（API / Subgraph / 合约）连接失败时自动回退到演示模式。
              规则配置仅保存在本地草稿，未上链，换设备或清缓存后丢失。
            </p>
          </div>
        </div>
      </div>

      {/* 页面标题 */}
        <div className="mb-12 text-center">
          <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text pb-4 font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
            FidesOrigin 风险检测 Demo
          </h1>
          <p className="text-lg text-indigo-200/65">
            体验链上地址风险实时分析与智能合规规则配置
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-lg bg-gray-900 p-1">
            <button
              onClick={() => setActiveTab("query")}
              className={`rounded-md px-6 py-2.5 text-sm font-medium transition-all ${
                activeTab === "query"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              地址风险查询
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`rounded-md px-6 py-2.5 text-sm font-medium transition-all ${
                activeTab === "rules"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              规则配置器
            </button>
          </div>
        </div>

        {/* 地址风险查询 */}
        {activeTab === "query" && (
          <div className="space-y-6">
            {/* 搜索框 */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8">
              <AddressInput
                value={address}
                onChange={handleAddressChange}
                onSubmit={handleSearch}
                placeholder="输入 Ethereum 地址 (0x...)"
                label="区块链地址"
                showExamples={true}
                showValidation={true}
                disabled={loading}
                loading={loading}
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <ErrorMessage message={error} onRetry={handleSearch} />
            )}

            {/* 加载状态 */}
            {loading && (
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50">
                <LoadingSpinner />
              </div>
            )}

            {/* 风险报告 */}
            {report && !loading && (
              <div className="space-y-6">
                {/* 数据来源标签（增强版：更明显的提示）*/}
                {report.dataSource === "demo" && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                    <p className="text-sm text-yellow-200 font-medium">
                      ⚠️ 演示模式数据
                    </p>
                    <p className="text-xs text-yellow-200/70 mt-1">
                      当前显示模拟数据，仅供UI展示。真实数据源（API / Subgraph / 合约）连接失败时自动回退到此模式。
                      同一地址的模拟结果始终一致（基于地址哈希），但非真实链上数据。
                    </p>
                  </div>
                )}
                {report.dataSource === "subgraph" && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2">
                    <p className="text-sm text-green-200">
                      ✅ 数据来源：The Graph Subgraph（链上真实数据）
                    </p>
                  </div>
                )}
                {report.dataSource === "api" && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2">
                    <p className="text-sm text-blue-200">
                      ✅ 数据来源：后端API（实时分析）
                    </p>
                  </div>
                )}

                {/* 评分卡片 */}
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 md:col-span-1">
                    <h3 className="mb-4 text-center text-lg font-medium text-white">风险评分</h3>
                    <RiskScore score={report.score} level={report.level} size="lg" animated={true} />
                    {report.fetchedAt && (
                      <p className="mt-4 text-center text-xs text-gray-500">
                        更新时间: {new Date(report.fetchedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 md:col-span-2">
                    <h3 className="mb-4 text-lg font-medium text-white">风险标签</h3>
                    <div className="flex flex-wrap gap-2">
                      {report.tags?.map((tag, i) => (
                        <span
                          key={i}
                          className={`rounded-full border px-4 py-2 text-sm font-medium ${getTagStyle(tag.type)}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    
                    <h3 className="mb-4 mt-6 text-lg font-medium text-white">规则触发</h3>
                    <div className="space-y-2">
                      {rules.filter(r => r.enabled).slice(0, 4).map((rule) => {
                        const triggered = report.level !== "low" && 
                          ((rule.action === "block" && report.level === "critical") ||
                           (rule.action === "flag" && (report.level === "high" || report.level === "critical")) ||
                           (rule.action === "review" && report.level === "medium"));
                        return (
                        <div
                          key={rule.id}
                          className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                            triggered
                              ? getRiskBg(report.level || "low")
                              : "border-gray-700 bg-gray-800/50"
                          }`}
                        >
                          <span className="text-gray-300">{rule.name}</span>
                          <span className={`rounded px-2 py-1 text-xs font-medium ${
                            triggered
                              ? getActionStyle(rule.action)
                              : "bg-green-500/20 text-green-400"
                          }`}>
                            {triggered
                              ? rule.action === "block" ? "已拦截" : rule.action === "flag" ? "已标记" : "待审核"
                              : "已通过"}
                          </span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 实时交易流 */}
                <LiveTransactionStream
                  maxItems={20}
                  autoScroll={true}
                  showHeader={true}
                  onTransactionClick={handleTransactionClick}
                  useMockData={useMockData}
                  className="rounded-2xl border border-gray-800 bg-gray-900/50"
                />

                {/* 详细分析 */}
                <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
                  <h3 className="mb-4 text-lg font-medium text-white">详细分析</h3>
                  <div className="space-y-3">
                    {report.details?.map((detail, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-4 rounded-lg border border-gray-800 bg-gray-800/30 p-4"
                      >
                        <div className={`mt-1 h-3 w-3 rounded-full ${
                          detail.severity === "high" ? "bg-red-500" : 
                          detail.severity === "medium" ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{detail.category}</h4>
                          <p className="text-sm text-gray-400">{detail.description}</p>
                        </div>
                        <RiskBadge level={detail.severity} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 最近交易 */}
                <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
                  <h3 className="mb-4 text-lg font-medium text-white">最近交易</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="pb-3 text-left text-sm font-medium text-gray-400">交易哈希</th>
                          <th className="pb-3 text-left text-sm font-medium text-gray-400">类型</th>
                          <th className="pb-3 text-left text-sm font-medium text-gray-400">金额</th>
                          <th className="pb-3 text-left text-sm font-medium text-gray-400">风险</th>
                          <th className="pb-3 text-left text-sm font-medium text-gray-400">时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.transactions?.map((tx, i) => (
                          <tr key={i} className="border-b border-gray-800/50 last:border-0">
                            <td className="py-3 font-mono text-sm text-indigo-400">{tx.hash}</td>
                            <td className="py-3 text-sm text-gray-300">{tx.type}</td>
                            <td className="py-3 text-sm text-gray-300">{tx.amount}</td>
                            <td className="py-3">
                              <RiskBadge level={tx.risk} />
                            </td>
                            <td className="py-3 text-sm text-gray-500">{tx.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 规则配置器 */}
        {activeTab === "rules" && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-medium text-white">合规规则配置</h2>
                <p className="mt-1 text-sm text-gray-400">自定义风险检测规则与响应策略</p>
              </div>
              <div className="flex items-center gap-3">
                {saveStatus && (
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${
                      saveStatus.type === "success"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {saveStatus.message}
                  </span>
                )}
                <button 
                  onClick={handleSaveRules}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                  保存配置
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-5 transition-all ${
                    rule.enabled ? "border-gray-700 bg-gray-800/50" : "border-gray-800 bg-gray-900/30 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-white">{rule.name}</h3>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => toggleRule(rule.id)}
                            className="peer sr-only"
                          />
                          <div className="h-5 w-9 rounded-full bg-gray-700 peer-checked:bg-indigo-600 peer-focus:ring-2 peer-focus:ring-indigo-500/30"></div>
                          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:left-4.5"></div>
                        </label>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">{rule.description}</p>
                    </div>
                  </div>

                  {rule.enabled && (
                    <div className="mt-4 grid gap-4 border-t border-gray-700/50 pt-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-400">
                          触发阈值
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={rule.threshold}
                            onChange={(e) => updateRuleThreshold(rule.id, parseInt(e.target.value))}
                            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-indigo-500"
                          />
                          <span className="w-12 text-right text-sm font-medium text-white">{rule.threshold}</span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-400">
                          响应动作
                        </label>
                        <select
                          value={rule.action}
                          onChange={(e) => updateRuleAction(rule.id, e.target.value as Rule["action"])}
                          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="flag">标记风险</option>
                          <option value="block">阻断交易</option>
                          <option value="review">人工审核</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 规则统计 */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-4 text-center">
                <div className="text-2xl font-bold text-white">{rules.filter(r => r.enabled).length}</div>
                <div className="text-sm text-gray-400">已启用规则</div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{rules.filter(r => r.enabled && r.action === "block").length}</div>
                <div className="text-sm text-gray-400">阻断规则</div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{rules.filter(r => r.enabled && r.action === "flag").length}</div>
                <div className="text-sm text-gray-400">标记规则</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 交易详情弹窗 */}
      {selectedTx && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTx(null)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">交易详情</h3>
              <button 
                onClick={() => setSelectedTx(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">交易哈希</span>
                <span className="font-mono text-indigo-400">{selectedTx.hash.slice(0, 20)}...{selectedTx.hash.slice(-8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">发送方</span>
                <span className="font-mono text-gray-300">{selectedTx.from.slice(0, 12)}...{selectedTx.from.slice(-6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">接收方</span>
                <span className="font-mono text-gray-300">{selectedTx.to.slice(0, 12)}...{selectedTx.to.slice(-6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">金额</span>
                <span className="text-white font-medium">{selectedTx.amount} {selectedTx.token}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">风险评分</span>
                <RiskBadge level={selectedTx.riskLevel} text={`${selectedTx.riskScore}分`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">状态</span>
                <span className={`${
                  selectedTx.status === "confirmed" ? "text-green-400" :
                  selectedTx.status === "flagged" ? "text-orange-400" :
                  selectedTx.status === "failed" ? "text-red-400" : "text-yellow-400"
                }`}>
                  {selectedTx.status === "confirmed" && "已确认"}
                  {selectedTx.status === "flagged" && "已标记"}
                  {selectedTx.status === "failed" && "失败"}
                  {selectedTx.status === "pending" && "待确认"}
                </span>
              </div>
              {selectedTx.tags && selectedTx.tags.length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                  <span className="text-gray-400 text-sm">风险标签:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTx.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
