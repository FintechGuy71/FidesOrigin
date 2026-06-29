import cron from 'node-cron';
import { runBatchSync, BatchSyncOptions } from './batch-collector';
import logger from './logger';

/**
 * Batch Risk Data Scheduler
 * Runs daily delta sync of OFAC + ScamSniffer using batchUpdateRiskProfiles.
 * Replaces the slow per-address sync with 100-address batches (~2 min vs 9 hours).
 */
export class BatchScheduler {
  private task?: cron.ScheduledTask;
  private isRunning: boolean = false;
  private cronExpression: string;
  private syncOptions: BatchSyncOptions;

  constructor(cronExpression: string = '30 3 * * *', syncOptions: BatchSyncOptions = {}) {
    this.cronExpression = cronExpression;
    this.syncOptions = syncOptions;
  }

  start(): void {
    if (this.task) {
      logger.warn('BatchScheduler already running');
      return;
    }

    this.task = cron.schedule(this.cronExpression, async () => {
      if (this.isRunning) {
        logger.warn('Batch sync already in progress, skipping');
        return;
      }
      this.isRunning = true;
      try {
        const result = await runBatchSync(this.syncOptions);
        logger.info(
          `Batch sync finished: ${result.published} published, ${result.failed} failed`,
          { totalNew: result.totalNew, published: result.published, failed: result.failed, sources: result.sources }
        );
      } catch (e: any) {
        logger.error(`Batch sync failed: ${e.message}`, { error: (e as Error).stack });
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai',
    });

    this.task.start();
    logger.info(`BatchScheduler started: ${this.cronExpression}`, { cron: this.cronExpression });
  }

  stop(): void {
    this.task?.stop();
    this.task = undefined;
    logger.info('BatchScheduler stopped');
  }

  get isActive(): boolean {
    return !!this.task;
  }
}
