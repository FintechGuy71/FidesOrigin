import { FidesOriginClient } from './client';
import {
  AddressRisk,
  RiskCheckOptions,
  BatchRiskCheckRequest,
  BatchRiskCheckResponse,
  RiskLevel
} from './types';

/**
 * Risk Assessment Helper Functions
 * 
 * Provides convenient methods for risk assessment operations
 */

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
  const { baseUrl = 'https://api.fidesorigin.com', ...riskOptions } = options;
  
  const client = new FidesOriginClient({
    baseUrl,
    apiKey
  });
  
  return client.checkAddress(address, riskOptions);
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
  const { baseUrl = 'https://api.fidesorigin.com', chain, detailed } = options;
  
  const client = new FidesOriginClient({
    baseUrl,
    apiKey
  });
  
  return client.checkBatchAddresses({
    addresses,
    chain,
    detailed
  });
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
    return this.client.checkAddress(address, options);
  }

  /**
   * Check multiple addresses
   */
  async checkBatch(
    addresses: string[],
    options?: Omit<BatchRiskCheckRequest, 'addresses'>
  ): Promise<BatchRiskCheckResponse> {
    return this.client.checkBatchAddresses({
      addresses,
      ...options
    });
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
