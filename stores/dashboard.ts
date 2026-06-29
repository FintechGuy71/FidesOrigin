/**
 * stores/dashboard.ts - 仪表盘状态 Store
 * 使用 immer 中间件处理不可变更新
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// 风险等级类型
export type RiskLevel = "low" | "medium" | "high" | "critical";

// 警报类型
export interface Alert {
  id: string;
  type: RiskLevel;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  source: string;
}

// 统计数据类型
export interface DashboardStats {
  totalTransactions: number;
  flaggedTransactions: number;
  riskScore: number;
  activeRules: number;
  lastUpdated: number;
}

// WebSocket 连接状态
export type WsStatus = "connected" | "connecting" | "disconnected" | "error";

// Store 状态
export interface DashboardState {
  stats: DashboardStats;
  alerts: Alert[];
  wsStatus: WsStatus;
  wsError: string | null;
  selectedTransaction: string | null;
}

// Store Actions
export interface DashboardActions {
  setStats: (stats: Partial<DashboardStats>) => void;
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  clearAlerts: () => void;
  setWsStatus: (status: WsStatus) => void;
  setWsError: (error: string | null) => void;
  setSelectedTransaction: (tx: string | null) => void;
}

// 初始状态
const initialStats: DashboardStats = {
  totalTransactions: 0,
  flaggedTransactions: 0,
  riskScore: 0,
  activeRules: 0,
  lastUpdated: Date.now(),
};

const initialState: DashboardState = {
  stats: initialStats,
  alerts: [],
  wsStatus: "disconnected",
  wsError: null,
  selectedTransaction: null,
};

// Selectors
export const selectStats = (state: DashboardState) => state.stats;
export const selectUnreadAlerts = (state: DashboardState) =>
  state.alerts.filter((a) => !a.read);
export const selectUnreadCount = (state: DashboardState) =>
  state.alerts.filter((a) => !a.read).length;
export const selectWsStatus = (state: DashboardState) => state.wsStatus;
export const selectWsError = (state: DashboardState) => state.wsError;

// Store 创建
export const useDashboardStore = create<DashboardState & DashboardActions>()(
  immer((set) => ({
    ...initialState,

    // Actions
    setStats: (stats) =>
      set((state) => {
        Object.assign(state.stats, stats);
        state.stats.lastUpdated = Date.now();
      }),

    addAlert: (alert) =>
      set((state) => {
        state.alerts.unshift(alert);
        // 限制最多 100 条警报
        if (state.alerts.length > 100) {
          state.alerts = state.alerts.slice(0, 100);
        }
      }),

    markAlertRead: (id) =>
      set((state) => {
        const alert = state.alerts.find((a) => a.id === id);
        if (alert) {
          alert.read = true;
        }
      }),

    clearAlerts: () =>
      set((state) => {
        state.alerts = [];
      }),

    setWsStatus: (status) =>
      set((state) => {
        state.wsStatus = status;
      }),

    setWsError: (error) =>
      set((state) => {
        state.wsError = error;
      }),

    setSelectedTransaction: (tx) =>
      set((state) => {
        state.selectedTransaction = tx;
      }),
  }))
);

export default useDashboardStore;
