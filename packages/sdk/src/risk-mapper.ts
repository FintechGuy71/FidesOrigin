import type {
  AddressRisk,
  BatchRiskCheckResponse,
  BatchRiskCheckResult,
  RiskCheckResult,
  RiskLevel,
} from './types';

const RISK_LEVELS = new Set<RiskLevel>(['low', 'medium', 'high', 'critical', 'unknown']);

/** Preserve uncertainty instead of silently converting it into a safe assessment. */
export function normalizeRiskLevel(value: unknown): RiskLevel {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.toLowerCase() as RiskLevel;
  return RISK_LEVELS.has(normalized) ? normalized : 'unknown';
}

export function toAddressRisk(result: RiskCheckResult): AddressRisk {
  const level = normalizeRiskLevel(result.risk_level ?? result.overallLevel);
  return {
    address: result.address,
    chain: result.chain,
    type: result.addressType || 'unknown',
    knownAddress: result.knownAddress ?? result.known_address ?? (level === 'unknown' ? false : undefined),
    risk: {
      score: result.risk_score ?? result.overallScore ?? 0,
      level,
      confidence: result.confidence ?? null,
    },
    flags: (result.risk_factors ?? result.flags ?? []).map((factor) => (
      typeof factor === 'string' ? factor : factor.name || 'suspicious_activity'
    ) as AddressRisk['flags'][number]),
    assessedAt: result.timestamp || new Date().toISOString(),
  };
}

export function toBatchRiskCheckResponse(result: BatchRiskCheckResult): BatchRiskCheckResponse {
  return {
    results: result.results.map(toAddressRisk),
    ...(result.failed ? { failed: result.failed } : {}),
  };
}
