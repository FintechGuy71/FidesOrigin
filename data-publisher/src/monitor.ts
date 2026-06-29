import express from 'express';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { config } from './config';
import logger from './logger';
import { BlockchainPublisher } from './publisher';
import { ethers } from 'ethers';

// ── Alert Types ───────────────────────────────────────────────────────

interface AlertRule {
  name: string;
  condition: () => boolean | Promise<boolean>;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

interface WebhookPayload {
  text: string;
  severity: string;
  timestamp: string;
  service: string;
  metadata?: Record<string, unknown>;
}

// ── Monitor Server ────────────────────────────────────────────────────

export class MonitorServer {
  private app = express();
  private server?: ReturnType<typeof express.application.listen>;
  private publisher: BlockchainPublisher;
  private registry: Registry;
  private provider: ethers.JsonRpcProvider;

  // ── Metrics ─────────────────────────────────────────────────────────
  private syncTotal: Counter;
  private syncSuccess: Counter;
  private syncFailed: Counter;
  private addressesTotal: Gauge;
  private oracleBalance: Gauge;
  private gasUsed: Histogram;
  private syncDuration: Histogram;
  private publishFailures: Counter;
  private profilesPublished: Counter;
  private pendingUpdates: Gauge;
  private dataSourceDown: Gauge;

  // ── State for Alerting ──────────────────────────────────────────────
  private consecutiveSyncFailures = 0;
  private alertCooldowns = new Map<string, number>();
  private alertCooldownMs = 5 * 60 * 1000; // 5 minutes
  private alertMaxCooldownEntries = 100;
  private lastGasUsed = 0;
  private webhookMaxRetries = 3;
  private webhookBaseDelayMs = 1000;

