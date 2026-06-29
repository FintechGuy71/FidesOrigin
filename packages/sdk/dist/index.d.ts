/**
 * FidesOrigin SDK - Main Entry Point
 * Core client, utilities, error handling, and WebSocket support
 */
export { FidesOriginClient } from './client';
export type { ClientOptions } from './client';
export { FidesOriginError } from './error';
export type { ErrorCode, ErrorContext } from './error';
export { isAddress, validateAddress, formatAddress, normalizeAddress, getExplorerUrl, calculateBackoff, sleep, generateRequestId, deepMerge, sanitizeApiKey, } from './utils';
export { FidesOriginWebSocket } from './websocket';
export type { WebSocketClientOptions, WebSocketEventCallback, WebSocketErrorCallback, WebSocketConnectCallback, WebSocketDisconnectCallback, } from './websocket';
export declare const fides: {
    version: string;
    createClient: (options: import("./client").ClientOptions) => Promise<import("./client").FidesOriginClient>;
};
