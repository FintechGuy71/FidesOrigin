/**
 * FidesOrigin SDK - Main Entry Point
 * Core client, utilities, error handling, and WebSocket support
 */

import type { ClientOptions } from './types';

// Core Client
export { FidesOriginClient } from './client';
export type { ClientOptions } from './types';

// Error Handling
export { FidesOriginError } from './error';
export type { ErrorCode, ErrorContext } from './error';

// Utilities
export {
  isAddress,
  validateAddress,
  formatAddress,
  normalizeAddress,
  getExplorerUrl,
  calculateBackoff,
  sleep,
  generateRequestId,
  deepMerge,
  sanitizeApiKey,
} from './utils';

// WebSocket
export { FidesOriginWebSocket } from './websocket';
export type {
  WebSocketClientOptions,
  WebSocketEventCallback,
  WebSocketErrorCallback,
  WebSocketConnectCallback,
  WebSocketDisconnectCallback,
} from './websocket';

// Convenience export
export const fides = {
  version: '0.2.1',
  createClient: async (options: ClientOptions) => new (await import('./client')).FidesOriginClient(options),
};
