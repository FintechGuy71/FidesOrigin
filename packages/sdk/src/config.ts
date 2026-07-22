/**
 * SDK Default Configuration
 *
 * Centralized default values for API endpoints and connection settings.
 * All values can be overridden via the config object passed to the client.
 */

/** 
 * [LOW-24 FIX] 不再提供默认生产 baseUrl。
 * 用户必须显式配置 baseUrl，防止开发/测试环境意外调用生产 API。
 * 在 client.ts 构造函数中会检查此配置是否已设置。
 */
export const DEFAULT_API_BASE_URL = '';

/** Default WebSocket URL (derived from baseUrl at runtime) */
export const DEFAULT_WEBSOCKET_URL = '';

/** Default Sepolia RPC endpoint */
export const DEFAULT_SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

/** Default risk registry contract address (Sepolia) */
export const DEFAULT_RISK_REGISTRY_ADDRESS =
  '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';
