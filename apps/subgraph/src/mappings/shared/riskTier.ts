import { log } from '@graphprotocol/graph-ts';

export function getRiskTier(tierValue: i32): string {
  if (tierValue === 0) return 'UNKNOWN';
  if (tierValue === 1) return 'LOW';
  if (tierValue === 2) return 'MEDIUM';
  if (tierValue === 3) return 'HIGH';
  log.warning(
    '[getRiskTier] Unknown tierValue received: {}. Returning UNKNOWN.',
    [tierValue.toString()]
  );
  return 'UNKNOWN';
}
