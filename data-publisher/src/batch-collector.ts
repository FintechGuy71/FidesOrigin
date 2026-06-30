import axios from 'axios';
import { ethers, JsonRpcProvider, AbstractSigner, Contract } from 'ethers';
import fs from 'fs';
import path from 'path';
import logger from './logger';
import { config } from './config';
import { isValidEthAddress, normalizeAddress } from './address-utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AddressBatch {
  addresses: string[];
  riskScores: number[];
  tiers: number[];
  sanctioned: boolean[];
  tags: string[][];
}

export interface SourceData {
  id: string;
  name: string;
  url: string;
  riskScore: number;
  tier: number;
  sanctioned: boolean;
  tag: string;
}

/**
 * Enriched address with country and entity metadata.
 * Enables FATF cross-matching: address → country → FATF tier.
 */
export interface EnrichedAddress {
  address: string;
  country: string;       // ISO country code or name from owner entity
  entityName: string;    // Name of the owner entity (e.g. "Iranian Entity")
  entityId: string;      // OpenSanctions entity ID
  lastSeen?: string;     // ISO timestamp of last update
}

export interface SyncState {
  lastSync: string;
  lastIncrementalSync?: string;
  sources: Record<string, {
    count: number;
    addresses: string[];
    /** Enriched metadata keyed by address (for country association & FATF tiering) */
    enriched?: Record<string, {
      country: string;
      entityName: string;
      entityId: string;
    }>;
    /** Addresses that failed on-chain publication (will be retried on next sync) */
    failed?: string[];
    /** Last HTTP ETag for conditional GET (e.g. ScamSniffer) */
    lastEtag?: string;
  }>;
}

export interface FetchOptions {
  /** If true, try delta URL first; fall back to last_seen filtering on full FTM. */
  incremental?: boolean;
  /** Number of days to look back for last_seen filter (default: 7). */
  days?: number;
  /** If true, skip the delta URL and use last_seen filter directly on full FTM. */
  skipDelta?: boolean;
  /** If true, also retry previously failed addresses for this source. */
  retryFailed?: boolean;
}

export interface BatchSyncOptions {
  incremental?: boolean;
  days?: number;
  dryRun?: boolean;
  retryFailed?: boolean;
}

// ─── FTM Internal Types ──────────────────────────────────────────────────────

interface FTMEntity {
  id: string;
  schema: string;
  caption: string;
  properties: Record<string, any>;
  datasets?: string[];
  first_seen?: string;
  last_seen?: string;
  referents?: string[];
}

interface FTMEntityMap {
  byId: Map<string, FTMEntity>;
  /** Reverse lookup: entityId → list of entity IDs that reference it in their properties */
  reverseRefs: Map<string, string[]>;
}

// ─── Source Configs ───────────────────────────────────────────────────────────

const OFAC_SOURCE: SourceData = {
  id: 'ofac-sdn',
  name: 'OFAC SDN CryptoWallets',
  url: 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/entities.ftm.json',
  riskScore: 100,
  tier: 4,        // CRITICAL — V2 supports CRITICAL tier
  sanctioned: true,
  tag: 'ofac-sdn',
};

const OFAC_DELTA_URL = 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/entities.delta.json';

const SCAM_SOURCE: SourceData = {
  id: 'scamsniffer',
  name: 'ScamSniffer Phishing Addresses',
  url: 'https://raw.githubusercontent.com/ScamSniffer/scam-database/main/blacklist/address.json',
  riskScore: 75,
  tier: 2,        // MEDIUM
  sanctioned: false,
  tag: 'scamsniffer-phishing',
};

const BATCH_MAX = 100; // Contract limit
// [C3-fix] Use /app/data (K8s PVC mount) instead of __dirname (readOnlyRootFilesystem)
// Fallback to local dev path if DATA_DIR env not set
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const STATE_FILE = path.join(DATA_DIR, 'synced-addresses.json');
const LOCK_FILE = path.join(DATA_DIR, 'synced-addresses.json.lock');
const STATE_BACKUP_FILE = path.join(DATA_DIR, 'synced-addresses.json.bak');

// ─── State Management (atomic + file-locked) ─────────────────────────────────

