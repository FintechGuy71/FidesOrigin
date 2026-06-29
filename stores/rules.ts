/**
 * stores/rules.ts - 规则管理状态 Store
 * 使用 immer 中间件处理不可变更新
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type RuleAction = "flag" | "block" | "notify" | "log";

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: number;
  action: RuleAction;
  conditions: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SaveStatus {
  type: "success" | "error" | "loading";
  message: string;
}

export interface RulesState {
  rules: Rule[];
  editingRule: Rule | null;
  saveStatus: SaveStatus | null;
}

export interface RulesActions {
  setRules: (rules: Rule[]) => void;
  addRule: (rule: Rule) => void;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  setEditingRule: (rule: Rule | null) => void;
  updateRuleThreshold: (id: string, threshold: number) => void;
  updateRuleAction: (id: string, action: RuleAction) => void;
  setSaveStatus: (status: SaveStatus | null) => void;
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
  resetToDefaults: () => void;
}

// 默认规则
const defaultRules: Rule[] = [
  {
    id: "rule-1",
    name: "高风险地址拦截",
    description: "当地址风险评分超过 80 分时自动拦截",
    enabled: true,
    threshold: 80,
    action: "block",
    conditions: ["risk_score > 80"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "rule-2",
    name: "混币器检测",
    description: "检测到混币器关联时标记并通知",
    enabled: true,
    threshold: 60,
    action: "flag",
    conditions: ["mixer_detected = true"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "rule-3",
    name: "大额交易监控",
    description: "超过 100 ETH 的交易触发日志记录",
    enabled: false,
    threshold: 100,
    action: "log",
    conditions: ["amount > 100 ETH"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const initialState: RulesState = {
  rules: [...defaultRules],
  editingRule: null,
  saveStatus: null,
};

const STORAGE_KEY = "fidesorigin_rules_draft";

export const selectRules = (state: RulesState) => state.rules;
export const selectEnabledRules = (state: RulesState) =>
  state.rules.filter((r) => r.enabled);
export const selectRuleById = (state: RulesState, id: string) =>
  state.rules.find((r) => r.id === id);
export const selectEditingRule = (state: RulesState) => state.editingRule;
export const selectSaveStatus = (state: RulesState) => state.saveStatus;

export const useRulesStore = create<RulesState & RulesActions>()(
  immer((set) => ({
    ...initialState,

    setRules: (rules) =>
      set((state) => {
        state.rules = rules;
      }),

    addRule: (rule) =>
      set((state) => {
        state.rules.push(rule);
      }),

    updateRule: (id, updates) =>
      set((state) => {
        const rule = state.rules.find((r) => r.id === id);
        if (rule) {
          Object.assign(rule, updates, { updatedAt: Date.now() });
        }
      }),

    deleteRule: (id) =>
      set((state) => {
        state.rules = state.rules.filter((r) => r.id !== id);
      }),

    toggleRule: (id) =>
      set((state) => {
        const rule = state.rules.find((r) => r.id === id);
        if (rule) {
          rule.enabled = !rule.enabled;
          rule.updatedAt = Date.now();
        }
      }),

    setEditingRule: (rule) =>
      set((state) => {
        state.editingRule = rule;
      }),

    updateRuleThreshold: (id, threshold) =>
      set((state) => {
        const rule = state.rules.find((r) => r.id === id);
        if (rule) {
          rule.threshold = threshold;
          rule.updatedAt = Date.now();
        }
      }),

    updateRuleAction: (id, action) =>
      set((state) => {
        const rule = state.rules.find((r) => r.id === id);
        if (rule) {
          rule.action = action;
          rule.updatedAt = Date.now();
        }
      }),

    setSaveStatus: (status) =>
      set((state) => {
        state.saveStatus = status;
      }),

    loadFromLocalStorage: () =>
      set((state) => {
        // [High Fix] SSR-safe: only access localStorage in browser environment
        if (typeof window === 'undefined' || !window.localStorage) {
          state.saveStatus = {
            type: "error",
            message: "localStorage not available (SSR environment)",
          };
          return;
        }
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              // [High Fix] Validate each rule has required fields and valid types
              const validActions = ["flag", "block", "notify", "log"];
              const validRules = parsed.filter(
                (r: any) =>
                  r &&
                  typeof r.id === "string" &&
                  typeof r.name === "string" &&
                  typeof r.enabled === "boolean" &&
                  typeof r.threshold === "number" &&
                  validActions.includes(r.action)
              );
              if (validRules.length > 0) {
                state.rules = validRules;
              }
              state.saveStatus = {
                type: "success",
                message: "已从本地存储加载规则配置",
              };
            }
          }
        } catch (e) {
          console.error("[RulesStore] 加载本地存储失败:", e);
          state.saveStatus = {
            type: "error",
            message: "加载本地存储失败",
          };
        }
      }),

    saveToLocalStorage: () =>
      set((state) => {
        // [High Fix] SSR-safe: only access localStorage in browser environment
        if (typeof window === 'undefined' || !window.localStorage) {
          state.saveStatus = {
            type: "error",
            message: "localStorage not available (SSR environment)",
          };
          return;
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rules));
          state.saveStatus = {
            type: "success",
            message: "规则配置已保存到本地存储",
          };
        } catch (e) {
          console.error("[RulesStore] 保存到本地存储失败:", e);
          state.saveStatus = {
            type: "error",
            message: "保存到本地存储失败",
          };
        }
      }),

    resetToDefaults: () =>
      set((state) => {
        state.rules = [...defaultRules];
        state.editingRule = null;
        state.saveStatus = {
          type: "success",
          message: "已重置为默认规则",
        };
      }),
  }))
);

export default useRulesStore;
