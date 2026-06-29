"use client";

import { useEffect, useState } from "react";

type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

interface RiskScoreProps {
  score?: number;
  level?: RiskLevel;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const getRiskColor = (score?: number): string => {
  if (score === undefined) return "#94a3b8"; // slate-400
  if (score >= 80) return "#ef4444"; // red-500
  if (score >= 60) return "#f97316"; // orange-500
  if (score >= 40) return "#eab308"; // yellow-500
  return "#22c55e"; // green-500
};

const getRiskLevel = (score?: number): RiskLevel => {
  if (score === undefined) return "unknown";
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const getRiskLabel = (level: RiskLevel): string => {
  switch (level) {
    case "critical":
      return "极高风险";
    case "high":
      return "高风险";
    case "medium":
      return "中风险";
    case "low":
      return "低风险";
    default:
      return "未知";
  }
};

const getSizeConfig = (size: string) => {
  switch (size) {
    case "sm":
      return { svg: 60, stroke: 6, font: "text-xl", label: "text-xs" };
    case "md":
      return { svg: 100, stroke: 8, font: "text-3xl", label: "text-sm" };
    case "lg":
      return { svg: 160, stroke: 10, font: "text-5xl", label: "text-base" };
    case "xl":
      return { svg: 200, stroke: 12, font: "text-6xl", label: "text-lg" };
    default:
      return { svg: 100, stroke: 8, font: "text-3xl", label: "text-sm" };
  }
};

export default function RiskScore({
  score,
  level,
  size = "md",
  showLabel = true,
  animated = true,
  className = "",
}: RiskScoreProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const computedLevel = level || getRiskLevel(score);
  const { svg, stroke, font, label } = getSizeConfig(size);
  const radius = (svg - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((displayScore || 0) / 100) * circumference;
  const color = getRiskColor(score);

  // 数字动画 - 使用 requestAnimationFrame 替代 setInterval
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score || 0);
      return;
    }

    // 检测 prefers-reduced-motion
    const prefersReducedMotion = typeof window !== 'undefined' && 
      typeof window.matchMedia === 'function' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayScore(score || 0);
      return;
    }

    const targetScore = score || 0;
    const duration = 1000;
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用 easeOutCubic 缓动函数
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentScore = Math.floor(easedProgress * targetScore);

      setDisplayScore(currentScore);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayScore(targetScore);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [score, animated]);

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <svg
        width={svg}
        height={svg}
        viewBox={`0 0 ${svg} ${svg}`}
        className="-rotate-90"
      >
        {/* 背景圆环 */}
        <circle
          cx={svg / 2}
          cy={svg / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-800"
        />
        {/* 进度圆环 */}
        <circle
          cx={svg / 2}
          cy={svg / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 ${stroke / 2}px ${color}40)`,
          }}
        />
      </svg>

      {/* 中心内容 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-bold text-white ${font}`}
          style={{ color: (score || 0) > 0 ? color : "#9ca3af" }}
        >
          {displayScore}
        </span>
        {showLabel && (
          <span
            className={`font-medium mt-1 ${label}`}
            style={{
              color:
                computedLevel === "critical"
                  ? "#ef4444"
                  : computedLevel === "high"
                  ? "#f97316"
                  : computedLevel === "medium"
                  ? "#eab308"
                  : "#22c55e",
            }}
          >
            {getRiskLabel(computedLevel)}
          </span>
        )}
      </div>
    </div>
  );
}

// 风险标签组件
export function RiskBadge({
  level,
  text,
  className = "",
}: {
  level: RiskLevel;
  text?: string;
  className?: string;
}) {
  const styles = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    unknown: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[level]} ${className}`}
    >
      {text || getRiskLabel(level)}
    </span>
  );
}

// 风险趋势指示器
export function RiskTrend({
  current,
  previous,
  className = "",
}: {
  current: number;
  previous: number;
  className?: string;
}) {
  const diff = current - previous;
  const isUp = diff > 0;
  const isNeutral = diff === 0;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {!isNeutral && (
        <svg
          className={`w-4 h-4 ${isUp ? "text-red-400" : "text-green-400"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isUp ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"}
          />
        </svg>
      )}
      <span
        className={`text-sm font-medium ${
          isUp ? "text-red-400" : isNeutral ? "text-gray-400" : "text-green-400"
        }`}
      >
        {isNeutral ? "持平" : `${Math.abs(diff).toFixed(1)}%`}
      </span>
    </div>
  );
}