  constructor(publisher: BlockchainPublisher) {
    this.publisher = publisher;
    this.provider = new ethers.JsonRpcProvider(config.publisher.rpcUrl, config.publisher.chainId);
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    // Core business metrics
    this.syncTotal = new Counter({
      name: 'fides_sync_total',
      help: 'Total number of sync jobs executed',
      labelNames: ['type'],
      registers: [this.registry],
    });
    this.syncSuccess = new Counter({
      name: 'fides_sync_success',
      help: 'Number of successful sync jobs',
      labelNames: ['type'],
      registers: [this.registry],
    });
    this.syncFailed = new Counter({
      name: 'fides_sync_failed',
      help: 'Number of failed sync jobs',
      labelNames: ['type'],
      registers: [this.registry],
    });
    this.addressesTotal = new Gauge({
      name: 'fides_addresses_total',
      help: 'Total number of on-chain risk profiles',
      registers: [this.registry],
    });
    this.oracleBalance = new Gauge({
      name: 'fides_oracle_balance',
      help: 'Oracle address ETH balance',
      registers: [this.registry],
    });
    this.gasUsed = new Histogram({
      name: 'fides_gas_used',
      help: 'Gas used per sync transaction',
      buckets: [50000, 100000, 150000, 200000, 300000, 500000, 1000000],
      registers: [this.registry],
    });
    this.syncDuration = new Histogram({
      name: 'fides_sync_duration_seconds',
      help: 'Duration of sync jobs in seconds',
      labelNames: ['type'],
      buckets: [60, 300, 600, 1800, 3600],
      registers: [this.registry],
    });
    this.publishFailures = new Counter({
      name: 'fides_publish_failures_total',
      help: 'Total number of failed publish transactions',
      registers: [this.registry],
    });
    this.profilesPublished = new Counter({
      name: 'fides_profiles_published_total',
      help: 'Total number of risk profiles published',
      registers: [this.registry],
    });
    this.pendingUpdates = new Gauge({
      name: 'fides_pending_updates',
      help: 'Number of profiles pending update',
      registers: [this.registry],
    });
    this.dataSourceDown = new Gauge({
      name: 'fides_data_source_down',
      help: 'Number of data sources currently unreachable (1 = down)',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.setupRoutes();
    this.startBackgroundTasks();
  }

  // ── Routes ──────────────────────────────────────────────────────────

  private setupRoutes(): void {
    // Prometheus metrics
    this.app.get(config.monitor.metricsPath, async (_req, res) => {
      try {
        res.set('Content-Type', this.registry.contentType);
        res.end(await this.registry.metrics());
      } catch (error) {
        res.status(500).end((error as Error).message);
      }
    });

    // Health check
    this.app.get(config.monitor.healthPath, async (_req, res) => {
      try {
        const health = await this.publisher.healthCheck();
        const status = health.healthy ? 200 : 503;
        res.status(status).json({
          status: health.healthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'fidesorigin-data-publisher',
          version: process.env.npm_package_version || '1.0.0',
          checks: {
            publisher: health.healthy ? 'ok' : health.error,
          },
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Status endpoint
    this.app.get('/status', async (_req, res) => {
      res.json({
        service: 'fidesorigin-data-publisher',
        version: process.env.npm_package_version || '1.0.0',
        env: config.env,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Readiness probe (for K8s)
    this.app.get('/ready', async (_req, res) => {
      try {
        const health = await this.publisher.healthCheck();
        if (health.healthy) {
          res.status(200).json({ ready: true });
        } else {
          res.status(503).json({ ready: false, reason: health.error });
        }
      } catch {
        res.status(503).json({ ready: false });
      }
    });
  }

  // ── Background Tasks ────────────────────────────────────────────────

  private startBackgroundTasks(): void {
    // Update oracle balance every 60s
    setInterval(() => this.updateOracleBalance(), 60000);
    // Check alert rules every 30s
    setInterval(() => this.evaluateAlertRules(), 30000);
  }

  private async updateOracleBalance(): Promise<void> {
    try {
      const address = await this.publisher.getAddress?.();
      if (!address) return;
      const balance = await this.provider.getBalance(address);
      this.oracleBalance.set(Number(ethers.formatEther(balance)));
    } catch (error) {
      // D1-AUDIT1-069 fix: elevate to warn level for production visibility
      logger.warn('Failed to update oracle balance', { error: (error as Error).message });
    }
  }

  // ── Alert Rules ─────────────────────────────────────────────────────

  private async evaluateAlertRules(): Promise<void> {
    const rules: AlertRule[] = [
      {
        name: 'oracle-balance-low',
        severity: 'critical',
        condition: async () => {
          const address = await this.publisher.getAddress?.();
          if (!address) return false;
          const bal = await this.provider.getBalance(address);
          const balEth = Number(ethers.formatEther(bal));
          // Configurable threshold: mainnet needs >= 1 ETH, testnet >= 0.1 ETH
          const threshold = config.publisher.chainId === 1 ? 1.0 : 0.1;
          return balEth < threshold;
        },
        message: `Oracle ETH balance is below threshold (${config.publisher.chainId === 1 ? '1.0' : '0.1'} ETH). Please top up immediately.`,
      },
      {
        name: 'consecutive-sync-failures',
        severity: 'critical',
        condition: () => this.consecutiveSyncFailures >= 3,
        message: `Consecutive sync failures: ${this.consecutiveSyncFailures}. Check RPC connection and ORACLE_ROLE.`,
      },
      {
        name: 'data-source-unreachable',
        severity: 'warning',
        condition: async () => {
          for (const ds of config.dataSources) {
            if (!ds.enabled) continue;
            const value = await this.getMetricValue('fides_data_source_down', { source: ds.id });
            if (value === 1) return true;
          }
          return false;
        },
        message: 'One or more data sources are unreachable.',
      },
    ];

    for (const rule of rules) {
      try {
        if (await rule.condition()) {
          await this.sendAlert(rule);
        }
      } catch (error) {
        logger.debug(`Alert rule ${rule.name} evaluation failed`, { error: (error as Error).message });
      }
    }
  }

  private async sendAlert(rule: AlertRule, customMessage?: string): Promise<void> {
    const now = Date.now();
    const lastFired = this.alertCooldowns.get(rule.name) || 0;
    if (now - lastFired < this.alertCooldownMs) return; // cooldown
    this.alertCooldowns.set(rule.name, now);

    // Prevent unbounded memory growth from alertCooldowns Map
    if (this.alertCooldowns.size > this.alertMaxCooldownEntries) {
      const oldest = Array.from(this.alertCooldowns.entries())
        .sort((a, b) => a[1] - b[1])[0];
      if (oldest) this.alertCooldowns.delete(oldest[0]);
    }

    const message = customMessage ?? rule.message;

    const payload: WebhookPayload = {
      text: message,
      severity: rule.severity,
      timestamp: new Date().toISOString(),
      service: 'fidesorigin-data-publisher',
      metadata: { rule: rule.name, instance: config.cluster.instanceId },
    };

    logger.warn(`[ALERT] ${rule.name}: ${message}`, { severity: rule.severity });

    if (config.monitor.alertWebhook) {
      try {
        await this.dispatchWebhookWithRetry(payload);
      } catch (error) {
        logger.error('Failed to dispatch webhook alert after retries', { error: (error as Error).message });
      }
    }
  }

  /**
   * Dispatch webhook with exponential backoff retry.
   */
  private async dispatchWebhookWithRetry(payload: WebhookPayload): Promise<void> {
    const url = config.monitor.alertWebhook!;
    const body = this.formatPayloadForWebhook(url, payload);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.webhookMaxRetries; attempt++) {
      try {
        // D1-AUDIT1-068 fix: add 10s timeout via AbortController
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          return; // success
        }
        lastError = new Error(`Webhook returned ${resp.status} ${resp.statusText}`);
      } catch (error) {
        lastError = error as Error;
      }

      if (attempt < this.webhookMaxRetries - 1) {
        const delay = this.webhookBaseDelayMs * Math.pow(2, attempt);
        logger.debug(`Webhook retry ${attempt + 1}/${this.webhookMaxRetries - 1} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Webhook dispatch failed after all retries');
  }

  /**
   * Read the current value of a Gauge metric with given labels.
   * Returns the value or 0 if not found.
   */
  private async getMetricValue(metricName: string, labels: Record<string, string>): Promise<number> {
    try {
      const metricsStr = await this.registry.getSingleMetricAsString(metricName);
      if (!metricsStr) return 0;

      // Parse the metric string to find the matching label set
      const lines = metricsStr.split('\n');
      for (const line of lines) {
        if (line.startsWith(metricName + '{')) {
          const labelMatch = Object.entries(labels).every(([k, v]) => line.includes(`${k}="${v}"`));
          if (labelMatch) {
            const valueMatch = line.match(/}\s*(\S+)$/);
            if (valueMatch) {
              const val = parseFloat(valueMatch[1]);
              return isNaN(val) ? 0 : val;
            }
          }
        }
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Format payload for Slack / Discord / DingTalk compatibility
   */
  private formatPayloadForWebhook(url: string, payload: WebhookPayload): unknown {
    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      warning: '🟡',
      info: '🔵',
    };

    // Slack-compatible
    if (url.includes('hooks.slack.com')) {
      return {
        text: `${severityEmoji[payload.severity]} *FidesOrigin Alert*`,
        attachments: [{
          color: payload.severity === 'critical' ? 'danger' : payload.severity === 'warning' ? 'warning' : 'good',
          fields: [
            { title: 'Rule', value: payload.metadata?.rule as string, short: true },
            { title: 'Severity', value: payload.severity, short: true },
            { title: 'Message', value: payload.text, short: false },
            { title: 'Instance', value: payload.metadata?.instance as string, short: false },
            { title: 'Time', value: payload.timestamp, short: false },
          ],
        }],
      };
    }

    // Discord-compatible (uses same format as Slack)
    if (url.includes('discord.com') || url.includes('discordapp.com')) {
      return {
        content: `${severityEmoji[payload.severity]} **FidesOrigin Alert**`,
        embeds: [{
          color: payload.severity === 'critical' ? 0xff0000 : payload.severity === 'warning' ? 0xffaa00 : 0x00aa00,
          fields: [
            { name: 'Rule', value: payload.metadata?.rule as string, inline: true },
            { name: 'Severity', value: payload.severity, inline: true },
            { name: 'Message', value: payload.text },
            { name: 'Instance', value: payload.metadata?.instance as string },
            { name: 'Time', value: payload.timestamp },
          ],
        }],
      };
    }

    // DingTalk-compatible
    if (url.includes('oapi.dingtalk.com') || url.includes('openplatform.dingtalk.com')) {
      return {
        msgtype: 'markdown',
        markdown: {
          title: 'FidesOrigin Alert',
          text: `### ${severityEmoji[payload.severity]} FidesOrigin Alert\n` +
                `- **Rule:** ${payload.metadata?.rule}\n` +
                `- **Severity:** ${payload.severity}\n` +
                `- **Message:** ${payload.text}\n` +
                `- **Instance:** ${payload.metadata?.instance}\n` +
                `- **Time:** ${payload.timestamp}`,
        },
      };
    }

    // Generic fallback
    return payload;
  }

  // ── Public API ──────────────────────────────────────────────────────

  start(): void {
    if (!config.monitor.enabled) {
      logger.info('Monitoring disabled');
      return;
    }
    this.server = this.app.listen(config.monitor.port, () => {
      logger.info(`Monitor server listening on port ${config.monitor.port}`, {
        metricsPath: config.monitor.metricsPath,
        healthPath: config.monitor.healthPath,
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close(() => {
        logger.info('Monitor server stopped');
      });
    }
  }

  recordSync(type: string, status: 'success' | 'failed', durationSec: number): void {
    this.syncTotal.inc({ type });
    this.syncDuration.observe({ type }, durationSec);
    if (status === 'success') {
      this.syncSuccess.inc({ type });
      this.consecutiveSyncFailures = 0;
    } else {
      this.syncFailed.inc({ type });
      this.consecutiveSyncFailures++;
    }
  }

  recordPublish(count: number): void {
    this.profilesPublished.inc(count);
  }

  recordFailure(count: number): void {
    this.publishFailures.inc(count);
  }

  recordGas(gas: bigint): void {
    this.lastGasUsed = Number(gas);
    this.gasUsed.observe(this.lastGasUsed);
  }

  setPendingUpdates(count: number): void {
    this.pendingUpdates.set(count);
  }

  setAddressesTotal(count: number): void {
    this.addressesTotal.set(count);
  }

  setDataSourceDown(source: string, isDown: boolean): void {
    this.dataSourceDown.set({ source }, isDown ? 1 : 0);
  }
}

export default MonitorServer;
