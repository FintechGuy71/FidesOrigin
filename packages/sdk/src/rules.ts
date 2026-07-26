import { FidesOriginClient } from './client';
import {
  Rule,
  RuleListOptions,
  RuleListResponse,
  CreateRuleRequest,
  UpdateRuleRequest,
  RuleCondition,
  RuleAction,
} from './types';

/**
 * Rules Management Helper Functions
 *
 * Provides convenient methods for managing compliance rules
 */

/**
 * Create a new rule with fluent builder
 *
 * @example
 * ```typescript
 * import { createRuleBuilder } from '@fidesorigin/sdk';
 *
 * const rule = await createRuleBuilder(client)
 *   .name('High Risk Sanctioned Address')
 *   .description('Flag addresses on sanctions list')
 *   .priority(80)
 *   .action('block')
 *   .build();
 * ```
 */
export function createRuleBuilder(client: FidesOriginClient): RuleBuilder {
  return new RuleBuilder(client);
}

/**
 * Rule Builder Class
 *
 * Fluent API for creating rules using the API's Rule format
 */
export class RuleBuilder {
  private client: FidesOriginClient;
  private request: Partial<CreateRuleRequest> = {
    conditions: [],
    actions: [],
    priority: 50,
  };

  constructor(client: FidesOriginClient) {
    this.client = client;
  }

  /**
   * Set rule name
   */
  name(name: string): this {
    this.request.name = name;
    return this;
  }

  /**
   * Set rule description
   */
  description(description: string): this {
    this.request.description = description;
    return this;
  }

  /**
   * Set rule priority (0-100, higher = more important)
   */
  priority(priority: number): this {
    this.request.priority = priority;
    return this;
  }

  /**
   * Set a simple condition
   */
  condition(field: string, operator: RuleCondition['operator'], value: unknown): this {
    if (!this.request.conditions) {
      this.request.conditions = [];
    }
    this.request.conditions.push({ field, operator, value });
    return this;
  }

  /**
   * Set rule action
   */
  action(actionType: RuleAction['type']): this {
    if (!this.request.actions) {
      this.request.actions = [];
    }
    this.request.actions.push({ type: actionType });
    return this;
  }

  /**
   * Build and create the rule
   */
  async build(): Promise<Rule> {
    if (!this.request.name) {
      throw new Error('Rule name is required');
    }
    if (!this.request.conditions || this.request.conditions.length === 0) {
      throw new Error('At least one rule condition is required');
    }
    if (!this.request.actions || this.request.actions.length === 0) {
      throw new Error('At least one rule action is required');
    }

    return this.client.createRule(this.request as CreateRuleRequest);
  }
}

/**
 * Predefined rule templates
 */
export const RuleTemplates = {
  /**
   * Create a rule to block high-risk addresses
   */
  blockHighRisk(priority: number = 100): CreateRuleRequest {
    return {
      name: 'Block High Risk Addresses',
      description: 'Automatically block transactions from high and critical risk addresses',
      priority,
      conditions: [
        { field: 'riskScore', operator: 'greater_than', value: 80 },
      ],
      actions: [{ type: 'block' }],
    };
  },

  /**
   * Create a rule to flag sanctioned addresses
   */
  flagSanctioned(priority: number = 90): CreateRuleRequest {
    return {
      name: 'Flag Sanctioned Addresses',
      description: 'Flag addresses on sanctions lists for manual review',
      priority,
      conditions: [
        { field: 'sanctioned', operator: 'equals', value: true },
      ],
      actions: [{ type: 'flag' }],
    };
  },

  /**
   * Create a rule for mixer detection
   */
  reviewMixerUsage(priority: number = 50): CreateRuleRequest {
    return {
      name: 'Review Mixer Usage',
      description: 'Flag transactions involving cryptocurrency mixers',
      priority,
      conditions: [
        { field: 'mixerInvolved', operator: 'equals', value: true },
      ],
      actions: [{ type: 'review' }],
    };
  },

  /**
   * Create a rule for large volume transactions
   */
  reviewLargeVolume(threshold: number = 100000, priority: number = 30): CreateRuleRequest {
    return {
      name: `Review Large Volume (>$${threshold.toLocaleString()})`,
      description: `Flag addresses with transaction volume exceeding $${threshold.toLocaleString()}`,
      priority,
      conditions: [
        { field: 'volume', operator: 'greater_than', value: threshold },
      ],
      actions: [{ type: 'review' }],
    };
  },

  /**
   * Create a custom rule for specific risk score threshold
   */
  riskScoreThreshold(minScore: number, action: RuleAction['type'] = 'review', priority: number = 50): CreateRuleRequest {
    return {
      name: `Risk Score Threshold (${minScore}+)`,
      description: `Trigger action for addresses with risk score ${minScore} or higher`,
      priority,
      conditions: [
        { field: 'riskScore', operator: 'greater_than', value: minScore },
      ],
      actions: [{ type: action }],
    };
  }
};

/**
 * Rules Manager Class
 *
 * High-level interface for rule management
 */
export class RulesManager {
  private client: FidesOriginClient;

  constructor(client: FidesOriginClient) {
    this.client = client;
  }

  /**
   * List all rules
   */
  async list(): Promise<Rule[]> {
    return this.client.getRules();
  }

  /**
   * Get active rules only
   */
  async getActive(): Promise<Rule[]> {
    const rules = await this.client.getRules();
    return rules.filter(r => r.status === 'active');
  }

  /**
   * Get a rule by ID
   */
  async get(ruleId: string): Promise<Rule> {
    const rules = await this.client.getRules();
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    return rule;
  }

  /**
   * Create a new rule using the builder
   */
  builder(): RuleBuilder {
    return new RuleBuilder(this.client);
  }

  /**
   * Create a rule from a template
   */
  async createFromTemplate(
    template: keyof typeof RuleTemplates,
    ...args: any[]
  ): Promise<Rule> {
    const templateFn = RuleTemplates[template];
    const request = (templateFn as any)(...args);
    return this.client.createRule(request);
  }

  /**
   * Update a rule
   */
  async update(ruleId: string, updates: Partial<UpdateRuleRequest>): Promise<Rule> {
    return this.client.updateRule(ruleId, updates);
  }

  /**
   * Activate a rule
   */
  async activate(ruleId: string): Promise<Rule> {
    return this.client.updateRule(ruleId, { status: 'active' });
  }

  /**
   * Deactivate a rule
   */
  async deactivate(ruleId: string): Promise<Rule> {
    return this.client.updateRule(ruleId, { status: 'inactive' });
  }

  /**
   * Delete a rule
   */
  async delete(ruleId: string): Promise<void> {
    return this.client.deleteRule(ruleId);
  }

  /**
   * Get rules by minimum priority
   */
  async getByPriority(minPriority: number): Promise<Rule[]> {
    const rules = await this.client.getRules();
    return rules.filter(rule => rule.priority >= minPriority);
  }

  /**
   * Enable default compliance rules
   */
  async enableDefaults(): Promise<Rule[]> {
    const rules: Rule[] = [];

    // Block high risk
    rules.push(await this.createFromTemplate('blockHighRisk', 100));

    // Flag sanctioned
    rules.push(await this.createFromTemplate('flagSanctioned', 90));

    // Review mixer usage
    rules.push(await this.createFromTemplate('reviewMixerUsage', 50));

    return rules;
  }
}

// Re-export types
export * from './types';
