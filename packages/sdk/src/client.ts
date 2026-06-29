import { isAddress, getAddress } from "ethers";
import {
  RiskCheckInput,
  BatchRiskCheckInput,
  RiskCheckResult,
  BatchRiskCheckResult,
  DashboardStats,
  ComplianceRule,
  WebSocketConfig,
  FidesOriginConfig,
  RiskLevel,
  RiskCheckOptions,
  BatchRiskCheckRequest,
  BatchRiskCheckResponse,
  AddressRisk,
  Rule,
  RuleListOptions,
  RuleListResponse,
  CreateRuleRequest,
  UpdateRuleRequest,
} from "./types";
import { FidesOriginWebSocket } from "./websocket";

import { FidesOriginError } from "./error";
import type { ErrorCode } from "./error";

// ─── Error Codes (re-export from error.ts for backward compatibility) ────────

export type FidesOriginErrorCode = ErrorCode;

// ─── Retry Configuration ─────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// ─── HTTP Status to Error Code Mapping ───────────────────────────────────────

function getErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 404:
      return "NOT_FOUND";
    case 429:
      return "RATE_LIMITED";
    case 500:
    case 502:
    case 503:
    case 504:
      return "SERVER_ERROR";
    default:
      return "API_ERROR";
  }
}

// ─── Safe URL Builder ────────────────────────────────────────────────────────

function buildUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, value);
    }
    url.search = searchParams.toString();
  }
  return url.toString();
}

// ─── Signal Merging Utility (H-02) ───────────────────────────────────────────

/**
 * Merge external AbortSignal (caller-provided) with our timeout signal.
 * If either aborts, the resulting signal will be aborted.
 */
function mergeSignals(...signals: (AbortSignal | undefined | null)[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = (reason?: unknown) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };
  for (const sig of signals) {
    if (!sig) continue;
    if (sig.aborted) {
      onAbort((sig as any).reason);
      break;
    }
    sig.addEventListener("abort", () => onAbort((sig as any).reason), { once: true });
  }
  return controller.signal;
}

// ─── Sensitive Data Redaction (M-01) ─────────────────────────────────────────

const SENSITIVE_PATTERNS: Array<{ re: RegExp; repl: string }> = [
  // Bearer tokens / API keys (header style)
  { re: /[Bb]earer\s+[A-Za-z0-9._\-]{8,}/g, repl: "Bearer [REDACTED]" },
  { re: /(api[_-]?key|apikey|token|secret|password|authorization)["'\s:=]+[A-Za-z0-9._\-\/+]{6,}/gi, repl: "$1: [REDACTED]" },
  // Long hex strings (possible keys / addresses)
  { re: /\b0x[a-fA-F0-9]{32,}\b/g, repl: "0x[REDACTED]" },
  // Email addresses
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, repl: "[EMAIL REDACTED]" },
];

function redactSecrets(input: string): string {
  let out = input;
  for (const { re, repl } of SENSITIVE_PATTERNS) {
    out = out.replace(re, repl as any);
  }
  return out;
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

/**
 * fetchWithRetry
 * [H-02 修复] 增加超时控制（默认 15s），通过 AbortController 实现
 * [M-01 修复] 错误信息中不直接回显原始响应体，并对其中敏感信息做脱敏
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retryConfig: RetryConfig,
  apiKey?: string,
  timeoutMs: number = 15000
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryableStatusCodes } = retryConfig;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // [H-02 修复] 为每次请求创建独立的超时控制器
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      });

      // [Fix] Properly handle HeadersInit: Headers object, string[][], or Record
      if (options.headers) {
        const userHeaders = new Headers(options.headers);
        userHeaders.forEach((value, key) => headers.set(key, value));
      }

      // 合并调用方传入的 signal 与我们的超时 signal，任一触发都会中止请求
      const finalSignal = mergeSignals(options.signal, timeoutController.signal);

      // [Fix] Explicitly build RequestInit to avoid spreading untrusted fields
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        body: options.body,
        signal: finalSignal,
        headers,
      };

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        // [M-01 修复] 读取响应体但在错误消息中仅保留脱敏后的简短预览，不向调用方暴露敏感内容
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch {
          /* ignore */
        }

        const safePreview = errorBody.slice(0, 200).replace(/[\r\n]+/g, " ");
        const redacted = redactSecrets(safePreview);

        const err = new FidesOriginError(
          `API error ${response.status}${redacted ? `: ${redacted}` : ""}`,
          getErrorCode(response.status)
        );
        // rawBody 仅在内部对象上保留，不参与 toJSON 序列化
        Object.defineProperty(err, "rawBody", {
          value: errorBody,
          enumerable: false,
          writable: false,
          configurable: false,
        });

        throw err;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof FidesOriginError) {
        lastError = error;
      } else if (error instanceof Error) {
        // [Fix] AbortError from fetch (timeout or user cancel). TimeoutError is not a DOM standard.
        if (error.name === 'AbortError') {
          if (timeoutController.signal.aborted && !options.signal?.aborted) {
            lastError = new FidesOriginError(
              `Request timeout after ${timeoutMs}ms`,
              "TIMEOUT"
            );
          } else {
            lastError = new FidesOriginError(
              `Request aborted: ${error.message}`,
              "NETWORK_ERROR"
            );
          }
        } else {
          lastError = new FidesOriginError(
            `Network error: ${error.message}`,
            "NETWORK_ERROR"
          );
        }
      } else {
        const normalizedMessage = typeof error === 'string' ? error : 'Unknown non-Error exception';
        lastError = new FidesOriginError(normalizedMessage, "UNKNOWN");
      }

      // 超时错误也属于可重试范围（避免连接假死永久挂起）
      const isTimeout = lastError instanceof FidesOriginError && lastError.code === "TIMEOUT";

      const shouldRetry =
        attempt < maxRetries &&
        (lastError instanceof FidesOriginError
          ? retryableStatusCodes.includes(lastError.status || 0) || isTimeout
          : true);

      if (!shouldRetry) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      // [H-02 修复] 确保超时定时器被清理，避免内存泄漏与事件循环堆积
      clearTimeout(timer);
    }
  }

  throw lastError || new FidesOriginError("Request failed", "UNKNOWN");
}

