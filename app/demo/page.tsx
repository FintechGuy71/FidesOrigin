"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import RiskScore, { RiskBadge } from "@/components/RiskScore";
import AddressInput from "@/components/AddressInput";
import LiveTransactionStream, { Transaction } from "@/components/LiveTransactionStream";
import { z } from "zod";
import {
  validateEthereumAddress,
  validateEthereumAddresses,
  validateChainId,
  validateAmount,
  type RiskCheckInput,
  type ValidatedRiskCheckInput,
} from "@/lib/validation";

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

// ─── API base URL (no secrets exposed on client) ─────────────────────────────

const API_BASE_URL = "/api/admin";

// ─── Zod runtime schema for WebSocket messages ───────────────────────────────

const WsStatsSchema = z.object({
  todayBlocked: z.number().optional(),
  todayFlagged: z.number().optional(),
  totalScanned: z.number().optional(),
  activeAlerts: z.number().optional(),
});

const WsEventSchema = z.object({
  id: z.string(),
  hash: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  risk: z.string().optional(),
  type: z.string().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
});

const WsMessageSchema = z.object({
  type: z.string(),
  stats: WsStatsSchema.optional(),
  event: WsEventSchema.optional(),
  data: z.any().optional(),
});

type WebSocketMessage = z.infer<typeof WsMessageSchema>;

// ─── Secure API helper (all calls proxied via server routes) ─────────────────

class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include", // carry auth session cookie
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let code = "REQUEST_FAILED";
    let message = `Request failed with status ${res.status}`;
    try {
      const errBody = await res.json();
      code = errBody.code || code;
      message = errBody.message || errBody.error || message;
    } catch {
      // ignore JSON parse error
    }
    if (res.status === 401 || res.status === 403) {
      code = "UNAUTHORIZED";
    }
    throw new ApiError(message, code, res.status);
  }

  return res.json() as Promise<T>;
}

// ─── Fetch short-lived WebSocket token via authenticated endpoint ────────────

async function getWebSocketToken(): Promise<string> {
  const data = await apiFetch<{ token: string }>("/ws-token");
  return data.token;
}

// ─── Error Boundary Component ──────────────────────────────────────────────────

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary?: () => void;
}) {
  const isApiError = error instanceof ApiError;

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
      <svg
        className="w-12 h-12 mx-auto mb-4 text-red-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p className="text-red-300 font-medium mb-1">
        {isApiError ? `API Error [${(error as ApiError).code}]` : "Unexpected Error"}
      </p>
      <p className="text-red-200/70 text-sm mb-4">{error.message}</p>
      {resetErrorBoundary && (
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  );
}

// ─── Loading Spinner ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-gray-700 border-t-indigo-500 animate-spin" />
        <div
          className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"
          style={{ animationDuration: "1.5s" }}
        />
      </div>
      <p className="mt-4 text-gray-400 animate-pulse">正在分析链上数据...</p>
      <p className="mt-1 text-sm text-gray-500">扫描历史交易 · 关联分析 · 风险评估</p>
    </div>
  );
}

// ─── Tag / Rule Styles ───────────────────────────────────────────────────────

const getTagStyle = (type: RiskTag["type"]) => {
  switch (type) {
    case "danger":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "warning":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "info":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "success":
      return "bg-green-500/20 text-green-400 border-green-500/30";
  }
};

const getRiskBg = (level: RiskLevel) => {
  switch (level) {
    case "critical":
      return "bg-red-500/10 border-red-500/30";
    case "high":
      return "bg-orange-500/10 border-orange-500/30";
    case "medium":
      return "bg-yellow-500/10 border-yellow-500/30";
    case "low":
      return "bg-green-500/10 border-green-500/30";
  }
};

const getActionStyle = (action: Rule["action"]) => {
  switch (action) {
    case "block":
      return "text-red-400 bg-red-500/20";
    case "flag":
      return "text-yellow-400 bg-yellow-500/20";
    case "review":
      return "text-blue-400 bg-blue-500/20";
  }
};

// ─── Risk Level from Score ───────────────────────────────────────────────────

function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ─── Local Fallback Analysis (deterministic, demo-only) ────────────────────────

