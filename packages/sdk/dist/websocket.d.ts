/**
 * FidesOrigin WebSocket Client
 * Real-time transaction monitoring and risk alerts
 */
import type { TransactionEvent } from '@fidesorigin/shared';
import { FidesOriginError } from './error';
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
export declare class FidesOriginWebSocket {
    private ws;
    private options;
    private reconnectAttempts;
    private reconnectTimer;
    private heartbeatTimer;
    private isManualClose;
    private eventCallbacks;
    private connectCallbacks;
    private disconnectCallbacks;
    private errorCallbacks;
    constructor(options: WebSocketClientOptions);
    /**
     * Connect to the WebSocket server
     *
     * @returns Promise that resolves when connected
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the WebSocket server
     */
    disconnect(): void;
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
    /**
     * Unsubscribe from an event type
     */
    off(event: 'transaction' | 'risk_alert' | 'compliance_alert', callback: WebSocketEventCallback): void;
    off(event: 'connect', callback: WebSocketConnectCallback): void;
    off(event: 'disconnect', callback: WebSocketDisconnectCallback): void;
    off(event: 'error', callback: WebSocketErrorCallback): void;
    /**
     * Send a message to the server
     *
     * @param type - Message type
     * @param data - Message payload
     */
    send(type: string, data: unknown): void;
    /**
     * Check if WebSocket is connected
     */
    isConnected(): boolean;
    /**
     * Get current connection state
     */
    getReadyState(): number;
    private handleMessage;
    private scheduleReconnect;
    private startHeartbeat;
    private stopHeartbeat;
}
export default FidesOriginWebSocket;
