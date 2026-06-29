import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RISK_LEVELS } from '@fidesorigin/shared';
import { RiskBadge } from './RiskBadge';
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
export const RiskScore = ({ risk, showDetails = false, showEntities = false, showStats = false, compact = false, className = '', }) => {
    const overallConfig = RISK_LEVELS[risk.overallLevel];
    // Calculate score ring color and circumference
    const circumference = 2 * Math.PI * 36; // radius = 36
    const strokeDashoffset = circumference - (risk.overallScore / 100) * circumference;
    if (compact) {
        return (_jsxs("div", { className: `flex items-center gap-3 ${className}`, children: [_jsxs("div", { className: "relative w-12 h-12", children: [_jsxs("svg", { className: "w-12 h-12 -rotate-90", viewBox: "0 0 80 80", children: [_jsx("circle", { cx: "40", cy: "40", r: "36", fill: "none", stroke: "currentColor", strokeWidth: "6", className: "text-gray-200 dark:text-gray-700" }), _jsx("circle", { cx: "40", cy: "40", r: "36", fill: "none", stroke: "currentColor", strokeWidth: "6", strokeLinecap: "round", strokeDasharray: circumference, strokeDashoffset: strokeDashoffset, className: overallConfig.textColor })] }), _jsx("span", { className: "absolute inset-0 flex items-center justify-center text-sm font-bold", children: risk.overallScore })] }), _jsx(RiskBadge, { level: risk.overallLevel, size: "sm" })] }));
    }
    return (_jsxs("div", { className: `space-y-4 ${className}`, children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "relative w-20 h-20", children: [_jsxs("svg", { className: "w-20 h-20 -rotate-90", viewBox: "0 0 80 80", children: [_jsx("circle", { cx: "40", cy: "40", r: "36", fill: "none", stroke: "currentColor", strokeWidth: "6", className: "text-gray-200 dark:text-gray-700" }), _jsx("circle", { cx: "40", cy: "40", r: "36", fill: "none", stroke: "currentColor", strokeWidth: "6", strokeLinecap: "round", strokeDasharray: circumference, strokeDashoffset: strokeDashoffset, className: overallConfig.textColor })] }), _jsx("span", { className: "absolute inset-0 flex items-center justify-center text-lg font-bold", children: risk.overallScore })] }), _jsxs("div", { children: [_jsx(RiskBadge, { level: risk.overallLevel, size: "lg", showScore: true, score: risk.overallScore }), _jsx("p", { className: "mt-1 text-sm text-gray-500 dark:text-gray-400", children: overallConfig.description })] })] }), risk.flags.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: risk.flags.map((flag) => (_jsx("span", { className: "px-2 py-1 text-xs rounded-md bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800", children: flag.replace(/_/g, ' ') }, flag))) })), showDetails && risk.scores.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "text-sm font-semibold text-gray-700 dark:text-gray-300", children: "Risk Breakdown" }), risk.scores.map((score) => (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-600 dark:text-gray-400", children: score.category }), _jsx("span", { className: "font-medium", children: score.score })] }), _jsx("div", { className: "h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all duration-500 ${RISK_LEVELS[score.level].bgColor}`, style: { width: `${score.score}%` } }) })] }, score.category)))] })), showEntities && risk.relatedEntities && risk.relatedEntities.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "text-sm font-semibold text-gray-700 dark:text-gray-300", children: "Related Entities" }), _jsx("div", { className: "space-y-1", children: risk.relatedEntities.map((entity) => (_jsxs("div", { className: "flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800", children: [_jsx("span", { className: "text-sm font-medium", children: entity.name }), _jsx(RiskBadge, { level: entity.riskLevel, size: "sm" })] }, entity.name))) })] })), showStats && risk.transactionStats && (_jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [_jsx(StatCard, { label: "Transactions", value: risk.transactionStats.totalTransactions.toString() }), _jsx(StatCard, { label: "Volume", value: risk.transactionStats.totalVolume }), _jsx(StatCard, { label: "Age (days)", value: risk.transactionStats.accountAge.toString() }), _jsx(StatCard, { label: "Counterparties", value: risk.transactionStats.uniqueCounterparties.toString() })] }))] }));
};
/** Internal stat card component */
const StatCard = ({ label, value }) => (_jsxs("div", { className: "px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800", children: [_jsx("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: label }), _jsx("div", { className: "text-sm font-semibold text-gray-900 dark:text-gray-100", children: value })] }));
export default RiskScore;