function performLocalAnalysis(address: string): RiskReport {
  const hash = address.slice(-6);
  const seed = parseInt(hash.slice(0, 4), 16) || 0;
  const pseudoRandom = (n: number) =>
    (((seed * 9301 + 49297) % 233280) / 233280) * n;

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
  };
}

// ─── Fetch Risk Analysis via server-side proxy ───────────────────────────────

async function fetchRiskAnalysis(address: string): Promise<RiskReport> {
  let validatedAddress: string;
  try {
    validatedAddress = validateEthereumAddress(address);
  } catch (err) {
    throw err;
  }

  try {
    const result = await apiFetch<{
      riskScore?: number;
      score?: number;
      riskLevel?: string;
      level?: string;
      tags?: string[];
      details?: { category: string; description: string; severity: string }[];
    }>(`/risk-check`, {
      method: "POST",
      body: JSON.stringify({ address: validatedAddress }),
    });

    const score = result.riskScore ?? result.score ?? 0;
    const level = (result.riskLevel as RiskLevel) || (result.level as RiskLevel) || getRiskLevelFromScore(score);

    return {
      score,
      level,
      tags: (result.tags || []).map((t: string) => ({
        label: t,
        type: score > 60 ? "danger" : score > 40 ? "warning" : "info",
      })),
      details: (result.details || []).map((d) => ({
        category: d.category,
        description: d.description,
        severity: (d.severity as RiskLevel) || "low",
      })),
      transactions: [],
      dataSource: "api",
      fetchedAt: new Date().toISOString(),
    };
  } catch (apiError) {
    console.warn("API call failed:", apiError);

    if (apiError instanceof ApiError) {
      // Do not fall back on validation or auth errors
      if (
        apiError.code === "INVALID_ADDRESS" ||
        apiError.code === "INVALID_CHAIN_ID" ||
        apiError.code === "INVALID_AMOUNT" ||
        apiError.code === "UNAUTHORIZED"
      ) {
        throw apiError;
      }
    }

    console.info("⚠️ API unavailable, falling back to demo mode");
    return performLocalAnalysis(validatedAddress);
  }
}

// ─── Save Rules via server-side proxy ────────────────────────────────────────

async function saveRules(rules: Rule[]): Promise<{ success: boolean; message: string }> {
  try {
    const data = await apiFetch<{ success: boolean; message?: string }>(`/rules/save`, {
      method: "POST",
      body: JSON.stringify({ rules }),
    });

    return {
      success: true,
      message: data.message || "规则配置已保存到服务器",
    };
  } catch (error) {
    console.warn("服务器保存失败，回退到本地存储:", error);

    // Reject if unauthorized — do not silently fall back to local storage
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return {
        success: false,
        message: "鉴权失败，请重新登录后再试",
      };
    }
  }

  localStorage.setItem("fidesorigin_rules_draft", JSON.stringify(rules));
  return {
    success: true,
    message: "规则配置已保存到本地草稿（仅当前设备有效，未上链）",
  };
}

// ─── Load Rules ────────────────────────────────────────────────────────────────

const initialRules: Rule[] = [
  { id: "1", name: "混币器检测", description: "检测与 Tornado Cash 等混币器的交互", enabled: true, threshold: 1, action: "block" },
  { id: "2", name: "制裁名单", description: "匹配 OFAC 制裁地址列表", enabled: true, threshold: 1, action: "block" },
  { id: "3", name: "暗网关联", description: "检测与已知暗网市场的资金往来", enabled: true, threshold: 1, action: "flag" },
  { id: "4", name: "闪电贷攻击", description: "识别闪电贷攻击模式", enabled: false, threshold: 3, action: "review" },
  { id: "5", name: "钓鱼合约", description: "检测与已知钓鱼合约的交互", enabled: true, threshold: 1, action: "block" },
  { id: "6", name: "异常交易频次", description: "短时间内高频交易检测", enabled: false, threshold: 100, action: "flag" },
];

