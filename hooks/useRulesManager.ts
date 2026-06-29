/**
 * hooks/useRulesManager.ts - 规则管理 Hook
 * 封装规则管理逻辑，使用 Zustand store 管理状态
 */
import { useCallback } from "react";
import { useRulesStore } from "@/stores/rules";
import { apiPost } from "@/lib/api";
import { getRulesApiUrl } from "@/lib/env";
import type { Rule, RuleAction } from "@/stores/rules";

export function useRulesManager() {
  const rules = useRulesStore((state) => state.rules);
  const setRules = useRulesStore((state) => state.setRules);
  const toggleRule = useRulesStore((state) => state.toggleRule);
  const updateRuleThreshold = useRulesStore((state) => state.updateRuleThreshold);
  const updateRuleAction = useRulesStore((state) => state.updateRuleAction);
  const loadFromLocalStorage = useRulesStore((state) => state.loadFromLocalStorage);
  const saveToLocalStorage = useRulesStore((state) => state.saveToLocalStorage);
  const setSaveStatus = useRulesStore((state) => state.setSaveStatus);
  const resetToDefaults = useRulesStore((state) => state.resetToDefaults);

  // 加载规则（优先从服务器，回退到本地存储）
  const loadRules = useCallback(async () => {
    const url = getRulesApiUrl();
    if (url) {
      try {
        const response = await apiPost(`${url}/load`, {});
        // [High Fix] Check response.ok before treating as success
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        const data = await response.json();
        if (data.rules && Array.isArray(data.rules)) {
          setRules(data.rules);
          setSaveStatus({
            type: "success",
            message: "已从服务器加载规则配置",
          });
          return;
        }
      } catch (e) {
        console.warn("[RulesManager] 服务器加载失败，回退到本地存储:", e);
      }
    }
    loadFromLocalStorage();
  }, [setRules, loadFromLocalStorage, setSaveStatus]);

  // 保存规则（优先保存到服务器，回退到本地存储）
  const saveRules = useCallback(async () => {
    const url = getRulesApiUrl();
    if (url) {
      try {
        const response = await apiPost(`${url}/save`, { rules });
        // [High Fix] Check response.ok before treating as success
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        const data = await response.json();
        setSaveStatus({
          type: "success",
          message: data.message || "规则配置已保存到服务器",
        });
        return;
      } catch (e) {
        console.warn("[RulesManager] 服务器保存失败，回退到本地存储:", e);
      }
    }
    saveToLocalStorage();
  }, [rules, saveToLocalStorage, setSaveStatus]);

  // 切换规则启用状态
  const handleToggle = useCallback(
    (id: string) => {
      toggleRule(id);
    },
    [toggleRule]
  );

  // 更新阈值
  const handleThresholdChange = useCallback(
    (id: string, threshold: number) => {
      updateRuleThreshold(id, threshold);
    },
    [updateRuleThreshold]
  );

  // 更新动作
  const handleActionChange = useCallback(
    (id: string, action: RuleAction) => {
      updateRuleAction(id, action);
    },
    [updateRuleAction]
  );

  // 重置为默认值
  const handleReset = useCallback(() => {
    resetToDefaults();
  }, [resetToDefaults]);

  return {
    rules,
    loadRules,
    saveRules,
    handleToggle,
    handleThresholdChange,
    handleActionChange,
    handleReset,
  };
}

export default useRulesManager;
