"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import {
  MOCK_ADDRESSES,
  MOCK_RISK_LEVELS,
  MOCK_TRANSACTION_STATUSES,
  MOCK_TOKENS,
  MOCK_CHAINS,
  MOCK_RISK_TAGS,
} from "@/lib/demo-config";

/** Formats a blockchain address for display (e.g., 0x1234...5678) */
function formatAddress(address: string, chars: number = 4): string {
  if (!address || address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export type TransactionStatus = "pending" | "confirmed" | "failed" | "flagged";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  token?: string;
  chain: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: TransactionStatus;
  timestamp: number;
  tags?: string[];
}

interface LiveTransactionStreamProps {
  maxItems?: number;
  autoScroll?: boolean;
  showHeader?: boolean;
  onTransactionClick?: (tx: Transaction) => void;
  wsUrl?: string;
  useMockData?: boolean;
  className?: string;
}

/** WebSocket message payload */
interface WebSocketMessage {
  type: string;
  transaction?: Transaction;
}

// WebSocket 连接钩子
function useWebSocket(url: string | undefined, onMessage: (data: WebSocketMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {
          console.error("WebSocket message parse error:");
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        // 自动重连
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };

      ws.current.onerror = (_event) => {
        setError("WebSocket connection error");
        setIsConnected(false);
      };
    } catch {
      setError("Failed to create WebSocket connection");
    }
  }, [url, onMessage]);

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

// 生成模拟交易数据
function generateMockTransaction(): Transaction {
  const addresses = MOCK_ADDRESSES as unknown as string[];
  const riskLevels = MOCK_RISK_LEVELS as unknown as RiskLevel[];
  const statuses = MOCK_TRANSACTION_STATUSES as unknown as TransactionStatus[];
  const tokens = MOCK_TOKENS as unknown as string[];
  const chains = MOCK_CHAINS as unknown as string[];
  const tags = MOCK_RISK_TAGS as unknown as string[][];

  const from = addresses[Math.floor(Math.random() * addresses.length)];
  let to = addresses[Math.floor(Math.random() * addresses.length)];
  while (to === from) {
    to = addresses[Math.floor(Math.random() * addresses.length)];
  }

  const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];
  const riskScore = {
    low: Math.floor(Math.random() * 40),
    medium: 40 + Math.floor(Math.random() * 20),
    high: 60 + Math.floor(Math.random() * 20),
    critical: 80 + Math.floor(Math.random() * 20),
  }[riskLevel];

  return {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    /* 与 id 一致用 slice —— String.prototype.substr 已废弃（Annex B） */
    hash: `0x${Math.random().toString(16).slice(2, 66)}`,
    from,
    to,
    amount: `${(Math.random() * 100).toFixed(4)}`,
    token: tokens[Math.floor(Math.random() * tokens.length)],
    chain: chains[Math.floor(Math.random() * chains.length)],
    riskScore,
    riskLevel,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    timestamp: Date.now(),
    tags: tags[Math.floor(Math.random() * tags.length)],
  };
}

// 格式化时间
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// 风险等级样式
/* 走设计系统的语义色令牌：Tailwind 默认 green/yellow/orange/red 与
   --fio-success/warn/danger 不同源，且这些色值对品牌深底对比度不达标。 */
const riskStyles = {
  low: "bg-[var(--fio-success-dim)] text-[var(--fio-success)] border-[var(--fio-success-dim)]",
  medium: "bg-[var(--fio-warn-dim)] text-[var(--fio-warn)] border-[var(--fio-warn-dim)]",
  high: "bg-[var(--fio-warn-dim)] text-[var(--fio-warn)] border-[var(--fio-warn-dim)]",
  critical: "bg-[var(--fio-danger-dim)] text-[var(--fio-danger)] border-[var(--fio-danger-dim)] animate-pulse",
};

