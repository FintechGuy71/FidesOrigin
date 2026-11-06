import { FidesOriginClient } from './client';
import {
  Rule,
  CreateRuleRequest,
  UpdateRuleRequest,
} from './types';

const EXECUTABLE_STRATEGIES = new Set([
  'reported_address',
  'high_frequency_transactions',
  'new_address',
  'large_amount_transfer',
  'sanctioned_list',
  'scam_list',
]);

function assertExecutable(request: Partial<CreateRuleRequest>): void {
  if (!request.name) throw new Error('Rule name is required');
  if (!request.rule_type) throw new Error('rule_type is required');
  if (!request.category) throw new Error('category is required');
  if (!request.condition) throw new Error('condition is required');
  if (request.conditions !== undefined || request.actions !== undefined) {
    throw new Error('Legacy conditions/actions are not executable by the backend');
  }
  if (!EXECUTABLE_STRATEGIES.has(request.name) && request.condition.always_apply !== true) {
    throw new Error('Use a registered strategy or explicitly set condition.always_apply=true');
  }
}

/** Fluent builder for the executable FastAPI rule contract. */
export class RuleBuilder {
  private request: Partial<CreateRuleRequest> = {
    rule_type: 'custom',
    category: 'custom',
    condition: {},
    priority: 50,
    risk_weight: 1,
    risk_score_impact: 50,
  };

  constructor(private client: FidesOriginClient) {}

  name(name: string): this {
    this.request.name = name;
    return this;
  }

  description(description: string): this {
    this.request.description = description;
    return this;
  }

  ruleType(ruleType: string): this {
    this.request.rule_type = ruleType;
    return this;
  }

  category(category: string): this {
    this.request.category = category;
    return this;
  }

  condition(condition: Record<string, unknown>): this {
    this.request.condition = { ...condition };
    return this;
  }

  impact(score: number): this {
    this.request.risk_score_impact = score;
    return this;
  }

  weight(weight: number): this {
    this.request.risk_weight = weight;
    return this;
  }

  priority(priority: number): this {
    this.request.priority = priority;
    return this;
  }

  async build(): Promise<Rule> {
    assertExecutable(this.request);
    return this.client.createRule(this.request as CreateRuleRequest);
  }
}

export function createRuleBuilder(client: FidesOriginClient): RuleBuilder {
  return new RuleBuilder(client);
}

/** Templates backed by real RiskEngineService strategies. */
export const RuleTemplates = {
  flagSanctioned(priority = 100): CreateRuleRequest {
    return {
      name: 'sanctioned_list',
      description: 'OFAC/SDN official sanctions list match',
      rule_type: 'sanctions',
      category: 'compliance',
      condition: {},
      risk_weight: 1,
      risk_score_impact: 100,
      priority,
    };
  },

  reviewScam(priority = 90): CreateRuleRequest {
    return {
      name: 'scam_list',
      description: 'Community phishing, scam and fraud intelligence match',
      rule_type: 'threat_intelligence',
      category: 'reputation',
      condition: {},
      risk_weight: 1,
      risk_score_impact: 75,
      priority,
    };
  },

  reviewLargeVolume(thresholdEth = 100, priority = 50): CreateRuleRequest {
    return {
      name: 'large_amount_transfer',
      description: `Review transfers above ${thresholdEth} ETH`,
      rule_type: 'transaction_monitoring',
      category: 'amount',
      condition: { threshold_eth: thresholdEth },
      risk_weight: 1,
      risk_score_impact: 30,
      priority,
    };
  },

  reviewHighFrequency(maxTransactionsPerHour = 10, priority = 40): CreateRuleRequest {
    return {
      name: 'high_frequency_transactions',
      description: 'Review unusually frequent transaction activity',
      rule_type: 'transaction_monitoring',
      category: 'behavior',
      condition: { max_transactions_per_hour: maxTransactionsPerHour },
      risk_weight: 1,
      risk_score_impact: 40,
      priority,
    };
  },
};

export class RulesManager {
  constructor(private client: FidesOriginClient) {}

  async list(): Promise<Rule[]> {
    return this.client.getRules();
  }

  async getActive(): Promise<Rule[]> {
    return (await this.list()).filter((rule) => rule.status === 'active');
  }

  async get(ruleId: string): Promise<Rule> {
    const rule = (await this.list()).find((item) => item.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    return rule;
  }

  builder(): RuleBuilder {
    return new RuleBuilder(this.client);
  }

  async createFromTemplate(template: keyof typeof RuleTemplates, ...args: any[]): Promise<Rule> {
    const templateFn = RuleTemplates[template] as (...values: any[]) => CreateRuleRequest;
    return this.client.createRule(templateFn(...args));
  }

  async update(ruleId: string, updates: Partial<UpdateRuleRequest>): Promise<Rule> {
    return this.client.updateRule(ruleId, updates);
  }

  async activate(ruleId: string): Promise<Rule> {
    return this.client.updateRule(ruleId, { is_active: true });
  }

  async deactivate(ruleId: string): Promise<Rule> {
    return this.client.updateRule(ruleId, { is_active: false });
  }

  async delete(ruleId: string): Promise<void> {
    return this.client.deleteRule(ruleId);
  }

  async getByPriority(minPriority: number): Promise<Rule[]> {
    return (await this.list()).filter((rule) => rule.priority >= minPriority);
  }

  async enableDefaults(): Promise<Rule[]> {
    return [
      await this.createFromTemplate('flagSanctioned', 100),
      await this.createFromTemplate('reviewScam', 90),
      await this.createFromTemplate('reviewLargeVolume', 100, 50),
    ];
  }
}

export * from './types';
