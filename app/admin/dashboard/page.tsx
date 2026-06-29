"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import RiskScore, { RiskBadge, RiskTrend } from "@/components/RiskScore";
import LiveTransactionStream, { Transaction } from "@/components/LiveTransactionStream";
import { FidesOriginClient, FidesOriginError } from "@fidesorigin/sdk";

// ─── SDK Client ──────────────────────────────────────────────────────────────

const sdkClient = new FidesOriginClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.fidesorigin.com",
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
});

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://api.fidesorigin.com/ws";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  todayBlocked: number;
  todayBlockedChange: number;
  riskAddresses: number;
  riskAddressesChange: number;
  complianceRate: number;
  complianceRateChange: number;
  monitoredTransactions: number;
  monitoredTransactionsChange: number;
}

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

// ─── Zustand Store ───────────────────────────────────────────────────────────

interface DashboardState {
  stats: DashboardStats;
  events: RiskEvent[];
  loading: boolean;
  useMockData: boolean;
  wsConnected: boolean;
  wsError: string | null;
  selectedTx: Transaction | null;
  // Actions
  setStats: (stats: DashboardStats) => void;
  addEvent: (event: RiskEvent) => void;
  setLoading: (loading: boolean) => void;
  setUseMockData: (useMock: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  setWsError: (error: string | null) => void;
  setSelectedTx: (tx: Transaction | null) => void;
  clearEvents: () => void;
}

const MAX_EVENTS = 100; // Memory limit: max events in queue
const MAX_STORED_EVENTS = 50; // Persisted events limit

const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      stats: getMockStats(),
      events: getMockEvents(),
      loading: true,
      useMockData: true,
      wsConnected: false,
      wsError: null,
      selectedTx: null,

      setStats: (stats) => set({ stats, useMockData: false }),

      addEvent: (event) =>
        set((state) => {
          const newEvent = { ...event, timestamp: Date.now() };
          const exists = state.events.some((e) => e.id === event.id);
          if (exists) return state;
          // Enforce memory limit
          const newEvents = [newEvent, ...state.events].slice(0, MAX_EVENTS);
          return { events: newEvents };
        }),

      setLoading: (loading) => set({ loading }),
      setUseMockData: (useMockData) => set({ useMockData }),
      setWsConnected: (wsConnected) => set({ wsConnected }),
      setWsError: (wsError) => set({ wsError }),
      setSelectedTx: (selectedTx) => set({ selectedTx }),

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: "fidesorigin-dashboard",
      partialize: (state) => ({
        // Only persist limited data to avoid localStorage bloat
        events: state.events.slice(0, MAX_STORED_EVENTS),
        useMockData: state.useMockData,
      }),
    }
  )
);

// ─── Refactored useWebSocket Hook ────────────────────────────────────────────

interface WebSocketMessage {
  type: string;
  stats?: DashboardStats;
  event?: RiskEvent;
  transaction?: Transaction;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  maxReconnectAttempts?: number;
  maxQueueSize?: number; // Memory limit for message queue
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  heartbeatInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  send: (message: unknown) => boolean;
  disconnect: () => void;
  reconnect: () => void;
}

