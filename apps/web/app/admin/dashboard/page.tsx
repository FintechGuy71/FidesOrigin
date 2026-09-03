"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

import LiveTransactionStream, { Transaction } from "@/components/LiveTransactionStream";

import { RiskBadge, RiskScore } from "@fidesorigin/ui";


// 事件显示配置
const MAX_EVENTS_DISPLAY = 50;
const MAX_EVENT_NAME_LENGTH = 30;
const MAX_ADDRESS_LENGTH = 10;
/* ⚠ 下面三个常量原先被直接当作「截断长度 / 风险分阈值」使用：
   MAX_ADDRESS_LENGTH(地址截断长度) 被当柱状图最小高度，
   CHART_UPDATE_INTERVAL(图表刷新间隔) 被当地址截断长度，
   MAX_EVENTS_DISPLAY(事件条数上限) 被当风险分阈值。
   改一个会破坏另一个，且语义完全无法维护。这里各自补上正确的常量。 */
const MIN_BAR_HEIGHT_PERCENT = 4;
const ADDRESS_PREVIEW_LENGTH = 12;
const HASH_PREVIEW_LENGTH = 20;
const RISK_SCORE_HIGH = 70;
const RISK_SCORE_MEDIUM = 40;
const CHART_UPDATE_INTERVAL = 12;
const CHART_ANIMATION_OFFSET = -6;
const BAR_CHART_OFFSET = -8;
const BAR_CHART_WIDTH = 20;

// API 配置（网关，注意默认 base 带 /v1）
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://fidesorigin-api.vercel.app/v1";
const AUTH_TOKEN_KEY = "fidesorigin_admin_token";
const AUTH_REFRESH_KEY = "fidesorigin_admin_refresh";
// [L-24 FIX] 移除硬编码生产 WS 回退地址：环境变量未配置时不建立 WS 连接
// （原实现静默指向生产 wss://api.fidesorigin.com/ws，环境错配难以察觉）
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

// WebSocket 重连配置
const WS_INITIAL_RETRY_DELAY = 1000;
const WS_MAX_RETRY_DELAY = 30000;
const WS_RETRY_MULTIPLIER = 2;

// 刷新间隔配置 (毫秒)
const REFRESH_INTERVALS = {
  realtime: 120000,    // 2分钟
  fast: 300000,        // 5分钟
  normal: 720000,      // 12分钟
  slow: 1080000,       // 18分钟
  verySlow: 1500000,   // 25分钟
} as const;

// 数值格式化常量
const FORMATTING = {
  million: 1000000,
  thousand: 1000,
  hundred: 100,
  minute: 60,
  second: 1000,
} as const;

// 统计数据类型
interface DashboardStats {
  /**
   * 风险趋势点。可选：后端未下发时前端必须渲染占位符，
   * 不得静默回退到硬编码样本（见文件内 [M-15 FIX] 的同款约束）。
   */
  riskTrend?: { time: string; score: number }[];
  todayBlocked: number;
  todayBlockedChange: number;
  riskAddresses: number;
  riskAddressesChange: number;
  complianceRate: number;
  complianceRateChange: number;
  monitoredTransactions: number;
  monitoredTransactionsChange: number;
}

// 风险事件类型
interface RiskEvent {
  id: string;
  type: string;
  address: string;
  amount: string;
  risk: "极高" | "高" | "中";
  time: string;
  status: "已拦截" | "审核中" | "已标记";
  timestamp?: number;
}

