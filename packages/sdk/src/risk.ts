import { FidesOriginClient } from './client';
import { DEFAULT_API_BASE_URL } from './config';
import {
  AddressRisk,
  RiskCheckOptions,
  BatchRiskCheckRequest,
  BatchRiskCheckInput,
  BatchRiskCheckResponse,
  RiskLevel
} from './types';

/**
 * Risk Assessment Helper Functions
 * 
 * Provides convenient methods for risk assessment operations
 */

// [MEDIUM Fix #15] 使用单例 client 避免每次调用 checkAddress 都创建新实例
// 缓存已创建的 client，按 baseUrl+apiKey 作为 key
const _clientCache = new Map<string, FidesOriginClient>();

function getCachedClient(baseUrl: string, apiKey: string): FidesOriginClient {
  const cacheKey = `${baseUrl}:${apiKey}`;
  let client = _clientCache.get(cacheKey);
  if (!client) {
    client = new FidesOriginClient({ baseUrl, apiKey });
    _clientCache.set(cacheKey, client);
  }
  return client;
}

/**
 * Quick risk check - one line integration
 * 
 * @example
 * ```typescript
 * import { checkAddress } from '@fidesorigin/sdk';
 * 
 * const risk = await checkAddress('0x123...', 'YOUR_API_KEY');
 * console.log(risk.risk.level); // 'low', 'medium', 'high', 'critical'
 * ```
 */
export async function checkAddress(
  address: string,
  apiKey: string,
  options: RiskCheckOptions & { baseUrl?: string } = {}
): Promise<AddressRisk> {
  const { baseUrl = DEFAULT_API_BASE_URL, ...riskOptions } = options;
  
  // [MEDIUM Fix #15] 使用缓存的 singleton client
  const client = getCachedClient(baseUrl, apiKey);
  
  /* [AUDIT FIX 2026-09-18 R3] checkRisk 返回 RiskCheckResult（risk_score/risk_level
     顶层字段），而本函数契约是 AddressRisk（risk:{score,level} 嵌套）。显式映射。 */
  const r = await client.checkRisk({ address, chainId: 1, ...riskOptions });
  return {
    address: r.address,
    chain: r.chain,
    type: r.addressType || 'unknown',
    risk: {
      score: r.risk_score ?? 0,
      level: (r.risk_level || 'low') as import('./types').RiskLevel,
      confidence: 1.0,
    },
    flags: (r.risk_factors || []).map(f => (f.name || 'suspicious_activity') as import('./types').RiskFlag),
    assessedAt: r.timestamp || new Date().toISOString(),
  };
}

/**
 * Batch risk check for multiple addresses
 * 
 * @example
 * ```typescript
 * import { checkBatchAddresses } from '@fidesorigin/sdk';
 * 
 * const result = await checkBatchAddresses(
 *   ['0x123...', '0x456...'],
 *   'YOUR_API_KEY'
 * );
 * ```
 */
export async function checkBatchAddresses(
  addresses: string[],
  apiKey: string,
  options: { baseUrl?: string; chain?: import('./types').Chain; detailed?: boolean } = {}
): Promise<BatchRiskCheckResponse> {
  const { baseUrl = DEFAULT_API_BASE_URL, chain, detailed } = options;
  
  // [MEDIUM Fix #15] 使用缓存的 singleton client
  const client = getCachedClient(baseUrl, apiKey);
  
  // [AUDIT FIX 2026-09-18 R3-L10] 原把 detailed 布尔误映射为 amount:'0' 参数
  // 发往 API（金额字段被污染）。detailed 仅影响返回粒度，不应产生 amount。
  /* [AUDIT FIX 2026-09-18 R3] batchCheckRisk 返回 BatchRiskCheckResult
     （results: RiskCheckResult[]），契约是 BatchRiskCheckResponse
     （results: AddressRisk[]）。显式映射（与 client.checkBatchAddresses 同逻辑）。 */
  const result = await client.batchCheckRisk({ addresses, chainId: 1, ...(chain ? { chainId: chain as any } : {}) });
  return {
    results: result.results.map((r) => ({
      address: r.address,
      chain: r.chain,
      type: r.addressType || 'unknown',
      risk: {
        score: r.risk_score ?? 0,
        level: (r.risk_level || 'low') as import('./types').RiskLevel,
        confidence: 1.0,
      },
      flags: (r.risk_factors || []).map(f => (f.name || 'suspicious_activity') as import('./types').RiskFlag),
      assessedAt: r.timestamp || new Date().toISOString(),
    })),
  };
}

/**
 * Check if an address is considered risky
 * 
 * @param riskLevel - The risk level to check
 * @param threshold - The threshold level (default: 'medium')
 * @returns true if risk level is at or above threshold
 * 
 * @example
 * ```typescript
 * import { isRisky, checkAddress } from '@fidesorigin/sdk';
 * 
 * const risk = await checkAddress('0x123...', 'YOUR_API_KEY');
 * if (isRisky(risk.risk.level, 'medium')) {
 *   console.log('Address is risky!');
 * }
 * ```
 */
export function isRisky(
  riskLevel: RiskLevel,
  threshold: RiskLevel = 'medium'
): boolean {
  const levels: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };
  
  return levels[riskLevel] >= levels[threshold];
}

/**
 * Check if an address is safe (low risk)
 * 
 * @param riskLevel - The risk level to check
 * @returns true if risk level is 'low'
 */
export function isSafe(riskLevel: RiskLevel): boolean {
  return riskLevel === 'low';
}

/**
 * Get risk color for UI display
 * 
 * @param riskLevel - The risk level
 * @returns CSS color value
 */
