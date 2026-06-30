"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataProcessor = void 0;
const types_1 = require("./types");
const logger_1 = __importDefault(require("./logger"));
/**
 * Data Processor — deduplicates, scores, and validates raw risk data
 */
class DataProcessor {
    /**
     * Process raw data into normalized risk profiles
     */
    process(rawData) {
        // Deduplicate by address + source
        const deduped = this.deduplicate(rawData);
        // Merge multiple sources for the same address
        const merged = this.mergeByAddress(deduped);
        // Validate and normalize
        const validated = merged.map(item => this.validateAndNormalize(item));
        logger_1.default.info(`Processed ${rawData.length} raw records into ${validated.length} unique risk profiles`, {
            rawCount: rawData.length,
            processedCount: validated.length,
            sanctionedCount: validated.filter(r => r.isSanctioned).length,
            criticalCount: validated.filter(r => r.tier === types_1.RiskTier.CRITICAL).length,
        });
        return validated;
    }
    /**
     * Deduplicate records by address + source
     */
    deduplicate(data) {
        const seen = new Map();
        for (const item of data) {
            const key = `${item.address.toLowerCase()}-${item.source}`;
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, item);
            }
            else if ((item.confidence || 0) > (existing.confidence || 0)) {
                // Keep the one with higher confidence
                seen.set(key, item);
            }
        }
        return Array.from(seen.values());
    }
    /**
     * Merge records from multiple sources for the same address
     */
    mergeByAddress(data) {
        const grouped = new Map();
        for (const item of data) {
            const addr = item.address.toLowerCase();
            const group = grouped.get(addr) || [];
            group.push(item);
            grouped.set(addr, group);
        }
        const merged = [];
        for (const [address, records] of grouped) {
            if (records.length === 1) {
                merged.push(records[0]);
                continue;
            }
            // Weighted average score
            let totalScore = 0;
            let totalWeight = 0;
            let maxTier = types_1.RiskTier.UNKNOWN;
            let isSanctioned = false;
            const allTags = new Set();
            const sources = [];
            let maxConfidence = 0;
            for (const r of records) {
                const weight = r.confidence || 0.5;
                totalScore += (r.riskScore || 0) * weight;
                totalWeight += weight;
                if ((r.tier || 0) > maxTier)
                    maxTier = r.tier || types_1.RiskTier.UNKNOWN;
                if (r.isSanctioned)
                    isSanctioned = true;
                (r.tags || []).forEach(t => allTags.add(t));
                sources.push(r.source);
                if ((r.confidence || 0) > maxConfidence)
                    maxConfidence = r.confidence || 0;
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
    validateAndNormalize(item) {
        // Validate address
        const address = item.address.toLowerCase().trim();
        if (!address.match(/^0x[0-9a-f]{40}$/)) {
            throw new Error(`Invalid address format: ${address}`);
        }
        // Validate score
        let score = Math.min(100, Math.max(0, item.riskScore || 0));
        // Determine tier from score if not provided
        let tier = item.tier || this.scoreToTier(score);
        // If sanctioned, force tier to CRITICAL and score to 100
        if (item.isSanctioned) {
            tier = types_1.RiskTier.CRITICAL;
            score = 100;
        }
        // Normalize tags
        const tags = (item.tags || []).map(t => t.toLowerCase().trim());
        if (item.isSanctioned && !tags.includes('sanctioned')) {
            tags.push('sanctioned');
        }
        return {
            address,
            riskScore: score,
            tier,
            tags: tags.slice(0, 10), // Max 10 tags
            isSanctioned: item.isSanctioned || false,
            source: item.source || 'unknown',
            confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
            timestamp: Date.now(),
        };
    }
    /**
     * Calculate tier from score
     */
    scoreToTier(score) {
        if (score >= 80)
            return types_1.RiskTier.CRITICAL;
        if (score >= 60)
            return types_1.RiskTier.HIGH;
        if (score >= 40)
            return types_1.RiskTier.MEDIUM;
        if (score >= 20)
            return types_1.RiskTier.LOW;
        return types_1.RiskTier.UNKNOWN;
    }
    /**
     * Filter out profiles that don't need updating (already up to date on chain)
     */
    filterForUpdate(profiles, onChainData) {
        return profiles.filter(p => {
            const onChain = onChainData.get(p.address);
            if (!onChain)
                return true; // New address
            // Update if score changed by more than 5 points, or tier changed, or sanction status changed
            const scoreChanged = Math.abs(p.riskScore - onChain.score) > 5;
            const tierChanged = p.tier !== onChain.tier;
            const sanctionChanged = p.isSanctioned !== onChain.sanctioned;
            return scoreChanged || tierChanged || sanctionChanged;
        });
    }
}
exports.DataProcessor = DataProcessor;
exports.default = DataProcessor;
//# sourceMappingURL=processor.js.map