function loadState(): SyncState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw) as SyncState;
    }
  } catch (e: any) {
    logger.warn(`Failed to load sync state: ${(e as Error).message}`, { error: (e as Error).stack });
    // Attempt recovery from backup
    try {
      if (fs.existsSync(STATE_BACKUP_FILE)) {
        const raw = fs.readFileSync(STATE_BACKUP_FILE, 'utf-8');
        logger.warn('Recovered sync state from backup');
        return JSON.parse(raw) as SyncState;
      }
    } catch (backupErr: any) {
      logger.error('Backup recovery also failed', { error: backupErr.message });
    }
  }
  return { lastSync: new Date(0).toISOString(), sources: {} };
}

/** Acquire an exclusive file lock (PID-based) with 5-min staleness detection. */
function acquireLock(): boolean {
  try {
    // If lock exists and is stale (>5 min), remove it (process likely crashed)
    if (fs.existsSync(LOCK_FILE)) {
      try {
        const stat = fs.statSync(LOCK_FILE);
        const lockAgeMs = Date.now() - stat.mtimeMs;
        if (lockAgeMs > 5 * 60 * 1000) {
          logger.warn('Removing stale lock file (age > 5min)', { lockAgeMs });
          fs.unlinkSync(LOCK_FILE);
        } else {
          return false;
        }
      } catch {
        return false;
      }
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString(), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      if (pid === process.pid.toString()) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
  } catch {
    // best-effort
  }
}

/** Atomically write state file (write temp → rename + backup old). */
// [Audit-Fix #32] Note: saveState performs atomic write via temp+rename pattern.
// For multi-instance deployments, ensure only one instance writes to STATE_FILE at a time
// (enforced by the acquireLock function). The lock file is PID-based with 5-min staleness detection.
function saveState(state: SyncState): void {
  if (!acquireLock()) {
    logger.error('Could not acquire state file lock — another sync process may be running');
    throw new Error('State file is locked by another process');
  }
  try {
    // Backup existing state
    if (fs.existsSync(STATE_FILE)) {
      fs.copyFileSync(STATE_FILE, STATE_BACKUP_FILE);
    }
    // Atomic write via temp + rename; set restrictive permissions (owner-only)
    const tmpFile = STATE_FILE + '.tmp.' + process.pid;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.chmodSync(tmpFile, 0o600);
    fs.renameSync(tmpFile, STATE_FILE);
    fs.chmodSync(STATE_FILE, 0o600);
  } finally {
    releaseLock();
  }
}

// ─── FTM Entity Parsing ─────────────────────────────────────────────────────

/**
 * Parse the FTM response (JSON array or JSON Lines) into a flat list of entities.
 * Handles large files gracefully and skips malformed lines/objects.
 */
function parseFTMResponse(data: string): FTMEntity[] {
  const trimmed = data.trim();
  if (!trimmed) return [];

  // Try JSON array first (OpenSanctions default export format)
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as any[];
      return arr.filter(e => e && typeof e === 'object');
    } catch (arrErr) {
      // [Fix] Remove fragile split(/\}\s*,\s*\{/) fallback that breaks on nested objects/strings with commas.
      // Fall through to JSON Lines parsing below.
      logger.warn('FTM JSON array parse failed, falling back to JSON Lines', {
        error: (arrErr as Error).message,
      });
    }
  }

  // JSON Lines: one entity per line
  const entities: FTMEntity[] = [];
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    try {
      const entity = JSON.parse(trimmedLine);
      if (entity && typeof entity === 'object') {
        entities.push(entity);
      }
    } catch {
      // skip malformed lines — log occasionally for debugging
      if (entities.length === 0) {
        logger.debug('Skipping malformed FTM line', { line: trimmedLine.slice(0, 200) });
      }
    }
  }
  return entities;
}

/**
 * Build a bidirectional entity map for cross-referencing owners.
 * OpenSanctions FTM relationships are stored in properties (e.g., holder, owner, ownershipAsset).
 */
