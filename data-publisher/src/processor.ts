import { RawRiskData, RiskProfile, RiskTier, TxResult, SyncJob } from './types';
import logger from './logger';

/**
 * Data Processor - deduplicates, scores, and validates raw risk data
 */
export class DataProcessor {
  /**
   * Process raw data into normalized risk profiles
   */
  process(rawData: RawRiskData[]): RiskProfile[] {
    // Deduplicate by address + source
    const deduped = this.deduplicate(rawData);

    // Merge multiple sources for the same address
    const merged = this.mergeByAddress(deduped);

    // Validate and normalize
    const validated = merged.map(item => this.validateAndNormalize(item)).filter((item): item is RiskProfile => item !== null);

    logger.info(`Processed ${rawData.length} raw records into ${validated.length} unique risk profiles`, {
      rawCount: rawData.length,
      processedCount: validated.length,
      sanctionedCount: validated.filter(r => r.isSanctioned).length,
      criticalCount: validated.filter(r => r.tier === RiskTier.CRITICAL).length,
    });

    return validated;
  }

  /**
   * Deduplicate records by address + source
   */
  private deduplicate(data: RawRiskData[]): RawRiskData[] {
    const seen = new Map<string, RawRiskData>();

    for (const item of data) {
      const key = `${item.address.toLowerCase()}-${item.source}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, item);
      } else if ((item.confidence || 0) > (existing.confidence || 0)) {
        // Keep the one with higher confidence
        seen.set(key, item);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Merge records from multiple sources for the same address
   */
  private mergeByAddress(data: RawRiskData[]): RawRiskData[] {
    const grouped = new Map<string, RawRiskData[]>();

    for (const item of data) {
      const addr = item.address.toLowerCase();
      const group = grouped.get(addr) || [];
      group.push(item);
      grouped.set(addr, group);
    }

    const merged: RawRiskData[] = [];

    for (const [address, records] of grouped) {
      if (records.length === 1) {
        merged.push(records[0]);
        continue;
      }

      // Weighted average score
      let totalScore = 0;
      let totalWeight = 0;
      let maxTier = RiskTier.UNKNOWN;
      let isSanctioned = false;
      const allTags = new Set<string>();
      const sources: string[] = [];
      let maxConfidence = 0;

      for (const r of records) {
        const weight = r.confidence ?? 0.5;
        totalScore += (r.riskScore || 0) * weight;
        totalWeight += weight;

        if ((r.tier || 0) > maxTier) maxTier = r.tier || RiskTier.UNKNOWN;
        if (r.isSanctioned) isSanctioned = true;

        (r.tags || []).forEach(t => allTags.add(t));
        sources.push(r.source);
        if ((r.confidence || 0) > maxConfidence) maxConfidence = r.confidence || 0;
      }

      const avgScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

      merged.push({
        address,
        source: sources.join('+'),
        riskScore: avgScore,
        tier: maxTier,
        tags: Array.from(allTags),
        isSanctioned,
        reason: `Merged from ${records.length} sources: ${sources.join(', ')}`,
        confidence: maxConfidence,
      });
    }

    return merged;
  }

  /**
   * Validate and normalize a single record
   */
  private validateAndNormalize(item: RawRiskData): RiskProfile | null {
    // Validate address
    if (!item.address || typeof item.address !== 'string') {
      logger.warn(`Invalid address format skipped: ${item.address}`);
      return null;
    }
    const address = item.address.toLowerCase().trim();
    if (!address.match(/^0x[0-9a-f]{40}$/)) {
      logger.warn(`Invalid address format skipped: ${address}`);
      return null;
    }
    // [Fix] Reject zero address
    if (address === '0x0000000000000000000000000000000000000000') {
      logger.warn(`Zero address skipped`);
      return null;
    }

    // Validate score
    let score = Math.min(100, Math.max(0, item.riskScore || 0));

    // Determine tier from score if not provided
    let tier = item.tier || this.scoreToTier(score);

    // If sanctioned, force tier to CRITICAL and score to 100
    if (item.isSanctioned) {
      tier = RiskTier.CRITICAL;
      score = 100;
    }

    // Normalize tags
    const tags = (item.tags || []).map(t => t.toLowerCase().trim());
    if (item.isSanctioned && !tags.includes('sanctioned')) {
      tags.push('sanctioned');
    }
    const truncatedTags = tags.slice(0, 10); // Max 10 tags
    if (tags.length > 10) {
      logger.warn(`Tags truncated for ${address}: ${tags.slice(10).join(', ')}`);
    }

    return {
      address,
      riskScore: score,
      tier,
      tags: truncatedTags,
      isSanctioned: item.isSanctioned || false,
      source: item.source || 'unknown',
      confidence: Math.min(1, Math.max(0, item.confidence ?? 0.5)),
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate tier from score
   */
  private scoreToTier(score: number): RiskTier {
    if (score >= 80) return RiskTier.CRITICAL;
    if (score >= 60) return RiskTier.HIGH;
    if (score >= 40) return RiskTier.MEDIUM;
    if (score >= 20) return RiskTier.LOW;
    return RiskTier.UNKNOWN;
  }

  /**
   * Filter out profiles that don't need updating (already up to date on chain)
   */
  filterForUpdate(
    profiles: RiskProfile[],
    onChainData: Map<string, { score: number; tier: number; sanctioned: boolean; timestamp: number }>
  ): RiskProfile[] {
    return profiles.filter(p => {
      const onChain = onChainData.get(p.address);
      if (!onChain) return true; // New address

      // Update if score changed by more than 5 points, or tier changed, or sanction status changed
      const scoreChanged = Math.abs(p.riskScore - onChain.score) > 5;
      const tierChanged = p.tier !== onChain.tier;
      const sanctionChanged = p.isSanctioned !== onChain.sanctioned;

      return scoreChanged || tierChanged || sanctionChanged;
    });
  }
}

export default DataProcessor;