function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    maxReconnectAttempts = 5,
    maxQueueSize = 200, // Memory limit: max queued messages
    reconnectBaseDelay = 1000,
    reconnectMaxDelay = 30000,
    heartbeatInterval = 30000,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageQueue = useRef<unknown[]>([]);
  const isManualDisconnect = useRef(false);

  // Exponential backoff with jitter
  const getBackoffDelay = useCallback(
    (attempt: number) => {
      const backoff = Math.min(reconnectBaseDelay * Math.pow(2, attempt), reconnectMaxDelay);
      const jitter = backoff * 0.25 * (Math.random() * 2 - 1);
      return Math.max(0, Math.floor(backoff + jitter));
    },
    [reconnectBaseDelay, reconnectMaxDelay]
  );

  const flushQueue = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    while (messageQueue.current.length > 0) {
      const msg = messageQueue.current.shift();
      try {
        ws.current.send(JSON.stringify(msg));
      } catch (e) {
        console.error("WebSocket send error:", e);
      }
    }
  }, []);

  const send = useCallback(
    (message: unknown): boolean => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        try {
          ws.current.send(JSON.stringify(message));
          return true;
        } catch (e) {
          console.error("WebSocket send failed:", e);
          return false;
        }
      }
      // Queue message if not connected (with memory limit)
      if (messageQueue.current.length < maxQueueSize) {
        messageQueue.current.push(message);
      } else {
        // Drop oldest message when queue is full
        messageQueue.current.shift();
        messageQueue.current.push(message);
      }
      return false;
    },
    [maxQueueSize]
  );

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
      ws.current.onopen = null;
      ws.current.onmessage = null;
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (isManualDisconnect.current) return;
    if (!url) {
      setError("WebSocket URL not configured");
      return;
    }

    try {
      cleanup();
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        onConnect?.();
        // Flush queued messages
        flushQueue();
        // Start heartbeat
        heartbeatTimer.current = setInterval(() => {
          send({ type: "ping" });
        }, heartbeatInterval);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          // Handle pong
          if (data.type === "pong") return;
          onMessage(data);
        } catch (e) {
          console.error("WebSocket message parse error:", e);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();
        // Auto-reconnect with exponential backoff
        if (!isManualDisconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = getBackoffDelay(reconnectAttempts.current);
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };

      ws.current.onerror = () => {
        const errMsg = "WebSocket connection error";
        setError(errMsg);
        setIsConnected(false);
        onError?.(errMsg);
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Failed to create WebSocket connection";
      setError(errMsg);
      onError?.(errMsg);
    }
  }, [
    url,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    maxReconnectAttempts,
    heartbeatInterval,
    getBackoffDelay,
    flushQueue,
    send,
    cleanup,
  ]);

  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;
    cleanup();
    setIsConnected(false);
  }, [cleanup]);

  const reconnect = useCallback(() => {
    isManualDisconnect.current = false;
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    isManualDisconnect.current = false;
    connect();
    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  return { isConnected, error, send, disconnect, reconnect };
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

function getMockStats(): DashboardStats {
  return {
    todayBlocked: 1247,
    todayBlockedChange: 12.5,
    riskAddresses: 3892,
    riskAddressesChange: 8.2,
    complianceRate: 98.7,
    complianceRateChange: 0.3,
    monitoredTransactions: 2400000,
    monitoredTransactionsChange: 23.1,
  };
}

function getMockEvents(): RiskEvent[] {
  return [
    {
      id: "EVT-001",
      type: "高风险交易",
      address: "0x7a2c...9b3d",
      amount: "150,000 USDC",
      risk: "极高",
      time: "2分钟前",
      status: "已拦截",
      timestamp: Date.now() - 120000,
    },
    {
      id: "EVT-002",
      type: "制裁名单匹配",
      address: "0x3f8e...2a1c",
      amount: "50,000 USDT",
      risk: "高",
      time: "5分钟前",
      status: "已拦截",
      timestamp: Date.now() - 300000,
    },
    {
      id: "EVT-003",
      type: "异常交易模式",
      address: "0x9d4b...7e2f",
      amount: "25,000 DAI",
      risk: "中",
      time: "12分钟前",
      status: "审核中",
      timestamp: Date.now() - 720000,
    },
    {
      id: "EVT-004",
      type: "闪电贷攻击",
      address: "0x1c5a...4b8e",
      amount: "500,000 USDC",
      risk: "极高",
      time: "18分钟前",
      status: "已拦截",
      timestamp: Date.now() - 1080000,
    },
    {
      id: "EVT-005",
      type: "混币器交互",
      address: "0x6e3d...1a9c",
      amount: "10,000 ETH",
      risk: "高",
      time: "25分钟前",
      status: "已标记",
      timestamp: Date.now() - 1500000,
    },
  ];
}

// ─── API Data Fetching ───────────────────────────────────────────────────────

async function fetchDashboardData(): Promise<{
  stats: DashboardStats;
  events: RiskEvent[];
}> {
  try {
    const stats = await sdkClient.getStats();
    // Also fetch rules to get event-like data, or use a dedicated endpoint
    return {
      stats: stats as unknown as DashboardStats,
      events: getMockEvents(), // Events come from WebSocket, initial data is mock
    };
  } catch (error) {
    if (error instanceof FidesOriginError) {
      console.warn(`SDK Error [${error.code}]:`, error.message);
    } else {
      console.warn("API 调用失败，使用模拟数据:", error);
    }
    return {
      stats: getMockStats(),
      events: getMockEvents(),
    };
  }
}

// ─── Icon Components ─────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
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
        />
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            isConnected ? "bg-emerald-500" : "bg-yellow-500"
          }`}
        />
      </span>
      <span
        className={`text-sm font-medium ${
          isConnected ? "text-emerald-400" : "text-yellow-400"
        }`}
      >
        {isConnected ? "实时监控中" : "连接中..."}
      </span>
    </div>
  );
}

// ─── Formatting Utilities ────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小时前`;
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const store = useDashboardStore();

  // Fetch initial data via SDK
  useEffect(() => {
    const loadData = async () => {
      store.setLoading(true);
      try {
        const data = await fetchDashboardData();
        store.setStats(data.stats);
        store.setUseMockData(false);
      } catch (error) {
        console.error("加载数据失败:", error);
      } finally {
        store.setLoading(false);
      }
    };

    loadData();

    // Periodic refresh every 30s
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [store]);

  // WebSocket handlers
  const handleWebSocketMessage = useCallback(
    (data: WebSocketMessage) => {
      if (data.type === "stats" && data.stats) {
        store.setStats(data.stats as DashboardStats);
      } else if (data.type === "event" && data.event) {
        store.addEvent(data.event as RiskEvent);
      }
    },
    [store]
  );

  const handleWsConnect = useCallback(() => {
    store.setWsConnected(true);
    store.setWsError(null);
  }, [store]);

  const handleWsDisconnect = useCallback(() => {
    store.setWsConnected(false);
  }, [store]);

  const handleWsError = useCallback(
    (error: string) => {
      store.setWsError(error);
    },
    [store]
  );

  // Use refactored useWebSocket hook with memory limits
  const { isConnected, error: wsError, send, reconnect } = useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
    onConnect: handleWsConnect,
    onDisconnect: handleWsDisconnect,
    onError: handleWsError,
    maxReconnectAttempts: 5,
    maxQueueSize: 200, // Memory limit: message queue
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 30000,
    heartbeatInterval: 30000,
  });

  // Subscribe to dashboard channel when connected
  useEffect(() => {
    if (isConnected) {
      send({ type: "subscribe", channel: "dashboard" });
    }
  }, [isConnected, send]);

  // Stat cards
  const statCards = [
    {
      title: "今日拦截",
      value: formatNumber(store.stats.todayBlocked),
      change: `+${store.stats.todayBlockedChange}%`,
      changeType: "positive" as const,
      icon: ShieldIcon,
    },
    {
      title: "风险地址",
      value: formatNumber(store.stats.riskAddresses),
      change: `+${store.stats.riskAddressesChange}%`,
      changeType: "negative" as const,
      icon: AlertIcon,
    },
    {
      title: "合规通过率",
      value: `${store.stats.complianceRate}%`,
      change: `+${store.stats.complianceRateChange}%`,
      changeType: "positive" as const,
      icon: CheckIcon,
    },
    {
      title: "监控交易",
      value: formatNumber(store.stats.monitoredTransactions),
      change: `+${store.stats.monitoredTransactionsChange}%`,
      changeType: "positive" as const,
      icon: ChartIcon,
    },
  ];

  const riskTrendData = [
    { time: "00:00", score: 12 },
    { time: "04:00", score: 8 },
    { time: "08:00", score: 25 },
    { time: "12:00", score: 45 },
    { time: "16:00", score: 38 },
    { time: "20:00", score: 55 },
    { time: "现在", score: 42 },
  ];

  const handleTransactionClick = (tx: Transaction) => {
    store.setSelectedTx(tx);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">运营仪表盘</h1>
              <p className="text-gray-400 mt-1">FidesOrigin 实时风险监控与合规数据概览</p>
            </div>
            <div className="flex items-center gap-4">
              {store.useMockData && (
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                  模拟数据
                </span>
              )}
              <LiveIndicator isConnected={isConnected} />
              {wsError && (
                <button
                  onClick={reconnect}
                  className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  重连
                </button>
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
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{card.title}</p>
                  <p className="text-2xl sm:text-3xl font-semibold text-white mt-2">
                    {store.loading ? "-" : card.value}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      card.changeType === "positive" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {card.change} 较昨日
                  </p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg text-gray-400">
                  <card.icon />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Risk Trend Chart */}
          <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">风险趋势监控</h2>
              <div className="flex gap-2">
                <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">24H</span>
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                  实时
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {riskTrendData.map((point, i) => (
                <div key={i} className="text-center p-3 rounded-lg bg-gray-800/30">
                  <div
                    className={`text-xl font-semibold ${
                      point.score >= 50
                        ? "text-red-400"
                        : point.score >= 30
                        ? "text-yellow-400"
                        : "text-green-400"
                    }`}
                  >
                    {point.score}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{point.time}</div>
                </div>
              ))}
            </div>

            <div className="h-48 flex items-end justify-between gap-2">
              {riskTrendData.map((point, i) => {
                const height = `${Math.max(10, point.score)}%`;
                const color =
                  point.score >= 50 ? "bg-red-500" : point.score >= 30 ? "bg-yellow-500" : "bg-green-500";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gray-800 rounded-t-lg relative h-32">
                      <div
                        className={`absolute bottom-0 left-0 right-0 ${color} rounded-t-lg transition-all duration-500`}
                        style={{ height }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{point.time}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Type Distribution */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-6">风险类型分布</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: "洗钱风险", value: 35, color: "bg-red-500", textColor: "text-red-400" },
                { name: "欺诈交易", value: 28, color: "bg-orange-500", textColor: "text-orange-400" },
                { name: "制裁名单", value: 15, color: "bg-yellow-500", textColor: "text-yellow-400" },
                { name: "其他", value: 22, color: "bg-blue-500", textColor: "text-blue-400" },
              ].map((item) => (
                <div key={item.name} className="text-center p-4 bg-gray-800/30 rounded-lg">
                  <div className={`text-2xl font-bold ${item.textColor}`}>{item.value}%</div>
                  <div className="text-sm text-gray-400 mt-1">{item.name}</div>
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Overall risk score */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">当前系统风险评分</p>
                <RiskScore score={42} level="medium" size="md" />
              </div>
            </div>
          </div>
        </div>

        {/* Live Transaction Stream */}
        <LiveTransactionStream
          maxItems={30}
          autoScroll={true}
          showHeader={true}
          onTransactionClick={handleTransactionClick}
          wsUrl={WS_URL}
          useMockData={store.useMockData}
          className="mb-8"
        />

        {/* Recent Events Table */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">最近风险事件</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{store.events.length} 条</span>
                <button
                  onClick={() => store.clearEvents()}
                  className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                >
                  清空
                </button>
                <button className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                  查看全部 →
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">
                    事件ID
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">
                    类型
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">
                    地址
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">
                    金额
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">
                    风险等级
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">
                    时间
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {store.loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : store.events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      暂无风险事件
                    </td>
                  </tr>
                ) : (
                  store.events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {event.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {event.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {event.timestamp ? formatTimeAgo(event.timestamp) : event.time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            event.status === "已拦截"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : event.status === "审核中"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-gray-400"
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
              className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl text-left hover:border-gray-600 hover:bg-gray-800/50 transition-all group"
            >
              <h3 className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-gray-400 mt-1">{action.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {store.selectedTx && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => store.setSelectedTx(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">交易详情</h3>
              <button onClick={() => store.setSelectedTx(null)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">交易哈希</span>
                <span className="font-mono text-indigo-400">
                  {store.selectedTx.hash.slice(0, 20)}...{store.selectedTx.hash.slice(-8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">发送方</span>
                <span className="font-mono text-gray-300">
                  {store.selectedTx.from.slice(0, 12)}...{store.selectedTx.from.slice(-6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">接收方</span>
                <span className="font-mono text-gray-300">
                  {store.selectedTx.to.slice(0, 12)}...{store.selectedTx.to.slice(-6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">金额</span>
                <span className="text-white font-medium">
                  {store.selectedTx.amount} {store.selectedTx.token}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">风险评分</span>
                <RiskBadge level={store.selectedTx.riskLevel} text={`${store.selectedTx.riskScore}分`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">状态</span>
                <span
                  className={`${
                    store.selectedTx.status === "confirmed"
                      ? "text-green-400"
                      : store.selectedTx.status === "flagged"
                      ? "text-orange-400"
                      : store.selectedTx.status === "failed"
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}
                >
                  {store.selectedTx.status === "confirmed" && "已确认"}
                  {store.selectedTx.status === "flagged" && "已标记"}
                  {store.selectedTx.status === "failed" && "失败"}
                  {store.selectedTx.status === "pending" && "待确认"}
                </span>
              </div>
              {store.selectedTx.tags && store.selectedTx.tags.length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                  <span className="text-gray-400 text-sm">风险标签:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {store.selectedTx.tags.map((tag) => (
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
