import React from 'react';
import type { AddressRisk } from '@fidesorigin/shared';
export interface RiskScoreProps {
    /** Risk assessment data */
    risk: AddressRisk;
    /** Whether to show detailed breakdown */
    showDetails?: boolean;
    /** Whether to show related entities */
    showEntities?: boolean;
    /** Whether to show transaction stats */
    showStats?: boolean;
    /** Compact mode */
    compact?: boolean;
    /** Additional CSS classes */
    className?: string;
}
/**
 * RiskScore - Comprehensive risk assessment display component
 *
 * Displays overall risk score, level badge, and optional detailed breakdown
 * of individual risk categories, related entities, and transaction statistics.
 *
 * @example
 * ```tsx
 * <RiskScore risk={riskData} showDetails showEntities />
 * <RiskScore risk={riskData} compact />
 * ```
 */
export declare const RiskScore: React.FC<RiskScoreProps>;
export default RiskScore;