// 状态样式
const statusStyles = {
  pending: "text-[var(--fio-warn)]",
  confirmed: "text-[var(--fio-success)]",
  failed: "text-[var(--fio-danger)]",
  flagged: "text-[var(--fio-warn)] animate-pulse",
};

// 链图标
const ChainIcon = ({ chain }: { chain: string }) => {
  const icons: Record<string, React.ReactElement> = {
    ethereum: (
      <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4.5 12.5L12 16.5L19.5 12.5L12 2Z" />
        <path d="M4.5 13.5L12 22L19.5 13.5L12 17.5L4.5 13.5Z" />
      </svg>
    ),
    bsc: (
      <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L6 6v4l6-4 6 4V6l-6-4zM6 10v4l6 4 6-4v-4l-6 4-6-4zM6 16v4l6 4 6-4v-4l-6 4-6-4z" />
      </svg>
    ),
    polygon: (
      <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4 6.5v11L12 22l8-4.5v-11L12 2zm0 2.5l5.5 3-5.5 3-5.5-3 5.5-3zM6 8.5l5 2.9v6.1l-5-2.9V8.5zm12 0v6.1l-5 2.9v-6.1l5-2.9z" />
      </svg>
    ),
    arbitrum: (
      <svg className="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.5l5.5 3-5.5 3-5.5-3 5.5-3zM6 9l5 2.5v6L6 15V9zm12 0v6l-5 2.5v-6L18 9z" />
      </svg>
    ),
  };

  return icons[chain] || icons.ethereum;
};

