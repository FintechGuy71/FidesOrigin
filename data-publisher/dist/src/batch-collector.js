"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOfacAddresses = fetchOfacAddresses;
exports.fetchScamSnifferAddresses = fetchScamSnifferAddresses;
exports.runBatchSync = runBatchSync;
const axios_1 = __importDefault(require("axios"));
const ethers_1 = require("ethers");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
const config_1 = require("./config");
const address_utils_1 = require("./address-utils");
// ─── Source Configs ───────────────────────────────────────────────────────────
const OFAC_SOURCE = {
    id: 'ofac-sdn',
    name: 'OFAC SDN CryptoWallets',
    url: 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/entities.ftm.json',
    riskScore: 100,
    tier: 3, // HIGH (proxy reverts on tier=4 CRITICAL)
    sanctioned: true,
    tag: 'ofac-sdn',
};
const OFAC_DELTA_URL = 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/entities.delta.json';
const SCAM_SOURCE = {
    id: 'scamsniffer',
    name: 'ScamSniffer Phishing Addresses',
    url: 'https://raw.githubusercontent.com/ScamSniffer/scam-database/main/blacklist/address.json',
    riskScore: 75,
    tier: 2, // MEDIUM
    sanctioned: false,
    tag: 'scamsniffer-phishing',
};
const BATCH_MAX = 100; // Contract limit
const STATE_FILE = path_1.default.join(__dirname, '../synced-addresses.json');
const LOCK_FILE = path_1.default.join(__dirname, '../synced-addresses.json.lock');
const STATE_BACKUP_FILE = path_1.default.join(__dirname, '../synced-addresses.json.bak');
// ─── State Management (atomic + file-locked) ─────────────────────────────────
function loadState() {
    try {
        if (fs_1.default.existsSync(STATE_FILE)) {
            const raw = fs_1.default.readFileSync(STATE_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    }
    catch (e) {
        logger_1.default.warn(`Failed to load sync state: ${e.message}`, { error: e.stack });
        // Attempt recovery from backup
        try {
            if (fs_1.default.existsSync(STATE_BACKUP_FILE)) {
                const raw = fs_1.default.readFileSync(STATE_BACKUP_FILE, 'utf-8');
                logger_1.default.warn('Recovered sync state from backup');
                return JSON.parse(raw);
            }
        }
        catch (backupErr) {
            logger_1.default.error('Backup recovery also failed', { error: backupErr.message });
        }
    }
    return { lastSync: new Date(0).toISOString(), sources: {} };
}
/** Acquire an exclusive file lock (PID-based). Returns false if already locked. */
function acquireLock() {
    try {
        fs_1.default.writeFileSync(LOCK_FILE, process.pid.toString(), { flag: 'wx' });
        return true;
    }
    catch {
        return false;
    }
}
function releaseLock() {
    try {
        if (fs_1.default.existsSync(LOCK_FILE)) {
            const pid = fs_1.default.readFileSync(LOCK_FILE, 'utf-8').trim();
            if (pid === process.pid.toString()) {
                fs_1.default.unlinkSync(LOCK_FILE);
            }
        }
    }
    catch {
        // best-effort
    }
}
/** Atomically write state file (write temp → rename + backup old). */
function saveState(state) {
    if (!acquireLock()) {
        logger_1.default.error('Could not acquire state file lock — another sync process may be running');
        throw new Error('State file is locked by another process');
    }
    try {
        // Backup existing state
        if (fs_1.default.existsSync(STATE_FILE)) {
            fs_1.default.copyFileSync(STATE_FILE, STATE_BACKUP_FILE);
        }
        // Atomic write via temp + rename
        const tmpFile = STATE_FILE + '.tmp.' + process.pid;
        fs_1.default.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
        fs_1.default.renameSync(tmpFile, STATE_FILE);
    }
    finally {
        releaseLock();
    }
}
// ─── FTM Entity Parsing ─────────────────────────────────────────────────────
/**
 * Parse the FTM response (JSON array or JSON Lines) into a flat list of entities.
 * Handles large files gracefully and skips malformed lines/objects.
 */
function parseFTMResponse(data) {
    const trimmed = data.trim();
    if (!trimmed)
        return [];
    // Try JSON array first (OpenSanctions default export format)
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            return arr.filter(e => e && typeof e === 'object');
        }
        catch (arrErr) {
            logger_1.default.warn('FTM JSON array parse failed, attempting line-by-line fallback', {
                error: arrErr.message,
            });
            // Fallback: strip outer brackets and try parsing each object line-by-line
            // This handles truncated arrays or arrays mixed with JSON Lines
            const entities = [];
            const inner = trimmed
                .replace(/^\[/, '')
                .replace(/\]\s*$/, '')
                .trim();
            if (inner) {
                // Split by "},{" pattern to extract individual objects
                const objects = inner.split(/\}\s*,\s*\{/);
                for (let i = 0; i < objects.length; i++) {
                    let objStr = objects[i];
                    if (i === 0)
                        objStr = objStr + '}';
                    else if (i === objects.length - 1)
                        objStr = '{' + objStr;
                    else
                        objStr = '{' + objStr + '}';
                    try {
                        const entity = JSON.parse(objStr);
                        if (entity && typeof entity === 'object') {
                            entities.push(entity);
                        }
                    }
                    catch {
                        // skip malformed fragment
                    }
                }
            }
            if (entities.length > 0) {
                logger_1.default.info(`FTM fallback parse recovered ${entities.length} entities`);
                return entities;
            }
            // If no entities recovered from array fallback, continue to JSON Lines
        }
    }
    // JSON Lines: one entity per line
    const entities = [];
    const lines = trimmed.split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine)
            continue;
        try {
            const entity = JSON.parse(trimmedLine);
            if (entity && typeof entity === 'object') {
                entities.push(entity);
            }
        }
        catch {
            // skip malformed lines — log occasionally for debugging
            if (entities.length === 0) {
                logger_1.default.debug('Skipping malformed FTM line', { line: trimmedLine.slice(0, 200) });
            }
        }
    }
    return entities;
}
/**
 * Build a bidirectional entity map for cross-referencing owners.
 * OpenSanctions FTM relationships are stored in properties (e.g., holder, owner, ownershipAsset).
 */
