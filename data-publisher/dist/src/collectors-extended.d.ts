import { DataSourceConfig, RawRiskData } from './types';
/**
 * Extended Data Collectors — additional sources beyond the base set
 */
export declare function fetchElliptic(config: DataSourceConfig): Promise<RawRiskData[]>;
export declare function fetchTRMLabs(config: DataSourceConfig): Promise<RawRiskData[]>;
export declare function fetchCSV(config: DataSourceConfig): Promise<RawRiskData[]>;
export declare function fetchJSON(config: DataSourceConfig): Promise<RawRiskData[]>;
export declare function getFlashbotsProvider(rpcUrl: string): string;
//# sourceMappingURL=collectors-extended.d.ts.map