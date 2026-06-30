"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkRunner = void 0;
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const kms_key_manager_1 = require("../src/kms-key-manager");
// ── RiskRegistry ABI (includes batch method for benchmarking) ─────────
const RISK_REGISTRY_ABI = [
    'function updateRiskProfile(address addr, uint256 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)',
    'function batchUpdateRiskProfiles(address[] addrs, uint256[] riskScores, uint8[] tiers, bool[] isSanctioned)',
    'function getRiskProfile(address addr) view returns (uint256 riskScore, address, uint32 lastUpdated, uint8 riskTier, uint8 sourceConfidence, bool sanctioned, bool exists)',
    'function riskProfiles(address) view returns (uint256, address, uint32, uint8, uint8, bool, bool)',
    'function isSanctioned(address addr) view returns (bool)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function ORACLE_ROLE() view returns (bytes32)',
    'function totalProfiles() view returns (uint256)',
];
const DEFAULT_CONFIG = {
    rpcUrl: process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    chainId: parseInt(process.env.CHAIN_ID || '11155111'),
    riskRegistryAddress: process.env.RISK_REGISTRY_ADDRESS || '0x7ead67622f6A47318a55502634A429eF9dC5cebc',
    batchSizes: [1, 5, 10, 20, 50, 100],
    sampleAddresses: 100,
    iterationsPerBatch: 3,
    outputPath: path.join(__dirname, 'benchmark-report.csv'),
    dryRun: false,
};
// ── Benchmark Runner ──────────────────────────────────────────────────
class BenchmarkRunner {
    provider;
    contract;
    signer;
    config;
    results = [];
    queryResults = [];
    batchMethodCache;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.provider = new ethers_1.JsonRpcProvider(this.config.rpcUrl, this.config.chainId);
        this.contract = new ethers_1.Contract(this.config.riskRegistryAddress, RISK_REGISTRY_ABI, this.provider);
    }
    async initialize() {
        if (this.config.dryRun) {
            console.log('DRY RUN mode: skipping signer initialization');
            return;
        }
        try {
            const keyManager = await (0, kms_key_manager_1.createKeyManager)(this.provider);
            this.signer = await keyManager.getSigner();
            this.contract = this.contract.connect(this.signer);
            const address = await this.signer.getAddress();
            console.log(`Benchmark runner initialized: ${address}`);
            // Verify ORACLE_ROLE
            const oracleRole = await this.contract.ORACLE_ROLE();
            const hasRole = await this.contract.hasRole(oracleRole, address);
            if (!hasRole) {
                console.warn('WARNING: Benchmark address does not have ORACLE_ROLE');
            }
        }
        catch (error) {
            console.error('Failed to initialize benchmark:', error.message);
            if (!this.config.dryRun) {
                throw error;
            }
            console.log('Continuing in query-only mode due to initialization failure...');
        }
    }
    /**
     * Generate deterministic test addresses (derived from a seed)
     */
    generateTestAddresses(count) {
        const addresses = [];
        const seed = '0x' + '00'.repeat(32);
        for (let i = 0; i < count; i++) {
            const wallet = ethers_1.ethers.HDNodeWallet.fromPhrase('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', undefined, `m/44'/60'/0'/0/${i}`);
            addresses.push(wallet.address);
        }
        return addresses;
    }
    /**
     * Benchmark batchUpdateRiskProfiles with different batch sizes
     */
    async benchmarkBatchUpdate() {
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
                let status = 'success';
                let error;
                try {
                    // Try batchUpdateRiskProfiles first (if contract supports it)
                    const hasBatchMethod = await this.hasBatchMethod();
                    if (hasBatchMethod && batchSize > 1) {
                        const tx = await this.contract.batchUpdateRiskProfiles(batchAddrs, riskScores, tiers, sanctioned);
                        const receipt = await tx.wait(1);
                        gasUsed = receipt.gasUsed;
                    }
                    else {
                        // Fallback: simulate batch with sequential single updates
                        for (let i = 0; i < batchAddrs.length; i++) {
                            const tagsBytes32 = [ethers_1.ethers.encodeBytes32String('benchmark')];
                            const tx = await this.contract.updateRiskProfile(batchAddrs[i], riskScores[i], tiers[i], tagsBytes32, sanctioned[i]);
                            const receipt = await tx.wait(1);
                            gasUsed += receipt.gasUsed;
                        }
                    }
                }
                catch (err) {
                    status = 'failed';
                    error = err.message;
                    console.error(`  ❌ Failed (iter ${iter}): ${error}`);
                }
                const latencyMs = Date.now() - startTime;
                const feeData = await this.provider.getFeeData();
                const gasPriceGwei = feeData.maxFeePerGas
                    ? ethers_1.ethers.formatUnits(feeData.maxFeePerGas, 'gwei')
                    : 'unknown';
                const result = {
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
                    console.log(`  ✅ Iter ${iter}: gas=${gasUsed.toString()}, latency=${latencyMs}ms, gasPrice=${gasPriceGwei} gwei`);
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
    async benchmarkIsSanctionedQuery() {
        console.log('\n═══════════════ isSanctioned Query Benchmark ═══════════════');
        const addresses = this.generateTestAddresses(50);
        const iterations = 100;
        const latencies = [];
        console.log(`Running ${iterations} iterations...`);
        for (let i = 0; i < iterations; i++) {
            const addr = addresses[i % addresses.length];
            const start = Date.now();
            try {
                await this.contract.isSanctioned(addr);
                latencies.push(Date.now() - start);
            }
            catch {
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
        const result = {
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
    async benchmarkGetRiskProfileQuery() {
        console.log('\n═══════════════ getRiskProfile Query Benchmark ═══════════════');
        const addresses = this.generateTestAddresses(50);
        const iterations = 100;
        const latencies = [];
        console.log(`Running ${iterations} iterations...`);
        for (let i = 0; i < iterations; i++) {
            const addr = addresses[i % addresses.length];
            const start = Date.now();
            try {
                await this.contract.getRiskProfile(addr);
                latencies.push(Date.now() - start);
            }
            catch {
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
        const result = {
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
    async hasBatchMethod() {
        if (this.batchMethodCache !== undefined) {
            return this.batchMethodCache;
        }
        try {
            const iface = new ethers_1.ethers.Interface(RISK_REGISTRY_ABI);
            const selector = iface.getFunction('batchUpdateRiskProfiles').selector;
            const code = await this.provider.getCode(this.config.riskRegistryAddress);
            this.batchMethodCache = code.includes(selector.slice(2));
            return this.batchMethodCache;
        }
        catch {
            this.batchMethodCache = false;
            return false;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines.
     * Double-up any internal quotes.
     */
    escapeCsv(value) {
        const str = value === undefined ? '' : String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }
    /**
     * Generate and write CSV report
     */
    generateReport() {
        const lines = [];
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
            lines.push([
                this.escapeCsv(r.testName),
                this.escapeCsv(r.batchSize),
                this.escapeCsv(r.iteration),
                this.escapeCsv(r.status),
                this.escapeCsv(r.gasUsed.toString()),
                this.escapeCsv(r.latencyMs),
                this.escapeCsv(r.gasPriceGwei),
                this.escapeCsv(r.error),
                this.escapeCsv(r.timestamp),
            ].join(','));
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
            lines.push([
                this.escapeCsv(bs),
                this.escapeCsv(Math.round(avgGas)),
                this.escapeCsv(Math.round(avgLatency)),
                this.escapeCsv(minLatency),
                this.escapeCsv(maxLatency),
                this.escapeCsv(successRate.toFixed(1) + '%'),
            ].join(','));
        }
        // ── Section 2: Query Results ──────────────────────────────────────
        lines.push('');
        lines.push('testName,queryType,iterations,avgLatencyMs,minLatencyMs,maxLatencyMs,p50LatencyMs,p95LatencyMs,p99LatencyMs,timestamp');
        for (const r of this.queryResults) {
            lines.push([
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
            ].join(','));
        }
        // ── Section 3: Gas Cost Analysis ──────────────────────────────────
        lines.push('');
        lines.push('batchSize,avgGasPerTx,avgGasPerAddress,estimatedCostEth (at 20 gwei)');
        for (const bs of batchSizes.sort((a, b) => a - b)) {
            const batchResults = this.results.filter(r => r.batchSize === bs && r.status === 'success');
            if (batchResults.length === 0)
                continue;
            const avgGas = batchResults.reduce((sum, r) => sum + Number(r.gasUsed), 0) / batchResults.length;
            const gasPerAddr = avgGas / bs;
            const costEth = (avgGas * 20e9) / 1e18; // at 20 gwei
            lines.push([
                this.escapeCsv(bs),
                this.escapeCsv(Math.round(avgGas)),
                this.escapeCsv(gasPerAddr.toFixed(0)),
                this.escapeCsv(costEth.toFixed(6)),
            ].join(','));
        }
        return lines.join('\n');
    }
    async run() {
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
        }
        catch (error) {
            console.error('Failed to initialize benchmark:', error.message);
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
exports.BenchmarkRunner = BenchmarkRunner;
// ── CLI Entrypoint ────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);
    const config = {};
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
//# sourceMappingURL=benchmark.js.map