// WebSocket 连接钩子
function useDashboardWebSocket(
  url: string,
  onStatsUpdate: (stats: DashboardStats) => void,
  onNewEvent: (event: RiskEvent) => void
) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        // 订阅仪表盘数据
        ws.current?.send(JSON.stringify({ type: "subscribe", channel: "dashboard" }));
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "stats" && data.stats) {
            onStatsUpdate(data.stats);
          } else if (data.type === "event" && data.event) {
            onNewEvent(data.event);
          }
        } catch (_e) {
          console.error("WebSocket message parse error:", _e);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(WS_INITIAL_RETRY_DELAY * Math.pow(WS_RETRY_MULTIPLIER, reconnectAttempts.current), WS_MAX_RETRY_DELAY);
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };

      ws.current.onerror = () => {
        setError("WebSocket connection error");
        setIsConnected(false);
      };
    } catch {
      setError("Failed to create WebSocket connection");
    }
  }, [url, onStatsUpdate, onNewEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { isConnected, error };
}

// 后端返回的 snake_case 统计结构
interface BackendStats {
  today_blocked?: number;
  today_blocked_change?: number;
  risk_addresses?: number;
  risk_addresses_change?: number;
  compliance_rate?: number;
  compliance_rate_change?: number;
  monitored_transactions?: number;
  monitored_transactions_change?: number;
  risk_trend?: { time: string; score: number }[];
  riskTrend?: { time: string; score: number }[];
}

// snake_case → camelCase 适配层
function adaptStats(raw: BackendStats): DashboardStats {
  return {
    riskTrend: raw.risk_trend ?? raw.riskTrend,
    todayBlocked: raw.today_blocked ?? 0,
    todayBlockedChange: raw.today_blocked_change ?? 0,
    riskAddresses: raw.risk_addresses ?? 0,
    riskAddressesChange: raw.risk_addresses_change ?? 0,
    complianceRate: raw.compliance_rate ?? 0,
    complianceRateChange: raw.compliance_rate_change ?? 0,
    monitoredTransactions: raw.monitored_transactions ?? 0,
    monitoredTransactionsChange: raw.monitored_transactions_change ?? 0,
  };
}

// 后端事件 → RiskEvent 适配层
function adaptEvent(raw: Record<string, unknown>): RiskEvent {
  const riskMap: Record<string, RiskEvent["risk"]> = {
    critical: "极高",
    "极高": "极高",
    high: "高",
    "高": "高",
    medium: "中",
    "中": "中",
  };
  const statusMap: Record<string, RiskEvent["status"]> = {
    blocked: "已拦截",
    "已拦截": "已拦截",
    reviewing: "审核中",
    "审核中": "审核中",
    flagged: "已标记",
    "已标记": "已标记",
  };
  const riskRaw = String(raw.risk ?? raw.risk_level ?? "中");
  const statusRaw = String(raw.status ?? "已标记");
  const ts = typeof raw.timestamp === "number" ? raw.timestamp : undefined;
  return {
    id: String(raw.id ?? raw.event_id ?? ""),
    type: String(raw.type ?? raw.event_type ?? ""),
    address: String(raw.address ?? ""),
    amount: String(raw.amount ?? ""),
    risk: riskMap[riskRaw] ?? "中",
    time: String(raw.time ?? raw.created_at ?? ""),
    status: statusMap[statusRaw] ?? "已标记",
    timestamp: ts,
  };
}

// 带凭证的请求：401 时自动用 refresh_token 换新 token 重试一次
async function authedFetch(path: string, retry = true): Promise<Response> {
  const token = window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  const doFetch = (t: string | null) =>
    fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });

  let response = await doFetch(token);
  if (response.status === 401 && retry) {
    const refreshToken = window.sessionStorage.getItem(AUTH_REFRESH_KEY);
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
        if (data.refresh_token) {
          window.sessionStorage.setItem(AUTH_REFRESH_KEY, data.refresh_token);
        }
        response = await doFetch(data.access_token);
      }
    }
  }
  return response;
}