// ─── Standalone Validation Functions ─────────────────────────────────────────

export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

export function validateAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new FidesOriginError("Invalid Ethereum address", "INVALID_ADDRESS");
  }
  return getAddress(address);
}

/**
 * [M-03 修复] 严格校验 chainId：
 * - 字符串必须为纯数字串（拒绝 "1evil"、"1e5" 等被 parseInt 截断的输入）
 * - 数字必须为整数（拒绝 1.5）
 * - 必须落在合理的 EVM chainId 范围内
 */
const KNOWN_CHAIN_IDS = new Set<number>([
  // Mainnets
  1, 10, 25, 56, 137, 250, 42161, 43114, 8453, 7777777, 324, 59144, 5000, 42220, 33139,
  // Testnets
  5, 11155111, 80001, 421613, 84532, 17000, 1440002,
]);

// ─── Chain Name → Chain ID Mapping (C-02 fix) ──────────────────────────────

const CHAIN_NAME_TO_ID: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
};

export function isValidChainId(chainId: number | string): boolean {
  let id: number;
  if (typeof chainId === "string") {
    // Check known chain names first
    const lower = chainId.toLowerCase();
    if (CHAIN_NAME_TO_ID[lower] !== undefined) {
      return CHAIN_NAME_TO_ID[lower] > 0;
    }
    // 仅允许纯数字字符串
    if (!/^\d+$/.test(chainId)) return false;
    id = Number(chainId);
  } else {
    if (!Number.isInteger(chainId)) return false;
    id = chainId;
  }
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  // 允许白名单中的 chainId；对于未知链，仍允许但要求在合理范围（1 ~ 2^32）
  // 这里不做严格白名单（避免阻碍新链），但保证数值合理
  if (id > 0xffffffff) return false;
  // 已知链直接放行
  if (KNOWN_CHAIN_IDS.has(id)) return true;
  // 未知链仍允许，但保留可扩展的告警钩子
  return true;
}

export function validateChainId(chainId: number | string): number {
  if (!isValidChainId(chainId)) {
    throw new FidesOriginError("Invalid chain ID", "INVALID_CHAIN_ID");
  }
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase();
    if (CHAIN_NAME_TO_ID[lower] !== undefined) {
      return CHAIN_NAME_TO_ID[lower];
    }
    return Number(chainId);
  }
  return chainId;
}

export function isValidAmount(amount: string): boolean {
  if (!amount || typeof amount !== "string") return false;
  return /^\d+(\.\d+)?$/.test(amount);
}

export function validateAmount(amount: string): string {
  if (!isValidAmount(amount)) {
    throw new FidesOriginError("Invalid amount format", "INVALID_AMOUNT");
  }
  return amount;
}

// ─── FidesOriginClient ───────────────────────────────────────────────────────

