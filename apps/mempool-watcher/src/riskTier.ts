/** RiskRegistry.RiskTier: UNKNOWN=0, LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4. */
export function scoreToTier(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score >= 95) return 4;
  if (score >= 80) return 3;
  if (score >= 50) return 2;
  if (score >= 30) return 1;
  return 0;
}
