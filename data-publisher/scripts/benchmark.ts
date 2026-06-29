import { ethers, Contract, AbstractSigner, JsonRpcProvider } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { createKeyManager } from '../src/kms-key-manager';

// ── RiskRegistry ABI (includes batch method for benchmarking) ─────────

const RISK_REGISTRY_ABI = [
  'function updateRiskProfile(address addr, uint256 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)',
  'function batchUpdateRiskProfiles(address[] addrs, uint8[] riskScores, uint8[] tiers, bool[] isSanctioned, bytes32[][] tags)',
  'function getRiskProfile(address addr) view returns (uint256 riskScore, address, uint32 lastUpdated, uint8 riskTier, uint8 sourceConfidence, bool sanctioned, bool exists)',
  'function riskProfiles(address) view returns (uint256, address, uint32, uint8, uint8, bool, bool)',
  'function isSanctioned(address addr) view returns (bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function ORACLE_ROLE() view returns (bytes32)',
  'function totalProfiles() view returns (uint256)',
];

// ── Benchmark Configuration ───────────────────────────────────────────

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

const DEFAULT_CONFIG: BenchmarkConfig = {
  rpcUrl: process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  riskRegistryAddress: process.env.RISK_REGISTRY_ADDRESS || '0x7ead67622f6A47318a55502634A429eF9dC5cebc',
  batchSizes: [1, 5, 10, 20, 50, 100],
  sampleAddresses: 100,
  iterationsPerBatch: 3,
  outputPath: path.join(__dirname, 'benchmark-report.csv'),
  dryRun: false,
};

// ── Benchmark Result Types ────────────────────────────────────────────

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

// ── Benchmark Runner ──────────────────────────────────────────────────

