import React from 'react';
import type { RiskLevel } from '@fidesorigin/shared';
export interface RiskBadgeProps {
    /** Risk level to display */
    level: RiskLevel;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Show score number */
    showScore?: boolean;
    /** Score value (if showing score) */
    score?: number;
    /** Additional CSS classes */
    className?: string;
}
/**
 * RiskBadge - Displays a risk level indicator badge
 *
 * @example
 * ```tsx
 * <RiskBadge level="high" showScore score={75} />
 * <RiskBadge level="low" size="sm" />
 * ```
 */
export declare const RiskBadge: React.FC<RiskBadgeProps>;
export default RiskBadge;
