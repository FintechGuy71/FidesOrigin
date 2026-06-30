/**
 * @deprecated 此文件为旧版 WebSocket 实现，不再维护。
 * [HIGH Fix #4] 请使用 packages/sdk/src/websocket.ts 中的新版本。
 * 新版本支持更安全的认证流程（连接后通过消息发送 API Key）。
 * 
 * 迁移指南：
 * - import { FidesOriginWS } from '@fidesorigin/sdk'
 * - 新版认证流程：先建立连接，再发送 {"type":"auth","api_key":"..."} 认证消息
 */
import WebSocket from 'isomorphic-ws';
import {
  FidesOriginConfig,
  WebSocketOptions,
  WebSocketEventType,
  WebSocketMessage,
  WebSocketEventHandler,
  RiskUpdateEvent,
  AlertEvent,
  RuleMatchEvent,
  FidesOriginWebSocket as IFidesOriginWebSocket
} from './types';

/**
 * FidesOrigin WebSocket Client
 * 
 * Provides real-time updates for risk assessments, alerts, and rule matches
 * 
 * @example
 * ```typescript
 * const ws = client.createWebSocket({
 *   autoReconnect: true,
 *   subscriptions: ['risk.update', 'alert.new']
 * });
 * 
 * ws.on('risk.update', (message) => {
 *   console.log('Risk updated:', message.data);
 * });
 * 
 * ws.connect();
 * ```
 */
export class FidesOriginWebSocket implements IFidesOriginWebSocket {
  private config: FidesOriginConfig;
  private options: Required<WebSocketOptions>;
  private ws: WebSocket | null = null;
  private handlers: Map<WebSocketEventType, Set<WebSocketEventHandler>> = new Map();
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private _isConnected = false;

  public get isConnected(): boolean {
    return this._isConnected;
  }

  constructor(config: FidesOriginConfig, options: WebSocketOptions = {}) {
    this.config = config;
    this.options = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      subscriptions: [],
      ...options
    };

    // Bind handlers
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log('debug', 'WebSocket already connected');
      return;
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = this.getWebSocketUrl();
    
    this.log('info', 'Connecting to WebSocket', { url: wsUrl });

    try {
      const headers: Record<string, string> = {};
      
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      this.ws = new WebSocket(wsUrl, undefined, { headers });
      
      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onclose = this.handleClose;
      this.ws.onerror = this.handleError;
    } catch (error) {
      this.log('error', 'Failed to create WebSocket connection', { error });
      this.emit('error', {
        event: 'error',
        data: { message: 'Failed to create WebSocket connection', error },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.log('info', 'Disconnecting WebSocket');
    
    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset reconnect count
    this.reconnectCount = 0;

    // Close connection
    if (this.ws) {
      // Remove listeners to prevent auto-reconnect
      this.ws.onclose = null;
      this.ws.onerror = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      
      this.ws = null;
    }

    this._isConnected = false;
  }

  /**
   * Subscribe to event types
   */
  public subscribe(eventTypes: WebSocketEventType[]): void {
    if (!this._isConnected || !this.ws) {
      this.log('warn', 'Cannot subscribe: WebSocket not connected');
      return;
    }

    const message = {
      action: 'subscribe',
      events: eventTypes
    };

    this.send(message);
    this.log('debug', 'Subscribed to events', { events: eventTypes });
  }

  /**
   * Unsubscribe from event types
   */
  public unsubscribe(eventTypes: WebSocketEventType[]): void {
    if (!this._isConnected || !this.ws) {
      this.log('warn', 'Cannot unsubscribe: WebSocket not connected');
      return;
    }

    const message = {
      action: 'unsubscribe',
      events: eventTypes
    };

    this.send(message);
    this.log('debug', 'Unsubscribed from events', { events: eventTypes });
  }

  /**
   * Register event handler
   */
  public on(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  public off(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Wait for connection to be established
   */
  public async waitForConnection(timeout = 10000): Promise<void> {
    if (this._isConnected) return;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      const handler: WebSocketEventHandler = () => {
        clearTimeout(timer);
        this.off('connection.established', handler);
        resolve();
      };

      this.on('connection.established', handler);
    });
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private handleOpen(): void {
    this.log('info', 'WebSocket connected');
    this._isConnected = true;
    this.reconnectCount = 0;

    // Subscribe to default events
    if (this.options.subscriptions.length > 0) {
      this.subscribe(this.options.subscriptions as WebSocketEventType[]);
    }

    this.emit('connection.established', {
      event: 'connection.established',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  }

  private handleMessage(data: WebSocket.MessageEvent): void {
    try {
      const message = JSON.parse(data.data.toString()) as WebSocketMessage;
      
      this.log('debug', 'WebSocket message received', { event: message.event });
      
      this.emit(message.event as WebSocketEventType, message);
    } catch (error) {
      this.log('error', 'Failed to parse WebSocket message', { error, data });
    }
  }

  private handleClose(event: WebSocket.CloseEvent): void {
    this.log('info', 'WebSocket closed', { code: event.code, reason: event.reason });
    this._isConnected = false;

    this.emit('connection.closed', {
      event: 'connection.closed',
      data: { code: event.code, reason: event.reason },
      timestamp: new Date().toISOString()
    });

    // Attempt reconnect if enabled
    if (this.options.autoReconnect && this.reconnectCount < this.options.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: WebSocket.ErrorEvent): void {
    this.log('error', 'WebSocket error', { error });
    
    this.emit('error', {
      event: 'error',
      data: { message: 'WebSocket error', error },
      timestamp: new Date().toISOString()
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log('warn', 'Cannot send: WebSocket not open');
      return;
    }

    this.ws.send(JSON.stringify(data));
  }

  private emit(event: WebSocketEventType, message: WebSocketMessage): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.log('error', 'Error in event handler', { event, error });
        }
      });
    }
  }

  private scheduleReconnect(): void {
    this.reconnectCount++;
    
    this.log('info', `Scheduling reconnect attempt ${this.reconnectCount}/${this.options.maxReconnectAttempts}`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }

  private getWebSocketUrl(): string {
    let url = this.config.baseUrl;
    
    // Replace http with ws
    if (url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
    } else if (url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
    } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      // Assume https if no protocol
      url = `wss://${url}`;
    }
    
    return `${url}/ws`;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    if (!this.config.debug && level === 'debug') return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [FidesOrigin:WebSocket] ${message}`;
    
    if (meta) {
      console.log(logMessage, meta);
    } else {
      console.log(logMessage);
    }
  }
}

/**
 * Type guards for WebSocket events
 */
export function isRiskUpdateEvent(data: unknown): data is RiskUpdateEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    'address' in data &&
    'risk' in data
  );
}

export function isAlertEvent(data: unknown): data is AlertEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'type' in data &&
    'severity' in data
  );
}

export function isRuleMatchEvent(data: unknown): data is RuleMatchEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    'rule' in data &&
    'address' in data
  );
}

// Re-export types
export * from './types';
