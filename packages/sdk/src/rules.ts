import { FidesOriginClient } from './client';
import {
  Rule,
  RuleListOptions,
  RuleListResponse,
  CreateRuleRequest,
  UpdateRuleRequest,
  RuleCondition,
  RuleAction,
  ComplianceRule,
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
 *   .threshold(80)
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
 * Fluent API for creating and updating rules (new ComplianceRule format)
 */
export class RuleBuilder {
  private client: FidesOriginClient;
  private request: Partial<ComplianceRule> = {
    enabled: true,
    threshold: 50,
    action: 'flag',
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
   * Set risk threshold (0-100)
   */
  threshold(threshold: number): this {
    this.request.threshold = threshold;
    return this;
  }

  /**
   * Set rule action
   */
  action(action: ComplianceRule['action']): this {
    this.request.action = action;
    return this;
  }

  /**
   * Enable/disable rule
   */
  enabled(enabled: boolean): this {
    this.request.enabled = enabled;
    return this;
  }

  /**
   * Build and create the rule
   */
  async build(): Promise<ComplianceRule> {
    if (!this.request.name) {
      throw new Error('Rule name is required');
    }
    if (this.request.threshold === undefined) {
      throw new Error('Rule threshold is required');
    }
    if (!this.request.action) {
      throw new Error('Rule action is required');
    }

    return this.client.createRule(this.request as Omit<ComplianceRule, 'id'>);
  }
}

/**
 * Predefined rule templates (new ComplianceRule format)
 */
export const RuleTemplates = {
  /**
   * Create a rule to block high-risk addresses
   */
  blockHighRisk(priority: number = 100): Omit<ComplianceRule, 'id'> {
    return {
      name: 'Block High Risk Addresses',
      description: 'Automatically block transactions from high and critical risk addresses',
      enabled: true,
      threshold: 80,
      action: 'block',
    };
  },

  /**
   * Create a rule to flag sanctioned addresses
   */
  flagSanctioned(priority: number = 90): Omit<ComplianceRule, 'id'> {
    return {
      name: 'Flag Sanctioned Addresses',
      description: 'Flag addresses on sanctions lists for manual review',
      enabled: true,
      threshold: 90,
      action: 'flag',
    };
  },

  /**
   * Create a rule for mixer detection
   */
  reviewMixerUsage(priority: number = 50): Omit<ComplianceRule, 'id'> {
    return {
      name: 'Review Mixer Usage',
      description: 'Flag transactions involving cryptocurrency mixers',
      enabled: true,
      threshold: 60,
      action: 'review',
    };
  },

  /**
   * Create a rule for large volume transactions
   */
  reviewLargeVolume(threshold: number = 100000, priority: number = 30): Omit<ComplianceRule, 'id'> {
    return {
      name: `Review Large Volume (>$${threshold.toLocaleString()})`,
      description: `Flag addresses with transaction volume exceeding $${threshold.toLocaleString()}`,
      enabled: true,
      threshold: 70,
      action: 'review',
    };
  },

  /**
   * Create a custom rule for specific risk score threshold
   */
  riskScoreThreshold(minScore: number, action: ComplianceRule['action'] = 'review', priority: number = 50): Omit<ComplianceRule, 'id'> {
    return {
      name: `Risk Score Threshold (${minScore}+)`,
      description: `Trigger action for addresses with risk score ${minScore} or higher`,
      enabled: true,
      threshold: minScore,
      action,
    };
  }
};

/**
 * Rules Manager Class
 * 
 * High-level interface for rule management (updated for ComplianceRule)
 */
export class RulesManager {
  private client: FidesOriginClient;

  constructor(client: FidesOriginClient) {
    this.client = client;
  }

  /**
   * List all rules
   */
  async list(): Promise<ComplianceRule[]> {
    return this.client.getRules();
  }

  /**
   * Get active rules only
   */
  async getActive(): Promise<ComplianceRule[]> {
    const rules = await this.client.getRules();
    return rules.filter(r => r.enabled);
  }

  /**
   * Get a rule by ID
   */
  async get(ruleId: string): Promise<ComplianceRule> {
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
  ): Promise<ComplianceRule> {
    const templateFn = RuleTemplates[template];
    const request = (templateFn as any)(...args);
    return this.client.createRule(request);
  }

  /**
   * Update a rule
   */
  async update(ruleId: string, updates: Partial<Omit<ComplianceRule, 'id'>>): Promise<ComplianceRule> {
    return this.client.updateRule(ruleId, updates);
  }

  /**
   * Activate a rule
   */
  async activate(ruleId: string): Promise<ComplianceRule> {
    return this.client.updateRule(ruleId, { enabled: true });
  }

  /**
   * Deactivate a rule
   */
  async deactivate(ruleId: string): Promise<ComplianceRule> {
    return this.client.updateRule(ruleId, { enabled: false });
  }

  /**
   * Delete a rule
   */
  async delete(ruleId: string): Promise<void> {
    return this.client.deleteRule(ruleId);
  }

  /**
   * Get rules by threshold
   */
  async getByThreshold(minThreshold: number): Promise<ComplianceRule[]> {
    const rules = await this.client.getRules();
    return rules.filter(rule => rule.threshold >= minThreshold);
  }

  /**
   * Enable default compliance rules
   */
  async enableDefaults(): Promise<ComplianceRule[]> {
    const rules: ComplianceRule[] = [];
    
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
