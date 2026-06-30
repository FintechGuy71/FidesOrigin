import { FATFCollector } from './fatf-collector';
import { OpenSanctionsCollector } from './opensanctions-collector';
import { AddressEnricher } from './address-enricher';
import { FATFPublisher } from './fatf-publisher';
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
export declare class FATFScheduler {
    private fatfCollector;
    private openSanctions;
    private enricher;
    private publisher?;
    private task?;
    private running;
    constructor(opts?: {
        fatfCollector?: FATFCollector;
        openSanctions?: OpenSanctionsCollector;
        enricher?: AddressEnricher;
        publisher?: FATFPublisher;
    });
    /**
     * Start the weekly cron job.
     */
    start(): void;
    /**
     * Stop the cron job.
     */
    stop(): void;
    /**
     * Execute the full FATF enrichment pipeline.
     * Can be called manually or via cron.
     */
    runPipeline(): Promise<void>;
    /**
     * Whether the pipeline is currently running.
     */
    isRunning(): boolean;
}
export default FATFScheduler;
//# sourceMappingURL=fatf-scheduler.d.ts.map