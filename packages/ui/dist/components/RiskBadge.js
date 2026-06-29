import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RISK_LEVELS } from '@fidesorigin/shared';
/**
 * RiskBadge - Displays a risk level indicator badge
 *
 * @example
 * ```tsx
 * <RiskBadge level="high" showScore score={75} />
 * <RiskBadge level="low" size="sm" />
 * ```
 */
export const RiskBadge = ({ level, size = 'md', showScore = false, score, className = '', }) => {
    const config = RISK_LEVELS[level];
    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
    };
    return (_jsxs("span", { className: [
            'inline-flex items-center gap-1.5 rounded-full font-medium',
            sizeClasses[size],
            config.bgColor,
            'text-white',
            className,
        ].join(' '), title: config.description, role: "status", "aria-label": `Risk level: ${config.name}`, children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-full bg-white/80", "aria-hidden": "true" }), config.label, showScore && score !== undefined && (_jsxs("span", { className: "opacity-80", children: ["(", score, ")"] }))] }));
};
export default RiskBadge;
