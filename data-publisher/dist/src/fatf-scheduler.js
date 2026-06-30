"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FATFScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const fatf_collector_1 = require("./fatf-collector");
const opensanctions_collector_1 = require("./opensanctions-collector");
const address_enricher_1 = require("./address-enricher");
const fatf_publisher_1 = require("./fatf-publisher");
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
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
class FATFScheduler {
    fatfCollector;
    openSanctions;
    enricher;
    publisher;
    task;
    running = false;
    constructor(opts) {
        this.fatfCollector = opts?.fatfCollector ?? new fatf_collector_1.FATFCollector({
            blacklistUrl: config_1.config.fatf.blacklistUrl,
            greylistUrl: config_1.config.fatf.greylistUrl,
            useFallback: config_1.config.fatf.useFallback,
        });
        this.openSanctions = opts?.openSanctions ?? new opensanctions_collector_1.OpenSanctionsCollector({ timeout: config_1.config.fatf.ofacTimeout });
        this.enricher = opts?.enricher ?? new address_enricher_1.AddressEnricher();
        this.publisher = opts?.publisher;
    }
    /**
     * Start the weekly cron job.
     */
    start() {
        if (!config_1.config.fatf.enabled) {
            logger_1.default.info('FATFScheduler: disabled via config, skipping');
            return;
        }
        const cronExpr = config_1.config.fatf.cron;
        logger_1.default.info('FATFScheduler: scheduling', { cron: cronExpr });
        this.task = node_cron_1.default.schedule(cronExpr, async () => {
            await this.runPipeline();
        }, {
            scheduled: true,
            timezone: 'UTC',
        });
        logger_1.default.info('FATFScheduler: started');
    }
    /**
     * Stop the cron job.
     */
    stop() {
        if (this.task) {
            this.task.stop();
            this.task = undefined;
        }
        this.running = false;
        logger_1.default.info('FATFScheduler: stopped');
    }
    /**
     * Execute the full FATF enrichment pipeline.
     * Can be called manually or via cron.
     */
    async runPipeline() {
        if (this.running) {
            logger_1.default.warn('FATFScheduler: pipeline already running, skipping');
            return;
        }
        this.running = true;
        const startedAt = Date.now();
        logger_1.default.info('═══════════════════════════════════════');
        logger_1.default.info('  FATF Pipeline — started');
        logger_1.default.info('═══════════════════════════════════════');
        try {
            // ─── Step 1: FATF country lists ───
            logger_1.default.info('[1/4] Collecting FATF country lists...');
            const fatfCountries = await this.fatfCollector.collectOnline();
            const blacklistCount = fatfCountries.filter(c => c.listType === 'blacklist').length;
            const greylistCount = fatfCountries.filter(c => c.listType === 'greylist').length;
            logger_1.default.info(`[1/4] FATF lists: ${blacklistCount} blacklist + ${greylistCount} greylist = ${fatfCountries.length} total`);
            // ─── Step 2: OpenSanctions OFAC SDN crypto entries ───
            logger_1.default.info('[2/4] Collecting OFAC SDN crypto addresses from OpenSanctions...');
            const ofacEntries = await this.openSanctions.collectCryptoAddresses();
            logger_1.default.info(`[2/4] OpenSanctions: ${ofacEntries.length} crypto-related entries`);
            if (ofacEntries.length === 0) {
                logger_1.default.warn('FATFScheduler: no OFAC crypto entries collected, aborting pipeline');
                return;
            }
            // ─── Step 3: Cross-reference enrichment ───
            logger_1.default.info('[3/4] Enriching addresses with FATF jurisdiction data...');
            const enrichments = this.enricher.enrich(ofacEntries, fatfCountries);
            const ethAddresses = [...enrichments.values()].filter(e => e.address.match(/^0x[0-9a-fA-F]{40}$/));
            const critical = ethAddresses.filter(e => e.boostedTier === 'CRITICAL').length;
            const high = ethAddresses.filter(e => e.boostedTier === 'HIGH').length;
            const medium = ethAddresses.filter(e => e.boostedTier === 'MEDIUM').length;
            logger_1.default.info(`[3/4] Enrichment complete: ${enrichments.size} total addresses`, {
                ethAddresses: ethAddresses.length,
                critical,
                high,
                medium,
            });
            if (ethAddresses.length === 0) {
                logger_1.default.warn('FATFScheduler: no Ethereum addresses to publish, aborting');
                return;
            }
            // ─── Step 4: Publish to RiskRegistry ───
            logger_1.default.info('[4/4] Publishing to RiskRegistry...');
            // Filter to only Ethereum addresses for on-chain publishing
            const ethEnrichments = new Map();
            for (const [addr, jur] of enrichments) {
                if (addr.match(/^0x[0-9a-fA-F]{40}$/)) {
                    ethEnrichments.set(addr, jur);
                }
            }
            if (!this.publisher) {
                // Initialise publisher on first run
                this.publisher = new fatf_publisher_1.FATFPublisher();
                await this.publisher.initialize();
            }
            const results = await this.publisher.publish(ethEnrichments);
            const success = results.filter(r => r.status === 'success' || r.status === 'dry-run').length;
            const failed = results.filter(r => r.status === 'failed').length;
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
            logger_1.default.info('═══════════════════════════════════════');
            logger_1.default.info('  FATF Pipeline — complete', {
                elapsed: `${elapsed}s`,
                totalAddresses: ethEnrichments.size,
                published: success,
                failed,
                critical,
                high,
                medium,
            });
            logger_1.default.info('═══════════════════════════════════════');
        }
        catch (error) {
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
            logger_1.default.error('FATFScheduler: pipeline FAILED', {
                error: error.stack,
                elapsed: `${elapsed}s`,
            });
        }
        finally {
            this.running = false;
        }
    }
    /**
     * Whether the pipeline is currently running.
     */
    isRunning() {
        return this.running;
    }
}
exports.FATFScheduler = FATFScheduler;
exports.default = FATFScheduler;
//# sourceMappingURL=fatf-scheduler.js.map