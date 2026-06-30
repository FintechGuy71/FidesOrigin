interface BenchmarkConfig {
    rpcUrl: string;
    chainId: number;
    riskRegistryAddress: string;
    batchSizes: number[];
    sampleAddresses: number;
    iterationsPerBatch: number;
    outputPath: string;
    dryRun: boolean;
}
interface BenchmarkResult {
    testName: string;
    batchSize: number;
    iteration: number;
    gasUsed: bigint;
    latencyMs: number;
    gasPriceGwei: string;
    status: 'success' | 'failed';
    error?: string;
    timestamp: string;
}
interface QueryBenchmarkResult {
    testName: string;
    queryType: string;
    iterations: number;
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    timestamp: string;
}
declare class BenchmarkRunner {
    private provider;
    private contract;
    private signer?;
    private config;
    private results;
    private queryResults;
    private batchMethodCache?;
    constructor(config?: Partial<BenchmarkConfig>);
    initialize(): Promise<void>;
    /**
     * Generate deterministic test addresses (derived from a seed)
     */
    private generateTestAddresses;
    /**
     * Benchmark batchUpdateRiskProfiles with different batch sizes
     */
    benchmarkBatchUpdate(): Promise<void>;
    /**
     * Benchmark RiskRegistry.isSanctioned() query latency
     */
    benchmarkIsSanctionedQuery(): Promise<void>;
    /**
     * Benchmark getRiskProfile query latency
     */
    benchmarkGetRiskProfileQuery(): Promise<void>;
    /**
     * Check if contract supports batchUpdateRiskProfiles (cached after first call).
     */
    private hasBatchMethod;
    private sleep;
    /**
     * Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines.
     * Double-up any internal quotes.
     */
    private escapeCsv;
    /**
     * Generate and write CSV report
     */
    generateReport(): string;
    run(): Promise<void>;
}
export { BenchmarkRunner, BenchmarkConfig, BenchmarkResult, QueryBenchmarkResult };
//# sourceMappingURL=benchmark.d.ts.map