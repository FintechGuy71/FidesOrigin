/**
 * hooks/useWebSocket.ts - WebSocket 连接 Hook
 * 带自动重连、心跳检测、使用 Zustand 存储连接状态
 * connect 使用 useCallback + 依赖优化
 */
import { useCallback, useEffect, useRef } from "react";
import { useDashboardStore } from "@/stores/dashboard";
import { getWsUrl } from "@/lib/env";

// WebSocket 配置
interface WebSocketConfig {
  url?: string;
  reconnectMaxAttempts?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

// 心跳消息类型
const HEARTBEAT_PING = JSON.stringify({ type: "ping", timestamp: Date.now() });
const HEARTBEAT_PONG = "pong";

export function useWebSocket(config: WebSocketConfig = {}) {
  const {
    url: configUrl,
    reconnectMaxAttempts = 5,
    reconnectBaseDelay = 1000,
    reconnectMaxDelay = 30000,
    heartbeatInterval = 30000,
    heartbeatTimeout = 10000,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = config;

  // 使用 Zustand store 管理连接状态
  const setWsStatus = useDashboardStore((state) => state.setWsStatus);
  const setWsError = useDashboardStore((state) => state.setWsError);
  const addAlert = useDashboardStore((state) => state.addAlert);

  // refs for mutable state that doesn't trigger re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualCloseRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  // 保持回调引用最新
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onMessage, onConnect, onDisconnect, onError]);

  // 清除心跳定时器
  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // 清除重连定时器
  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // 启动心跳检测
  const startHeartbeat = useCallback(() => {
    clearHeartbeat();

    heartbeatTimerRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(HEARTBEAT_PING);

        // 设置心跳超时
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn("[WebSocket] 心跳超时，连接可能已断开");
          ws.close();
        }, heartbeatTimeout);
      }
    }, heartbeatInterval);
  }, [clearHeartbeat, heartbeatInterval, heartbeatTimeout]);

  // 计算重连延迟（指数退避 + 抖动）
  const calculateReconnectDelay = useCallback((attempt: number): number => {
    const delay = Math.min(
      reconnectBaseDelay * Math.pow(2, attempt),
      reconnectMaxDelay
    );
    // 添加随机抖动 (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }, [reconnectBaseDelay, reconnectMaxDelay]);

  // 连接 WebSocket - 使用 useCallback + 依赖优化
  const connect = useCallback(() => {
    const url = configUrl || getWsUrl();
    if (!url) {
      console.warn("[WebSocket] URL 未配置，跳过连接");
      setWsStatus("disconnected");
      return;
    }

    // [Fix] Prevent duplicate connection attempts
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // 清除之前的重连定时器
    clearReconnect();

    try {
      setWsStatus("connecting");
      isManualCloseRef.current = false;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] 连接已建立");
        reconnectAttemptsRef.current = 0;
        setWsStatus("connected");
        setWsError(null);
        startHeartbeat();
        onConnectRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = event.data;

          // 处理心跳响应
          if (data === HEARTBEAT_PONG || data === '"pong"') {
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
              heartbeatTimeoutRef.current = null;
            }
            return;
          }

          const parsed = JSON.parse(data);
          onMessageRef.current?.(parsed);
        } catch (e) {
          console.warn("[WebSocket] 消息解析失败:", e);
          onMessageRef.current?.(event.data);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] 连接关闭 (code: ${event.code}, reason: ${event.reason})`);
        clearHeartbeat();
        setWsStatus("disconnected");
        onDisconnectRef.current?.();

        // 如果不是手动关闭，尝试自动重连
        if (!isManualCloseRef.current && reconnectAttemptsRef.current < reconnectMaxAttempts) {
          const delay = calculateReconnectDelay(reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;

          console.warn(
            `[WebSocket] ${delay}ms 后尝试重连 (${reconnectAttemptsRef.current}/${reconnectMaxAttempts})...`
          );

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= reconnectMaxAttempts) {
          const errorMsg = `WebSocket 重连失败，已达最大尝试次数 (${reconnectMaxAttempts})`;
          console.error(`[WebSocket] ${errorMsg}`);
          setWsError(errorMsg);
          addAlert({
            id: `ws_error_${Date.now()}`,
            type: "high",
            title: "WebSocket 连接失败",
            description: errorMsg,
            timestamp: Date.now(),
            read: false,
            source: "websocket",
          });
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] 连接错误:", error);
        const err = new Error("WebSocket connection error");
        setWsError(err.message);
        onErrorRef.current?.(err);
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to create WebSocket");
      console.error("[WebSocket] 创建连接失败:", err);
      setWsError(err.message);
      setWsStatus("error");
      onErrorRef.current?.(err);
    }
  }, [
    configUrl,
    reconnectMaxAttempts,
    setWsStatus,
    setWsError,
    addAlert,
    clearReconnect,
    clearHeartbeat,
    startHeartbeat,
    calculateReconnectDelay,
  ]);

  // 断开连接
  const disconnect = useCallback(() => {
    isManualCloseRef.current = true;
    clearReconnect();
    clearHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
    setWsStatus("disconnected");
    setWsError(null);
  }, [clearReconnect, clearHeartbeat, setWsStatus, setWsError]);

  // 发送消息
  const send = useCallback((data: unknown): boolean => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(typeof data === "string" ? data : JSON.stringify(data));
        return true;
      } catch (e) {
        console.error("[WebSocket] 发送消息失败:", e);
        return false;
      }
    }
    console.warn("[WebSocket] 连接未建立，无法发送消息");
    return false;
  }, []);

  // 重连
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    // 小延迟后重新连接
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  // 组件挂载时自动连接，卸载时断开
  // [Fix] Add connect to dependency array so config changes trigger reconnection
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect]);

  return {
    connect,
    disconnect,
    reconnect,
    send,
  };
}

export default useWebSocket;
