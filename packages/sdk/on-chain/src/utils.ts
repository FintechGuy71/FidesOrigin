import { Decision, RiskTier } from './types';

/**
 * Format Decision enum to human-readable string
 */
export function formatDecision(decision: Decision): string {
  const map: Record<Decision, string> = {
    [Decision.ALLOW]: 'ALLOW',
    [Decision.BLOCK]: 'BLOCK',
    [Decision.FLAG]: 'FLAG',
    [Decision.HOLD]: 'HOLD',
  };
  return map[decision] ?? 'UNKNOWN';
}

/**
 * Format RiskTier enum to human-readable string
 */
export function formatRiskTier(tier: RiskTier): string {
  const map: Record<RiskTier, string> = {
    [RiskTier.UNKNOWN]: 'Unknown',
    [RiskTier.LOW]: 'Low Risk',
    [RiskTier.MEDIUM]: 'Medium Risk',
    [RiskTier.HIGH]: 'High Risk',
  };
  return map[tier] ?? 'Unknown';
}

/**
 * Check if decision is BLOCK
 */
export function isBlocked(decision: Decision): boolean {
  return decision === Decision.BLOCK;
}

/**
 * Parse raw RiskProfile from contract into typed object
 */
export function parseRiskProfile(raw: any): { score: number; tier: RiskTier; sanctioned: boolean } {
  return {
    score: Number(raw.riskScore ?? raw[0] ?? 0),
    tier: Number(raw.tier ?? raw[1] ?? 0) as RiskTier,
    sanctioned: Boolean(raw.isSanctioned ?? raw[3] ?? false),
  };
}

/**
 * Get CSS color for risk tier (useful for frontend displays)
 */
export function getRiskColor(tier: RiskTier): string {
  const colors: Record<RiskTier, string> = {
    [RiskTier.UNKNOWN]: '#9CA3AF', // gray-400
    [RiskTier.LOW]: '#10B981',     // emerald-500
    [RiskTier.MEDIUM]: '#F59E0B',  // amber-500
    [RiskTier.HIGH]: '#EF4444',    // red-500
  };
  return colors[tier] ?? colors[RiskTier.UNKNOWN];
}

/**
 * Get emoji/icon for risk tier
 */
export function getRiskIcon(tier: RiskTier): string {
  const icons: Record<RiskTier, string> = {
    [RiskTier.UNKNOWN]: '❓',
    [RiskTier.LOW]: '✅',
    [RiskTier.MEDIUM]: '⚠️',
    [RiskTier.HIGH]: '🚫',
  };
  return icons[tier] ?? icons[RiskTier.UNKNOWN];
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Shorten address for display (0x1234...5678)
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

/**
 * Convert wei to human-readable string with decimals
 */
export function formatAmount(wei: bigint, decimals = 18, precision = 4): string {
  const divisor = 10n ** BigInt(decimals);
  const integer = wei / divisor;
  const remainder = wei % divisor;
  const fractional = remainder.toString().padStart(decimals, '0').slice(0, precision);
  return `${integer}.${fractional}`;
}