function loadRules(): Rule[] {
  if (typeof window === "undefined") return initialRules;
  const saved = localStorage.getItem("fidesorigin_rules_draft") || localStorage.getItem("fidesorigin_rules");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Basic runtime validation
      if (Array.isArray(parsed)) {
        return parsed as Rule[];
      }
      return initialRules;
    } catch {
      return initialRules;
    }
  }
  return initialRules;
}

// ─── Clear local sensitive data (call on logout) ────────────────────────────

export function clearLocalDashboardData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("fidesorigin_rules_draft");
  localStorage.removeItem("fidesorigin_rules");
  localStorage.removeItem("fidesorigin-dashboard");
  localStorage.removeItem("fidesorigin-dashboard-events");
}

// ─── WebSocket connection hook (with auth + runtime validation) ──────────────

interface DashboardStats {
  todayBlocked?: number;
  todayFlagged?: number;
  totalScanned?: number;
  activeAlerts?: number;
}

function useWebSocketStream(
  url: string,
  onMessage: (msg: WebSocketMessage) => void,
  onStatsUpdate?: (stats: DashboardStats) => void
) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCount = useRef(0);
  const isManualClose = useRef(false);
  const MAX_RETRIES = 5;
  const MAX_BACKOFF_MS = 30000;

  const cleanup = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (ws.current) {
      isManualClose.current = true;
      try {
        ws.current.close();
      } catch {
        // ignore
      }
      ws.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    cleanup();
    isManualClose.current = false;

    let wsToken: string;
    try {
      wsToken = await getWebSocketToken();
    } catch (err) {
      console.error("Failed to obtain WebSocket token:", err);
      // schedule retry with backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), MAX_BACKOFF_MS);
      retryCount.current += 1;
      if (retryCount.current <= MAX_RETRIES) {
        reconnectTimeout.current = setTimeout(() => connect(), delay);
      }
      return;
    }

    try {
      // Build authenticated URL — short-lived token via query string
      const urlObj = new URL(url);
      urlObj.searchParams.set("token", wsToken);
      const wsUrlWithAuth = urlObj.toString();

      ws.current = new WebSocket(wsUrlWithAuth);
    } catch (err) {
      console.error("WebSocket construction failed:", err);
      return;
    }

    const heartbeatInterval = 30000;

    ws.current.onopen = () => {
      retryCount.current = 0;
      // Heartbeat — only send when in OPEN state
      heartbeatTimer.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          try {
            ws.current.send(JSON.stringify({ type: "ping" }));
          } catch {
            // Silently handle heartbeat send failure; onclose/onerror handles reconnect
          }
        }
      }, heartbeatInterval);
    };

    ws.current.onmessage = (event) => {
      let rawData: unknown;
      try {
        rawData = JSON.parse(event.data);
      } catch (e) {
        console.error("WebSocket message parse error:", e);
        return;
      }

      // Runtime validation via zod
      const result = WsMessageSchema.safeParse(rawData);
      if (!result.success) {
        console.error("Invalid WebSocket message format", result.error);
        return;
      }

      if (result.data.type === "pong") return;

      onMessage(result.data);

      if (result.data.stats && onStatsUpdate) {
        onStatsUpdate(result.data.stats);
      }
    };

    ws.current.onerror = () => {
      // error details handled by onclose reconnect logic
    };

    ws.current.onclose = () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }

      if (isManualClose.current) return;

      retryCount.current += 1;
      if (retryCount.current > MAX_RETRIES) {
        console.error("WebSocket max retries reached, giving up");
        return;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), MAX_BACKOFF_MS);
      reconnectTimeout.current = setTimeout(() => connect(), delay);
    };
  }, [url, onMessage, onStatsUpdate, cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { connect, disconnect: cleanup };
}

