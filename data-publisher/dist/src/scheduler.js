"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
/**
 * Job Scheduler — orchestrates data collection, processing, and publishing
 * With cluster support: uses distributed locks to prevent duplicate syncs
 */
class JobScheduler {
    collector;
    processor;
    publisher;
    cluster;
    jobs = new Map();
    tasks = [];
    isRunning = false;
    constructor(collector, processor, publisher, cluster) {
        this.collector = collector;
        this.processor = processor;
        this.publisher = publisher;
        this.cluster = cluster;
    }
    /**
     * Start all scheduled jobs
     */
    start() {
        if (this.isRunning) {
            logger_1.default.warn('Scheduler already running');
            return;
        }
        // Full sync job
        const fullSyncTask = node_cron_1.default.schedule(config_1.config.scheduler.fullSync, async () => {
            await this.runFullSync();
        }, {
            scheduled: false,
            timezone: 'UTC',
        });
        this.tasks.push(fullSyncTask);
        fullSyncTask.start();
        logger_1.default.info('Full sync scheduled', { cron: config_1.config.scheduler.fullSync });
        // Incremental sync job
        const incrementalTask = node_cron_1.default.schedule(config_1.config.scheduler.incrementalSync, async () => {
            await this.runIncrementalSync();
        }, {
            scheduled: false,
            timezone: 'UTC',
        });
        this.tasks.push(incrementalTask);
        incrementalTask.start();
        logger_1.default.info('Incremental sync scheduled', { cron: config_1.config.scheduler.incrementalSync });
        this.isRunning = true;
        logger_1.default.info('Scheduler started with all jobs');
    }
    /**
     * Run full sync immediately
     */
    async runFullSync() {
        return this.runSyncJob('full', 'full');
    }
    /**
     * Run incremental sync immediately
     */
    async runIncrementalSync() {
        return this.runSyncJob('incremental', 'incremental');
    }
    /**
     * Execute a sync job with cluster locking
     */
    async runSyncJob(type, jobId) {
        const job = {
            id: jobId,
            type,
            startedAt: new Date(),
            addressesProcessed: 0,
            addressesUpdated: 0,
            errors: [],
            status: 'running',
        };
        this.jobs.set(jobId, job);
        // Try to acquire distributed lock (if cluster mode)
        if (this.cluster) {
            const lockAcquired = await this.cluster.acquireLock(`sync:${type}`);
            if (!lockAcquired) {
                logger_1.default.info(`Another instance is running ${type} sync, skipping`);
                job.status = 'completed';
                job.completedAt = new Date();
                job.errors.push('Skipped: another instance holds the lock');
                return job;
            }
        }
        logger_1.default.info(`Starting ${type} sync job`, { jobId, instanceId: config_1.config.cluster.instanceId });
        try {
            // Step 1: Collect data
            logger_1.default.info('Step 1: Collecting data from sources...');
            const rawData = await this.collector.collectAll();
            job.addressesProcessed = rawData.length;
            if (rawData.length === 0) {
                logger_1.default.warn('No data collected from any source');
                job.status = 'completed';
                job.completedAt = new Date();
                await this.releaseLock(type);
                return job;
            }
            // Step 2: Process data
            logger_1.default.info('Step 2: Processing raw data...');
            const profiles = this.processor.process(rawData);
            // Step 3: Partition addresses (if cluster mode)
            let profilesToProcess = profiles;
            if (this.cluster) {
                const addresses = profiles.map(p => p.address);
                const myPartition = await this.cluster.getAddressPartition(addresses);
                const myAddresses = new Set(myPartition);
                profilesToProcess = profiles.filter(p => myAddresses.has(p.address));
                logger_1.default.info(`Partitioned ${profiles.length} profiles to ${profilesToProcess.length} for this instance`);
            }
            // Step 4: Get on-chain data to filter for updates (only for incremental)
            let profilesToUpdate = profilesToProcess;
            if (type === 'incremental' && profilesToProcess.length > 0) {
                logger_1.default.info('Step 3: Checking on-chain state for incremental updates...');
                const addresses = profilesToProcess.map(p => p.address);
                const onChainData = await this.publisher.getOnChainData(addresses);
                profilesToUpdate = this.processor.filterForUpdate(profilesToProcess, onChainData);
                logger_1.default.info(`Filtered ${profilesToProcess.length} profiles to ${profilesToUpdate.length} needing updates`, {
                    skipped: profilesToProcess.length - profilesToUpdate.length,
                });
            }
            if (profilesToUpdate.length === 0) {
                logger_1.default.info('No profiles need updating, skipping publish');
                job.status = 'completed';
                job.completedAt = new Date();
                await this.releaseLock(type);
                return job;
            }
            // Step 5: Estimate gas and publish
            logger_1.default.info('Step 4: Publishing to blockchain...');
            const gasEstimate = await this.publisher.estimateGasCost(profilesToUpdate.length);
            logger_1.default.info(`Estimated gas cost: ${gasEstimate.eth} ETH`, gasEstimate);
            const results = await this.publisher.publish(profilesToUpdate);
            job.addressesUpdated = results.filter(r => r.status === 'success').length;
            const failures = results.filter(r => r.status === 'failed');
            for (const f of failures) {
                job.errors.push(f.error || 'Unknown error');
            }
            job.status = 'completed';
            job.completedAt = new Date();
            logger_1.default.info(`${type} sync completed`, {
                jobId,
                processed: job.addressesProcessed,
                updated: job.addressesUpdated,
                failed: failures.length,
                duration: job.completedAt.getTime() - job.startedAt.getTime(),
            });
        }
        catch (error) {
            job.status = 'failed';
            job.completedAt = new Date();
            job.errors.push(error.message);
            logger_1.default.error(`${type} sync failed`, {
                jobId,
                error: error.stack,
            });
        }
        finally {
            await this.releaseLock(type);
        }
        return job;
    }
    /**
     * Release lock if cluster mode
     */
    async releaseLock(type) {
        if (this.cluster) {
            try {
                await this.cluster.releaseLock(`sync:${type}`);
            }
            catch (err) {
                logger_1.default.error('Failed to release lock', { error: err.message });
            }
        }
    }
    /**
     * Get all jobs (running and historical)
     */
    getJobs() {
        return Array.from(this.jobs.values()).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }
    /**
     * Get a specific job by ID
     */
    getJob(id) {
        return this.jobs.get(id);
    }
    /**
     * Stop all scheduled jobs
     */
    stop() {
        for (const task of this.tasks) {
            task.stop();
        }
        this.tasks = [];
        this.isRunning = false;
        logger_1.default.info('Scheduler stopped');
    }
    /**
     * Check if scheduler is running
     */
    isActive() {
        return this.isRunning;
    }
}
exports.JobScheduler = JobScheduler;
exports.default = JobScheduler;
//# sourceMappingURL=scheduler.js.map