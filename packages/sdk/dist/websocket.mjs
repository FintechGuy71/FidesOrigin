/**
 * FidesOrigin WebSocket Client
 * Real-time transaction monitoring and risk alerts
 */
import { WEBSOCKET_CONFIG } from '@fidesorigin/shared';
import { FidesOriginError } from './error';
import WebSocket from 'isomorphic-ws';
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
    ws = null;
    options;
    reconnectAttempts = 0;
    reconnectTimer = null;
    heartbeatTimer = null;
    isManualClose = false;
    eventCallbacks = {
        transaction: [],
        risk_alert: [],
        compliance_alert: [],
    };
    connectCallbacks = [];
    disconnectCallbacks = [];
    errorCallbacks = [];
    constructor(options) {
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
    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }
            this.isManualClose = false;
            const url = new URL(this.options.url);
            if (this.options.apiKey) {
                url.searchParams.set('apiKey', this.options.apiKey);
            }
            if (this.options.debug) {
                console.log('[FidesOriginWebSocket] Connecting to', url.toString());
            }
            this.ws = new WebSocket(url.toString());
            this.ws.onopen = () => {
                if (this.options.debug) {
                    console.log('[FidesOriginWebSocket] Connected');
                }
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.connectCallbacks.forEach((cb) => cb());
                resolve();
            };
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            this.ws.onerror = (error) => {
                const err = new FidesOriginError('WebSocket connection error', 'NETWORK_ERROR', { cause: error instanceof Error ? error : undefined });
                this.errorCallbacks.forEach((cb) => cb(err));
                reject(err);
            };
            this.ws.onclose = () => {
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
    disconnect() {
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
    on(event, callback) {
        switch (event) {
            case 'transaction':
            case 'risk_alert':
            case 'compliance_alert':
                this.eventCallbacks[event].push(callback);
                break;
            case 'connect':
                this.connectCallbacks.push(callback);
                break;
            case 'disconnect':
                this.disconnectCallbacks.push(callback);
                break;
            case 'error':
                this.errorCallbacks.push(callback);
                break;
        }
    }
    off(event, callback) {
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
    send(type, data) {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            throw new FidesOriginError('WebSocket is not connected', 'NETWORK_ERROR');
        }
        const message = {
            type,
            data,
            timestamp: new Date().toISOString(),
        };
        this.ws.send(JSON.stringify(message));
    }
    /**
     * Check if WebSocket is connected
     */
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    /**
     * Get current connection state
     */
    getReadyState() {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (this.options.debug) {
                console.log('[FidesOriginWebSocket] Message received', message.type);
            }
            const event = message.data;
            const callbacks = this.eventCallbacks[event.type];
            if (callbacks) {
                callbacks.forEach((cb) => cb(event));
            }
        }
        catch (error) {
            if (this.options.debug) {
                console.error('[FidesOriginWebSocket] Failed to parse message', error);
            }
        }
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            const error = new FidesOriginError(`Max reconnection attempts (${this.options.maxReconnectAttempts}) reached`, 'NETWORK_ERROR');
            this.errorCallbacks.forEach((cb) => cb(error));
            return;
        }
        this.reconnectAttempts++;
        if (this.options.debug) {
            console.log(`[FidesOriginWebSocket] Reconnecting in ${this.options.reconnectInterval}ms (attempt ${this.reconnectAttempts})`);
        }
        this.reconnectTimer = setTimeout(() => {
            this.connect().catch(() => {
                // Error handled by onerror callback
            });
        }, this.options.reconnectInterval);
    }
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.send('ping', {});
            }
        }, this.options.heartbeatInterval);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
export default FidesOriginWebSocket;
