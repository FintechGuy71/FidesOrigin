import { log } from '@graphprotocol/graph-ts';

export function getRiskTier(tierValue: i32): string {
  if (tierValue === 0) return 'UNKNOWN';
  if (tierValue === 1) return 'LOW';
  if (tierValue === 2) return 'MEDIUM';
  if (tierValue === 3) return 'HIGH';
  // Defensive: unknown tier values should not crash the indexer.
  // Log the unexpected value and return UNKNOWN to maintain data consistency.
  log.warning(
    '[getRiskTier] Unknown tierValue received: {}. Returning UNKNOWN to prevent mapping error.',
    [tierValue.toString()]
  );
  return 'UNKNOWN';
}
