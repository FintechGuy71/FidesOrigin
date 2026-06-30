import { AppConfig, PublisherConfig } from './types';
/** FATF-specific configuration */
export interface FATFConfig {
    enabled: boolean;
    cron: string;
    blacklistUrl: string;
    greylistUrl: string;
    useFallback: boolean;
    ofacTimeout: number;
    /** Separate RiskRegistry proxy used by the FATF oracle (may differ from main publisher). */
    riskRegistryAddress: string;
    /** Private key for the FATF oracle account (ORACLE_ROLE deployer). */
    oraclePrivateKey?: string;
    /** Gas limit for FATF publish transactions. */
    gasLimit: number;
    /** Dry-run mode for the FATF pipeline. */
    dryRun: boolean;
}
export declare const config: AppConfig & {
    fatf: FATFConfig;
    publisher: PublisherConfig;
};
//# sourceMappingURL=config.d.ts.map