export default function LiveTransactionStream({
  maxItems = 50,
  autoScroll = true,
  showHeader = true,
  onTransactionClick,
  wsUrl,
  useMockData = true,
  className = "",
}: LiveTransactionStreamProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(true);

  // WebSocket 接收消息
  const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
    if (data.type === "transaction" && data.transaction) {
      const newTx = data.transaction;
      setTransactions((prev) => {
        const exists = prev.some((tx) => tx.id === newTx.id);
        if (exists) return prev;
        return [newTx, ...prev].slice(0, maxItems);
      });
    }
  }, [maxItems]);

  const { isConnected } = useWebSocket(
    useMockData ? undefined : wsUrl,
    handleWebSocketMessage
  );

  /* 暂停状态同步到 ref：数据流 effect 读 ref 而不是 state，
     这样 isPaused 不进入依赖数组，定时器不会因暂停/继续而反复重建。 */
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  /* 初始种子数据 —— 必须独立成只跑一次的 effect。
     原实现把种子逻辑放在数据流 effect 里，而该 effect 的依赖含 isPaused：
     每次点「暂停/继续」都会重新执行 setTransactions(Array.from({length:5})),
     把已累积的 50 条记录整批覆盖掉，并重建定时器。 */
  useEffect(() => {
    if (!useMockData) return;
    setTransactions(Array.from({ length: 5 }, generateMockTransaction));
  }, [useMockData]);

  // 模拟数据流
  useEffect(() => {
    if (!useMockData) return;

    /* 用递归 setTimeout 而不是 setInterval：
       setInterval 的 `2000 + Math.random()*3000` 只在创建时算一次，
       之后是固定周期，与注释声称的「2-5 秒随机」不符。 */
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!isPausedRef.current) {
          const newTx = generateMockTransaction();
          setTransactions((prev) => [newTx, ...prev].slice(0, maxItems));
        }
        schedule();
      }, 2000 + Math.random() * 3000);
    };
    schedule();

    return () => clearTimeout(timer);
  }, [useMockData, maxItems]);

  // 自动滚动
  useEffect(() => {
    if (autoScroll && shouldScroll.current && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [transactions, autoScroll]);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop } = containerRef.current;
    shouldScroll.current = scrollTop < 50;
  }, []);

  return (
    <div className={`rounded-xl border border-[var(--fio-border)] bg-[var(--fio-surface)] overflow-hidden ${className}`}>
      {/* 头部 */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fio-border)]">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-[var(--fio-text)]">Live Transaction Stream</h3>
            <div className="flex items-center gap-2">
              {useMockData ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--fio-warn-dim)] text-[var(--fio-warn)]">
                  Mock Data
                </span>
              ) : isConnected ? (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--fio-success)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--fio-success)]"></span>
                  </span>
                  <span className="text-xs text-[var(--fio-success)]">Live</span>
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--fio-danger-dim)] text-[var(--fio-danger)]">
                  Connecting...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--fio-text-2)]">{transactions.length} txs</span>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`p-1.5 rounded transition-colors ${
                isPaused
                  ? "bg-[var(--fio-warn-dim)] text-[var(--fio-warn)]"
                  : "bg-[var(--fio-surface-2)] text-[var(--fio-text)] hover:bg-[var(--fio-surface-3)]"
              }`}
              title={isPaused ? "Resume" : "Pause"}
              aria-label={isPaused ? "Resume stream" : "Pause stream"}
              aria-pressed={isPaused}
            >
              {isPaused ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 交易列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[400px] overflow-y-auto"
      >
        <div className="divide-y divide-[var(--fio-border)]">
          {transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[var(--fio-text-2)]">
              <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>No transactions yet</p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              /* 原为 div + onClick：不可聚焦、无 role、无键盘事件、无焦点样式，
                 键盘与读屏用户完全无法触发。改为 button 并补焦点环。 */
              <button
                key={tx.id}
                type="button"
                onClick={() => onTransactionClick?.(tx)}
                className={`
                  w-full px-4 py-3 text-left transition-all hover:bg-[var(--fio-surface-2)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fio-gold)]
                  ${index === 0 && !isPaused ? "animate-slide-in" : ""}
                `}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ChainIcon chain={tx.chain} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        {/* 原 text-indigo-400 依赖已删除的 tailwind.config.js 的
                            indigo 色板，在 v4 下落回默认蓝紫。改用品牌强调色。 */}
                        <span className="truncate font-mono text-[var(--fio-accent)]">
                          {formatAddress(tx.hash, 8)}
                        </span>
                        {tx.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 rounded bg-[var(--fio-danger-dim)] text-[var(--fio-danger)] whitespace-nowrap"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--fio-text-2)]">
                        <span>From</span>
                        <span className="font-mono text-[var(--fio-text)]">{formatAddress(tx.from, 4)}</span>
                        <span>To</span>
                        <span className="font-mono text-[var(--fio-text)]">{formatAddress(tx.to, 4)}</span>
                      </div>
                    </div>
                  </div>

                  {/* shrink-0：左列已有 min-w-0 + truncate，但右列既无 shrink-0
                      也无 min-w-0，内含 whitespace-nowrap 的标签，窄屏多标签
                      叠加时会把整行撑宽触发横向滚动。 */}
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <div className="hidden sm:block">
                      <div className="text-sm font-medium text-[var(--fio-text)]">
                        {tx.amount} {tx.token}
                      </div>
                      <div className={`text-xs ${statusStyles[tx.status]}`}>
                        {tx.status === "pending" && "Pending"}
                        {tx.status === "confirmed" && "Confirmed"}
                        {tx.status === "failed" && "Failed"}
                        {tx.status === "flagged" && "Flagged"}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${riskStyles[tx.riskLevel]}`}
                      >
                        {tx.riskScore}
                      </span>
                      <span className="text-xs text-[var(--fio-text-2)]">{formatTimeAgo(tx.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 底部信息 */}
      <div className="border-t border-[var(--fio-border)] bg-[var(--fio-surface-2)] px-4 py-2">
        <div className="flex items-center justify-between text-xs text-[var(--fio-text-2)]">
          <span>
            Live monitoring · {isConnected ? "Connected" : useMockData ? "Mock mode" : "Disconnected"}
          </span>
          <span>
            High risk: {transactions.filter((t) => t.riskLevel === "high" || t.riskLevel === "critical").length}
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// 导出工具函数
export { formatTimeAgo, generateMockTransaction };
