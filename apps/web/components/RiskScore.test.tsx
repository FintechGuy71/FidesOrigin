import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import RiskScore, { RiskBadge, RiskTrend } from './RiskScore';

describe('RiskScore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render with default props', () => {
      render(<RiskScore />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render with score', () => {
      render(<RiskScore score={75} />);
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<RiskScore score={75} showLabel={true} />);
      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.getByText('高风险')).toBeInTheDocument();
    });

    it('should not render label when showLabel is false', () => {
      render(<RiskScore score={75} showLabel={false} />);
      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.queryByText('高风险')).not.toBeInTheDocument();
    });

    it('should render all size variants', () => {
      const sizes = ['sm', 'md', 'lg', 'xl'] as const;
      sizes.forEach((size) => {
        const { container } = render(<RiskScore score={50} size={size} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
      });
    });

    it('should render with custom className', () => {
      const { container } = render(<RiskScore className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('risk colors', () => {
    it('should display green for low risk', () => {
      render(<RiskScore score={20} />);
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('should display yellow for medium risk', () => {
      render(<RiskScore score={45} />);
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('should display orange for high risk', () => {
      render(<RiskScore score={70} />);
      expect(screen.getByText('70')).toBeInTheDocument();
    });

    it('should display red for critical risk', () => {
      render(<RiskScore score={90} />);
      expect(screen.getByText('90')).toBeInTheDocument();
    });

    it('should display gray for unknown', () => {
      render(<RiskScore />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('animation', () => {
    it('should animate score by default', async () => {
      render(<RiskScore score={60} />);
      
      // Initially should show 0 or partial
      expect(screen.getByText('0')).toBeInTheDocument();

      // Fast-forward animation
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText('60')).toBeInTheDocument();
      });
    });

    it('should skip animation when animated is false', () => {
      render(<RiskScore score={60} animated={false} />);
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('should update when score changes', async () => {
      const { rerender } = render(<RiskScore score={30} />);
      
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText('30')).toBeInTheDocument();
      });

      rerender(<RiskScore score={80} />);
      
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText('80')).toBeInTheDocument();
      });
    });
  });

  describe('RiskBadge', () => {
    it('should render critical badge', () => {
      render(<RiskBadge level="critical" />);
      expect(screen.getByText('极高风险')).toBeInTheDocument();
    });

    it('should render high badge', () => {
      render(<RiskBadge level="high" />);
      expect(screen.getByText('高风险')).toBeInTheDocument();
    });

    it('should render medium badge', () => {
      render(<RiskBadge level="medium" />);
      expect(screen.getByText('中风险')).toBeInTheDocument();
    });

    it('should render low badge', () => {
      render(<RiskBadge level="low" />);
      expect(screen.getByText('低风险')).toBeInTheDocument();
    });

    it('should render unknown badge', () => {
      render(<RiskBadge level="unknown" />);
      expect(screen.getByText('未知')).toBeInTheDocument();
    });

    it('should render custom text', () => {
      render(<RiskBadge level="high" text="Custom" />);
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<RiskBadge level="low" className="custom" />);
      expect(container.firstChild).toHaveClass('custom');
    });
  });

  describe('RiskTrend', () => {
    it('should render upward trend', () => {
      render(<RiskTrend current={80} previous={60} />);
      expect(screen.getByText('20.0%')).toBeInTheDocument();
    });

    it('should render downward trend', () => {
      render(<RiskTrend current={40} previous={60} />);
      expect(screen.getByText('20.0%')).toBeInTheDocument();
    });

    it('should render neutral trend', () => {
      render(<RiskTrend current={50} previous={50} />);
      expect(screen.getByText('持平')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<RiskTrend current={10} previous={5} className="custom" />);
      expect(container.firstChild).toHaveClass('custom');
    });
  });
});
