import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * RiskScore 组件测试
 * 验证风险评分组件的渲染
 */

const RiskScore = ({ score }: { score: number }) => {
  const getColor = (s: number) => {
    if (s <= 30) return 'text-green-600';
    if (s <= 60) return 'text-yellow-600';
    if (s <= 85) return 'text-orange-600';
    return 'text-red-600';
  };

  const getLabel = (s: number) => {
    if (s <= 30) return 'Low';
    if (s <= 60) return 'Medium';
    if (s <= 85) return 'High';
    return 'Critical';
  };

  return (
    <div data-testid="risk-score">
      <span data-testid="risk-score-value" className={`text-2xl font-bold ${getColor(score)}`}>
        {score}
      </span>
      <span data-testid="risk-score-label" className="ml-2 text-sm text-gray-500">
        {getLabel(score)}
      </span>
      <div data-testid="risk-score-bar" className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

describe('RiskScore Component', () => {
  it('renders score of 0', () => {
    render(<RiskScore score={0} />);
    expect(screen.getByTestId('risk-score-value')).toHaveTextContent('0');
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('Low');
  });

  it('renders low risk score', () => {
    render(<RiskScore score={25} />);
    expect(screen.getByTestId('risk-score-value')).toHaveTextContent('25');
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('Low');
    expect(screen.getByTestId('risk-score-value').className).toContain('green');
  });

  it('renders medium risk score', () => {
    render(<RiskScore score={45} />);
    expect(screen.getByTestId('risk-score-value')).toHaveTextContent('45');
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('Medium');
    expect(screen.getByTestId('risk-score-value').className).toContain('yellow');
  });

  it('renders high risk score', () => {
    render(<RiskScore score={75} />);
    expect(screen.getByTestId('risk-score-value')).toHaveTextContent('75');
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('High');
    expect(screen.getByTestId('risk-score-value').className).toContain('orange');
  });

  it('renders critical risk score', () => {
    render(<RiskScore score={95} />);
    expect(screen.getByTestId('risk-score-value')).toHaveTextContent('95');
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('Critical');
    expect(screen.getByTestId('risk-score-value').className).toContain('red');
  });

  it('renders boundary score of 30', () => {
    render(<RiskScore score={30} />);
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('Low');
  });

  it('renders boundary score of 60', () => {
    render(<RiskScore score={60} />);
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('Medium');
  });

  it('renders boundary score of 85', () => {
    render(<RiskScore score={85} />);
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('High');
  });

  it('renders boundary score of 100', () => {
    render(<RiskScore score={100} />);
    expect(screen.getByTestId('risk-score-value')).toHaveTextContent('100');
    expect(screen.getByTestId('risk-score-label')).toHaveTextContent('Critical');
  });
});