export function getRiskColor(riskLevel: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    low: '#10B981',      // Green
    medium: '#F59E0B',   // Yellow/Orange
    high: '#EF4444',     // Red
    critical: '#7C2D12'  // Dark Red
  };
  
  return colors[riskLevel] || '#6B7280';
}

/**
 * Get risk label for display
 * 
 * @param riskLevel - The risk level
 * @returns Human readable label
 */
export function getRiskLabel(riskLevel: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk'
  };
  
  return labels[riskLevel] || 'Unknown Risk';
}

/**
 * Filter addresses by risk level
 * 
 * @param addresses - Array of address risk assessments
 * @param minRiskLevel - Minimum risk level to include
 * @returns Filtered array of risky addresses
 * 
 * @example
 * ```typescript
 * const riskyAddresses = filterByRiskLevel(results, 'high');
 * ```
 */
export function filterByRiskLevel(
  addresses: AddressRisk[],
  minRiskLevel: RiskLevel
): AddressRisk[] {
  return addresses.filter(addr => isRisky(addr.risk.level, minRiskLevel));
}

/**
 * Sort addresses by risk score (highest first)
 * 
 * @param addresses - Array of address risk assessments
 * @returns Sorted array
 */
export function sortByRiskScore(addresses: AddressRisk[]): AddressRisk[] {
  return [...addresses].sort((a, b) => b.risk.score - a.risk.score);
}

/**
 * Get risk statistics for a batch of addresses
 * 
 * @param addresses - Array of address risk assessments
 * @returns Statistics object
 */
export function getRiskStatistics(addresses: AddressRisk[]): {
  total: number;
  byLevel: Record<RiskLevel | 'unknown', number>;
  averageScore: number;
  highestRisk: AddressRisk | null;
} {
  const stats = {
    total: addresses.length,
    byLevel: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      unknown: 0
    } as Record<RiskLevel | 'unknown', number>,
    averageScore: 0,
    highestRisk: null as AddressRisk | null
  };
  
  if (addresses.length === 0) {
    return stats;
  }
  
  let totalScore = 0;
  let maxScore = -1;
  
  addresses.forEach(addr => {
    const level = addr.risk?.level || 'unknown';
    stats.byLevel[level]++;
    
    const score = addr.risk?.score || 0;
    totalScore += score;
    
    if (score > maxScore) {
      maxScore = score;
      stats.highestRisk = addr;
    }
  });
  
  stats.averageScore = Math.round((totalScore / addresses.length) * 100) / 100;
  
  return stats;
}

/**
 * Risk Assessment Class
 * 
 * Provides a fluent interface for risk assessment operations
 */
export class RiskAssessor {
  private client: FidesOriginClient;

  constructor(client: FidesOriginClient) {
    this.client = client;
  }

  /**
   * Check single address risk
   */
  async check(address: string, options?: RiskCheckOptions): Promise<AddressRisk> {
    const result = await this.client.checkRisk({ address, chainId: 1, ...options });
    /* [AUDIT FIX 2026-09-18 R3-M14] 原读不存在的 overallScore/flags →
       undefined.map TypeError。RiskCheckResult 真实字段为 risk_score/risk_level/
       risk_factors。 */
    return {
      address: result.address,
      chain: result.chain,
      type: result.addressType,
      risk: {
        score: result.risk_score ?? result.overallScore ?? 0,
        level: (result.risk_level ?? result.overallLevel ?? 'low') as RiskLevel,
        confidence: 1.0,
      },
      // [R3] RiskFactor 仅 name/weight/score/description；RiskFlag 为字符串联合
      flags: (result.risk_factors ?? result.flags ?? []).map(f =>
        (typeof f === 'string' ? f : f.name || 'suspicious_activity') as import('./types').RiskFlag
      ),
      assessedAt: result.timestamp,
    };
  }

  /**
   * Check multiple addresses
   */
  async checkBatch(
    addresses: string[],
    options?: Omit<BatchRiskCheckInput, 'addresses'>
  ): Promise<BatchRiskCheckResponse> {
    // [AUDIT FIX 2026-09-18 R3] 与单地址同款契约修正：读 risk_score/risk_level/
    // risk_factors 真实字段，flags 映射为 RiskFlag 字符串联合
    const result = await this.client.batchCheckRisk({ addresses, chainId: options?.chainId || 1 });
    return {
      results: result.results.map(r => ({
        address: r.address,
        chain: r.chain,
        type: r.addressType || 'unknown',
        risk: {
          score: r.risk_score ?? 0,
          level: (r.risk_level || 'low') as RiskLevel,
          confidence: 1.0,
        },
        flags: (r.risk_factors || []).map(f => (f.name || 'suspicious_activity') as import('./types').RiskFlag),
        assessedAt: r.timestamp || new Date().toISOString(),
      })),
      failed: [],
    };
  }

  /**
   * Find high-risk addresses from a list
   */
  async findHighRisk(
    addresses: string[],
    threshold: RiskLevel = 'high'
  ): Promise<AddressRisk[]> {
    const result = await this.checkBatch(addresses);
    return filterByRiskLevel(result.results, threshold);
  }

  /**
   * Validate if all addresses are safe
   */
  async validateAllSafe(addresses: string[]): Promise<{
    safe: boolean;
    riskyAddresses: AddressRisk[];
  }> {
    const result = await this.checkBatch(addresses);
    const riskyAddresses = filterByRiskLevel(result.results, 'medium');
    
    return {
      safe: riskyAddresses.length === 0,
      riskyAddresses
    };
  }
}

// Re-export types
export * from './types';
