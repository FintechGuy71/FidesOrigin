"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

import LiveTransactionStream, { Transaction } from "@/components/LiveTransactionStream";

import { RiskBadge, RiskScore } from "@fidesorigin/ui";


// 事件显示配置
/* [AUDIT FIX R2-016/R2-017 收尾] 原 MAX_EVENT_NAME_LENGTH / MAX_ADDRESS_LENGTH /
   CHART_UPDATE_INTERVAL / CHART_ANIMATION_OFFSET / BAR_CHART_OFFSET / BAR_CHART_WIDTH /
   REFRESH_INTERVALS 七个常量在语义修复后全站零消费（原先正是它们被互相
   误用造成截断长度/阈值 bug），已删除，避免"看似可用"的误导。 */
const MAX_EVENTS_DISPLAY = 50;
const MIN_BAR_HEIGHT_PERCENT = 4;
const ADDRESS_PREVIEW_LENGTH = 12;
const HASH_PREVIEW_LENGTH = 20;
/* [AUDIT FIX] 地址/哈希「取末尾 N 位」的语义常量。
   此前 modal 里用 slice(BAR_CHART_OFFSET=-8) / slice(CHART_ANIMATION_OFFSET=-6)
   —— 两个图表几何常量被当字符串负索引，数值凑巧能用但语义完全错误，
   改图表布局会静默改变地址显示。 */
const ADDRESS_TAIL_LENGTH = 6;
const HASH_TAIL_LENGTH = 8;
const RISK_SCORE_HIGH = 70;
const RISK_SCORE_MEDIUM = 30; // [AUDIT FIX 2026-09-18 R3-L14] 与 shared RISK_THRESHOLDS 对齐（medium≥30）
/* [AUDIT FIX] 仪表盘数据轮询间隔。此前复用 WS_MAX_RETRY_DELAY（WS 重连退避上限），
   数值凑巧 30s，但改 WS 退避策略会连带改刷新频率。 */
const DASHBOARD_REFRESH_INTERVAL = 30000;

// API 配置
/* [D1 Fix] admin 会话改为 httpOnly cookie（JS 不可读，根治 XSS 窃取 token）。
   API 走同源 rewrite（/api/v1/* 反代到网关 fidesorigin-api.vercel.app），
   同源使 cookie 成为第一方，避免跨域第三方 cookie 被浏览器拦截。
   不再在 sessionStorage 存 token；fetch 一律 credentials: "include" 由浏览器自动带 cookie。 */
const API_BASE = "/api/v1";
// [L-24 FIX] 移除硬编码生产 WS 回退地址：环境变量未配置时不建立 WS 连接
// （原实现静默指向生产 wss://api.fidesorigin.com/ws，环境错配难以察觉）
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

// WebSocket 重连配置
const WS_INITIAL_RETRY_DELAY = 1000;
const WS_MAX_RETRY_DELAY = 30000;
const WS_RETRY_MULTIPLIER = 2;

// 数值格式化常量
/* [AUDIT FIX] .hundred 零消费已删除。 */
const FORMATTING = {
  million: 1000000,
  thousand: 1000,
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
  risk: "极高" | "高" | "中" | "低";
  time: string;
  status: "已拦截" | "审核中" | "已标记" | "误报";
  timestamp?: number;
}