function buildEntityMap(entities) {
    const byId = new Map();
    const reverseRefs = new Map();
    for (const ent of entities) {
        if (ent.id) {
            byId.set(ent.id, ent);
        }
    }
    // Second pass: build reverse references
    for (const ent of entities) {
        const props = ent.properties || {};
        for (const [_key, val] of Object.entries(props)) {
            if (!val)
                continue;
            const refs = Array.isArray(val) ? val : [val];
            for (const ref of refs) {
                const refId = typeof ref === 'string' ? ref : ref?.id;
                if (refId && typeof refId === 'string' && byId.has(refId)) {
                    const existing = reverseRefs.get(refId) || [];
                    if (!existing.includes(ent.id)) {
                        existing.push(ent.id);
                        reverseRefs.set(refId, existing);
                    }
                }
            }
        }
    }
    return { byId, reverseRefs };
}
/**
 * Extract the first string value from a property that may be an array or object.
 * Handles FTM reference objects ({ id: string }) and value objects ({ value: string }).
 */
function extractFirstString(value) {
    if (value === null || value === undefined)
        return undefined;
    if (typeof value === 'string')
        return value.trim() || undefined;
    if (Array.isArray(value)) {
        for (const v of value) {
            const s = extractFirstString(v);
            if (s)
                return s;
        }
    }
    if (typeof value === 'object') {
        // FTM reference objects use 'id'; value objects use 'value'
        return (value.id?.toString()?.trim() ||
            value.value?.toString()?.trim() ||
            undefined);
    }
    return undefined;
}
/**
 * Extract a list of string values from a property.
 */
function extractStringList(value) {
    if (!value)
        return [];
    if (typeof value === 'string')
        return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) {
        return value.map(extractFirstString).filter((s) => !!s);
    }
    return [];
}
/**
 * Resolve the owner entity of a CryptoWallet and extract its country.
 *
 * OpenSanctions FTM relationships are modeled as properties:
 *   - CryptoWallet may have `properties.holder` or `properties.owner` pointing to the owner
 *   - Owner entity may have `properties.country`, `properties.nationality`, or `properties.jurisdiction`
 *
 * Strategy:
 *   1. Direct reference: check wallet's `properties.holder` / `properties.owner`
 *   2. Reverse lookup: find entities that reference this wallet (e.g., via `ownershipAsset`)
 *   3. Extract country from the first non-wallet entity found.
 */
