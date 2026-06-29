import cron from 'node-cron';
import { DataCollector } from './collector';
import { DataProcessor } from './processor';
import { BlockchainPublisher } from './publisher';
import { ClusterCoordinator } from './cluster-coordinator';
import { SyncJob, RiskProfile } from './types';
import { config } from './config';
import logger from './logger';

/**
 * Job Scheduler — orchestrates data collection, processing, and publishing
 * With cluster support: uses distributed locks to prevent duplicate syncs
 */
export class JobScheduler {
  private collector: DataCollector;
  private processor: DataProcessor;
  private publisher: BlockchainPublisher;
  private cluster?: ClusterCoordinator;
  private jobs: Map<string, SyncJob> = new Map();
  private tasks: cron.ScheduledTask[] = [];
  private isRunning: boolean = false;
  private localLock: boolean = false;

  constructor(
    collector: DataCollector, 
    processor: DataProcessor, 
    publisher: BlockchainPublisher,
    cluster?: ClusterCoordinator
  ) {
    this.collector = collector;
    this.processor = processor;
    this.publisher = publisher;
    this.cluster = cluster;
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    // Full sync job
    const fullSyncTask = cron.schedule(config.scheduler.fullSync, async () => {
      await this.runFullSync();
    }, {
      scheduled: false,
      timezone: 'UTC',
    });
    this.tasks.push(fullSyncTask);
    fullSyncTask.start();
    logger.info('Full sync scheduled', { cron: config.scheduler.fullSync });

    // Incremental sync job
    const incrementalTask = cron.schedule(config.scheduler.incrementalSync, async () => {
      await this.runIncrementalSync();
    }, {
      scheduled: false,
      timezone: 'UTC',
    });
    this.tasks.push(incrementalTask);
    incrementalTask.start();
    logger.info('Incremental sync scheduled', { cron: config.scheduler.incrementalSync });

    this.isRunning = true;
    logger.info('Scheduler started with all jobs');
  }

  /**
   * Run full sync immediately
   */
  async runFullSync(): Promise<SyncJob> {
    return this.runSyncJob('full', 'full');
  }

  /**
   * Run incremental sync immediately
   */
  async runIncrementalSync(): Promise<SyncJob> {
    return this.runSyncJob('incremental', 'incremental');
  }

  /**
   * Execute a sync job with cluster locking
   */
  private async runSyncJob(type: 'full' | 'incremental', jobId: string): Promise<SyncJob> {
    if (this.localLock) {
      logger.warn('Sync already in progress, skipping');
      return { id: jobId, type, startedAt: new Date(), addressesProcessed: 0, addressesUpdated: 0, errors: ['Skipped: another sync is already running'], status: 'skipped' };
    }
    this.localLock = true;
    const uniqueJobId = `${type}-${Date.now()}`;
    const job: SyncJob = {
      id: uniqueJobId,
      type,
      startedAt: new Date(),
      addressesProcessed: 0,
      addressesUpdated: 0,
      errors: [],
      status: 'running',
    };

    this.jobs.set(jobId, job);
    // [Fix] Prevent unbounded memory growth: keep only last 100 jobs
    const jobKeys = Array.from(this.jobs.keys());
    if (jobKeys.length > 100) {
      const toRemove = jobKeys.slice(0, jobKeys.length - 100);
      for (const key of toRemove) {
        this.jobs.delete(key);
      }
    }

    // Try to acquire distributed lock (if cluster mode)
    if (this.cluster) {
      const lockAcquired = await this.cluster.acquireLock(`sync:${type}`);
      if (!lockAcquired) {
        logger.info(`Another instance is running ${type} sync, skipping`);
        job.status = 'skipped';
        job.completedAt = new Date();
        job.errors.push('Skipped: another instance holds the lock');
        return job;
      }
    }

    logger.info(`Starting ${type} sync job`, { jobId, instanceId: config.cluster.instanceId });

    try {
      // Step 1: Collect data
      logger.info('Step 1: Collecting data from sources...');
      const rawData = await this.collector.collectAll();
      job.addressesProcessed = rawData.length;

      if (rawData.length === 0) {
        logger.warn('No data collected from any source');
        job.status = 'completed';
        job.completedAt = new Date();
        await this.releaseLock(type);
        return job;
      }

      // Step 2: Process data
      logger.info('Step 2: Processing raw data...');
      const profiles = this.processor.process(rawData);

      // Step 3: Partition addresses (if cluster mode)
      let profilesToProcess = profiles;
      if (this.cluster) {
        const addresses = profiles.map(p => p.address);
        const myPartition = await this.cluster.getAddressPartition(addresses);
        const myAddresses = new Set(myPartition);
        profilesToProcess = profiles.filter(p => myAddresses.has(p.address));
        
        logger.info(`Partitioned ${profiles.length} profiles to ${profilesToProcess.length} for this instance`);
      }

      // Step 4: Get on-chain data to filter for updates (only for incremental)
      let profilesToUpdate: RiskProfile[] = profilesToProcess;
      
      if (type === 'incremental' && profilesToProcess.length > 0) {
        logger.info('Step 3: Checking on-chain state for incremental updates...');
        const addresses = profilesToProcess.map(p => p.address);
        const onChainData = await this.publisher.getOnChainData(addresses);
        profilesToUpdate = this.processor.filterForUpdate(profilesToProcess, onChainData);
        
        logger.info(`Filtered ${profilesToProcess.length} profiles to ${profilesToUpdate.length} needing updates`, {
          skipped: profilesToProcess.length - profilesToUpdate.length,
        });
      }

      if (profilesToUpdate.length === 0) {
        logger.info('No profiles need updating, skipping publish');
        job.status = 'completed';
        job.completedAt = new Date();
        await this.releaseLock(type);
        return job;
      }

      // Step 5: Estimate gas and publish
      logger.info('Step 4: Publishing to blockchain...');
      const gasEstimate = await this.publisher.estimateGasCost(profilesToUpdate.length);
      logger.info(`Estimated gas cost: ${gasEstimate.eth} ETH`, gasEstimate);

      const results = await this.publisher.publish(profilesToUpdate);
      
      job.addressesUpdated = results.filter(r => r.status === 'success').length;
      const failures = results.filter(r => r.status === 'failed');
      
      for (const f of failures) {
        job.errors.push(f.error || 'Unknown error');
      }

      job.status = 'completed';
      job.completedAt = new Date();
      
      logger.info(`${type} sync completed`, {
        jobId,
        processed: job.addressesProcessed,
        updated: job.addressesUpdated,
        failed: failures.length,
        duration: job.completedAt.getTime() - job.startedAt.getTime(),
      });

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors.push((error as Error).message);
      
      logger.error(`${type} sync failed`, {
        jobId,
        error: (error as Error).stack,
      });
    } finally {
      this.localLock = false;
      await this.releaseLock(type);
    }

    return job;
  }

  /**
   * Release lock if cluster mode
   */
  private async releaseLock(type: string): Promise<void> {
    if (this.cluster) {
      try {
        await this.cluster.releaseLock(`sync:${type}`);
      } catch (err) {
        logger.error('Failed to release lock', { error: (err as Error).message });
      }
    }
  }

  /**
   * Get all jobs (running and historical)
   */
  getJobs(): SyncJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      b.startedAt.getTime() - a.startedAt.getTime()
    );
  }

  /**
   * Get a specific job by ID
   */
  getJob(id: string): SyncJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export default JobScheduler;