// 获取仪表盘数据
// [M-15 FIX] 移除静默 mock 回退：原实现 API 失败时 console.warn 后返回硬编码
// 虚构统计（"今日拦截 1247 笔、合规率 98.7%"）——合规产品的仪表盘展示
// 假数据而用户无从分辨。修复：失败返回 null，UI 显式渲染"数据不可用"状态。
async function fetchDashboardData(): Promise<{
  stats: DashboardStats | null;
  events: RiskEvent[];
  unauthorized?: boolean;
} | null> {
  try {
    const [statsRes, eventsRes] = await Promise.all([
      authedFetch("/dashboard/stats"),
      authedFetch("/dashboard/events"),
    ]);

    if (statsRes.status === 401 || eventsRes.status === 401) {
      return { stats: null, events: [], unauthorized: true };
    }
    if (!statsRes.ok || !eventsRes.ok) {
      throw new Error(`API 错误: stats=${statsRes.status} events=${eventsRes.status}`);
    }

    const statsData = await statsRes.json();
    const eventsData = await eventsRes.json();
    const rawStats: BackendStats | null = statsData?.stats ?? statsData ?? null;
    const rawEvents: Record<string, unknown>[] = Array.isArray(eventsData)
      ? eventsData
      : Array.isArray(eventsData?.events)
        ? eventsData.events
        : [];
    return {
      stats: rawStats ? adaptStats(rawStats) : null,
      events: rawEvents.map(adaptEvent),
    };
  } catch (error) {
    console.warn("仪表盘 API 调用失败:", error);
    return null;
  }
}

// [M-15 FIX] getMockStats / getMockEvents 已删除（静默虚构数据回退）。
// 无数据时 UI 显式展示"数据不可用"占位状态。

// 图标组件
function ShieldIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function LiveIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isConnected ? "bg-emerald-400" : "bg-yellow-400"
          }`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            isConnected ? "bg-emerald-500" : "bg-yellow-500"
          }`}
        ></span>
      </span>
      <span
        className={`text-sm font-medium ${isConnected ? "text-emerald-400" : "text-yellow-400"}`}
      >
        {isConnected ? "实时监控中" : "连接中..."}
      </span>
    </div>
  );
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= FORMATTING.million) {
    return (num / FORMATTING.million).toFixed(1) + "M";
  }
  if (num >= FORMATTING.thousand) {
    return (num / FORMATTING.thousand).toFixed(1) + "K";
  }
  return num.toString();
}

// 格式化时间
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / FORMATTING.second);
  if (seconds < FORMATTING.minute) return "刚刚";
  const minutes = Math.floor(seconds / FORMATTING.minute);
  if (minutes < FORMATTING.minute) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / FORMATTING.minute);
  return `${hours}小时前`;
}

