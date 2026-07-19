import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * RiskBadge 组件测试
 * 验证风险等级徽章的渲染
 */

const RiskBadge = ({ level }: { level: 'low' | 'medium' | 'high' | 'critical' | 'unknown' }) => {
  const colors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const labels = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
    unknown: 'Unknown',
  };

  return (
    <span data-testid="risk-badge" className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[level]}`}>
      {labels[level]}
    </span>
  );
};

describe('RiskBadge Component', () => {
  it('renders low risk badge', () => {
    render(<RiskBadge level="low" />);
    const badge = screen.getByTestId('risk-badge');
    expect(badge).toHaveTextContent('Low Risk');
    expect(badge.className).toContain('green');
  });

  it('renders medium risk badge', () => {
    render(<RiskBadge level="medium" />);
    const badge = screen.getByTestId('risk-badge');
    expect(badge).toHaveTextContent('Medium Risk');
    expect(badge.className).toContain('yellow');
  });

  it('renders high risk badge', () => {
    render(<RiskBadge level="high" />);
    const badge = screen.getByTestId('risk-badge');
    expect(badge).toHaveTextContent('High Risk');
    expect(badge.className).toContain('orange');
  });

  it('renders critical risk badge', () => {
    render(<RiskBadge level="critical" />);
    const badge = screen.getByTestId('risk-badge');
    expect(badge).toHaveTextContent('Critical Risk');
    expect(badge.className).toContain('red');
  });

  it('renders unknown risk badge', () => {
    render(<RiskBadge level="unknown" />);
    const badge = screen.getByTestId('risk-badge');
    expect(badge).toHaveTextContent('Unknown');
    expect(badge.className).toContain('gray');
  });
});
