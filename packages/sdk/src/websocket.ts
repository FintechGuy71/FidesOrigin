/**
 * FidesOrigin WebSocket Client
 * Real-time transaction monitoring and risk alerts
 */

import type { TransactionEvent, WebSocketMessage } from '@fidesorigin/shared';
import { WEBSOCKET_CONFIG } from '@fidesorigin/shared';
import { FidesOriginError } from './error';
import type { WebSocketEventType } from './types';

// [P1 Fix] Lazy-load WebSocket implementation for SSR compatibility
let _WebSocketImpl: typeof WebSocket | null = null;
function getWebSocketImpl(): typeof WebSocket {
  if (_WebSocketImpl) return _WebSocketImpl;
  if (typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined') {
    _WebSocketImpl = window.WebSocket;
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _WebSocketImpl = require('isomorphic-ws') as typeof WebSocket;
    } catch {
      throw new FidesOriginError(
        'WebSocket implementation not available. Install "ws" or run in a browser environment.',
        'NETWORK_ERROR'
      );
    }
  }
  return _WebSocketImpl;
}

export interface WebSocketClientOptions {
  /** WebSocket server URL */
  url: string;
  /** API key for authentication */
  apiKey?: string;
  /** Reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export type WebSocketEventCallback = (event: TransactionEvent) => void;
export type WebSocketErrorCallback = (error: FidesOriginError) => void;
export type WebSocketConnectCallback = () => void;
export type WebSocketDisconnectCallback = () => void;

/**
 * FidesOriginWebSocket - Real-time WebSocket client
 *
 * Provides connection management, automatic reconnection, heartbeat,
 * and typed event handling for real-time risk alerts.
 *
 * @example
 * ```ts
 * const ws = new FidesOriginWebSocket({
 *   url: 'wss://api.fidesorigin.com/v1/ws',
 *   apiKey: 'your-api-key'
 * });
 *
 * ws.on('transaction', (event) => {
 *   console.log('New transaction:', event.transaction.hash);
 * });
 *
 * ws.on('risk_alert', (event) => {
 *   console.log('Risk alert:', event.riskAssessment?.overallLevel);
 * });
 *
 * await ws.connect();
 * ```
 */
export class FidesOriginWebSocket {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isManualClose = false;

  private eventCallbacks: {
    transaction: WebSocketEventCallback[];
    risk_alert: WebSocketEventCallback[];
    compliance_alert: WebSocketEventCallback[];
  } = {
    transaction: [],
    risk_alert: [],
    compliance_alert: [],
  };

  private connectCallbacks: WebSocketConnectCallback[] = [];
  private disconnectCallbacks: WebSocketDisconnectCallback[] = [];
  private errorCallbacks: WebSocketErrorCallback[] = [];

  constructor(options: WebSocketClientOptions) {
    this.options = {
      reconnectInterval: WEBSOCKET_CONFIG.reconnectInterval,
      maxReconnectAttempts: WEBSOCKET_CONFIG.maxReconnectAttempts,
      heartbeatInterval: WEBSOCKET_CONFIG.heartbeatInterval,
      debug: false,
      apiKey: '',
      ...options,
    };
  }

  /**
   * Connect to the WebSocket server
   *
   * @returns Promise that resolves when connected
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === getWebSocketImpl().OPEN) {
        resolve();
        return;
      }

      this.isManualClose = false;

      // [High Fix] Force wss:// to prevent plaintext API Key transmission
      const connectUrl = this.options.url.replace(/^ws:/, 'wss:');
      if (!connectUrl.startsWith('wss:')) {
        throw new FidesOriginError(
          'WebSocket URL must use wss:// protocol for secure API key transmission',
          'NETWORK_ERROR'
        );
      }

      if (this.options.debug) {
        console.log('[FidesOriginWebSocket] Connecting to', connectUrl);
      }

      this.ws = new (getWebSocketImpl())(connectUrl) as WebSocket;

      // [High Fix] Connection timeout to prevent Promise hanging
      const connectionTimeout = setTimeout(() => {
        const err = new FidesOriginError(
          'WebSocket connection timeout (10s)',
          'TIMEOUT'
        );
        this.errorCallbacks.forEach((cb) => cb(err));
        this.ws?.close();
        reject(err);
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        if (this.options.debug) {
          console.log('[FidesOriginWebSocket] Connected');
        }
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // [High Fix] Send auth after connection instead of exposing apiKey in URL
        if (this.options.apiKey) {
          // [High Fix] Redact API key in debug logs
          if (this.options.debug) {
            console.log('[FidesOriginWebSocket] Sending auth message');
          }
          this.send('auth', { apiKey: this.options.apiKey });
        }
        this.connectCallbacks.forEach((cb) => cb());
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        const err = new FidesOriginError(
          'WebSocket connection error',
          'NETWORK_ERROR',
          { cause: error instanceof Error ? error : undefined }
        );
        this.errorCallbacks.forEach((cb) => cb(err));
        reject(err);
      };

      this.ws.onclose = () => {
        clearTimeout(connectionTimeout);
        this.stopHeartbeat();
        this.disconnectCallbacks.forEach((cb) => cb());

        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.options.debug) {
      console.log('[FidesOriginWebSocket] Disconnected');
    }
  }

  /**
   * Subscribe to server-side event types
   */
  subscribe(eventTypes: WebSocketEventType[]): void {
    this.send('subscribe', { eventTypes });
  }