export default function DashboardPage() {
  // [M-15 FIX] stats 允许为 null：无数据时渲染显式占位而非虚构数字
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataUnavailable, setDataUnavailable] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  /* 鉴权门禁：与 public/admin/index.html 共用 sessionStorage token（网关真登录）。
     初始为 null：SSR/水合完成前不渲染后台内容，避免未授权闪现。 */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [pwdInput, setPwdInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    setAuthed(
      typeof window !== "undefined" &&
        !!window.sessionStorage.getItem(AUTH_TOKEN_KEY)
    );
  }, []);

  const tryLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: pwdInput }),
      });
      if (res.ok) {
        const data = await res.json();
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
        if (data.refresh_token) {
          window.sessionStorage.setItem(AUTH_REFRESH_KEY, data.refresh_token);
        }
        setAuthed(true);
      } else if (res.status === 401) {
        setLoginError("用户名或密码错误");
      } else if (res.status === 423) {
        setLoginError("账户已锁定，请稍后再试");
      } else {
        setLoginError("服务器错误，请稍后再试");
      }
    } catch {
      setLoginError("无法连接服务器");
    } finally {
      setLoginSubmitting(false);
    }
  };

  // 初始加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchDashboardData();
        if (data?.unauthorized) {
          // token 失效且 refresh 失败：清凭证回登录页
          window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
          window.sessionStorage.removeItem(AUTH_REFRESH_KEY);
          setAuthed(false);
          return;
        }
        if (data) {
          setStats(data.stats);
          setEvents(data.events);
          setDataUnavailable(data.stats === null);
        } else {
          setDataUnavailable(true);
        }
      } catch (error) {
        console.error("加载数据失败:", error);
        setDataUnavailable(true);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // 定期刷新数据（每 30 秒）
    const interval = setInterval(loadData, WS_MAX_RETRY_DELAY);
    return () => clearInterval(interval);
  }, []);

  // WebSocket 数据更新处理
  const handleStatsUpdate = useCallback((newStats: DashboardStats) => {
    setStats(newStats);
    setDataUnavailable(false);
  }, []);

  const handleNewEvent = useCallback((event: RiskEvent) => {
    setEvents((prev) => {
      const newEvent = { ...event, timestamp: Date.now() };
      const exists = prev.some((e) => e.id === event.id);
      if (exists) return prev;
      return [newEvent, ...prev].slice(0, MAX_EVENTS_DISPLAY);
    });
  }, []);

  // WebSocket 连接
  const { isConnected } = useDashboardWebSocket(WS_URL, handleStatsUpdate, handleNewEvent);

  // 统计数据卡片（[M-15 FIX] 无数据时显示占位符而非虚构数字）
  const statCards = [
    {
      title: "今日拦截",
      value: stats ? formatNumber(stats.todayBlocked) : "—",
      change: stats ? `+${stats.todayBlockedChange}%` : "",
      changeType: "positive" as const,
      icon: ShieldIcon,
    },
    {
      title: "风险地址",
      value: stats ? formatNumber(stats.riskAddresses) : "—",
      change: stats ? `+${stats.riskAddressesChange}%` : "",
      changeType: "negative" as const,
      icon: AlertIcon,
    },
    {
      title: "合规通过率",
      value: stats ? `${stats.complianceRate}%` : "—",
      change: stats ? `+${stats.complianceRateChange}%` : "",
      changeType: "positive" as const,
      icon: CheckIcon,
    },
    {
      title: "监控交易",
      value: stats ? formatNumber(stats.monitoredTransactions) : "—",
      change: stats ? `+${stats.monitoredTransactionsChange}%` : "",
      changeType: "positive" as const,
      icon: ChartIcon,
    },
  ];

  /* 风险趋势（用于图表）。
     ⚠ 原先这里是一份硬编码的 7 点样本（12/8/25/45/38/55/42），永远显示
     同一条编造曲线 —— 与同文件 [M-15 FIX]「移除静默 mock 回退」直接冲突：
     上方统计卡在无数据时正确显示「—」，下方图表却一直在画假曲线，
     两个区块数据自相矛盾（图表 42 分 vs 卡片 —）。
     改为读后端下发的 riskTrend，无数据时 riskTrendData 为空，
     由下方渲染逻辑输出占位符。 */
  const riskTrendData = stats?.riskTrend ?? [];

  /* 风险类型分布：从真实事件列表派生。事件类型字段来自后端，
     这里只做计数与归一化，不预设任何具体类型名。 */
  const riskTypeDistribution = (() => {
    if (events.length === 0) return [];
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    const palette = [
      { color: "bg-[var(--fio-danger)]", textColor: "text-[var(--fio-danger)]" },
      { color: "bg-[var(--fio-warn)]",   textColor: "text-[var(--fio-warn)]" },
      { color: "bg-[var(--fio-info)]",   textColor: "text-[var(--fio-info)]" },
      { color: "bg-[var(--fio-success)]", textColor: "text-[var(--fio-success)]" },
    ];
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count], i) => ({
        name,
        percent: Math.round((count / events.length) * 100),
        ...palette[i % palette.length],
      }));
  })();

  const latestRiskScore = riskTrendData.length > 0 ? riskTrendData[riskTrendData.length - 1].score : null;

  const handleTransactionClick = (tx: Transaction) => {
    setSelectedTx(tx);
  };

  /* [O-4 Fix] 鉴权门禁渲染：
     authed === null → 水合未完成，渲染空白避免未授权内容闪现；
     authed === false → 渲染登录表单；
     authed === true → 渲染后台本体。 */
  if (authed === null) {
    return <div className="min-h-screen bg-[var(--fio-ink)]" />;
  }
  if (authed === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--fio-ink)] px-4">
        <form
          onSubmit={tryLogin}
          className="w-full max-w-sm rounded-xl border border-[var(--fio-border)] bg-[var(--fio-surface)] p-8"
        >
          <h1 className="mb-2 text-xl font-semibold text-[var(--fio-text)]">Admin Sign In</h1>
          <p className="mb-6 text-sm text-[var(--fio-text-2)]">Sign in with your admin account to continue.</p>
          <label htmlFor="admin-username" className="mb-1 block text-sm text-[var(--fio-text-2)]">
            Username
          </label>
          <input
            id="admin-username"
            type="text"
            value={usernameInput}
            onChange={(e) => {
              setUsernameInput(e.target.value);
              setLoginError(null);
            }}
            placeholder="Username"
            aria-label="Admin username"
            autoComplete="username"
            className="mb-4 w-full rounded-lg border border-[var(--fio-border)] bg-[var(--fio-ink)] px-4 py-3 text-[var(--fio-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fio-gold)]"
          />
          <label htmlFor="admin-password" className="mb-1 block text-sm text-[var(--fio-text-2)]">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={pwdInput}
            onChange={(e) => {
              setPwdInput(e.target.value);
              setLoginError(null);
            }}
            placeholder="Password"
            aria-label="Admin password"
            autoComplete="current-password"
            className="mb-4 w-full rounded-lg border border-[var(--fio-border)] bg-[var(--fio-ink)] px-4 py-3 text-[var(--fio-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fio-gold)]"
          />
          {loginError && (
            <p className="mb-4 text-sm text-[var(--fio-danger)]" role="alert">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            disabled={loginSubmitting}
            className="w-full rounded-lg bg-[var(--fio-gold)] px-4 py-3 font-medium text-[var(--fio-ink)] transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--fio-gold)] focus:ring-offset-2 focus:ring-offset-[var(--fio-ink)] disabled:opacity-50"
          >
            {loginSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--fio-ink)]">
      {/* Header */}
      <div className="border-b border-[var(--fio-border)] bg-[var(--fio-surface)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">运营仪表盘</h1>
              <p className="text-[var(--fio-text-2)] mt-1">FidesOrigin 实时风险监控与合规数据概览</p>
            </div>
            <div className="flex items-center gap-4">
              {dataUnavailable && (
                <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                  数据不可用
                </span>
              )}
              <LiveIndicator isConnected={isConnected} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-[var(--fio-surface)] border border-[var(--fio-border)] rounded-xl p-6 hover:border-[var(--fio-border-light)] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[var(--fio-text-2)] text-sm">{card.title}</p>
                  <p className="text-2xl sm:text-3xl font-semibold text-white mt-2">
                    {loading ? "-" : card.value}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      card.changeType === "positive" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {card.change} 较昨日
                  </p>
                </div>
                <div className="p-3 bg-[var(--fio-surface-2)]/50 rounded-lg text-[var(--fio-text-2)]">
                  <card.icon />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Risk Trend Chart */}
          <div className="lg:col-span-2 bg-[var(--fio-surface)] border border-[var(--fio-border)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">风险趋势监控</h2>
              <div className="flex gap-2">
                <span className="text-xs px-2 py-1 rounded bg-[var(--fio-surface-2)] text-[var(--fio-text-2)]">24H</span>
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">实时</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {riskTrendData.map((point, i) => (
                <div key={i} className="text-center p-3 rounded-lg bg-[var(--fio-surface-2)]">
                  <div className={`text-xl font-semibold ${
                    point.score >= MAX_EVENTS_DISPLAY ? "text-red-400" : point.score >= MAX_EVENT_NAME_LENGTH ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {point.score}
                  </div>
                  <div className="mt-1 text-xs text-[var(--fio-text-2)]">{point.time}</div>
                </div>
              ))}
            </div>

            <div className="h-48 flex items-end justify-between gap-2">
              {riskTrendData.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center text-sm text-[var(--fio-text-2)]">
                  No trend data available
                </div>
              ) : riskTrendData.map((point, i) => {
                const height = `${Math.max(MIN_BAR_HEIGHT_PERCENT, point.score)}%`;
                const color =
                  point.score >= RISK_SCORE_HIGH
                    ? "bg-[var(--fio-danger)]"
                    : point.score >= RISK_SCORE_MEDIUM
                      ? "bg-[var(--fio-warn)]"
                      : "bg-[var(--fio-success)]";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-[var(--fio-surface-2)] rounded-t-lg relative h-32">
                      <div
                        className={`absolute bottom-0 left-0 right-0 ${color} rounded-t-lg transition-all duration-500`}
                        style={{ height }}
                      />
                    </div>
                    <span className="text-xs text-[var(--fio-text-2)]">{point.time}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Type Distribution */}
          <div className="bg-[var(--fio-surface)] border border-[var(--fio-border)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Risk Type Distribution</h2>
            {/* ⚠ 原先这里是一份硬编码的百分比（35/28/15/22），永远是同一组数字。
                改为从真实事件列表派生；无事件时显示占位符。 */}
            {events.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--fio-text-2)]">
                No risk events recorded
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-4">
              {riskTypeDistribution.map((item) => (
                <div key={item.name} className="text-center p-4 bg-[var(--fio-surface-2)] rounded-lg">
                  <div className={`text-2xl font-bold ${item.textColor}`}>{item.percent}%</div>
                  <div className="text-sm text-[var(--fio-text-2)] mt-1">{item.name}</div>
                  <div className="mt-2 h-1.5 bg-[var(--fio-surface-3)] rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
            )}
            {/* 总体风险评分 */}
            <div className="mt-6 pt-6 border-t border-[var(--fio-border)]">
              <div className="text-center">
                <p className="text-sm text-[var(--fio-text-2)] mb-2">Current System Risk Score</p>
                {/* ⚠ 原先硬编码 score={42} level="medium"：无论后端返回什么，
                    页面永远显示 42/中等。改为取趋势末点，无数据时显示占位符。 */}
                {latestRiskScore === null ? (
                  <p className="text-2xl font-semibold text-[var(--fio-text-2)]">—</p>
                ) : (
                  <RiskScore
                    score={latestRiskScore}
                    level={latestRiskScore >= RISK_SCORE_HIGH ? "high" : latestRiskScore >= RISK_SCORE_MEDIUM ? "medium" : "low"}
                    size="md"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Transaction Stream */}
        {/* [M-15 FIX] 不再使用模拟交易流：WS 未配置时显示空状态而非编造交易 */}
        <LiveTransactionStream
          maxItems={30}
          autoScroll={true}
          showHeader={true}
          onTransactionClick={handleTransactionClick}
          wsUrl={WS_URL || undefined}
          useMockData={false}
          className="mb-8"
        />

        {/* Recent Events Table */}
        <div className="bg-[var(--fio-surface)] border border-[var(--fio-border)] rounded-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-[var(--fio-border)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">最近风险事件</h2>
              <button className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                查看全部 →
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--fio-surface-2)]/50">
                  <th className="text-left text-xs font-medium text-[var(--fio-text-2)] uppercase tracking-wider px-6 py-4">
                    事件ID
                  </th>
                  <th className="text-left text-xs font-medium text-[var(--fio-text-2)] uppercase tracking-wider px-6 py-4">
                    类型
                  </th>
                  <th className="text-left text-xs font-medium text-[var(--fio-text-2)] uppercase tracking-wider px-6 py-4">
                    地址
                  </th>
                  <th className="text-left text-xs font-medium text-[var(--fio-text-2)] uppercase tracking-wider px-6 py-4">
                    金额
                  </th>
                  <th className="text-left text-xs font-medium text-[var(--fio-text-2)] uppercase tracking-wider px-6 py-4">
                    风险等级
                  </th>
                  <th className="text-left text-xs font-medium text-[var(--fio-text-2)] uppercase tracking-wider px-6 py-4">
                    时间
                  </th>
                  <th className="text-left text-xs font-medium text-[var(--fio-text-2)] uppercase tracking-wider px-6 py-4">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fio-border)]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[var(--fio-text-2)]">
                      加载中...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[var(--fio-text-2)]">
                      暂无风险事件
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id} className="hover:bg-[var(--fio-surface-2)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {event.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--fio-text)]">
                        {event.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--fio-text-2)] font-mono">
                        {event.address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {event.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RiskBadge
                          level={
                            event.risk === "极高"
                              ? "critical"
                              : event.risk === "高"
                              ? "high"
                              : "medium"
                          }
                          text={event.risk}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--fio-text-2)]">
                        {event.timestamp
                          ? formatTimeAgo(event.timestamp)
                          : event.time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            event.status === "已拦截"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : event.status === "审核中"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-[var(--fio-text-2)]"
                          }`}
                        >
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "生成报告", desc: "导出今日风险分析", color: "blue" },
            { title: "配置规则", desc: "更新风控策略", color: "purple" },
            { title: "地址查询", desc: "查询风险地址", color: "orange" },
            { title: "系统设置", desc: "管理通知与阈值", color: "gray" },
          ].map((action, index) => (
            <button
              key={index}
              className="p-4 bg-[var(--fio-surface)] border border-[var(--fio-border)] rounded-xl text-left hover:border-[var(--fio-border-light)] hover:bg-[var(--fio-surface-2)]/50 transition-all group"
            >
              <h3 className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-[var(--fio-text-2)] mt-1">{action.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 交易详情弹窗 */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="bg-[var(--fio-surface)] border border-[var(--fio-border-light)] rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">交易详情</h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-[var(--fio-text-2)] hover:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">交易哈希</span>
                {/* 原 text-indigo-400 依赖已删除的 tailwind.config.js 色板，
                    在 v4 下落回默认蓝紫。改用品牌强调色令牌。 */}
                <span className="font-mono text-[var(--fio-accent)]">
                  {selectedTx.hash.slice(0, HASH_PREVIEW_LENGTH)}...{selectedTx.hash.slice(BAR_CHART_OFFSET)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">发送方</span>
                <span className="font-mono text-[var(--fio-text)]">
                  {selectedTx.from.slice(0, ADDRESS_PREVIEW_LENGTH)}...{selectedTx.from.slice(CHART_ANIMATION_OFFSET)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">接收方</span>
                <span className="font-mono text-[var(--fio-text)]">
                  {selectedTx.to.slice(0, ADDRESS_PREVIEW_LENGTH)}...{selectedTx.to.slice(CHART_ANIMATION_OFFSET)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">金额</span>
                <span className="text-white font-medium">
                  {selectedTx.amount} {selectedTx.token}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">风险评分</span>
                <RiskBadge level={selectedTx.riskLevel} text={`${selectedTx.riskScore}分`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">状态</span>
                <span
                  className={`${
                    selectedTx.status === "confirmed"
                      ? "text-green-400"
                      : selectedTx.status === "flagged"
                      ? "text-orange-400"
                      : selectedTx.status === "failed"
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}
                >
                  {selectedTx.status === "confirmed" && "已确认"}
                  {selectedTx.status === "flagged" && "已标记"}
                  {selectedTx.status === "failed" && "失败"}
                  {selectedTx.status === "pending" && "待确认"}
                </span>
              </div>
              {selectedTx.tags && selectedTx.tags.length > 0 && (
                <div className="pt-4 border-t border-[var(--fio-border)]">
                  <span className="text-[var(--fio-text-2)] text-sm">风险标签:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTx.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400"
                      >
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
