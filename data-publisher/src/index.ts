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

    // Start RiskOracle deferred count monitoring
    publisher.startDeferredCountReporting(monitor);

    // data-sync owns scheduled sanctions/Merkle writes when this is disabled.
    // Queue-driven risk updates remain active in either mode.
    if (config.scheduler.enabled) scheduler.start();

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

    let batchScheduler: BatchScheduler | undefined;
    if (config.batchSync.enabled) {
      const batchSyncOpts = {
        incremental: process.env.BATCH_SYNC_INCREMENTAL === 'true',
        days: process.env.BATCH_SYNC_DAYS ? parseInt(process.env.BATCH_SYNC_DAYS, 10) : 7,
        dryRun: process.env.BATCH_SYNC_DRY_RUN === 'true' ? true : undefined,
      };
      batchScheduler = new BatchScheduler(
        process.env.BATCH_SYNC_CRON || '30 3 * * *',
        batchSyncOpts
      );
      batchScheduler.start();
    }

    let shuttingDown = false;
    const shutdown = async (signal: string, exitCode: number = 0) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);
      scheduler.stop();
      batchScheduler?.stop();
      if (fatfScheduler) fatfScheduler.stop();
      monitor.stop();
      await publisher.close().catch(err => {
        logger.error('Publisher cleanup failed', { error: (err as Error).message });
      });
      if (cluster) {
        await cluster.disconnect();
      }
      logger.info('Shutdown complete');
      process.exit(exitCode);
    };

    process.on('SIGINT', () => { void shutdown('SIGINT'); });
    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err.stack });
      // Never leave a half-alive process with its monitor closed and cron still active.
      void shutdown('uncaughtException', 1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      void shutdown('unhandledRejection', 1);
    });

    logger.info('Data publisher ready and running');

    // If DRY_RUN, run a test sync immediately when scheduled collection is enabled.
    if (config.publisher.dryRun && config.scheduler.enabled) {
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