class BenchmarkRunner {
  private provider: JsonRpcProvider;
  private contract: Contract;
  private signer?: AbstractSigner;
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];
  private queryResults: QueryBenchmarkResult[] = [];
  private batchMethodCache?: boolean;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.provider = new JsonRpcProvider(this.config.rpcUrl, this.config.chainId);
    this.contract = new Contract(
      this.config.riskRegistryAddress,
      RISK_REGISTRY_ABI,
      this.provider
    );
  }

  async initialize(): Promise<void> {
    if (this.config.dryRun) {
      console.log('DRY RUN mode: skipping signer initialization');
      return;
    }

    try {
      const keyManager = await createKeyManager(this.provider);
      this.signer = await keyManager.getSigner();
      this.contract = this.contract.connect(this.signer) as Contract;

      const address = await this.signer.getAddress();
      console.log(`Benchmark runner initialized: ${address}`);

      // Verify ORACLE_ROLE
      const oracleRole = await this.contract.ORACLE_ROLE();
      const hasRole = await this.contract.hasRole(oracleRole, address);
      if (!hasRole) {
        console.warn('WARNING: Benchmark address does not have ORACLE_ROLE');
      }
    } catch (error) {
      console.error('Failed to initialize benchmark:', (error as Error).message);
      if (!this.config.dryRun) {
        throw error;
      }
      console.log('Continuing in query-only mode due to initialization failure...');
    }
  }

  /**
   * Generate deterministic test addresses (derived from env seed)
   * D1-AUDIT1-074 fix: use BENCHMARK_MNEMONIC env var instead of hardcoded public mnemonic
   */
  private generateTestAddresses(count: number): string[] {
    const addresses: string[] = [];
    const mnemonic = process.env.BENCHMARK_MNEMONIC;
    if (!mnemonic) {
      throw new Error(
        'BENCHMARK_MNEMONIC env var must be set. Use a dedicated test mnemonic — never reuse a production key.'
      );
    }
    for (let i = 0; i < count; i++) {
      const wallet = ethers.HDNodeWallet.fromPhrase(
        mnemonic,
        undefined,
        `m/44'/60'/0'/0/${i}`
      );
      addresses.push(wallet.address);
    }
    return addresses;
  }

  /**
   * Benchmark batchUpdateRiskProfiles with different batch sizes
   */
  async benchmarkBatchUpdate(): Promise<void> {
    if (this.config.dryRun) {
      console.log('\n[DRY RUN] Skipping batch update benchmark (would write to blockchain)');
      return;
    }
    if (!this.signer) {
      console.log('\n[SKIP] No signer available — skipping batch update benchmark');
      return;
    }

    console.log('\n═══════════════ Batch Update Benchmark ═══════════════');

    const addresses = this.generateTestAddresses(this.config.sampleAddresses);

    for (const batchSize of this.config.batchSizes) {
      console.log(`\n--- Batch Size: ${batchSize} ---`);

      for (let iter = 1; iter <= this.config.iterationsPerBatch; iter++) {
        const batchAddrs = addresses.slice(0, batchSize);
        const riskScores = batchAddrs.map(() => Math.floor(Math.random() * 100));
        const tiers = batchAddrs.map(() => Math.floor(Math.random() * 5));
        const sanctioned = batchAddrs.map(() => Math.random() > 0.8);

        const startTime = Date.now();
        let gasUsed = BigInt(0);
        let status: 'success' | 'failed' = 'success';
        let error: string | undefined;

        try {
          // Try batchUpdateRiskProfiles first (if contract supports it)
          const hasBatchMethod = await this.hasBatchMethod();

          if (hasBatchMethod && batchSize > 1) {
            const tagsBatch = batchAddrs.map(() => [ethers.encodeBytes32String('benchmark')]);
            const tx = await this.contract.batchUpdateRiskProfiles(
              batchAddrs,
              riskScores,
              tiers,
              sanctioned,
              tagsBatch
            );
            const receipt = await tx.wait(1);
            gasUsed = receipt.gasUsed;
          } else {
            // Fallback: simulate batch with sequential single updates
            for (let i = 0; i < batchAddrs.length; i++) {
              const tagsBytes32 = [ethers.encodeBytes32String('benchmark')];
              const tx = await this.contract.updateRiskProfile(
                batchAddrs[i],
                riskScores[i],
                tiers[i],
                tagsBytes32,
                sanctioned[i]
              );
              const receipt = await tx.wait(1);
              gasUsed += receipt.gasUsed;
            }
          }
        } catch (err) {
          status = 'failed';
          error = (err as Error).message;
          console.error(`  ❌ Failed (iter ${iter}): ${error}`);
        }

        const latencyMs = Date.now() - startTime;
        const feeData = await this.provider.getFeeData();
        const gasPriceGwei = feeData.maxFeePerGas
          ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei')
          : 'unknown';

        const result: BenchmarkResult = {
          testName: 'batchUpdateRiskProfiles',
          batchSize,
          iteration: iter,
          gasUsed,
          latencyMs,
          gasPriceGwei,
          status,
          error,
          timestamp: new Date().toISOString(),
        };

        this.results.push(result);

        if (status === 'success') {
          console.log(
            `  ✅ Iter ${iter}: gas=${gasUsed.toString()}, latency=${latencyMs}ms, gasPrice=${gasPriceGwei} gwei`
          );
        }

        // Rate limit between iterations
        if (iter < this.config.iterationsPerBatch) {
          await this.sleep(2000);
        }
      }
    }
  }

  /**
   * Benchmark RiskRegistry.isSanctioned() query latency
   */
  async benchmarkIsSanctionedQuery(): Promise<void> {
    console.log('\n═══════════════ isSanctioned Query Benchmark ═══════════════');

    const addresses = this.generateTestAddresses(50);
    const iterations = 100;
    const latencies: number[] = [];

    console.log(`Running ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
      const addr = addresses[i % addresses.length];
      const start = Date.now();

      try {
        await this.contract.isSanctioned(addr);
        latencies.push(Date.now() - start);
      } catch {
        // Ignore errors, just record latency
        latencies.push(Date.now() - start);
      }

      if ((i + 1) % 20 === 0) {
        process.stdout.write(` ${i + 1}/${iterations}`);
      }
    }
    console.log();

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    const result: QueryBenchmarkResult = {
      testName: 'isSanctioned',
      queryType: 'view',
      iterations,
      avgLatencyMs: parseFloat(avg.toFixed(2)),
      minLatencyMs: sorted[0],
      maxLatencyMs: sorted[sorted.length - 1],
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      timestamp: new Date().toISOString(),
    };

    this.queryResults.push(result);

    console.log(`  Avg: ${avg.toFixed(2)}ms | Min: ${sorted[0]}ms | Max: ${sorted[sorted.length - 1]}ms`);
    console.log(`  P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);
  }

  /**
   * Benchmark getRiskProfile query latency
   */
  async benchmarkGetRiskProfileQuery(): Promise<void> {
    console.log('\n═══════════════ getRiskProfile Query Benchmark ═══════════════');

    const addresses = this.generateTestAddresses(50);
    const iterations = 100;
    const latencies: number[] = [];

    console.log(`Running ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
      const addr = addresses[i % addresses.length];
      const start = Date.now();

      try {
        await this.contract.getRiskProfile(addr);
        latencies.push(Date.now() - start);
      } catch {
        latencies.push(Date.now() - start);
      }

      if ((i + 1) % 20 === 0) {
        process.stdout.write(` ${i + 1}/${iterations}`);
      }
    }
    console.log();

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    const result: QueryBenchmarkResult = {
      testName: 'getRiskProfile',
      queryType: 'view',
      iterations,
      avgLatencyMs: parseFloat(avg.toFixed(2)),
      minLatencyMs: sorted[0],
      maxLatencyMs: sorted[sorted.length - 1],
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      timestamp: new Date().toISOString(),
    };

    this.queryResults.push(result);

    console.log(`  Avg: ${avg.toFixed(2)}ms | Min: ${sorted[0]}ms | Max: ${sorted[sorted.length - 1]}ms`);
    console.log(`  P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);
  }

  /**
   * Check if contract supports batchUpdateRiskProfiles (cached after first call).
   */
  private async hasBatchMethod(): Promise<boolean> {
    if (this.batchMethodCache !== undefined) {
      return this.batchMethodCache;
    }
    try {
      const iface = new ethers.Interface(RISK_REGISTRY_ABI);
      const selector = iface.getFunction('batchUpdateRiskProfiles')!.selector;
      const code = await this.provider.getCode(this.config.riskRegistryAddress);
      this.batchMethodCache = code.includes(selector.slice(2));
      return this.batchMethodCache;
    } catch {
      this.batchMethodCache = false;
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines.
   * Double-up any internal quotes.
   */
  private escapeCsv(value: string | number | bigint | undefined): string {
    const str = value === undefined ? '' : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Generate and write CSV report
   */
  generateReport(): string {
    const lines: string[] = [];
    const now = new Date().toISOString();

    // Metadata header
    lines.push('# FidesOrigin Benchmark Report');
    lines.push(`# Generated: ${now}`);
    lines.push(`# RPC: ${this.config.rpcUrl}`);
    lines.push(`# Contract: ${this.config.riskRegistryAddress}`);
    lines.push(`# Mode: ${this.config.dryRun ? 'dry-run' : 'live'}`);
    lines.push('#');
    lines.push('');

    // ── Section 1: Batch Update Results ───────────────────────────────
    lines.push('testName,batchSize,iteration,status,gasUsed,latencyMs,gasPriceGwei,error,timestamp');

    for (const r of this.results) {
      lines.push(
        [
          this.escapeCsv(r.testName),
          this.escapeCsv(r.batchSize),
          this.escapeCsv(r.iteration),
          this.escapeCsv(r.status),
          this.escapeCsv(r.gasUsed.toString()),
          this.escapeCsv(r.latencyMs),
          this.escapeCsv(r.gasPriceGwei),
          this.escapeCsv(r.error),
          this.escapeCsv(r.timestamp),
        ].join(',')
      );
    }

    // ── Summary by batch size ────────────────────────────────────────
    lines.push('');
    lines.push('batchSize,avgGasUsed,avgLatencyMs,minLatencyMs,maxLatencyMs,successRate');

    const batchSizes = [...new Set(this.results.map(r => r.batchSize))];
    for (const bs of batchSizes.sort((a, b) => a - b)) {
      const batchResults = this.results.filter(r => r.batchSize === bs);
      const successful = batchResults.filter(r => r.status === 'success');
      const avgGas = successful.length > 0
        ? successful.reduce((sum, r) => sum + Number(r.gasUsed), 0) / successful.length
        : 0;
      const avgLatency = successful.length > 0
        ? successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length
        : 0;
      const minLatency = successful.length > 0
        ? Math.min(...successful.map(r => r.latencyMs))
        : 0;
      const maxLatency = successful.length > 0
        ? Math.max(...successful.map(r => r.latencyMs))
        : 0;
      const successRate = (successful.length / batchResults.length) * 100;

      lines.push(
        [
          this.escapeCsv(bs),
          this.escapeCsv(Math.round(avgGas)),
          this.escapeCsv(Math.round(avgLatency)),
          this.escapeCsv(minLatency),
          this.escapeCsv(maxLatency),
          this.escapeCsv(successRate.toFixed(1) + '%'),
        ].join(',')
      );
    }

    // ── Section 2: Query Results ──────────────────────────────────────
    lines.push('');
    lines.push('testName,queryType,iterations,avgLatencyMs,minLatencyMs,maxLatencyMs,p50LatencyMs,p95LatencyMs,p99LatencyMs,timestamp');

    for (const r of this.queryResults) {
      lines.push(
        [
          this.escapeCsv(r.testName),
          this.escapeCsv(r.queryType),
          this.escapeCsv(r.iterations),
          this.escapeCsv(r.avgLatencyMs),
          this.escapeCsv(r.minLatencyMs),
          this.escapeCsv(r.maxLatencyMs),
          this.escapeCsv(r.p50LatencyMs),
          this.escapeCsv(r.p95LatencyMs),
          this.escapeCsv(r.p99LatencyMs),
          this.escapeCsv(r.timestamp),
        ].join(',')
      );
    }

    // ── Section 3: Gas Cost Analysis ──────────────────────────────────
    lines.push('');
    lines.push('batchSize,avgGasPerTx,avgGasPerAddress,estimatedCostEth (at 20 gwei)');

    for (const bs of batchSizes.sort((a, b) => a - b)) {
      const batchResults = this.results.filter(r => r.batchSize === bs && r.status === 'success');
      if (batchResults.length === 0) continue;
      const avgGas = batchResults.reduce((sum, r) => sum + Number(r.gasUsed), 0) / batchResults.length;
      const gasPerAddr = avgGas / bs;
      const costEth = (avgGas * 20e9) / 1e18; // at 20 gwei
      lines.push(
        [
          this.escapeCsv(bs),
          this.escapeCsv(Math.round(avgGas)),
          this.escapeCsv(gasPerAddr.toFixed(0)),
          this.escapeCsv(costEth.toFixed(6)),
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  async run(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║     FidesOrigin Performance Benchmark Suite           ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log(`RPC: ${this.config.rpcUrl}`);
    console.log(`Contract: ${this.config.riskRegistryAddress}`);
    console.log(`Batch sizes: [${this.config.batchSizes.join(', ')}]`);
    console.log(`Iterations per batch: ${this.config.iterationsPerBatch}`);
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);

    try {
      await this.initialize();
    } catch (error) {
      console.error('Failed to initialize benchmark:', (error as Error).message);
      console.error('Continuing in dry-run mode (queries only)...');
    }

    if (this.signer) {
      await this.benchmarkBatchUpdate();
    }

    await this.benchmarkIsSanctionedQuery();
    await this.benchmarkGetRiskProfileQuery();

    const report = this.generateReport();
    fs.writeFileSync(this.config.outputPath, report, 'utf-8');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`Report saved to: ${this.config.outputPath}`);
    console.log('═══════════════════════════════════════════════════════');
  }
}

// ── CLI Entrypoint ────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const config: Partial<BenchmarkConfig> = {};

  for (let i = 0; i < args.length; i += 2) {
    switch (args[i]) {
      case '--rpc':
        config.rpcUrl = args[i + 1];
        break;
      case '--contract':
        config.riskRegistryAddress = args[i + 1];
        break;
      case '--batch-sizes':
        config.batchSizes = args[i + 1].split(',').map(Number);
        break;
      case '--iterations':
        config.iterationsPerBatch = parseInt(args[i + 1]);
        break;
      case '--output':
        config.outputPath = args[i + 1];
        break;
      case '--dry-run':
        config.dryRun = true;
        i -= 1; // no value for this flag
        break;
    }
  }

  const runner = new BenchmarkRunner(config);
  await runner.run();
}

if (require.main === module) {
  main().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
  });
}

export { BenchmarkRunner, BenchmarkConfig, BenchmarkResult, QueryBenchmarkResult };
