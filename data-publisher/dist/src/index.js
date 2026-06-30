"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const collector_1 = require("./collector");
const processor_1 = require("./processor");
const publisher_1 = require("./publisher");
const scheduler_1 = require("./scheduler");
const monitor_1 = require("./monitor");
const cluster_coordinator_1 = require("./cluster-coordinator");
const fatf_scheduler_1 = require("./fatf-scheduler");
const batch_scheduler_1 = require("./batch-scheduler");
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
/**
 * FidesOrigin Data Publisher
 * Self-hosted on-chain data publishing service
 * Replaces Chainlink Functions with autonomous data pipeline
 */
async function main() {
    logger_1.default.info('═══════════════════════════════════════');
    logger_1.default.info('  FidesOrigin Data Publisher v1.0.0');
    logger_1.default.info('  Self-hosted on-chain compliance data');
    logger_1.default.info(`  Instance: ${config_1.config.cluster.instanceId}`);
    logger_1.default.info('═══════════════════════════════════════');
    let cluster;
    try {
        // Initialize cluster coordinator (if enabled)
        if (config_1.config.cluster.enabled) {
            logger_1.default.info('Cluster mode enabled, connecting to Redis...');
            cluster = new cluster_coordinator_1.ClusterCoordinator(config_1.config.cluster);
            await cluster.connect();
            cluster.startHeartbeat();
            logger_1.default.info('Cluster coordinator ready');
        }
        // Initialize components
        logger_1.default.info('Initializing components...');
        const collector = new collector_1.DataCollector(config_1.config.dataSources);
        const processor = new processor_1.DataProcessor();
        const publisher = new publisher_1.BlockchainPublisher(config_1.config.publisher);
        // Initialize publisher (connect wallet, verify role)
        await publisher.initialize();
        const scheduler = new scheduler_1.JobScheduler(collector, processor, publisher, cluster);
        const monitor = new monitor_1.MonitorServer(publisher);
        // Start monitoring server
        monitor.start();
        // Start scheduled jobs
        scheduler.start();
        // Start FATF pipeline (weekly)
        let fatfScheduler;
        if (config_1.config.fatf.enabled) {
            fatfScheduler = new fatf_scheduler_1.FATFScheduler();
            fatfScheduler.start();
            if (config_1.config.fatf.dryRun) {
                logger_1.default.info('Running FATF pipeline in dry-run mode for initial verification...');
                fatfScheduler.runPipeline().catch(err => {
                    logger_1.default.error('FATF initial pipeline failed', { error: err.stack });
                });
            }
        }
        // Start batch risk data sync (daily — OFAC + ScamSniffer)
        const batchSyncOpts = {
            incremental: process.env.BATCH_SYNC_INCREMENTAL === 'true',
            days: process.env.BATCH_SYNC_DAYS ? parseInt(process.env.BATCH_SYNC_DAYS, 10) : 7,
            dryRun: process.env.BATCH_SYNC_DRY_RUN === 'true' ? true : undefined,
        };
        const batchScheduler = new batch_scheduler_1.BatchScheduler(process.env.BATCH_SYNC_CRON || '30 3 * * *', batchSyncOpts);
        batchScheduler.start();
        // Graceful shutdown
        const shutdown = async (signal) => {
            logger_1.default.info(`Received ${signal}, shutting down gracefully...`);
            scheduler.stop();
            batchScheduler.stop();
            if (fatfScheduler)
                fatfScheduler.stop();
            monitor.stop();
            if (cluster) {
                await cluster.disconnect();
            }
            logger_1.default.info('Shutdown complete');
            process.exit(0);
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('uncaughtException', (err) => {
            logger_1.default.error('Uncaught exception', { error: err.stack });
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason) => {
            logger_1.default.error('Unhandled rejection', { reason });
        });
        logger_1.default.info('Data publisher ready and running');
        // If DRY_RUN, run a test sync immediately
        if (config_1.config.publisher.dryRun) {
            logger_1.default.info('Running test sync in dry-run mode...');
            await scheduler.runFullSync();
        }
    }
    catch (error) {
        logger_1.default.error('Failed to start data publisher', { error: error.stack });
        if (cluster) {
            await cluster.disconnect().catch(() => { });
        }
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map