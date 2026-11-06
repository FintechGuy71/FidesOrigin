import { describe, expect, it } from 'vitest';
import { scoreToTier } from './riskTier';

describe('scoreToTier contract boundaries', () => {
  it('matches RiskRegistry enum thresholds exactly', () => {
    expect(scoreToTier(0)).toBe(0);
    expect(scoreToTier(29)).toBe(0);
    expect(scoreToTier(30)).toBe(1);
    expect(scoreToTier(49)).toBe(1);
    expect(scoreToTier(50)).toBe(2);
    expect(scoreToTier(79)).toBe(2);
    expect(scoreToTier(80)).toBe(3);
    expect(scoreToTier(94)).toBe(3);
    expect(scoreToTier(95)).toBe(4);
    expect(scoreToTier(100)).toBe(4);
  });

  it('fails safe for non-numeric input', () => {
    expect(scoreToTier(Number.NaN)).toBe(0);
    expect(scoreToTier(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
