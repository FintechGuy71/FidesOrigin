import { DataCollector } from './collector';
import { DataProcessor } from './processor';
import { BlockchainPublisher } from './publisher';
import { JobScheduler } from './scheduler';
import { MonitorServer } from './monitor';
import { ClusterCoordinator } from './cluster-coordinator';
import { FATFScheduler } from './fatf-scheduler';
import { BatchScheduler } from './batch-scheduler';
import { config } from './config';
import logger from './logger';

/**
 * FidesOrigin Data Publisher
 * Self-hosted on-chain data publishing service
 * Replaces Chainlink Functions with autonomous data pipeline
 */
async function main(): Promise<void> {
  logger.info('═══════════════════════════════════════');
  logger.info('  FidesOrigin Data Publisher v1.0.0');
  logger.info('  Self-hosted on-chain compliance data');
  logger.info(`  Instance: ${config.cluster.instanceId}`);
  logger.info('═══════════════════════════════════════');

  let cluster: ClusterCoordinator | undefined;

  try {
    // Initialize cluster coordinator (if enabled)
    if (config.cluster.enabled) {
      logger.info('Cluster mode enabled, connecting to Redis...');
      cluster = new ClusterCoordinator(config.cluster);
      await cluster.connect();
      cluster.startHeartbeat();
      logger.info('Cluster coordinator ready');
    }

    // Initialize components
    logger.info('Initializing components...');

    const collector = new DataCollector(config.dataSources);
    const processor = new DataProcessor();
    const publisher = new BlockchainPublisher(config.publisher);

    // Initialize publisher (connect wallet, verify role)
    await publisher.initialize();

    const scheduler = new JobScheduler(collector, processor, publisher, cluster);
    const monitor = new MonitorServer(publisher);

    // Start monitoring server
    monitor.start();

    // Start scheduled jobs
    scheduler.start();

    // Start FATF pipeline (weekly)
    let fatfScheduler: FATFScheduler | undefined;
    if (config.fatf.enabled) {
      fatfScheduler = new FATFScheduler();
      fatfScheduler.start();

      if (config.fatf.dryRun) {
        logger.info('Running FATF pipeline in dry-run mode for initial verification...');
        fatfScheduler.runPipeline().catch(err => {
          logger.error('FATF initial pipeline failed', { error: (err as Error).stack });
        });
      }
    }

    // Start batch risk data sync (daily — OFAC + ScamSniffer)
    const batchSyncOpts = {
      incremental: process.env.BATCH_SYNC_INCREMENTAL === 'true',
      days: process.env.BATCH_SYNC_DAYS ? parseInt(process.env.BATCH_SYNC_DAYS, 10) : 7,
      dryRun: process.env.BATCH_SYNC_DRY_RUN === 'true' ? true : undefined,
    };
    const batchScheduler = new BatchScheduler(
      process.env.BATCH_SYNC_CRON || '30 3 * * *',
      batchSyncOpts
    );
    batchScheduler.start();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      scheduler.stop();
      batchScheduler.stop();
      if (fatfScheduler) fatfScheduler.stop();
      monitor.stop();
      if (cluster) {
        await cluster.disconnect();
      }
      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err.stack });
      // [FIX] Use process.exitCode instead of process.exit(1) to allow async cleanup
      process.exitCode = 1;
      // Attempt best-effort synchronous cleanup
      try {
        scheduler.stop();
        batchScheduler.stop();
        if (fatfScheduler) fatfScheduler.stop();
        monitor.stop();
      } catch (cleanupErr) {
        logger.error('Sync cleanup failed during uncaughtException', { error: (cleanupErr as Error).message });
      }
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      // [Audit-Fix #23] Call shutdown before exiting instead of raw process.exit(1).
      // This allows pending HTTP responses to complete, connections to close, and
      // cluster state to be cleaned up before the process terminates.
      shutdown('unhandledRejection').finally(() => {
        process.exit(1);
      });
    });

    logger.info('Data publisher ready and running');

    // If DRY_RUN, run a test sync immediately
    if (config.publisher.dryRun) {
      logger.info('Running test sync in dry-run mode...');
      await scheduler.runFullSync();
    }

  } catch (error) {
    logger.error('Failed to start data publisher', { error: (error as Error).stack });
    if (cluster) {
      await cluster.disconnect().catch(() => {});
    }
    process.exit(1);
  }
}

main();
