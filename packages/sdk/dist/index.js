/**
 * FidesOrigin SDK - Main Entry Point
 * Core client, utilities, error handling, and WebSocket support
 */
// Core Client
export { FidesOriginClient } from './client';
// Error Handling
export { FidesOriginError } from './error';
// Utilities
export { isAddress, validateAddress, formatAddress, normalizeAddress, getExplorerUrl, calculateBackoff, sleep, generateRequestId, deepMerge, sanitizeApiKey, } from './utils';
// WebSocket
export { FidesOriginWebSocket } from './websocket';
// Convenience export
export const fides = {
    version: '0.2.1',
    createClient: async (options) => new (await import('./client')).FidesOriginClient(options),
};
