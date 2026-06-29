import React from 'react';
import type { RiskLevel } from '@fidesorigin/shared';
import { RISK_LEVELS } from '@fidesorigin/shared';

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
export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  size = 'md',
  showScore = false,
  score,
  className = '',
}) => {
  // [Fix] Defensive access: fallback to 'medium' for unknown/invalid levels
  const config = RISK_LEVELS[level] ?? RISK_LEVELS['medium'];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        sizeClasses[size],
        config.bgColor,
        'text-white',
        className,
      ].join(' ')}
      title={config.description}
      role="status"
      aria-label={`Risk level: ${config.name}`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full bg-white/80"
        aria-hidden="true"
      />
      {config.label}
      {showScore && score !== undefined && (
        <span className="opacity-80">({score})</span>
      )}
    </span>
  );
};

export default RiskBadge;