function buildEntityMap(entities: FTMEntity[]): FTMEntityMap {
  const byId = new Map<string, FTMEntity>();
  const reverseRefs = new Map<string, string[]>();

  for (const ent of entities) {
    if (ent.id) {
      byId.set(ent.id, ent);
    }
  }

  // Second pass: build reverse references
  for (const ent of entities) {
    const props = ent.properties || {};
    for (const [_key, val] of Object.entries(props)) {
      if (!val) continue;
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
function extractFirstString(value: any, depth: number = 0): string | undefined {
  // [Fix] Prevent infinite recursion / stack overflow on cyclic or deeply nested objects
  if (depth > 10) return undefined;
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = extractFirstString(v, depth + 1);
      if (s) return s;
    }
  }
  if (typeof value === 'object') {
    // FTM reference objects use 'id'; value objects use 'value'
    return (
      value.id?.toString()?.trim() ||
      value.value?.toString()?.trim() ||
      undefined
    );
  }
  return undefined;
}

/**
 * Extract a list of string values from a property.
 */
function extractStringList(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.map(extractFirstString).filter((s): s is string => !!s);
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
function resolveOwnerCountry(
  wallet: FTMEntity,
  map: FTMEntityMap
): { country: string; entityName: string; entityId: string } {
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
function extractCountry(entity: FTMEntity): string | undefined {
  const props = entity.properties || {};
  const country = extractFirstString(props.country || props.nationality);
  if (country) return country;

  const jurisdiction = extractFirstString(props.jurisdiction || props.incorporation);
  if (jurisdiction) return jurisdiction;

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
function extractWalletAddress(entity: FTMEntity): string | undefined {
  const props = entity.properties || {};
  const candidates = [
    extractFirstString(props.address),
    extractFirstString(props.cryptoAddress),
    extractFirstString(props.cryptoWallet),
    typeof entity.caption === 'string' ? entity.caption : undefined,
  ];

  for (const addr of candidates) {
    if (!addr) continue;
    const norm = normalizeAddress(addr);
    if (norm) return norm;
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
export async function fetchOfacAddresses(options: FetchOptions = {}): Promise<EnrichedAddress[]> {
  const { incremental = false, days = 7, skipDelta = false } = options;

  // ─── Attempt 1: Delta URL (lightweight, fast) ─────────────────────────────
  if (incremental && !skipDelta) {
    try {
      const delta = await fetchOfacDelta();
      if (delta.length > 0) {
        logger.info(`OFAC delta fetched: ${delta.length} enriched addresses`);
        return delta;
      }
      logger.info('Delta URL returned empty; falling back to full FTM with last_seen filter');
    } catch (err: any) {
      logger.warn(`Delta fetch failed: ${err.message}; falling back to full FTM`, { error: err.message });
    }
  }

  // ─── Attempt 2: Full FTM with optional last_seen filter ───────────────────
  logger.info(`Fetching OFAC SDN from ${OFAC_SOURCE.url}${incremental ? ` (incremental, last ${days} days)` : ''}`);
  const resp = await axios.get(OFAC_SOURCE.url, { responseType: 'text', timeout: 120000 });
  const entities = parseFTMResponse(resp.data as string);
  logger.info(`OFAC FTM parsed: ${entities.length} total entities`);

  const map = buildEntityMap(entities);
  const cutoff = incremental ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const enriched: EnrichedAddress[] = [];
  for (const entity of entities) {
    if (entity.schema !== 'CryptoWallet') continue;

    const addr = extractWalletAddress(entity);
    if (!addr) continue;

    // Incremental filter: only entities updated since cutoff
    if (cutoff) {
      const lastSeen = extractFirstString(entity.properties?.last_seen) || entity.last_seen;
      if (lastSeen) {
        const entityDate = new Date(lastSeen);
        if (entityDate < cutoff) continue;
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

  logger.info(`OFAC SDN ETH addresses fetched: ${enriched.length}${incremental ? ' (incremental)' : ''}`);
  return enriched;
}

/**
 * Fetch the delta update from OpenSanctions.
 * The delta file contains only entities that changed since the last full export.
 * Format: same FTM JSON as the full export, but with a subset of entities.
 */
async function fetchOfacDelta(): Promise<EnrichedAddress[]> {
  logger.info(`Fetching OFAC delta from ${OFAC_DELTA_URL}`);
  const resp = await axios.get(OFAC_DELTA_URL, {
    responseType: 'text',
    timeout: 30000,
    validateStatus: s => s === 200,
  });

  const entities = parseFTMResponse(resp.data as string);
  if (entities.length === 0) return [];

  const map = buildEntityMap(entities);
  const enriched: EnrichedAddress[] = [];

  for (const entity of entities) {
    if (entity.schema !== 'CryptoWallet') continue;

    const addr = extractWalletAddress(entity);
    if (!addr) continue;

    const { country, entityName, entityId } = resolveOwnerCountry(entity, map);

    enriched.push({
      address: addr,
      country: country || 'UNKNOWN',
      entityName: entityName || entity.caption || 'Unknown',
      entityId: entityId || entity.id,
      lastSeen: extractFirstString(entity.properties?.last_seen) || entity.last_seen,
    });
  }

  logger.info(`OFAC delta parsed: ${enriched.length} enriched addresses`);
  return enriched;
}

/**
 * Fetch ScamSniffer phishing addresses.
 * ScamSniffer does not provide country data; returns empty country.
 * Validates all addresses with strict Ethereum format checks.
 */
export async function fetchScamSnifferAddresses(): Promise<EnrichedAddress[]> {
  logger.info(`Fetching ScamSniffer from ${SCAM_SOURCE.url}`);
  const resp = await axios.get(SCAM_SOURCE.url, { timeout: 30000 });

  if (!Array.isArray(resp.data)) {
    logger.warn('ScamSniffer response is not an array, skipping');
    return [];
  }

  const rawAddrs: string[] = resp.data;
  const validAddrs: string[] = [];

  for (const a of rawAddrs) {
    if (typeof a !== 'string') continue;
    const norm = normalizeAddress(a);
    if (norm) {
      validAddrs.push(norm);
    } else if (a.trim()) {
      logger.debug('Skipping invalid ScamSniffer address', { address: a.trim().slice(0, 50) });
    }
  }

  // Deduplicate
  const deduped = [...new Set(validAddrs)];

  const enriched: EnrichedAddress[] = deduped.map(addr => ({
    address: addr,
    country: 'UNKNOWN',
    entityName: 'ScamSniffer Phishing',
    entityId: `scam-${addr.slice(2, 10)}`,
  }));

  logger.info(`ScamSniffer ETH addresses fetched: ${enriched.length} valid (filtered ${rawAddrs.length - deduped.length} invalid/duplicate)`);
  return enriched;
}

// ─── Batch Publisher ─────────────────────────────────────────────────────────

/**
 * Publish addresses in batches of 100 using batchUpdateRiskProfiles.
 * Returns per-address success/failure tracking so the caller can decide
 * which addresses to mark as synced and which to retry.
 */
async function publishBatches(
  wallet: AbstractSigner,
  registry: Contract,
  batch: AddressBatch,
  dryRun: boolean
): Promise<{
  success: number;
  failed: number;
  succeededAddresses: string[];
  failedAddresses: string[];
}> {
  const total = batch.addresses.length;
  if (total === 0) {
    return { success: 0, failed: 0, succeededAddresses: [], failedAddresses: [] };
  }

  const succeededAddresses: string[] = [];
  const failedAddresses: string[] = [];

  for (let i = 0; i < total; i += BATCH_MAX) {
    const end = Math.min(i + BATCH_MAX, total);
    const batchAddrs = batch.addresses.slice(i, end);
    const batchScores = batch.riskScores.slice(i, end);
    const batchTiers = batch.tiers.slice(i, end);
    const batchSanc = batch.sanctioned.slice(i, end);

    logger.info(
      `Publishing batch ${Math.floor(i / BATCH_MAX) + 1} (${batchAddrs.length} addresses)`,
      { batchIndex: Math.floor(i / BATCH_MAX) + 1, batchSize: batchAddrs.length }
    );

    if (dryRun) {
      logger.info(`DRY_RUN: skipped batch of ${batchAddrs.length} addresses`);
      succeededAddresses.push(...batchAddrs);
      continue;
    }

    try {
      // [P1-fix] Pre-validate all addresses to prevent single invalid address from reverting entire batch
      const validIndices: number[] = [];
      const invalidAddresses: string[] = [];
      for (let idx = 0; idx < batchAddrs.length; idx++) {
        const addr = batchAddrs[idx];
        if (isValidEthAddress(addr)) {
          validIndices.push(idx);
        } else {
          invalidAddresses.push(addr);
        }
      }
      if (invalidAddresses.length > 0) {
        logger.warn(`Skipping ${invalidAddresses.length} invalid addresses in batch`, {
          invalidAddresses: invalidAddresses.slice(0, 5),
          batchIndex: Math.floor(i / BATCH_MAX) + 1,
        });
        failedAddresses.push(...invalidAddresses);
      }
      if (validIndices.length === 0) {
        continue; // no valid addresses to publish
      }

      // Filter batch to only valid addresses
      const validAddrs = validIndices.map(idx => batchAddrs[idx]);
      const validScores = validIndices.map(idx => batchScores[idx]);
      const validTiers = validIndices.map(idx => batchTiers[idx]);
      const validSanc = validIndices.map(idx => batchSanc[idx]);
      const batchTags = batch.tags.slice(i, end);
      const validTags = validIndices.map(idx => batchTags[idx]).map(tagArr =>
        tagArr.map(t => ethers.encodeBytes32String(t))
      );

      // Dynamic gas estimation with 20% buffer and 5M hard cap
      const estimatedGas = await registry.batchUpdateRiskProfiles.estimateGas(
        validAddrs,
        validScores,
        validTiers,
        validSanc,
        validTags
      );
      const gasLimit = (estimatedGas * 120n) / 100n; // 20% buffer
      const maxGasLimit = 5000000n;
      if (gasLimit > maxGasLimit) {
        throw new Error(`Gas limit ${gasLimit} exceeds maximum ${maxGasLimit}. Reduce batch size.`);
      }
      const tx = await registry.batchUpdateRiskProfiles(
        validAddrs,
        validScores,
        validTiers,
        validSanc,
        validTags,
        { gasLimit }
      );
      const receipt = await tx.wait(1);

      // receipt can be null if the network drops the tx before confirmation
      if (!receipt) {
        logger.error(`Batch tx receipt is null (network timeout?): ${tx.hash.slice(0, 16)}...`);
        failedAddresses.push(...validAddrs);
        continue;
      }

      if (receipt.status === 1) {
        // [P1-fix] Contract may skip some addresses internally (e.g., duplicates, no changes).
        // Verify by calling getRiskProfile for each address to confirm on-chain update.
        const verifiedSuccess: string[] = [];
        const contractSkipped: string[] = [];
        for (const addr of validAddrs) {
          try {
            // getRiskProfile returns: (riskScore, tier, tags, lastUpdated, isSanctioned)
            const profile = await registry.getRiskProfile(addr);
            if (profile && profile[3] && Number(profile[3]) > 0) {
              verifiedSuccess.push(addr);
            } else {
              contractSkipped.push(addr);
            }
          } catch (verifyErr) {
            // If verification call fails, conservatively assume success (tx was mined)
            verifiedSuccess.push(addr);
          }
        }
        if (contractSkipped.length > 0) {
          logger.warn(`Contract skipped ${contractSkipped.length} addresses (likely duplicates or no changes)`, {
            skipped: contractSkipped.slice(0, 10),
            batchIndex: Math.floor(i / BATCH_MAX) + 1,
          });
          // Mark skipped addresses as failed so they will be retried on next sync
          failedAddresses.push(...contractSkipped);
        }
        succeededAddresses.push(...verifiedSuccess);
        logger.info(`Batch published: ${tx.hash.slice(0, 16)}... (${verifiedSuccess.length} verified, ${contractSkipped.length} skipped)`);
      } else {
        failedAddresses.push(...validAddrs);
        logger.error(`Batch tx reverted: ${tx.hash.slice(0, 16)}...`);
      }
    } catch (e: any) {
      logger.error(
        `Batch publish failed: ${(e as Error).message?.slice(0, 120)} (size: ${batchAddrs.length})`,
        { error: (e as Error).message?.slice(0, 120), batchSize: batchAddrs.length }
      );
      failedAddresses.push(...batchAddrs);
    }

    // Small delay between batches
    if (i + BATCH_MAX < total) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return {
    success: succeededAddresses.length,
    failed: failedAddresses.length,
    succeededAddresses,
    failedAddresses,
  };
}

// ─── Main Sync ───────────────────────────────────────────────────────────────

/**
 * Run a full or incremental delta sync of all data sources.
 *
 * @param options.incremental — if true, only fetch entities updated in the last N days
 * @param options.days — lookback window for incremental mode (default 7)
 * @param options.dryRun — override config dryRun
 */
export async function runBatchSync(options: BatchSyncOptions = {}): Promise<{
  totalNew: number;
  published: number;
  failed: number;
  sources: Record<string, number>;
}> {
  const { incremental = false, days = 7, dryRun: dryRunOverride, retryFailed = false } = options;

  logger.info('=== FidesOrigin Batch Risk Data Sync ===');
  if (incremental) {
    logger.info(`Incremental mode: last ${days} days`);
  }
  if (retryFailed) {
    logger.info('Retry-failed mode: will re-attempt previously failed addresses');
  }

  const state = loadState();
  const now = new Date().toISOString();

  // Connect
  const provider = new ethers.JsonRpcProvider(config.publisher.rpcUrl, config.publisher.chainId);
  // Use key-manager for secure key handling (KMS/Vault/Plain)
  const { createKeyManager } = await import('./kms-key-manager');
  const keyManager = await createKeyManager(provider);
  const wallet = await keyManager.getSigner() as ethers.Wallet;
  const walletAddress = await keyManager.getAddress();
  const registry = new ethers.Contract(
    config.publisher.riskRegistryAddress,
    [
      'function batchUpdateRiskProfiles(address[] accounts, uint8[] riskScores, uint8[] tiers, bool[] isSanctionedList, bytes32[][] tags) external',
      'function hasRole(bytes32 role, address account) view returns (bool)',
      'function getRiskProfile(address addr) view returns (uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool isSanctioned)',
    ],
    wallet
  );

  // Verify role (use walletAddress, not wallet.address — wallet may be a wrapped Signer)
  const ORACLE_ROLE = '0x68e79a7bf1e0bc45d0a330c573bc367f9cf464fd326078812f301165fbda4ef1';
  if (!(await registry.hasRole(ORACLE_ROLE, walletAddress))) {
    throw new Error('Account does not have ORACLE_ROLE');
  }

  const dryRun = dryRunOverride ?? config.publisher.dryRun;
  const results: Record<string, number> = {};
  let totalPublished = 0;
  let totalFailed = 0;

  // ─── Source 1: OFAC SDN (with country enrichment) ─────────────────────────
  const ofacEnriched = await fetchOfacAddresses({ incremental, days, retryFailed });
  // [Audit-Fix #15] Use Set for O(1) membership checks instead of Array.includes() which is O(n).
  // For large datasets (10k+ addresses), Array.includes causes significant performance degradation.
  const ofacSynced = new Set(state.sources[OFAC_SOURCE.id]?.addresses || []);
  const ofacFailed = new Set(state.sources[OFAC_SOURCE.id]?.failed || []);

  // Build the candidate list: new addresses + previously failed (if retryFailed)
  const ofacCandidates = ofacEnriched.filter(e => {
    if (ofacSynced.has(e.address)) return false;
    if (ofacFailed.has(e.address) && !retryFailed) return false;
    return true;
  });

  if (ofacCandidates.length > 0) {
    const batch: AddressBatch = {
      addresses: ofacCandidates.map(e => e.address),
      riskScores: ofacCandidates.map(() => OFAC_SOURCE.riskScore),
      tiers: ofacCandidates.map(() => OFAC_SOURCE.tier),
      sanctioned: ofacCandidates.map(() => OFAC_SOURCE.sanctioned),
      tags: ofacCandidates.map(e => [OFAC_SOURCE.tag, `country:${e.country.toLowerCase().replace(/\s+/g, '_')}`]),
    };
    const { success, failed, succeededAddresses, failedAddresses } = await publishBatches(wallet, registry, batch, dryRun);
    totalPublished += success;
    totalFailed += failed;
    results[OFAC_SOURCE.id] = success;

    // Only mark SUCCESSFULLY published addresses as synced
    for (const addr of succeededAddresses) {
      ofacSynced.add(addr);
      ofacFailed.delete(addr); // remove from failed if it was there
    }
    // Track newly failed addresses
    for (const addr of failedAddresses) {
      ofacFailed.add(addr);
    }

    // Update enriched metadata only for succeeded addresses
    const existingEnriched = state.sources[OFAC_SOURCE.id]?.enriched || {};
    for (const e of ofacCandidates) {
      if (succeededAddresses.includes(e.address)) {
        existingEnriched[e.address] = {
          country: e.country,
          entityName: e.entityName,
          entityId: e.entityId,
        };
      }
    }
    state.sources[OFAC_SOURCE.id] = {
      count: ofacSynced.size,
      // [Audit-Fix #15] Note: For very large datasets (>100k addresses), consider periodically
      // pruning the addresses array or migrating to a Bloom filter for space efficiency.
      addresses: Array.from(ofacSynced),
      enriched: existingEnriched,
      failed: Array.from(ofacFailed),
    };
    if (!dryRun) saveState(state);
  } else {
    logger.info('No new OFAC addresses to sync');
    results[OFAC_SOURCE.id] = 0;
  }

  // ─── Source 2: ScamSniffer ─────────────────────────────────────────────────
  const scamEnriched = await fetchScamSnifferAddresses();
  const scamSynced = new Set(state.sources[SCAM_SOURCE.id]?.addresses || []);
  const scamFailed = new Set(state.sources[SCAM_SOURCE.id]?.failed || []);

  const scamCandidates = scamEnriched.filter(e => {
    if (scamSynced.has(e.address)) return false;
    if (scamFailed.has(e.address) && !retryFailed) return false;
    return true;
  });

  if (scamCandidates.length > 0) {
    const batch: AddressBatch = {
      addresses: scamCandidates.map(e => e.address),
      riskScores: scamCandidates.map(() => SCAM_SOURCE.riskScore),
      tiers: scamCandidates.map(() => SCAM_SOURCE.tier),
      sanctioned: scamCandidates.map(() => SCAM_SOURCE.sanctioned),
      tags: scamCandidates.map(() => [SCAM_SOURCE.tag]),
    };
    const { success, failed, succeededAddresses, failedAddresses } = await publishBatches(wallet, registry, batch, dryRun);
    totalPublished += success;
    totalFailed += failed;
    results[SCAM_SOURCE.id] = success;

    for (const addr of succeededAddresses) {
      scamSynced.add(addr);
      scamFailed.delete(addr);
    }
    for (const addr of failedAddresses) {
      scamFailed.add(addr);
    }

    state.sources[SCAM_SOURCE.id] = {
      count: scamSynced.size,
      addresses: Array.from(scamSynced),
      failed: Array.from(scamFailed),
    };
    if (!dryRun) saveState(state);
  } else {
    logger.info('No new ScamSniffer addresses to sync');
    results[SCAM_SOURCE.id] = 0;
  }

  state.lastSync = now;
  if (incremental) {
    state.lastIncrementalSync = now;
  }
  // D2-013 fix: don't persist state in dryRun mode
  if (!dryRun) saveState(state);

  logger.info(
    `=== Batch sync complete: ${ofacCandidates.length + scamCandidates.length} new, ${totalPublished} published, ${totalFailed} failed ===`,
    { totalNew: ofacCandidates.length + scamCandidates.length, published: totalPublished, failed: totalFailed }
  );

  return {
    totalNew: ofacCandidates.length + scamCandidates.length,
    published: totalPublished,
    failed: totalFailed,
    sources: results,
  };
}

// ─── CLI Helpers ─────────────────────────────────────────────────────────────

function parseCliArgs(): BatchSyncOptions {
  const args = process.argv.slice(2);
  const options: BatchSyncOptions = {};

  for (const arg of args) {
    if (arg === '--incremental' || arg === '-i') {
      options.incremental = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--retry-failed' || arg === '-r') {
      options.retryFailed = true;
    } else if (arg.startsWith('--days=')) {
      const days = parseInt(arg.split('=')[1], 10);
      if (!isNaN(days) && days > 0) {
        options.days = days;
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
FidesOrigin Batch Collector — CLI Usage

Options:
  --incremental, -i     Enable incremental mode (delta URL or last_seen filter)
  --days=N              Lookback window for incremental mode (default: 7)
  --retry-failed, -r    Retry previously failed on-chain publishes
  --dry-run, -d         Skip blockchain transactions
  --help, -h            Show this help

Examples:
  npx ts-node src/batch-collector.ts --incremental --days=3
  npx ts-node src/batch-collector.ts --dry-run
  npx ts-node src/batch-collector.ts --incremental --days=14 --dry-run
  npx ts-node src/batch-collector.ts --retry-failed
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
