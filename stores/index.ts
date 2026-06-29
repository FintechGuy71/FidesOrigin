/**
 * stores/index.ts - Stores 统一导出
 */
export {
  useDashboardStore,
  type DashboardState,
  type DashboardActions,
  type DashboardStats,
  type Alert,
  type RiskLevel,
  type WsStatus,
  selectStats,
  selectUnreadAlerts,
  selectUnreadCount,
  selectWsStatus,
  selectWsError,
} from "./dashboard";

export {
  useRiskStore,
  type RiskState,
  type RiskActions,
  type RiskReport,
  type RiskLevel,
  type RiskTag,
  type RiskDetail,
  type RiskTransaction,
  selectRiskData,
  selectRiskLevel,
  selectRiskScore,
  selectIsLoading,
  selectError,
  selectHistory,
} from "./risk";

export {
  useRulesStore,
  type RulesState,
  type RulesActions,
  type Rule,
  type RuleAction,
  type SaveStatus,
  selectRules,
  selectEnabledRules,
  selectRuleById,
  selectEditingRule,
  selectSaveStatus,
} from "./rules";

export {
  useAuthStore,
  type AuthState,
  type AuthActions,
  type User,
  selectIsAuthenticated,
  selectUser,
  selectUserRole,
  selectIsAdmin,
  selectAuthLoading,
  selectAuthError,
} from "./auth";
