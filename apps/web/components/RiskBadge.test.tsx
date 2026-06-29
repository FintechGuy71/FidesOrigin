import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskBadge } from './RiskScore';

describe('RiskBadge', () => {
  it('should render critical level with correct styles', () => {
    const { container } = render(<RiskBadge level="critical" />);
    expect(screen.getByText('极高风险')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-red-500/20');
    expect(container.firstChild).toHaveClass('text-red-400');
    expect(container.firstChild).toHaveClass('border-red-500/30');
  });

  it('should render high level with correct styles', () => {
    const { container } = render(<RiskBadge level="high" />);
    expect(screen.getByText('高风险')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-orange-500/20');
    expect(container.firstChild).toHaveClass('text-orange-400');
  });

  it('should render medium level with correct styles', () => {
    const { container } = render(<RiskBadge level="medium" />);
    expect(screen.getByText('中风险')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-yellow-500/20');
    expect(container.firstChild).toHaveClass('text-yellow-400');
  });

  it('should render low level with correct styles', () => {
    const { container } = render(<RiskBadge level="low" />);
    expect(screen.getByText('低风险')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-green-500/20');
    expect(container.firstChild).toHaveClass('text-green-400');
  });

  it('should render unknown level with correct styles', () => {
    const { container } = render(<RiskBadge level="unknown" />);
    expect(screen.getByText('未知')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-gray-500/20');
    expect(container.firstChild).toHaveClass('text-gray-400');
  });

  it('should render custom text', () => {
    render(<RiskBadge level="high" text="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('should have rounded-full shape', () => {
    const { container } = render(<RiskBadge level="low" />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });

  it('should have border', () => {
    const { container } = render(<RiskBadge level="medium" />);
    expect(container.firstChild).toHaveClass('border');
  });

  it('should have correct padding', () => {
    const { container } = render(<RiskBadge level="low" />);
    expect(container.firstChild).toHaveClass('px-2.5');
    expect(container.firstChild).toHaveClass('py-0.5');
  });

  it('should have correct font size', () => {
    const { container } = render(<RiskBadge level="low" />);
    expect(container.firstChild).toHaveClass('text-xs');
  });

  it('should apply custom className', () => {
    const { container } = render(<RiskBadge level="high" className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('should be inline-flex', () => {
    const { container } = render(<RiskBadge level="critical" />);
    expect(container.firstChild).toHaveClass('inline-flex');
  });

  it('should center items', () => {
    const { container } = render(<RiskBadge level="critical" />);
    expect(container.firstChild).toHaveClass('items-center');
  });
});