function resolveOwnerCountry(wallet, map) {
    const { byId, reverseRefs } = map;
    // 1. Direct reference from wallet properties
    const props = wallet.properties || {};
    const directRefIds = [
        ...extractStringList(props.holder),
        ...extractStringList(props.owner),
        ...extractStringList(props.holderEntity),
    ];
    for (const refId of directRefIds) {
        const owner = byId.get(refId);
        if (owner && owner.schema !== 'CryptoWallet') {
            const country = extractCountry(owner);
            if (country) {
                return { country, entityName: owner.caption || owner.properties?.name?.[0] || 'Unknown', entityId: owner.id };
            }
        }
    }
    // 2. Reverse lookup: entities that reference this wallet
    const referringIds = reverseRefs.get(wallet.id) || [];
    for (const refId of referringIds) {
        const owner = byId.get(refId);
        if (owner && owner.schema !== 'CryptoWallet') {
            const country = extractCountry(owner);
            if (country) {
                return { country, entityName: owner.caption || owner.properties?.name?.[0] || 'Unknown', entityId: owner.id };
            }
        }
    }
    // 3. Fallback: use the wallet's own country if available (rare)
    const walletCountry = extractCountry(wallet);
    if (walletCountry) {
        return { country: walletCountry, entityName: wallet.caption || 'Unknown', entityId: wallet.id };
    }
    return { country: 'UNKNOWN', entityName: wallet.caption || 'Unknown', entityId: wallet.id };
}
/**
 * Extract country from an entity's properties.
 * Tries: country → nationality → jurisdiction → incorporation
 */
function extractCountry(entity) {
    const props = entity.properties || {};
    const country = extractFirstString(props.country || props.nationality);
    if (country)
        return country;
    const jurisdiction = extractFirstString(props.jurisdiction || props.incorporation);
    if (jurisdiction)
        return jurisdiction;
    // Some entities have country as a top-level field
    if (entity.caption && typeof entity.caption === 'string') {
        // Not a direct country, but we can use it as entity name
    }
    return undefined;
}
/**
 * Extract the crypto wallet address from a CryptoWallet entity.
 * Tries: properties.address → caption → properties.cryptoAddress
 * Validates strict Ethereum address format (0x + 40 hex chars).
 */
function extractWalletAddress(entity) {
    const props = entity.properties || {};
    const candidates = [
        extractFirstString(props.address),
        extractFirstString(props.cryptoAddress),
        extractFirstString(props.cryptoWallet),
        typeof entity.caption === 'string' ? entity.caption : undefined,
    ];
    for (const addr of candidates) {
        if (!addr)
            continue;
        const norm = (0, address_utils_1.normalizeAddress)(addr);
        if (norm)
            return norm;
    }
    return undefined;
}
// ─── Data Fetchers ───────────────────────────────────────────────────────────
/**
 * Fetch OFAC SDN crypto addresses from OpenSanctions FTM JSON.
 *
 * Supports incremental mode:
 *   - `incremental: true` → first tries delta URL, then falls back to `last_seen` filter.
 *   - `days: N` → only include entities whose `last_seen` is within N days.
 *
 * Returns enriched addresses with country and owner entity metadata,
 * enabling FATF cross-matching (address → country → FATF tier).
 */
