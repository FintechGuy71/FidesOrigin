import axios from 'axios';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import { DataSourceConfig, RawRiskData, RiskTier } from './types';
import logger from './logger';

/**
 * Extended Data Collectors — additional sources beyond the base set
 */

// ============================================
// Elliptic API
// ============================================
export async function fetchElliptic(config: DataSourceConfig): Promise<RawRiskData[]> {
  if (!config.apiKey) {
    logger.warn('Elliptic API key not configured');
    return [];
  }

  const response = await axios.get(`${config.endpoint}v2/wallet Screening`, {
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
    },
    timeout: config.timeout,
    maxRedirects: 0,
  });

  const results: RawRiskData[] = [];

  for (const item of response.data?.entities || []) {
    const riskScore = item.riskScore || 0;
    results.push({
      address: item.address.toLowerCase(),
      source: 'Elliptic',
      riskScore,
      tier: scoreToTier(riskScore),
      tags: item.tags || [],
      isSanctioned: item.sanctions || false,
      reason: item.description || 'Elliptic risk assessment',
      confidence: 0.92,
    });
  }

  return results;
}

// ============================================
// TRM Labs API
// [Audit-Fix #11] Throw NotImplemented error instead of silently returning empty array
// when API key is configured but the implementation is incomplete.
// ============================================
export async function fetchTRMLabs(config: DataSourceConfig): Promise<RawRiskData[]> {
  if (!config.apiKey) {
    logger.warn('TRM Labs API key not configured');
    return [];
  }

  // [Audit-Fix #11] The TRM Labs integration requires a list of addresses to screen,
  // but the current pipeline does not pass them. Throw an explicit error instead of
  // silently sending an empty array (which would always return zero results).
  throw new Error(
    'TRM Labs fetchTRMLabs: address batching not implemented. ' +
    'This connector requires a pre-collected list of addresses to screen. ' +
    'Pass addresses via config.endpoint or implement a dedicated address collection step.'
  );
}

// ============================================
// Local CSV File
// ============================================
export async function fetchCSV(config: DataSourceConfig): Promise<RawRiskData[]> {
  const filePath = config.endpoint.replace('file://', '');
  
  try {
    await fs.access(filePath);
  } catch {
    logger.error(`CSV file not found: ${filePath}`);
    return [];
  }

  return new Promise((resolve, reject) => {
    const results: RawRiskData[] = [];
    
    createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: any) => {
        try {
          const address = (row.address || row.addr || row.wallet)?.toLowerCase().trim();
          if (!address || !address.match(/^0x[0-9a-f]{40}$/)) return;

          const riskScore = parseInt(row.riskScore || row.riskScore || '0', 10);
          const tags = (row.tags || row.categories || '')
            .split(',')
            .map((t: string) => t.trim().toLowerCase())
            .filter((t: string) => t.length > 0);

          results.push({
            address,
            source: row.source || 'CSV-Import',
            riskScore,
            tier: scoreToTier(riskScore),
            tags,
            isSanctioned: row.sanctioned?.toLowerCase() === 'true' || tags.includes('sanctioned'),
            reason: row.reason || row.description || 'CSV imported risk data',
            confidence: parseFloat(row.confidence || '0.8'),
          });
        } catch (err) {
          logger.warn(`Failed to parse CSV row`, { row, error: (err as Error).message });
        }
      })
      .on('end', () => {
        logger.info(`Parsed ${results.length} records from CSV: ${filePath}`);
        resolve(results);
      })
      .on('error', reject);
  });
}

// ============================================
// JSON File (local or remote URL)
// ============================================
export async function fetchJSON(config: DataSourceConfig): Promise<RawRiskData[]> {
  let data: any;

  if (config.endpoint.startsWith('http')) {
    const response = await axios.get(config.endpoint, {
      timeout: config.timeout,
      maxRedirects: 0,
    });
    data = response.data;
  } else {
    const filePath = config.endpoint.replace('file://', '');
    const content = await fs.readFile(filePath, 'utf-8');
    data = JSON.parse(content);
  }

  const results: RawRiskData[] = [];
  const items = Array.isArray(data) ? data : data.addresses || data.results || [];

  for (const item of items) {
    const address = (item.address || item.addr || item.wallet)?.toLowerCase().trim();
    if (!address || !address.match(/^0x[0-9a-f]{40}$/)) continue;

    const riskScore = item.riskScore || item.riskScore || 0;
    const tags = Array.isArray(item.tags) ? item.tags : 
      (item.tags || item.categories || '').split(',').map((t: string) => t.trim()).filter(Boolean);

    results.push({
      address,
      source: item.source || 'JSON-Import',
      riskScore,
      tier: scoreToTier(riskScore),
      tags,
      isSanctioned: item.sanctioned === true || tags.includes('sanctioned'),
      reason: item.reason || item.description || 'JSON imported risk data',
      confidence: item.confidence || 0.8,
    });
  }

  return results;
}

// ============================================
// Flashbots Protect RPC (MEV protection)
// ============================================
export function getFlashbotsProvider(rpcUrl: string): string {
  // Replace standard RPC with Flashbots Protect for transaction privacy
  if (rpcUrl.includes('mainnet')) {
    return 'https://rpc.flashbots.net';
  }
  return rpcUrl;
}

// ============================================
// Helper
// ============================================
function scoreToTier(score: number): RiskTier {
  if (score >= 80) return RiskTier.CRITICAL;
  if (score >= 60) return RiskTier.HIGH;
  if (score >= 40) return RiskTier.MEDIUM;
  if (score >= 20) return RiskTier.LOW;
  return RiskTier.UNKNOWN;
}
