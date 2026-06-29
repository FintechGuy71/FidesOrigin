/**
 * Batch Sync Script — entrypoint for K8s CronJob
 * Performs a one-shot full data sync and exits.
 */
import { DataCollector } from '../src/collector';
import { DataProcessor } from '../src/processor';
import { BlockchainPublisher } from '../src/publisher';
import { config } from '../src/config';
import logger from '../src/logger';

async function main(): Promise<void> {
  logger.info('═══════════════════════════════════════════');
  logger.info('  FidesOrigin Batch Sync (one-shot)');
  logger.info('═══════════════════════════════════════════');

  const startTime = Date.now();

  try {
    const collector = new DataCollector(config.dataSources);
    const processor = new DataProcessor();
    const publisher = new BlockchainPublisher(config.publisher);

    await publisher.initialize();

    // Collect data from all enabled sources
    logger.info('Collecting data from sources...');
    const rawData = await collector.collectAll();
    logger.info(`Collected ${rawData.length} raw records`);

    // Process and deduplicate
    logger.info('Processing risk profiles...');
    const profiles = await processor.process(rawData);
    logger.info(`Processed ${profiles.length} unique profiles`);

    // Get on-chain state for delta
    logger.info('Fetching on-chain state...');
    const addresses = profiles.map(p => p.address);
    const onChainData = await publisher.getOnChainData(addresses);
    logger.info(`Found ${onChainData.size} existing on-chain profiles`);

    // Filter to only changed profiles
    const changedProfiles = profiles.filter(p => {
      const onChain = onChainData.get(p.address);
      if (!onChain) return true;
      return (
        onChain.score !== p.riskScore ||
        onChain.tier !== p.tier ||
        onChain.sanctioned !== p.isSanctioned
      );
    });

    logger.info(`${changedProfiles.length} profiles need updating`);

    if (changedProfiles.length === 0) {
      logger.info('No updates required — everything is up to date');
      process.exit(0);
    }

    // Publish updates
    logger.info('Publishing updates to blockchain...');
    const results = await publisher.publish(changedProfiles);

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const duration = (Date.now() - startTime) / 1000;

    logger.info('Batch sync complete', {
      total: results.length,
      success: successCount,
      failed: failedCount,
      durationSec: duration,
    });

    if (failedCount > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Batch sync failed', { error: (error as Error).stack });
    process.exit(1);
  }
}

main();