// ─── Main Demo Page ────────────────────────────────────────────────────────────

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
  const [retryCount, setRetryCount] = useState(0);
  const [stats, setStats] = useState<DashboardStats>({});
  const [liveEvents, setLiveEvents] = useState<Transaction[]>([]);

  const liveEventsRef = useRef<Transaction[]>([]);
  liveEventsRef.current = liveEvents;

  // Cap stored events to avoid unbounded memory / localStorage bloat
  const MAX_EVENTS = 50;

  // Load saved rules
  useEffect(() => {
    setRules(loadRules());
  }, []);

  const handleWsMessage = useCallback((msg: WebSocketMessage) => {
    if (msg.event) {
      const ev = msg.event;
      const tx: Transaction = {
        id: ev.id,
        hash: ev.hash || "",
        from: ev.from || "",
        to: ev.to || "",
        amount: typeof ev.amount === "number" ? String(ev.amount) : ev.amount || "",
        risk: (ev.risk as RiskLevel) || "low",
        type: ev.type || "transaction",
        timestamp: typeof ev.timestamp === "number" ? new Date(ev.timestamp).toISOString() : ev.timestamp || new Date().toISOString(),
      };
      setLiveEvents((prev) => {
        const next = [tx, ...prev];
        return next.slice(0, MAX_EVENTS);
      });
    }
  }, []);

  const { connect, disconnect } = useWebSocketStream(
    "wss://api.fidesorigin.com/ws",
    handleWsMessage,
    setStats
  );

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const handleAddressChange = useCallback(
    (value: string, isValid: boolean) => {
      setAddress(value);
      setAddressValid(isValid);
      if (error) setError(null);
    },
    [error]
  );

  const handleSearch = useCallback(async () => {
    if (!addressValid) {
      setError("请输入有效的以太坊地址");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      validateEthereumAddress(address);
      const result = await fetchRiskAnalysis(address);
      setReport(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("查询失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  }, [address, addressValid]);

  const handleSaveRules = useCallback(async () => {
    setSaveStatus(null);
    try {
      const result = await saveRules(rules);
      setSaveStatus({
        type: result.success ? "success" : "error",
        message: result.message,
      });
    } catch (err) {
      setSaveStatus({
        type: "error",
        message: err instanceof Error ? err.message : "保存失败",
      });
    }
  }, [rules]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">FidesOrigin 风控仪表盘</h1>
          <p className="text-gray-400 mt-2">链上风险分析 · 实时监控 · 合规规则配置</p>
        </header>

        <div className="flex gap-2 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab("query")}
            className={`px-4 py-2 transition-colors ${
              activeTab === "query"
                ? "border-b-2 border-indigo-500 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            地址查询
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 transition-colors ${
              activeTab === "rules"
                ? "border-b-2 border-indigo-500 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            合规规则
          </button>
        </div>

        {activeTab === "query" && (
          <div className="space-y-6">
            <AddressInput value={address} onChange={handleAddressChange} />

            <button
              onClick={handleSearch}
              disabled={!addressValid || loading}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
            >
              {loading ? "查询中..." : "查询风险"}
            </button>

            {error && <ErrorFallback error={new Error(error)} />}

            {loading && <LoadingSpinner />}

            {report && !loading && (
              <div className="space-y-4">
                <RiskScore score={report.score || 0} level={report.level || "low"} />

                {report.tags && report.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {report.tags.map((tag, i) => (
                      <span
                        key={i}
                        className={`px-3 py-1 rounded-full text-sm border ${getTagStyle(tag.type)}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}

                {report.details && report.details.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {report.details.map((d, i) => (
                      <div
                        key={i}
                        className={`rounded-xl border p-4 ${getRiskBg(d.severity)}`}
                      >
                        <p className="font-medium mb-1">{d.category}</p>
                        <p className="text-sm text-gray-400">{d.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <LiveTransactionStream events={liveEvents} onSelect={setSelectedTx} />
          </div>
        )}

        {activeTab === "rules" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">合规规则配置</h2>
              <button
                onClick={handleSaveRules}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                保存规则
              </button>
            </div>

            {saveStatus && (
              <div
                className={`p-3 rounded-lg border ${
                  saveStatus.type === "success"
                    ? "bg-green-500/10 border-green-500/30 text-green-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {saveStatus.message}
              </div>
            )}

            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 p-4"
                >
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-sm text-gray-400">{rule.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${getActionStyle(rule.action)}`}
                    >
                      {rule.action}
                    </span>
                    <button
                      onClick={() => {
                        const next = [...rules];
                        next[idx] = { ...rule, enabled: !rule.enabled };
                        setRules(next);
                      }}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        rule.enabled ? "bg-indigo-500" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                          rule.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}