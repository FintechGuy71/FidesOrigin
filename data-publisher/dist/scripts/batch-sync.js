"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Batch Sync Script — entrypoint for K8s CronJob
 * Performs a one-shot full data sync and exits.
 */
const collector_1 = require("../src/collector");
const processor_1 = require("../src/processor");
const publisher_1 = require("../src/publisher");
const config_1 = require("../src/config");
const logger_1 = __importDefault(require("../src/logger"));
async function main() {
    logger_1.default.info('═══════════════════════════════════════════');
    logger_1.default.info('  FidesOrigin Batch Sync (one-shot)');
    logger_1.default.info('═══════════════════════════════════════════');
    const startTime = Date.now();
    try {
        const collector = new collector_1.DataCollector(config_1.config.dataSources);
        const processor = new processor_1.DataProcessor();
        const publisher = new publisher_1.BlockchainPublisher(config_1.config.publisher);
        await publisher.initialize();
        // Collect data from all enabled sources
        logger_1.default.info('Collecting data from sources...');
        const rawData = await collector.collectAll();
        logger_1.default.info(`Collected ${rawData.length} raw records`);
        // Process and deduplicate
        logger_1.default.info('Processing risk profiles...');
        const profiles = await processor.process(rawData);
        logger_1.default.info(`Processed ${profiles.length} unique profiles`);
        // Get on-chain state for delta
        logger_1.default.info('Fetching on-chain state...');
        const addresses = profiles.map(p => p.address);
        const onChainData = await publisher.getOnChainData(addresses);
        logger_1.default.info(`Found ${onChainData.size} existing on-chain profiles`);
        // Filter to only changed profiles
        const changedProfiles = profiles.filter(p => {
            const onChain = onChainData.get(p.address);
            if (!onChain)
                return true;
            return (onChain.score !== p.riskScore ||
                onChain.tier !== p.tier ||
                onChain.sanctioned !== p.isSanctioned);
        });
        logger_1.default.info(`${changedProfiles.length} profiles need updating`);
        if (changedProfiles.length === 0) {
            logger_1.default.info('No updates required — everything is up to date');
            process.exit(0);
        }
        // Publish updates
        logger_1.default.info('Publishing updates to blockchain...');
        const results = await publisher.publish(changedProfiles);
        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.filter(r => r.status === 'failed').length;
        const duration = (Date.now() - startTime) / 1000;
        logger_1.default.info('Batch sync complete', {
            total: results.length,
            success: successCount,
            failed: failedCount,
            durationSec: duration,
        });
        if (failedCount > 0) {
            process.exit(1);
        }
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error('Batch sync failed', { error: error.stack });
        process.exit(1);
    }
}
main();
//# sourceMappingURL=batch-sync.js.map