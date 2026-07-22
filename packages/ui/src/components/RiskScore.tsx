import React from 'react';
import type { AddressRisk, RiskLevel } from '@fidesorigin/shared';
import { RISK_LEVELS } from '@fidesorigin/shared';
import { RiskBadge } from './RiskBadge';

export interface RiskScoreProps {
  /** Risk assessment data (full mode) */
  risk?: AddressRisk;
  /** Direct score value (inline/simplified mode) */
  score?: number;
  /** Direct risk level (inline/simplified mode) */
  level?: RiskLevel;
  /** Size variant for inline mode */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to animate the score ring */
  animated?: boolean;
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
export const RiskScore: React.FC<RiskScoreProps> = ({
  risk,
  score: inlineScore,
  level: inlineLevel,
  size = 'md',
  animated = false,
  showDetails = false,
  showEntities = false,
  showStats = false,
  compact = false,
  className = '',
}) => {
  // Support both full Risk object mode and inline score/level mode
  const overallLevel = inlineLevel ?? risk?.overallLevel ?? 'medium';
  const overallScore = inlineScore ?? risk?.overallScore ?? 0;

  // [P1 Fix] Defensive access: fallback to 'medium' for unknown/invalid levels
  const overallConfig = RISK_LEVELS[overallLevel as keyof typeof RISK_LEVELS] ?? RISK_LEVELS['medium'];

  // Calculate score ring color and circumference
  const circumference = 2 * Math.PI * 36; // radius = 36
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  // Inline/simplified mode (just score ring + badge)
  if (inlineScore !== undefined || inlineLevel !== undefined) {
    const ringSize = size === 'lg' ? 'w-20 h-20' : size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';
    const textSize = size === 'lg' ? 'text-lg' : size === 'sm' ? 'text-sm' : 'text-base';
    const svgSize = size === 'lg' ? 80 : size === 'sm' ? 48 : 64;
    const radius = size === 'lg' ? 36 : size === 'sm' ? 20 : 28;
    const strokeWidth = size === 'lg' ? 6 : size === 'sm' ? 4 : 5;
    const inlineCircumference = 2 * Math.PI * radius;
    const inlineOffset = inlineCircumference - (overallScore / 100) * inlineCircumference;

    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`relative ${ringSize} ${animated ? 'animate-pulse' : ''}`}>
          <svg className={`${ringSize} -rotate-90`} viewBox={`0 0 ${svgSize} ${svgSize}`}>
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={inlineCircumference}
              strokeDashoffset={inlineOffset}
              className={overallConfig.textColor}
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center ${textSize} font-bold`}>
            {overallScore}
          </span>
        </div>
        <RiskBadge level={overallLevel} size={size === 'lg' ? 'md' : 'sm'} showScore={false} />
      </div>
    );
  }

  // Compact mode
  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={overallConfig.textColor}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
            {overallScore}
          </span>
        </div>
        <RiskBadge level={overallLevel} size="sm" />
      </div>
    );
  }

  // Full mode
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Score Header */}
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={overallConfig.textColor}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
            {overallScore}
          </span>
        </div>
        <div>
          <RiskBadge level={overallLevel} size="lg" showScore score={overallScore} />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {overallConfig.description}
          </p>
        </div>
      </div>

      {/* Risk Flags */}
      {risk && risk.flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {risk.flags.map((flag) => (
            <span
              key={flag}
              className="px-2 py-1 text-xs rounded-md bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800"
            >
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Detailed Scores */}
      {showDetails && risk && risk.scores.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Risk Breakdown
          </h4>
          {risk.scores.map((score) => (
            <div key={score.category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{score.category}</span>
                <span className="font-medium">{score.score}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${RISK_LEVELS[score.level as keyof typeof RISK_LEVELS]?.bgColor ?? 'bg-gray-500'}`}
                  style={{ width: `${score.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Related Entities */}
      {showEntities && risk && risk.relatedEntities && risk.relatedEntities.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Related Entities
          </h4>
          <div className="space-y-1">
            {risk.relatedEntities.map((entity) => (
              <div
                key={entity.name}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <span className="text-sm font-medium">{entity.name}</span>
                <RiskBadge level={entity.riskLevel} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction Stats */}
      {showStats && risk && risk.transactionStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Transactions" value={String(risk.transactionStats?.totalTransactions ?? '-')} />
          <StatCard label="Volume" value={String(risk.transactionStats?.totalVolume ?? '-')} />
          <StatCard label="Age (days)" value={String(risk.transactionStats?.accountAge ?? '-')} />
          <StatCard label="Counterparties" value={String(risk.transactionStats?.uniqueCounterparties ?? '-')} />
        </div>
      )}
    </div>
  );
};

/** Internal stat card component */
const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</div>
  </div>
);

/** Risk trend display props */
export interface RiskTrendProps {
  /** Current risk score */
  current: number;
  /** Previous risk score for comparison */
  previous: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * RiskTrend - Displays risk score trend compared to previous value
 *
 * Shows an up/down arrow with color-coded difference percentage.
 *
 * @example
 * ```tsx
 * <RiskTrend current={80} previous={60} />
 * ```
 */
export const RiskTrend: React.FC<RiskTrendProps> = ({
  current,
  previous,
  className = '',
}) => {
  const diff = current - previous;
  const isUp = diff > 0;
  const isNeutral = diff === 0;
  const percentChange = previous > 0 ? Math.round((diff / previous) * 100) : 0;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {!isNeutral && (
        <svg
          className={`w-4 h-4 ${isUp ? 'text-red-400' : 'text-green-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={
              isUp
                ? 'M5 10l7-7m0 0l7 7m-7-7v18'
                : 'M19 14l-7 7m0 0l-7-7m7 7V3'
            }
          />
        </svg>
      )}
      <span
        className={`text-sm font-medium ${
          isNeutral
            ? 'text-gray-400'
            : isUp
            ? 'text-red-400'
            : 'text-green-400'
        }`}
      >
        {isNeutral ? '—' : `${isUp ? '+' : ''}${percentChange}%`}
      </span>
    </div>
  );
};

export default RiskScore;
