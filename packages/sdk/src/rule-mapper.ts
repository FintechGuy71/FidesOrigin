import type { Rule, RuleListResponse } from './types';

/** Normalize both FastAPI and legacy gateway rule representations. */
export function normalizeRule(raw: any): Rule {
  return {
    ...raw,
    id: String(raw.id),
    status: raw.status || (raw.is_active === false ? 'inactive' : 'active'),
    priority: raw.priority ?? 0,
    conditions: raw.conditions || [],
    actions: raw.actions || [],
    createdAt: raw.createdAt || raw.created_at || '',
    updatedAt: raw.updatedAt || raw.updated_at || '',
  };
}

export function normalizeRuleList(raw: any): RuleListResponse {
  const items = Array.isArray(raw?.rules) ? raw.rules : Array.isArray(raw?.items) ? raw.items : [];
  return {
    rules: items.map(normalizeRule),
    total: raw?.total ?? items.length,
    page: raw?.page ?? 1,
    limit: raw?.limit ?? raw?.page_size ?? items.length,
  };
}
