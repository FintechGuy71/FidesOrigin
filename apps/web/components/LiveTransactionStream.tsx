"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatAddress } from "./AddressInput";

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

// WebSocket 连接钩子
function useWebSocket(url: string | undefined, onMessage: (data: any) => void) {
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
        } catch (e) {
          console.error("WebSocket message parse error:", e);
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

      ws.current.onerror = (e) => {
        setError("WebSocket connection error");
        setIsConnected(false);
      };
    } catch (e) {
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
  const addresses = [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEe",
    "0x8ba1f109551bD432803012645Hac136c82C3e8C",
    "0x1f9090aaE28b8a3dCeaDf281B0F12828E676c326",
    "0x1234567890123456789012345678901234567890",
    "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
  ];

  const riskLevels: RiskLevel[] = ["low", "medium", "high", "critical"];
  const statuses: TransactionStatus[] = ["pending", "confirmed", "flagged"];
  const tokens = ["ETH", "USDC", "USDT", "DAI", "WBTC"];
  const chains = ["ethereum", "bsc", "polygon", "arbitrum"];
  const tags = [["混币器关联"], ["暗网交易"], ["闪电贷"], ["新地址"], []];

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
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
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
  if (seconds < 5) return "刚刚";
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小时前`;
}

// 风险等级样式
const riskStyles = {
  low: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse",
};

// 状态样式
const statusStyles = {
  pending: "text-yellow-400",
  confirmed: "text-green-400",
  failed: "text-red-400",
  flagged: "text-orange-400 animate-pulse",
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
  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === "transaction" && data.transaction) {
      setTransactions((prev) => {
        const newTx = data.transaction;
        const exists = prev.some((tx) => tx.id === newTx.id);
        if (exists) return prev;
        return [newTx, ...prev].slice(0, maxItems);
      });
    }
  }, [maxItems]);

  const { isConnected, error } = useWebSocket(
    useMockData ? undefined : wsUrl,
    handleWebSocketMessage
  );

  // 模拟数据流
  useEffect(() => {
    if (!useMockData) return;

    const interval = setInterval(() => {
      if (!isPaused) {
        const newTx = generateMockTransaction();
        setTransactions((prev) => [newTx, ...prev].slice(0, maxItems));
      }
    }, 2000 + Math.random() * 3000); // 2-5 秒随机间隔

    // 初始数据
    setTransactions(Array.from({ length: 5 }, generateMockTransaction));

    return () => clearInterval(interval);
  }, [useMockData, isPaused, maxItems]);

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
    <div className={`rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden ${className}`}>
      {/* 头部 */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-white">实时交易流</h3>
            <div className="flex items-center gap-2">
              {useMockData ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                  模拟数据
                </span>
              ) : isConnected ? (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs text-emerald-400">实时</span>
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  连接中...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{transactions.length} 笔交易</span>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`p-1.5 rounded transition-colors ${
                isPaused
                  ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              title={isPaused ? "继续" : "暂停"}
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
        className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        <div className="divide-y divide-gray-800/50">
          {transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>暂无交易数据</p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              <div
                key={tx.id}
                onClick={() => onTransactionClick?.(tx)}
                className={`
                  px-4 py-3 hover:bg-gray-800/30 transition-all cursor-pointer
                  ${index === 0 && !isPaused ? "animate-slide-in" : ""}
                `}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ChainIcon chain={tx.chain} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-indigo-400 truncate">
                          {formatAddress(tx.hash, 8)}
                        </span>
                        {tx.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 whitespace-nowrap"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>从</span>
                        <span className="font-mono text-gray-400">{formatAddress(tx.from, 4)}</span>
                        <span>到</span>
                        <span className="font-mono text-gray-400">{formatAddress(tx.to, 4)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div className="hidden sm:block">
                      <div className="text-sm font-medium text-white">
                        {tx.amount} {tx.token}
                      </div>
                      <div className={`text-xs ${statusStyles[tx.status]}`}>
                        {tx.status === "pending" && "待确认"}
                        {tx.status === "confirmed" && "已确认"}
                        {tx.status === "failed" && "失败"}
                        {tx.status === "flagged" && "已标记"}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${riskStyles[tx.riskLevel]}`}
                      >
                        {tx.riskScore}
                      </span>
                      <span className="text-xs text-gray-500">{formatTimeAgo(tx.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部信息 */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/30">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            实时监控 {isConnected ? "已连接" : useMockData ? "模拟模式" : "未连接"}
          </span>
          <span>
            高风险: {transactions.filter((t) => t.riskLevel === "high" || t.riskLevel === "critical").length}
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
