import { BlockchainPublisher } from './publisher';
export declare class MonitorServer {
    private app;
    private server?;
    private publisher;
    private registry;
    private provider;
    private syncTotal;
    private syncSuccess;
    private syncFailed;
    private addressesTotal;
    private oracleBalance;
    private gasUsed;
    private syncDuration;
    private publishFailures;
    private profilesPublished;
    private pendingUpdates;
    private dataSourceDown;
    private consecutiveSyncFailures;
    private alertCooldowns;
    private alertCooldownMs;
    private alertMaxCooldownEntries;
    private lastGasUsed;
    private webhookMaxRetries;
    private webhookBaseDelayMs;
    constructor(publisher: BlockchainPublisher);
    private setupRoutes;
    private startBackgroundTasks;
    private updateOracleBalance;
    private evaluateAlertRules;
    private sendAlert;
    /**
     * Dispatch webhook with exponential backoff retry.
     */
    private dispatchWebhookWithRetry;
    /**
     * Read the current value of a Gauge metric with given labels.
     * Returns the value or 0 if not found.
     */
    private getMetricValue;
    /**
     * Format payload for Slack / Discord / DingTalk compatibility
     */
    private formatPayloadForWebhook;
    start(): void;
    stop(): void;
    recordSync(type: string, status: 'success' | 'failed', durationSec: number): void;
    recordPublish(count: number): void;
    recordFailure(count: number): void;
    recordGas(gas: bigint): void;
    setPendingUpdates(count: number): void;
    setAddressesTotal(count: number): void;
    setDataSourceDown(source: string, isDown: boolean): void;
}
export default MonitorServer;
//# sourceMappingURL=monitor.d.ts.map