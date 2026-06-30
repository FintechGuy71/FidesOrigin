import { DataCollector } from './collector';
import { DataProcessor } from './processor';
import { BlockchainPublisher } from './publisher';
import { ClusterCoordinator } from './cluster-coordinator';
import { SyncJob } from './types';
/**
 * Job Scheduler — orchestrates data collection, processing, and publishing
 * With cluster support: uses distributed locks to prevent duplicate syncs
 */
export declare class JobScheduler {
    private collector;
    private processor;
    private publisher;
    private cluster?;
    private jobs;
    private tasks;
    private isRunning;
    constructor(collector: DataCollector, processor: DataProcessor, publisher: BlockchainPublisher, cluster?: ClusterCoordinator);
    /**
     * Start all scheduled jobs
     */
    start(): void;
    /**
     * Run full sync immediately
     */
    runFullSync(): Promise<SyncJob>;
    /**
     * Run incremental sync immediately
     */
    runIncrementalSync(): Promise<SyncJob>;
    /**
     * Execute a sync job with cluster locking
     */
    private runSyncJob;
    /**
     * Release lock if cluster mode
     */
    private releaseLock;
    /**
     * Get all jobs (running and historical)
     */
    getJobs(): SyncJob[];
    /**
     * Get a specific job by ID
     */
    getJob(id: string): SyncJob | undefined;
    /**
     * Stop all scheduled jobs
     */
    stop(): void;
    /**
     * Check if scheduler is running
     */
    isActive(): boolean;
}
export default JobScheduler;
//# sourceMappingURL=scheduler.d.ts.map