// WebSocket 连接钩子
function useDashboardWebSocket(
  url: string,
  onStatsUpdate: (stats: DashboardStats) => void,
  onNewEvent: (event: RiskEvent) => void,
  /* [AUDIT FIX 2026-09-17 R1-004] 与数据拉取的 authed 门禁对齐：未登录不建 WS */
  enabled: boolean = true
) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  /* [AUDIT FIX 2026-09-17 R1-003] 主动关闭标志：此前 disconnect() 调 ws.close()
     后 onclose 异步触发仍无条件 setTimeout(connect) → 组件卸载后又 new WebSocket，
     泄漏连接与定时器。disconnect 置位后 onclose 不再重连。 */
  const closedByUser = useRef(false);

  const connect = useCallback(() => {
    /* [AUDIT FIX R2-056] WS_URL 未配置（空串）时不得构造 WebSocket：
       new WebSocket("") 会抛 SyntaxError。此前该 hook 无守卫（同仓
       LiveTransactionStream 的 useWebSocket 有 `if (!url) return;`），
       导致未配置环境下每次打开页面必抛错，且 LiveIndicator 永显"连接中"。
       与 LiveTransactionStream 对齐：空 URL 直接跳过连接。 */
    if (!url || !enabled) return;
    closedByUser.current = false;
    try {
      // [AUDIT FIX 2026-09-18 R3-M1] 与 LiveTransactionStream 同款实例身份守卫
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        // 订阅仪表盘数据
        socket.send(JSON.stringify({ type: "subscribe", channel: "dashboard" }));
      };

      socket.onmessage = (event) => {
        if (ws.current !== socket) return; // [R3-M1] 过期实例不投递
        try {
          const data = JSON.parse(event.data);
          if (data.type === "stats" && data.stats) {
            /* [AUDIT FIX 2026-09-18 R3] WS 推送原样绕过适配层：后端 WS 下发的
               snake_case 字段会让统计卡显示 "—"，事件的大写枚举让等级/状态
               比较全部落空。与 REST 路径一致走 adapt*。 */
            onStatsUpdate(adaptStats(data.stats as Record<string, unknown>));
          } else if (data.type === "event" && data.event) {
            onNewEvent(adaptEvent(data.event as Record<string, unknown>));
          }
        } catch (_e) {
          console.error("WebSocket message parse error:", _e);
        }
      };

      socket.onclose = () => {
        if (ws.current !== socket) return; // [R3-M1] 过期实例不触发重连
        setIsConnected(false);
        if (closedByUser.current) return; // [R1-003] 主动关闭/卸载后不重连
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(WS_INITIAL_RETRY_DELAY * Math.pow(WS_RETRY_MULTIPLIER, reconnectAttempts.current), WS_MAX_RETRY_DELAY);
          reconnectTimeout.current = setTimeout(connect, delay);
        } else {
          /* [AUDIT FIX 2026-09-18 R3] 原实现重连耗尽后静默死亡——
             LiveIndicator 恒显"连接中..."，运营无法察觉监控失联。 */
          setError("实时监控连接已断开（重连失败），请刷新页面重试");
        }
      };

      socket.onerror = () => {
        if (ws.current !== socket) return; // [R3-M1]
        setError("WebSocket connection error");
        setIsConnected(false);
      };
    } catch {
      setError("Failed to create WebSocket connection");
    }
  }, [url, onStatsUpdate, onNewEvent, enabled]);

  const disconnect = useCallback(() => {
    closedByUser.current = true; // [R1-003] 阻止 onclose 里的重连定时器
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
/* [AUDIT FIX 2026-09-17 R1-001] 后端 /api/v1/dashboard/summary 实际返回
   嵌套结构 { today_blocked: { value, change }, ... }（backend/controllers/dashboard.py
   的 _metric()），原适配层按扁平数字读取 → 统计卡显示 "[object Object]"。
   现同时兼容嵌套 {value,change} 与扁平字段两种形态。 */
interface BackendMetric {
  value?: number;
  change?: number | null;
}
interface BackendStats {
  today_blocked?: number | BackendMetric;
  today_blocked_change?: number;
  risk_addresses?: number | BackendMetric;
  risk_addresses_change?: number;
  compliance_rate?: number | BackendMetric;
  compliance_rate_change?: number;
  monitored_transactions?: number | BackendMetric;
  monitored_transactions_change?: number;
  risk_trend?: { time: string; score: number }[];
  riskTrend?: { time: string; score: number }[];
}

function metricValue(m: number | BackendMetric | undefined, flat?: number): number {
  if (typeof m === "number") return m;
  if (m && typeof m.value === "number") return m.value;
  return flat ?? 0;
}

function metricChange(m: number | BackendMetric | undefined, flat?: number): number {
  if (m && typeof m === "object" && typeof m.change === "number") return m.change;
  return flat ?? 0;
}

// snake_case → camelCase 适配层
function adaptStats(raw: BackendStats): DashboardStats {
  return {
    riskTrend: (Array.isArray(raw.risk_trend) ? raw.risk_trend : Array.isArray(raw.riskTrend) ? raw.riskTrend : []) as DashboardStats["riskTrend"],
    todayBlocked: metricValue(raw.today_blocked),
    todayBlockedChange: metricChange(raw.today_blocked, raw.today_blocked_change),
    riskAddresses: metricValue(raw.risk_addresses),
    riskAddressesChange: metricChange(raw.risk_addresses, raw.risk_addresses_change),
    complianceRate: metricValue(raw.compliance_rate),
    complianceRateChange: metricChange(raw.compliance_rate, raw.compliance_rate_change),
    monitoredTransactions: metricValue(raw.monitored_transactions),
    monitoredTransactionsChange: metricChange(raw.monitored_transactions, raw.monitored_transactions_change),
  };
}

// 后端事件 → RiskEvent 适配层
/* [AUDIT FIX 2026-09-17 R1-002] 后端事件枚举为大写（backend/models.py:
   RiskLevel=LOW/MEDIUM/HIGH/CRITICAL/UNKNOWN, EventStatus=PENDING/CONFIRMED/
   FALSE_POSITIVE/UNDER_REVIEW），原映射表只有小写/中文键 → 所有事件等级/状态
   全部落入 ?? 兜底，HIGH/CRITICAL 被系统性降级显示为「中」。
   现统一 toUpperCase 归一后映射，并补全 LOW/UNKNOWN 与全部后端状态枚举。 */
function adaptEvent(raw: Record<string, unknown>): RiskEvent {
  const riskMap: Record<string, RiskEvent["risk"]> = {
    CRITICAL: "极高",
    HIGH: "高",
    MEDIUM: "中",
    LOW: "低",
    UNKNOWN: "中",
  };
  const statusMap: Record<string, RiskEvent["status"]> = {
    BLOCKED: "已拦截",
    CONFIRMED: "已拦截",
    PENDING: "审核中",
    UNDER_REVIEW: "审核中",
    REVIEWING: "审核中",
    FALSE_POSITIVE: "误报",
    FLAGGED: "已标记",
  };
  const riskZhMap: Record<string, RiskEvent["risk"]> = {
    "极高": "极高", "高": "高", "中": "中", "低": "低",
  };
  const statusZhMap: Record<string, RiskEvent["status"]> = {
    "已拦截": "已拦截", "审核中": "审核中", "已标记": "已标记", "误报": "误报",
  };
  const riskRaw = String(raw.risk ?? raw.risk_level ?? "中");
  const statusRaw = String(raw.status ?? "已标记");
  const ts = typeof raw.timestamp === "number" ? raw.timestamp : undefined;
  return {
    id: String(raw.id ?? raw.event_id ?? ""),
    type: String(raw.type ?? raw.event_type ?? ""),
    address: String(raw.address ?? ""),
    amount: String(raw.amount ?? ""),
    risk: riskMap[riskRaw.toUpperCase()] ?? riskZhMap[riskRaw] ?? "中",
    time: String(raw.time ?? raw.created_at ?? ""),
    status: statusMap[statusRaw.toUpperCase()] ?? statusZhMap[statusRaw] ?? "已标记",
    timestamp: ts,
  };
}

// 带凭证的请求：401 时自动用 httpOnly refresh cookie 换新 token 重试一次。
// [D1 Fix] 凭证在 cookie（浏览器自动携带），前端不再读写 token。
async function authedFetch(path: string, retry = true): Promise<Response> {
  let response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (response.status === 401 && retry) {
    // access 过期：refresh cookie 换新（网关读 cookie，前端不传值）
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (refreshRes.ok) {
      response = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
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

function LiveIndicator({ isConnected, wsConfigured }: { isConnected: boolean; wsConfigured: boolean }) {
  /* [AUDIT FIX R2-056] 未配置 WS 时显示"未配置"而非恒显"连接中..."：
     与 LiveTransactionStream 头部状态口径一致，避免同屏矛盾。 */
  if (!wsConfigured) {
    return (
      <span className="text-sm font-medium text-[var(--fio-text-3)] px-2 py-0.5 rounded-full bg-[var(--fio-surface-2)]">
        实时流未配置
      </span>
    );
  }
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
  // [AUDIT FIX 2026-09-18 R3-L13] 超过 24 小时不再显示 "50小时前"
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export default function DashboardPage() {
  // [M-15 FIX] stats 允许为 null：无数据时渲染显式占位而非虚构数字
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataUnavailable, setDataUnavailable] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  /* [AUDIT FIX R2-059] 交易详情模态框：焦点管理 + Esc 关闭所需的 ref */
  const modalRef = useRef<HTMLDivElement>(null);

  /* [D1 Fix] 鉴权门禁改用 httpOnly cookie。cookie JS 不可读，无法像 sessionStorage
     那样本地探测，改为水合后调 /auth/me 确认会话有效性（401 → 未登录）。
     初始为 null：SSR/水合完成前不渲染后台内容，避免未授权闪现。 */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [pwdInput, setPwdInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 会话探测：cookie 存在且未过期 → 200；否则 401 → 登录表单
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false));
  }, []);

  const tryLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: pwdInput }),
      });
      // [D1 Fix] token 已由网关 Set-Cookie 落进 httpOnly cookie，响应体不再含 token，
      // 前端无需也读不到——登录成功仅看 2xx。
      if (res.ok) {
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
    /* [AUDIT FIX R2-065] 仅在已登录（authed === true）时拉取数据：
       此前 effect 无前置条件，未登录用户每次打开页面都会发出 2 个必 401 的
       /dashboard/stats|events 请求 + 1 次必失败的 WS 构造，网关侧看是匿名扫射，
       可能触发风控/限流。authed 进入依赖数组：登录成功后自动开始拉取。 */
    if (authed !== true) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchDashboardData();
        if (data?.unauthorized) {
          // [D1 Fix] token 失效且 refresh 失败：cookie 由网关过期机制管理，
          // 前端无需清 sessionStorage，直接回登录页
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
    const interval = setInterval(loadData, DASHBOARD_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [authed]);

  // WebSocket 数据更新处理
  const handleStatsUpdate = useCallback((newStats: DashboardStats) => {
    setStats(newStats);
    setDataUnavailable(false);
  }, []);

  const handleNewEvent = useCallback((event: RiskEvent) => {
    setEvents((prev) => {
      // [R3] 保留后端事件时间；仅在缺失时才用到达时间兜底
      const newEvent = { ...event, timestamp: event.timestamp ?? Date.now() };
      const exists = prev.some((e) => e.id === event.id);
      if (exists) return prev;
      return [newEvent, ...prev].slice(0, MAX_EVENTS_DISPLAY);
    });
  }, []);

  // WebSocket 连接
  // [AUDIT FIX 2026-09-17 R1-004] 未登录（authed !== true）不建立 WS 连接
  const { isConnected, error: wsError } = useDashboardWebSocket(WS_URL, handleStatsUpdate, handleNewEvent, authed === true);

  /* [AUDIT FIX R2-057] 变化率此前恒以 `+` 前缀拼接：后端下发 -5 时显示 "+-5%"；
     且 changeType 按卡片写死，不随数值符号变化——下降的拦截量也显示绿色。
     改为按符号生成前缀，changeType 由数值方向决定。
     ⚠ 「风险地址」语义相反：风险地址**减少**是好事（绿），增加是坏事（红），
        因此该卡的 changeType 取反。 */
  const changeText = (v: number) => `${v >= 0 ? "+" : ""}${v}%`;

  // 统计数据卡片（[M-15 FIX] 无数据时显示占位符而非虚构数字）
  const statCards = [
    {
      title: "今日拦截",
      value: stats ? formatNumber(stats.todayBlocked) : "—",
      change: stats ? changeText(stats.todayBlockedChange) : "",
      changeType: (stats?.todayBlockedChange ?? 0) >= 0 ? ("positive" as const) : ("negative" as const),
      icon: ShieldIcon,
    },
    {
      title: "风险地址",
      value: stats ? formatNumber(stats.riskAddresses) : "—",
      change: stats ? changeText(stats.riskAddressesChange) : "",
      // 风险地址增加 = 负面（红），减少 = 正面（绿）——与其它卡方向相反
      changeType: (stats?.riskAddressesChange ?? 0) >= 0 ? ("negative" as const) : ("positive" as const),
      icon: AlertIcon,
    },
    {
      title: "合规通过率",
      value: stats ? `${stats.complianceRate}%` : "—",
      change: stats ? changeText(stats.complianceRateChange) : "",
      changeType: (stats?.complianceRateChange ?? 0) >= 0 ? ("positive" as const) : ("negative" as const),
      icon: CheckIcon,
    },
    {
      title: "监控交易",
      value: stats ? formatNumber(stats.monitoredTransactions) : "—",
      change: stats ? changeText(stats.monitoredTransactionsChange) : "",
      changeType: (stats?.monitoredTransactionsChange ?? 0) >= 0 ? ("positive" as const) : ("negative" as const),
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

  /* [AUDIT FIX R2-059] 模态框键盘契约：打开时焦点移入并支持 Esc 关闭。
     此前模态仅靠点击遮罩/关闭按钮关闭，无 role="dialog"、无 Esc、
     焦点不移入、背景可 Tab 穿透。 */
  useEffect(() => {
    if (!selectedTx) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTx(null);
    };
    document.addEventListener("keydown", onKeyDown);
    // 打开后把焦点移入模态（聚焦关闭按钮，避免焦点留在被遮挡的背景）
    const focusTarget = modalRef.current?.querySelector<HTMLElement>("[data-modal-close]");
    focusTarget?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedTx]);

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
          {/* [AUDIT FIX R2-066] 登录表单原为英文，与主体中文界面混杂。
              后台受众为运营团队，统一为中文。 */}
          <h1 className="mb-2 text-xl font-semibold text-[var(--fio-text)]">管理员登录</h1>
          <p className="mb-6 text-sm text-[var(--fio-text-2)]">使用管理员账号登录以继续。</p>
          <label htmlFor="admin-username" className="mb-1 block text-sm text-[var(--fio-text-2)]">
            用户名
          </label>
          <input
            id="admin-username"
            type="text"
            value={usernameInput}
            onChange={(e) => {
              setUsernameInput(e.target.value);
              setLoginError(null);
            }}
            placeholder="请输入用户名"
            aria-label="管理员用户名"
            autoComplete="username"
            className="mb-4 w-full rounded-lg border border-[var(--fio-border)] bg-[var(--fio-ink)] px-4 py-3 text-[var(--fio-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fio-gold)]"
          />
          <label htmlFor="admin-password" className="mb-1 block text-sm text-[var(--fio-text-2)]">
            密码
          </label>
          <input
            id="admin-password"
            type="password"
            value={pwdInput}
            onChange={(e) => {
              setPwdInput(e.target.value);
              setLoginError(null);
            }}
            placeholder="请输入密码"
            aria-label="管理员密码"
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
            {loginSubmitting ? "登录中..." : "登录"}
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
              <LiveIndicator isConnected={isConnected} wsConfigured={!!WS_URL} />
              {wsError && (
                <span className="text-xs text-red-400 ml-2">{wsError}</span>
              )}
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
                  {/* [AUDIT FIX 2026-09-17 R1-021] 无数据时 change 为空串，
                      此前残留孤立文案「 较昨日」；有数据时才渲染整行。 */}
                  {card.change && (
                    <p
                      className={`text-sm mt-1 ${
                        card.changeType === "positive" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {card.change} 较昨日
                    </p>
                  )}
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
                    /* [AUDIT FIX R2-016] 此前误用 MAX_EVENTS_DISPLAY(50)/MAX_EVENT_NAME_LENGTH(30)
                       当风险分阈值，与同页柱状图（RISK_SCORE_HIGH=70/MEDIUM=40）配色矛盾：
                       同一分数在两块区域一个判红一个判黄。统一用语义阈值常量。 */
                    point.score >= RISK_SCORE_HIGH ? "text-red-400" : point.score >= RISK_SCORE_MEDIUM ? "text-yellow-400" : "text-green-400"
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
                  暂无趋势数据
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

          {/* 风险类型分布 */}
          <div className="bg-[var(--fio-surface)] border border-[var(--fio-border)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-6">风险类型分布</h2>
            {/* ⚠ 原先这里是一份硬编码的百分比（35/28/15/22），永远是同一组数字。
                改为从真实事件列表派生；无事件时显示占位符。 */}
            {events.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--fio-text-2)]">
                暂无风险事件记录
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
                <p className="text-sm text-[var(--fio-text-2)] mb-2">当前系统风险评分</p>
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
              {/* [AUDIT FIX R2-058] "查看全部"此前是无 onClick/href 的死按钮（虚假可供性）。
                  事件列表页尚未实现，降级为不可交互的占位文本。 */}
              <span className="text-sm text-[var(--fio-text-3)]" aria-disabled="true">
                查看全部 →（即将上线）
              </span>
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
                              : event.risk === "低"
                              ? "low"
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
        {/* [AUDIT FIX R2-058] 此前 4 个 <button> 均无 onClick/href，可聚焦、有 hover 态，
            但点击零反馈——虚假可供性。对应后端功能尚未实现，改为非交互占位卡
            （div + aria-disabled + "即将上线"标记），不再用 button 语义误导用户。 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "生成报告", desc: "导出今日风险分析" },
            { title: "配置规则", desc: "更新风控策略" },
            { title: "地址查询", desc: "查询风险地址" },
            { title: "系统设置", desc: "管理通知与阈值" },
          ].map((action, index) => (
            <div
              key={index}
              aria-disabled="true"
              className="p-4 bg-[var(--fio-surface)] border border-[var(--fio-border)] rounded-xl text-left opacity-70"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">{action.title}</h3>
                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-[var(--fio-surface-2)] text-[var(--fio-text-3)]">
                  即将上线
                </span>
              </div>
              <p className="text-sm text-[var(--fio-text-2)] mt-1">{action.desc}</p>
            </div>
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
            /* [AUDIT FIX R2-059] 补 dialog 语义：role/aria-modal/aria-labelledby，
               此前纯 div 实现，读屏无法识别为模态对话框。 */
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-detail-title"
            className="bg-[var(--fio-surface)] border border-[var(--fio-border-light)] rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="tx-detail-title" className="text-lg font-medium text-white">交易详情</h3>
              <button
                data-modal-close
                onClick={() => setSelectedTx(null)}
                aria-label="关闭交易详情"
                className="text-[var(--fio-text-2)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] rounded"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                  {selectedTx.hash.slice(0, HASH_PREVIEW_LENGTH)}...{selectedTx.hash.slice(-HASH_TAIL_LENGTH)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">发送方</span>
                <span className="font-mono text-[var(--fio-text)]">
                  {selectedTx.from.slice(0, ADDRESS_PREVIEW_LENGTH)}...{selectedTx.from.slice(-ADDRESS_TAIL_LENGTH)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--fio-text-2)]">接收方</span>
                <span className="font-mono text-[var(--fio-text)]">
                  {selectedTx.to.slice(0, ADDRESS_PREVIEW_LENGTH)}...{selectedTx.to.slice(-ADDRESS_TAIL_LENGTH)}
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
