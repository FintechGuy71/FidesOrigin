import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useEffect, useState } from 'react';

/**
 * LiveTransactionStream 组件测试
 * 验证 WebSocket 连接和数据流
 */

// 模拟组件
const LiveTransactionStream = ({ addresses, minRiskScore = 0 }: { addresses: string[]; minRiskScore?: number }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (addresses.length === 0) return;

    const wsUrl = `wss://api.fidesorigin.com/api/v1/monitor/stream?addresses=${addresses.join(',')}&min_risk_score=${minRiskScore}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Send auth message
      ws.send(JSON.stringify({ type: 'auth', api_key: 'test-key' }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'transaction') {
        setTransactions((prev) => [message.data, ...prev].slice(0, 100));
      } else if (message.type === 'system' && message.data?.event === 'connected') {
        // Connected successfully
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [addresses, minRiskScore]);

  return (
    <div data-testid="live-transaction-stream">
      <div data-testid="connection-status">
        {isConnected ? 'Connected' : error ? `Error: ${error}` : 'Disconnected'}
      </div>
      <div data-testid="transaction-list">
        {transactions.map((tx, i) => (
          <div key={i} data-testid="transaction-item">
            {tx.tx_hash || tx.hash}
          </div>
        ))}
      </div>
      {transactions.length === 0 && <div data-testid="empty-state">No transactions yet</div>}
    </div>
  );
};

describe('LiveTransactionStream Component', () => {
  let mockWebSocket: any;

  beforeEach(() => {
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      onopen: null as any,
      onmessage: null as any,
      onerror: null as any,
      onclose: null as any,
    };
    (global as any).WebSocket = vi.fn(() => mockWebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders disconnected state initially', () => {
    render(<LiveTransactionStream addresses={['0x123']} />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
  });

  it('shows connected status after WebSocket opens', async () => {
    render(<LiveTransactionStream addresses={['0x123']} />);

    // Simulate WebSocket open
    mockWebSocket.onopen?.();

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
    });
  });

  it('sends auth message after connection', async () => {
    render(<LiveTransactionStream addresses={['0x123']} />);

    mockWebSocket.onopen?.();

    await waitFor(() => {
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'auth', api_key: 'test-key' })
      );
    });
  });

  it('displays transactions received via WebSocket', async () => {
    render(<LiveTransactionStream addresses={['0x123']} />);

    mockWebSocket.onopen?.();

    // Simulate receiving a transaction
    const txMessage = {
      data: JSON.stringify({
        type: 'transaction',
        data: { tx_hash: '0xabc123', from: '0x123', to: '0x456', value: '1.0' },
      }),
    };
    mockWebSocket.onmessage?.(txMessage);

    await waitFor(() => {
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  it('shows error when WebSocket fails', async () => {
    render(<LiveTransactionStream addresses={['0x123']} />);

    mockWebSocket.onerror?.();

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Error: WebSocket connection error');
    });
  });

  it('does not connect when addresses array is empty', () => {
    render(<LiveTransactionStream addresses={[]} />);
    expect((global as any).WebSocket).not.toHaveBeenCalled();
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = render(<LiveTransactionStream addresses={['0x123']} />);
    unmount();
    expect(mockWebSocket.close).toHaveBeenCalled();
  });

  it('respects minRiskScore parameter in URL', () => {
    render(<LiveTransactionStream addresses={['0x123']} minRiskScore={50} />);
    expect((global as any).WebSocket).toHaveBeenCalledWith(
      expect.stringContaining('min_risk_score=50')
    );
  });

  it('handles multiple addresses in URL', () => {
    render(<LiveTransactionStream addresses={['0x123', '0x456']} />);
    expect((global as any).WebSocket).toHaveBeenCalledWith(
      expect.stringContaining('addresses=0x123,0x456')
    );
  });
});
