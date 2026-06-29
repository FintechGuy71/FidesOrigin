import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// useWebSocket Hook Implementation
// ============================================================================

interface WebSocketMessage {
  event: string;
  data: unknown;
  timestamp: string;
}

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface UseWebSocketReturn {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  messages: WebSocketMessage[];
  connect: () => void;
  disconnect: () => void;
  send: (data: unknown) => void;
  clearMessages: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectCountRef.current = 0;
    
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent auto-reconnect on manual close
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
    setConnecting(false);
    setError(null);
  }, [clearReconnectTimer]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    disconnect();
    setConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(optionsRef.current.url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectCountRef.current = 0;
        optionsRef.current.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setMessages((prev) => [...prev.slice(-99), message]);
          optionsRef.current.onMessage?.(message);
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        optionsRef.current.onDisconnect?.();
        
        const { maxReconnectAttempts = 5, reconnectInterval = 3000 } = optionsRef.current;
        if (reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (err) => {
        setError('WebSocket error occurred');
        setConnecting(false);
        optionsRef.current.onError?.(err);
      };
    } catch (err) {
      setError('Failed to create WebSocket connection');
      setConnecting(false);
    }
  }, [disconnect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    if (options.autoConnect !== false) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.url]);

  return {
    connected,
    connecting,
    error,
    messages,
    connect,
    disconnect,
    send,
    clearMessages,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useWebSocket', () => {
  let mockWebSocketInstances: MockWebSocket[] = [];

  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    url: string;
    onopen: ((ev: Event) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    sentMessages: unknown[] = [];

    constructor(url: string) {
      this.url = url;
      mockWebSocketInstances.push(this);
      
      // Simulate async connection
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event('open'));
      }, 10);
    }

    send(data: string): void {
      this.sentMessages.push(data);
    }

    close(): void {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close'));
    }
  }

  beforeEach(() => {
    mockWebSocketInstances = [];
    Object.defineProperty(global, 'WebSocket', {
      value: MockWebSocket,
      writable: true,
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    mockWebSocketInstances = [];
  });

  describe('connection establishment', () => {
    it('should connect automatically by default', async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      expect(result.current.connecting).toBe(true);
      expect(result.current.connected).toBe(false);

      // Advance timers to trigger connection
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
        expect(result.current.connecting).toBe(false);
      });
    });

    it('should not connect when autoConnect is false', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws', autoConnect: false })
      );

      expect(result.current.connected).toBe(false);
      expect(result.current.connecting).toBe(false);
    });

    it('should connect manually', async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws', autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      expect(result.current.connecting).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });
    });

    it('should call onConnect callback', async () => {
      const onConnect = vi.fn();
      
      renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws', onConnect })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('message receiving', () => {
    it('should receive and store messages', async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      const ws = mockWebSocketInstances[0];
      const message: WebSocketMessage = {
        event: 'risk.update',
        data: { score: 85 },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].event).toBe('risk.update');
    });

    it('should call onMessage callback', async () => {
      const onMessage = vi.fn();
      
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws', onMessage })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      const ws = mockWebSocketInstances[0];
      const message: WebSocketMessage = {
        event: 'alert.new',
        data: { id: '1' },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
      });

      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ event: 'alert.new' }));
    });

    it('should ignore non-JSON messages', async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      const ws = mockWebSocketInstances[0];

      act(() => {
        ws.onmessage?.(new MessageEvent('message', { data: 'not-json' }));
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('should limit message history to 100', async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      const ws = mockWebSocketInstances[0];

      act(() => {
        for (let i = 0; i < 105; i++) {
          ws.onmessage?.(new MessageEvent('message', {
            data: JSON.stringify({ event: 'test', data: { i }, timestamp: new Date().toISOString() }),
          }));
        }
      });

      expect(result.current.messages).toHaveLength(100);
    });
  });

  describe('auto-reconnect', () => {
    it('should reconnect on close', async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: 'wss://test.example.com/ws',
          reconnectInterval: 1000,
          maxReconnectAttempts: 3,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));
      expect(mockWebSocketInstances).toHaveLength(1);

      // Close connection
      act(() => {
        mockWebSocketInstances[0].close();
      });

      expect(result.current.connected).toBe(false);

      // Trigger reconnect
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockWebSocketInstances).toHaveLength(2);
      });
    });

    it('should stop reconnecting after max attempts', async () => {
      const onDisconnect = vi.fn();
      
      renderHook(() =>
        useWebSocket({
          url: 'wss://test.example.com/ws',
          reconnectInterval: 100,
          maxReconnectAttempts: 2,
          onDisconnect,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(mockWebSocketInstances[0].readyState).toBe(MockWebSocket.OPEN));

      // Close and trigger reconnects
      for (let i = 0; i < 3; i++) {
        act(() => {
          if (mockWebSocketInstances[i]) {
            mockWebSocketInstances[i].close();
          }
        });
        await act(async () => {
          vi.advanceTimersByTime(100);
        });
      }

      // Should have initial + 2 reconnect attempts = 3 total
      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('cleanup', () => {
    it('should disconnect on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      const ws = mockWebSocketInstances[0];
      const closeSpy = vi.spyOn(ws, 'close');

      unmount();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should clear messages', async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      const ws = mockWebSocketInstances[0];
      
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({ event: 'test', data: {}, timestamp: new Date().toISOString() }),
        }));
      });

      expect(result.current.messages).toHaveLength(1);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('sending messages', () => {
    it('should send data when connected', async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => {
        result.current.send({ action: 'subscribe', events: ['risk.update'] });
      });

      const ws = mockWebSocketInstances[0];
      expect(ws.sentMessages).toHaveLength(1);
      expect(JSON.parse(ws.sentMessages[0] as string)).toEqual({
        action: 'subscribe',
        events: ['risk.update'],
      });
    });

    it('should not send when not connected', () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws', autoConnect: false })
      );

      act(() => {
        result.current.send({ test: 'data' });
      });

      // Should not throw
      expect(result.current.connected).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle connection error', async () => {
      const onError = vi.fn();
      
      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws', onError })
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      await waitFor(() => expect(mockWebSocketInstances[0]).toBeDefined());

      const ws = mockWebSocketInstances[0];
      
      act(() => {
        ws.onerror?.(new Event('error'));
      });

      expect(result.current.error).toBe('WebSocket error occurred');
      expect(onError).toHaveBeenCalled();
    });

    it('should handle WebSocket constructor error', () => {
      const OriginalWebSocket = global.WebSocket;
      Object.defineProperty(global, 'WebSocket', {
        value: class {
          constructor() {
            throw new Error('WebSocket not supported');
          }
        },
        writable: true,
      });

      const { result } = renderHook(() =>
        useWebSocket({ url: 'wss://test.example.com/ws' })
      );

      expect(result.current.error).toBe('Failed to create WebSocket connection');
      expect(result.current.connecting).toBe(false);

      Object.defineProperty(global, 'WebSocket', {
        value: OriginalWebSocket,
        writable: true,
      });
    });
  });
});
