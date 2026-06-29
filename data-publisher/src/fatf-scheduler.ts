import cron from 'node-cron';
import { FATFCollector } from './fatf-collector';
import { OpenSanctionsCollector } from './opensanctions-collector';
import { AddressEnricher } from './address-enricher';
import { FATFPublisher } from './fatf-publisher';
import { config } from './config';
import logger from './logger';

/**
 * FATFScheduler — weekly orchestrator for the full FATF pipeline:
 *
 *  1. FATFCollector.collect()           — country-level risk lists
 *  2. OpenSanctionsCollector             — address-level OFAC SDN crypto entries
 *  3. AddressEnricher.enrich()          — cross-reference → boosted tiers
 *  4. FATFPublisher.publish()           — write on-chain
 *
 * Cron: every Monday at 03:17 UTC (`17 3 * * 1`).
 */
export class FATFScheduler {
  private fatfCollector: FATFCollector;
  private openSanctions: OpenSanctionsCollector;
  private enricher: AddressEnricher;
  private publisher?: FATFPublisher;
  private task?: cron.ScheduledTask;
  private running = false;

  constructor(opts?: {
    fatfCollector?: FATFCollector;
    openSanctions?: OpenSanctionsCollector;
    enricher?: AddressEnricher;
    publisher?: FATFPublisher;
  }) {
    this.fatfCollector = opts?.fatfCollector ?? new FATFCollector({
      blacklistUrl: config.fatf.blacklistUrl,
      greylistUrl: config.fatf.greylistUrl,
      useFallback: config.fatf.useFallback,
    });
    this.openSanctions = opts?.openSanctions ?? new OpenSanctionsCollector({ timeout: config.fatf.ofacTimeout });
    this.enricher = opts?.enricher ?? new AddressEnricher();
    this.publisher = opts?.publisher;
  }

  /**
   * Start the weekly cron job.
   */
  start(): void {
    if (!config.fatf.enabled) {
      logger.info('FATFScheduler: disabled via config, skipping');
      return;
    }

    const cronExpr = config.fatf.cron;
    logger.info('FATFScheduler: scheduling', { cron: cronExpr });

    this.task = cron.schedule(cronExpr, async () => {
      await this.runPipeline();
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    logger.info('FATFScheduler: started');
  }

  /**
   * Stop the cron job.
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = undefined;
    }
    this.running = false;
    logger.info('FATFScheduler: stopped');
  }

  /**
   * Execute the full FATF enrichment pipeline.
   * Can be called manually or via cron.
   */
  async runPipeline(): Promise<void> {
    if (this.running) {
      logger.warn('FATFScheduler: pipeline already running, skipping');
      return;
    }

    this.running = true;
    const startedAt = Date.now();

    logger.info('═══════════════════════════════════════');
    logger.info('  FATF Pipeline — started');
    logger.info('═══════════════════════════════════════');

    try {
      // ─── Step 1: FATF country lists ───
      logger.info('[1/4] Collecting FATF country lists...');
      const fatfCountries = await this.fatfCollector.collectOnline();
      const blacklistCount = fatfCountries.filter(c => c.listType === 'blacklist').length;
      const greylistCount = fatfCountries.filter(c => c.listType === 'greylist').length;
      logger.info(`[1/4] FATF lists: ${blacklistCount} blacklist + ${greylistCount} greylist = ${fatfCountries.length} total`);

      // ─── Step 2: OpenSanctions OFAC SDN crypto entries ───
      logger.info('[2/4] Collecting OFAC SDN crypto addresses from OpenSanctions...');
      const ofacEntries = await this.openSanctions.collectCryptoAddresses();
      logger.info(`[2/4] OpenSanctions: ${ofacEntries.length} crypto-related entries`);

      if (ofacEntries.length === 0) {
        logger.warn('FATFScheduler: no OFAC crypto entries collected, aborting pipeline');
        return;
      }

      // ─── Step 3: Cross-reference enrichment ───
      logger.info('[3/4] Enriching addresses with FATF jurisdiction data...');
      const enrichments = this.enricher.enrich(ofacEntries, fatfCountries);
      const ethAddresses = [...enrichments.values()].filter(e => e.address.match(/^0x[0-9a-fA-F]{40}$/));

      const critical = ethAddresses.filter(e => e.boostedTier === 'CRITICAL').length;
      const high = ethAddresses.filter(e => e.boostedTier === 'HIGH').length;
      const medium = ethAddresses.filter(e => e.boostedTier === 'MEDIUM').length;

      logger.info(`[3/4] Enrichment complete: ${enrichments.size} total addresses`, {
        ethAddresses: ethAddresses.length,
        critical,
        high,
        medium,
      });

      if (ethAddresses.length === 0) {
        logger.warn('FATFScheduler: no Ethereum addresses to publish, aborting');
        return;
      }

      // ─── Step 4: Publish to RiskRegistry ───
      logger.info('[4/4] Publishing to RiskRegistry...');

      // Filter to only Ethereum addresses for on-chain publishing
      const ethEnrichments = new Map<string, typeof ethAddresses[0]>();
      for (const [addr, jur] of enrichments) {
        if (addr.match(/^0x[0-9a-fA-F]{40}$/)) {
          ethEnrichments.set(addr, jur);
        }
      }

      if (!this.publisher) {
        // Initialise publisher on first run
        this.publisher = new FATFPublisher();
        await this.publisher.initialize();
      }

      const results = await this.publisher.publish(ethEnrichments);
      const success = results.filter(r => r.status === 'success' || r.status === 'dry-run').length;
      const failed = results.filter(r => r.status === 'failed').length;

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      logger.info('═══════════════════════════════════════');
      logger.info('  FATF Pipeline — complete', {
        elapsed: `${elapsed}s`,
        totalAddresses: ethEnrichments.size,
        published: success,
        failed,
        critical,
        high,
        medium,
      });
      logger.info('═══════════════════════════════════════');

    } catch (error) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      logger.error('FATFScheduler: pipeline FAILED', {
        error: (error as Error).stack,
        elapsed: `${elapsed}s`,
      });
    } finally {
      this.running = false;
    }
  }

  /**
   * Whether the pipeline is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }
}

export default FATFScheduler;