  /**
   * Unsubscribe from server-side event types
   */
  unsubscribe(eventTypes: WebSocketEventType[]): void {
    this.send('unsubscribe', { eventTypes });
  }

  /**
   * Subscribe to an event type
   *
   * @param event - Event type to subscribe to
   * @param callback - Callback function
   */
  on(event: 'transaction' | 'risk_alert' | 'compliance_alert', callback: WebSocketEventCallback): void;
  on(event: 'connect', callback: WebSocketConnectCallback): void;
  on(event: 'disconnect', callback: WebSocketDisconnectCallback): void;
  on(event: 'error', callback: WebSocketErrorCallback): void;
  on(
    event: string,
    callback: WebSocketEventCallback | WebSocketConnectCallback | WebSocketDisconnectCallback | WebSocketErrorCallback
  ): void {
    switch (event) {
      case 'transaction':
      case 'risk_alert':
      case 'compliance_alert':
        this.eventCallbacks[event].push(callback as WebSocketEventCallback);
        break;
      case 'connect':
        this.connectCallbacks.push(callback as WebSocketConnectCallback);
        break;
      case 'disconnect':
        this.disconnectCallbacks.push(callback as WebSocketDisconnectCallback);
        break;
      case 'error':
        this.errorCallbacks.push(callback as WebSocketErrorCallback);
        break;
    }
  }

  /**
   * Unsubscribe from an event type
   */
  off(event: 'transaction' | 'risk_alert' | 'compliance_alert', callback: WebSocketEventCallback): void;
  off(event: 'connect', callback: WebSocketConnectCallback): void;
  off(event: 'disconnect', callback: WebSocketDisconnectCallback): void;
  off(event: 'error', callback: WebSocketErrorCallback): void;
  off(
    event: string,
    callback: WebSocketEventCallback | WebSocketConnectCallback | WebSocketDisconnectCallback | WebSocketErrorCallback
  ): void {
    switch (event) {
      case 'transaction':
      case 'risk_alert':
      case 'compliance_alert':
        this.eventCallbacks[event] = this.eventCallbacks[event].filter((cb) => cb !== callback);
        break;
      case 'connect':
        this.connectCallbacks = this.connectCallbacks.filter((cb) => cb !== callback);
        break;
      case 'disconnect':
        this.disconnectCallbacks = this.disconnectCallbacks.filter((cb) => cb !== callback);
        break;
      case 'error':
        this.errorCallbacks = this.errorCallbacks.filter((cb) => cb !== callback);
        break;
    }
  }

  /**
   * Send a message to the server
   *
   * @param type - Message type
   * @param data - Message payload
   */
  send(type: string, data: unknown): void {
    if (this.ws?.readyState !== getWebSocketImpl().OPEN) {
      throw new FidesOriginError('WebSocket is not connected', 'NETWORK_ERROR');
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    // [High Fix] Handle BigInt serialization to prevent JSON.stringify crash
    this.ws.send(JSON.stringify(message, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === getWebSocketImpl().OPEN;
  }

  /**
   * Get current connection state
   */
  getReadyState(): number {
    return this.ws?.readyState ?? getWebSocketImpl().CLOSED;
  }

  private handleMessage(data: string | ArrayBufferLike | ArrayBufferView): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage<TransactionEvent>;

      if (this.options.debug) {
        console.log('[FidesOriginWebSocket] Message received', message.type);
      }

      const event = message.data;
      const callbacks = this.eventCallbacks[event.type];

      if (callbacks) {
        callbacks.forEach((cb) => cb(event));
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('[FidesOriginWebSocket] Failed to parse message', error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      const error = new FidesOriginError(
        `Max reconnection attempts (${this.options.maxReconnectAttempts}) reached`,
        'NETWORK_ERROR'
      );
      this.errorCallbacks.forEach((cb) => cb(error));
      return;
    }

    this.reconnectAttempts++;

    if (this.options.debug) {
      console.log(
        `[FidesOriginWebSocket] Reconnecting in ${this.options.reconnectInterval}ms (attempt ${this.reconnectAttempts})`
      );
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Error handled by onerror callback
      });
    }, this.options.reconnectInterval);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === getWebSocketImpl().OPEN) {
        this.send('ping', {});
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export default FidesOriginWebSocket;