async function fetchOfacAddresses(options = {}) {
    const { incremental = false, days = 7, skipDelta = false } = options;
    // ─── Attempt 1: Delta URL (lightweight, fast) ─────────────────────────────
    if (incremental && !skipDelta) {
        try {
            const delta = await fetchOfacDelta();
            if (delta.length > 0) {
                logger_1.default.info(`OFAC delta fetched: ${delta.length} enriched addresses`);
                return delta;
            }
            logger_1.default.info('Delta URL returned empty; falling back to full FTM with last_seen filter');
        }
        catch (err) {
            logger_1.default.warn(`Delta fetch failed: ${err.message}; falling back to full FTM`, { error: err.message });
        }
    }
    // ─── Attempt 2: Full FTM with optional last_seen filter ───────────────────
    logger_1.default.info(`Fetching OFAC SDN from ${OFAC_SOURCE.url}${incremental ? ` (incremental, last ${days} days)` : ''}`);
    const resp = await axios_1.default.get(OFAC_SOURCE.url, { responseType: 'text', timeout: 120000 });
    const entities = parseFTMResponse(resp.data);
    logger_1.default.info(`OFAC FTM parsed: ${entities.length} total entities`);
    const map = buildEntityMap(entities);
    const cutoff = incremental ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
    const enriched = [];
    for (const entity of entities) {
        if (entity.schema !== 'CryptoWallet')
            continue;
        const addr = extractWalletAddress(entity);
        if (!addr)
            continue;
        // Incremental filter: only entities updated since cutoff
        if (cutoff) {
            const lastSeen = extractFirstString(entity.properties?.last_seen) || entity.last_seen;
            if (lastSeen) {
                const entityDate = new Date(lastSeen);
                if (entityDate < cutoff)
                    continue;
            }
        }
        const { country, entityName, entityId } = resolveOwnerCountry(entity, map);
        enriched.push({
            address: addr,
            country: country || 'UNKNOWN',
            entityName: entityName || entity.caption || 'Unknown',
            entityId: entityId || entity.id,
            lastSeen: extractFirstString(entity.properties?.last_seen) || entity.last_seen,
        });
    }
    logger_1.default.info(`OFAC SDN ETH addresses fetched: ${enriched.length}${incremental ? ' (incremental)' : ''}`);
    return enriched;
}
/**
 * Fetch the delta update from OpenSanctions.
 * The delta file contains only entities that changed since the last full export.
 * Format: same FTM JSON as the full export, but with a subset of entities.
 */
async function fetchOfacDelta() {
    logger_1.default.info(`Fetching OFAC delta from ${OFAC_DELTA_URL}`);
    const resp = await axios_1.default.get(OFAC_DELTA_URL, {
        responseType: 'text',
        timeout: 30000,
        validateStatus: s => s === 200,
    });
    const entities = parseFTMResponse(resp.data);
    if (entities.length === 0)
        return [];
    const map = buildEntityMap(entities);
    const enriched = [];
    for (const entity of entities) {
        if (entity.schema !== 'CryptoWallet')
            continue;
        const addr = extractWalletAddress(entity);
        if (!addr)
            continue;
        const { country, entityName, entityId } = resolveOwnerCountry(entity, map);
        enriched.push({
            address: addr,
            country: country || 'UNKNOWN',
            entityName: entityName || entity.caption || 'Unknown',
            entityId: entityId || entity.id,
            lastSeen: extractFirstString(entity.properties?.last_seen) || entity.last_seen,
        });
    }
    logger_1.default.info(`OFAC delta parsed: ${enriched.length} enriched addresses`);
    return enriched;
}
/**
 * Fetch ScamSniffer phishing addresses.
 * ScamSniffer does not provide country data; returns empty country.
 */
async function fetchScamSnifferAddresses() {
    logger_1.default.info(`Fetching ScamSniffer from ${SCAM_SOURCE.url}`);
    const resp = await axios_1.default.get(SCAM_SOURCE.url, { timeout: 30000 });
    const addrs = resp.data
        .filter((a) => a.startsWith('0x') && a.length === 42)
        .map((a) => a.toLowerCase());
    const enriched = addrs.map(addr => ({
        address: addr,
        country: 'UNKNOWN',
        entityName: 'ScamSniffer Phishing',
        entityId: `scam-${addr.slice(2, 10)}`,
    }));
    logger_1.default.info(`ScamSniffer ETH addresses fetched: ${enriched.length}`);
    return enriched;
}
// ─── Batch Publisher ─────────────────────────────────────────────────────────
/**
 * Publish addresses in batches of 100 using batchUpdateRiskProfiles.
 */