export class FidesOriginClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly retryConfig: RetryConfig;
  private readonly wsUrl: string;
  private readonly timeoutMs: number;
  private readonly allowBrowserUsage: boolean;

  /** Public readonly config accessor */
  get config(): FidesOriginConfig {
    return {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      timeout: this.timeoutMs,
      debug: false,
      retryConfig: this.retryConfig,
    };
  }

  constructor(config: FidesOriginConfig & { allowBrowserUsage?: boolean; timeoutMs?: number } = {}) {
    this.baseUrl = (config.baseUrl || "https://api.fidesorigin.com").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retryConfig,
    };
    this.wsUrl = this.baseUrl.replace(/^https/i, "wss").replace(/^http/i, "ws");
    this.timeoutMs = config.timeoutMs ?? config.timeout ?? 30000;
    this.allowBrowserUsage = config.allowBrowserUsage === true;

    // [H-01 修复] 浏览器/Worker 环境下，禁止使用服务端 Secret API Key（除非显式声明）
    // [High Fix] SSR-safe browser detection: check window only after confirming we're in a browser environment
    const isBrowser =
      typeof window !== 'undefined' &&
      typeof window.document !== 'undefined' &&
      typeof window.document.createElement === 'function';

    if (isBrowser && this.apiKey) {
      if (!this.apiKey.startsWith('pk_') && !this.allowBrowserUsage) {
        throw new FidesOriginError(
          "[FidesOriginClient] Secret API key must not be used in browser/worker. " +
          "Use a backend proxy or pass allowBrowserUsage=true only with a scoped public token.",
          "UNAUTHORIZED"
        );
      }
      if (!this.apiKey.startsWith('pk_')) {
        console.warn(
          '[FidesOriginClient] Browser usage enabled. Ensure this token is a scoped public token.'
        );
      }
    }
  }

  // ─── Risk Assessment ─────────────────────────────────────────────────────

  /**
   * 单地址风险查询
   */
  async checkRisk(input: RiskCheckInput): Promise<RiskCheckResult> {
    const account = validateAddress(input.address);
    const chainId = validateChainId(input.chainId);

    const params: Record<string, string> = {
      address: account,
      chainId: String(chainId),
    };
    if (input.amount !== undefined && input.amount !== null) {
      params.amount = validateAmount(input.amount);
    }

    return fetchWithRetry<RiskCheckResult>(
      buildUrl(this.baseUrl, '/v1/risk/check', params),
      { method: 'GET' },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  /**
   * 批量风险查询
   */
  async batchCheckRisk(input: BatchRiskCheckInput): Promise<BatchRiskCheckResult> {
    const addresses = input.addresses.map(validateAddress);
    const chainId = validateChainId(input.chainId);

    const body: BatchRiskCheckRequest = {
      chainId,
      addresses,
      ...(input.amount ? { amount: validateAmount(input.amount) } : {}),
    };

    return fetchWithRetry<BatchRiskCheckResult>(
      buildUrl(this.baseUrl, '/v1/risk/batch-check'),
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  /**
   * 查询某地址的最新风险快照
   */
  async getAddressRisk(address: string): Promise<AddressRisk> {
    const account = validateAddress(address);
    return fetchWithRetry<AddressRisk>(
      buildUrl(this.baseUrl, `/v1/risk/address/${account}`),
      { method: 'GET' },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  // ─── Dashboard / Stats ───────────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    return fetchWithRetry<DashboardStats>(
      buildUrl(this.baseUrl, '/v1/dashboard/stats'),
      { method: 'GET' },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  // ─── Compliance Rules ────────────────────────────────────────────────────

  async listRules(options: RuleListOptions = {}): Promise<RuleListResponse> {
    const params: Record<string, string> = {};
    if (options.limit !== undefined) params.limit = String(options.limit);
    if (options.offset !== undefined) params.offset = String(options.offset);
    if (options.status) params.status = options.status;

    return fetchWithRetry<RuleListResponse>(
      buildUrl(this.baseUrl, '/v1/rules', params),
      { method: 'GET' },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  async createRule(req: CreateRuleRequest): Promise<Rule> {
    if (!req || typeof req !== 'object') {
      throw new FidesOriginError('Invalid create rule request', 'BAD_REQUEST');
    }
    return fetchWithRetry<Rule>(
      buildUrl(this.baseUrl, '/v1/rules'),
      { method: 'POST', body: JSON.stringify(req) },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  async updateRule(id: string, req: UpdateRuleRequest): Promise<Rule> {
    if (!id) {
      throw new FidesOriginError('Rule id is required', 'BAD_REQUEST');
    }
    return fetchWithRetry<Rule>(
      buildUrl(this.baseUrl, `/v1/rules/${encodeURIComponent(id)}`),
      { method: 'PATCH', body: JSON.stringify(req || {}) },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  async deleteRule(id: string): Promise<void> {
    if (!id) {
      throw new FidesOriginError('Rule id is required', 'BAD_REQUEST');
    }
    await fetchWithRetry<void>(
      buildUrl(this.baseUrl, `/v1/rules/${encodeURIComponent(id)}`),
      { method: 'DELETE' },
      this.retryConfig,
      this.apiKey,
      this.timeoutMs
    );
  }

  // ─── WebSocket ───────────────────────────────────────────────────────────

  createWebSocket(config?: WebSocketConfig): FidesOriginWebSocket {
    return new FidesOriginWebSocket({
      url: this.wsUrl,
      apiKey: this.apiKey,
      ...config,
    } as any);
  }
}

export default FidesOriginClient;