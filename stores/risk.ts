/**
 * stores/risk.ts - 风险查询状态 Store
 * 使用 immer 中间件处理不可变更新
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskTag {
  label: string;
  type: "danger" | "warning" | "info" | "success";
}

export interface RiskDetail {
  category: string;
  description: string;
  severity: RiskLevel;
}

export interface RiskTransaction {
  hash: string;
  type: string;
  amount: string;
  risk: RiskLevel;
  time: string;
}

export interface RiskReport {
  score: number;
  level: RiskLevel;
  tags: RiskTag[];
  details: RiskDetail[];
  transactions: RiskTransaction[];
  dataSource: "api" | "subgraph" | "demo";
  fetchedAt: string;
  address: string;
}

export interface RiskState {
  riskData: RiskReport | null;
  loading: boolean;
  error: string | null;
  currentAddress: string | null;
  history: string[];
}

export interface RiskActions {
  setRiskData: (data: RiskReport | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentAddress: (address: string | null) => void;
  addToHistory: (address: string) => void;
  clearHistory: () => void;
  clear: () => void;
}

const initialState: RiskState = {
  riskData: null,
  loading: false,
  error: null,
  currentAddress: null,
  history: [],
};

export const selectRiskData = (state: RiskState) => state.riskData;
export const selectRiskLevel = (state: RiskState) => state.riskData?.level ?? null;
export const selectRiskScore = (state: RiskState) => state.riskData?.score ?? 0;
export const selectIsLoading = (state: RiskState) => state.loading;
export const selectError = (state: RiskState) => state.error;
export const selectHistory = (state: RiskState) => state.history;

export const useRiskStore = create<RiskState & RiskActions>()(
  immer((set) => ({
    ...initialState,

    setRiskData: (data) =>
      set((state) => {
        state.riskData = data;
        if (data) {
          state.error = null;
        }
      }),

    setLoading: (loading) =>
      set((state) => {
        state.loading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        if (error) {
          state.loading = false;
        }
      }),

    setCurrentAddress: (address) =>
      set((state) => {
        state.currentAddress = address;
      }),

    addToHistory: (address) =>
      set((state) => {
        if (!state.history.includes(address)) {
          state.history.unshift(address);
          if (state.history.length > 20) {
            state.history = state.history.slice(0, 20);
          }
        }
      }),

    clearHistory: () =>
      set((state) => {
        state.history = [];
      }),

    clear: () =>
      set((state) => {
        state.riskData = null;
        state.loading = false;
        state.error = null;
        state.currentAddress = null;
      }),
  }))
);

export default useRiskStore;