async function publishBatches(wallet, registry, batch, dryRun) {
    const total = batch.addresses.length;
    if (total === 0)
        return { success: 0, failed: 0 };
    let success = 0;
    let failed = 0;
    for (let i = 0; i < total; i += BATCH_MAX) {
        const end = Math.min(i + BATCH_MAX, total);
        const batchAddrs = batch.addresses.slice(i, end);
        const batchScores = batch.riskScores.slice(i, end);
        const batchTiers = batch.tiers.slice(i, end);
        const batchSanc = batch.sanctioned.slice(i, end);
        const batchTags = batch.tags.slice(i, end);
        const tagBytes = batchTags.map((tArr) => tArr.map((t) => ethers_1.ethers.id(t)));
        logger_1.default.info(`Publishing batch ${Math.floor(i / BATCH_MAX) + 1} (${batchAddrs.length} addresses)`, { batchIndex: Math.floor(i / BATCH_MAX) + 1, batchSize: batchAddrs.length });
        if (dryRun) {
            logger_1.default.info(`DRY_RUN: skipped batch of ${batchAddrs.length} addresses`);
            success += batchAddrs.length;
            continue;
        }
        try {
            const tx = await registry.batchUpdateRiskProfiles(batchAddrs, batchScores, batchTiers, batchSanc, tagBytes, { gasLimit: 5000000 });
            const receipt = await tx.wait(1);
            if (receipt.status === 1) {
                success += batchAddrs.length;
                logger_1.default.info(`Batch published: ${tx.hash.slice(0, 16)}... (${batchAddrs.length} addresses)`);
            }
            else {
                failed += batchAddrs.length;
                logger_1.default.error(`Batch tx reverted: ${tx.hash.slice(0, 16)}...`);
            }
        }
        catch (e) {
            logger_1.default.error(`Batch publish failed: ${e.message?.slice(0, 120)} (size: ${batchAddrs.length})`, { error: e.message?.slice(0, 120), batchSize: batchAddrs.length });
            failed += batchAddrs.length;
        }
        // Small delay between batches
        if (i + BATCH_MAX < total) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    return { success, failed };
}
// ─── Main Sync ───────────────────────────────────────────────────────────────
/**
 * Run a full or incremental delta sync of all data sources.
 *
 * @param options.incremental — if true, only fetch entities updated in the last N days
 * @param options.days — lookback window for incremental mode (default 7)
 * @param options.dryRun — override config dryRun
 */
async function runBatchSync(options = {}) {
    const { incremental = false, days = 7, dryRun: dryRunOverride } = options;
    logger_1.default.info('=== FidesOrigin Batch Risk Data Sync ===');
    if (incremental) {
        logger_1.default.info(`Incremental mode: last ${days} days`);
    }
    const state = loadState();
    const now = new Date().toISOString();
    // Connect
    const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.publisher.rpcUrl, config_1.config.publisher.chainId);
    // Use oracle private key (not publisher key - different roles)
    const oracleKey = process.env.ORACLE_PRIVATE_KEY || config_1.config.publisher.privateKey;
    if (!oracleKey) {
        throw new Error('ORACLE_PRIVATE_KEY or PUBLISHER_PRIVATE_KEY must be set');
    }
    const wallet = new ethers_1.ethers.Wallet(oracleKey, provider);
    const registry = new ethers_1.ethers.Contract(config_1.config.publisher.riskRegistryAddress, [
        'function batchUpdateRiskProfiles(address[] addrs, uint8[] riskScores, uint8[] tiers, bool[] sanctioned, bytes32[][] tags) external',
        'function hasRole(bytes32 role, address account) view returns (bool)',
    ], wallet);
    // Verify role
    const ORACLE_ROLE = '0x68e79a7bf1e0bc45d0a330c573bc367f9cf464fd326078812f301165fbda4ef1';
    if (!(await registry.hasRole(ORACLE_ROLE, wallet.address))) {
        throw new Error('Account does not have ORACLE_ROLE');
    }
    const dryRun = dryRunOverride ?? config_1.config.publisher.dryRun;
    const results = {};
    let totalPublished = 0;
    let totalFailed = 0;
    // ─── Source 1: OFAC SDN (with country enrichment) ─────────────────────────
    const ofacEnriched = await fetchOfacAddresses({ incremental, days });
    const ofacSynced = new Set(state.sources[OFAC_SOURCE.id]?.addresses || []);
    const ofacNew = ofacEnriched.filter(e => !ofacSynced.has(e.address));
    if (ofacNew.length > 0) {
        const batch = {
            addresses: ofacNew.map(e => e.address),
            riskScores: ofacNew.map(() => OFAC_SOURCE.riskScore),
            tiers: ofacNew.map(() => OFAC_SOURCE.tier),
            sanctioned: ofacNew.map(() => OFAC_SOURCE.sanctioned),
            tags: ofacNew.map(e => [OFAC_SOURCE.tag, `country:${e.country.toLowerCase().replace(/\s+/g, '_')}`]),
        };
        const { success, failed } = await publishBatches(wallet, registry, batch, dryRun);
        totalPublished += success;
        totalFailed += failed;
        results[OFAC_SOURCE.id] = success;
        // Update state with enriched metadata
        ofacNew.forEach(e => ofacSynced.add(e.address));
        const existingEnriched = state.sources[OFAC_SOURCE.id]?.enriched || {};
        ofacNew.forEach(e => {
            existingEnriched[e.address] = {
                country: e.country,
                entityName: e.entityName,
                entityId: e.entityId,
            };
        });
        state.sources[OFAC_SOURCE.id] = {
            count: ofacSynced.size,
            addresses: Array.from(ofacSynced),
            enriched: existingEnriched,
        };
        saveState(state);
    }
    else {
        logger_1.default.info('No new OFAC addresses to sync');
        results[OFAC_SOURCE.id] = 0;
    }
    // ─── Source 2: ScamSniffer ─────────────────────────────────────────────────
    const scamEnriched = await fetchScamSnifferAddresses();
    const scamSynced = new Set(state.sources[SCAM_SOURCE.id]?.addresses || []);
    const scamNew = scamEnriched.filter(e => !scamSynced.has(e.address));
    if (scamNew.length > 0) {
        const batch = {
            addresses: scamNew.map(e => e.address),
            riskScores: scamNew.map(() => SCAM_SOURCE.riskScore),
            tiers: scamNew.map(() => SCAM_SOURCE.tier),
            sanctioned: scamNew.map(() => SCAM_SOURCE.sanctioned),
            tags: scamNew.map(() => [SCAM_SOURCE.tag]),
        };
        const { success, failed } = await publishBatches(wallet, registry, batch, dryRun);
        totalPublished += success;
        totalFailed += failed;
        results[SCAM_SOURCE.id] = success;
        // Update state
        scamNew.forEach(e => scamSynced.add(e.address));
        state.sources[SCAM_SOURCE.id] = { count: scamSynced.size, addresses: Array.from(scamSynced) };
        saveState(state);
    }
    else {
        logger_1.default.info('No new ScamSniffer addresses to sync');
        results[SCAM_SOURCE.id] = 0;
    }
    state.lastSync = now;
    if (incremental) {
        state.lastIncrementalSync = now;
    }
    saveState(state);
    logger_1.default.info(`=== Batch sync complete: ${ofacNew.length + scamNew.length} new, ${totalPublished} published, ${totalFailed} failed ===`, { totalNew: ofacNew.length + scamNew.length, published: totalPublished, failed: totalFailed });
    return {
        totalNew: ofacNew.length + scamNew.length,
        published: totalPublished,
        failed: totalFailed,
        sources: results,
    };
}
// ─── CLI Helpers ─────────────────────────────────────────────────────────────
function parseCliArgs() {
    const args = process.argv.slice(2);
    const options = {};
    for (const arg of args) {
        if (arg === '--incremental' || arg === '-i') {
            options.incremental = true;
        }
        else if (arg === '--dry-run' || arg === '-d') {
            options.dryRun = true;
        }
        else if (arg.startsWith('--days=')) {
            const days = parseInt(arg.split('=')[1], 10);
            if (!isNaN(days) && days > 0) {
                options.days = days;
            }
        }
        else if (arg === '--help' || arg === '-h') {
            console.log(`
FidesOrigin Batch Collector — CLI Usage

Options:
  --incremental, -i     Enable incremental mode (delta URL or last_seen filter)
  --days=N              Lookback window for incremental mode (default: 7)
  --dry-run, -d         Skip blockchain transactions
  --help, -h            Show this help

Examples:
  npx ts-node batch-collector.ts --incremental --days=3
  npx ts-node batch-collector.ts --dry-run
  npx ts-node batch-collector.ts --incremental --days=14 --dry-run
`);
            process.exit(0);
        }
    }
    return options;
}
// ─── CLI / Test ─────────────────────────────────────────────────────────────
if (require.main === module) {
    const cliOptions = parseCliArgs();
    runBatchSync(cliOptions)
        .then(r => {
        console.log('\nResult:', JSON.stringify(r, null, 2));
        process.exit(0);
    })
        .catch(e => {
        console.error('Fatal error:', e);
        process.exit(1);
    });
}
//# sourceMappingURL=batch-collector.js.map