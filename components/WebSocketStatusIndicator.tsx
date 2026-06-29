"use client";

import { useDashboardStore } from "@/stores/dashboard";

// 连接状态指示器组件
export function WebSocketStatusIndicator() {
  const wsStatus = useDashboardStore((state) => state.wsStatus);
  const wsError = useDashboardStore((state) => state.wsError);

  const statusConfig = {
    connected: {
      color: "bg-emerald-500",
      pulseColor: "bg-emerald-400",
      label: "已连接",
      textColor: "text-emerald-400",
    },
    connecting: {
      color: "bg-yellow-500",
      pulseColor: "bg-yellow-400",
      label: "连接中...",
      textColor: "text-yellow-400",
    },
    disconnected: {
      color: "bg-gray-500",
      pulseColor: "bg-gray-400",
      label: "未连接",
      textColor: "text-gray-400",
    },
    error: {
      color: "bg-red-500",
      pulseColor: "bg-red-400",
      label: "连接错误",
      textColor: "text-red-400",
    },
  };

  const config = statusConfig[wsStatus];

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {wsStatus === "connected" && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`} />
        )}
        {wsStatus === "connecting" && (
          <span className={`animate-pulse absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.color}`} />
      </span>
      <span className={`text-xs ${config.textColor}`}>
        {config.label}
      </span>
      {wsError && wsStatus === "error" && (
        <span className="text-xs text-red-400/70 ml-1" title={wsError}>
          (点击重试)
        </span>
      )}
    </div>
  );
}
