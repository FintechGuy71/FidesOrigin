import { BatchSyncOptions } from './batch-collector';
/**
 * Batch Risk Data Scheduler
 * Runs daily delta sync of OFAC + ScamSniffer using batchUpdateRiskProfiles.
 * Replaces the slow per-address sync with 100-address batches (~2 min vs 9 hours).
 */
export declare class BatchScheduler {
    private task?;
    private isRunning;
    private cronExpression;
    private syncOptions;
    constructor(cronExpression?: string, syncOptions?: BatchSyncOptions);
    start(): void;
    stop(): void;
    get isActive(): boolean;
}
//# sourceMappingURL=batch-scheduler.d.ts.map