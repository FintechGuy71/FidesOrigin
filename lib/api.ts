/**
 * lib/api.ts - API 封装层
 * 统一错误处理、请求/响应拦截器、自动重试机制（指数退避 + 抖动）
 *
 * Security Fixes:
 * - [Critical] SSRF 防护：URL 白名单/协议校验
 * - [Critical] 敏感头/密钥脱敏，防止经错误链路泄露
 * - [High] 请求超时控制
 * - [High] parseJson 运行时校验支持
 */

// 拦截器类型定义
export type RequestInterceptor = (url: string, options: RequestInit) => RequestInit | Promise<RequestInit>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;
export type ErrorInterceptor = (error: Error, url: string, options: RequestInit) => void | Promise<void>;

// 自定义错误类
export class ApiError extends Error {
  public readonly safeDataSummary: string;

  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
    message?: string
  ) {
    super(message ?? `API Error ${status}: ${statusText}`);
    this.name = "ApiError";
    this.safeDataSummary = typeof data === "string" ? `${data.slice(0, 80)}...` : "[object]";
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Network error") {
    super(message);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string = "Request timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

// === [Critical] SSRF 防护 ===

const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

const PRIVATE_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i,
  /^fc00:/i,
  /^fe80:/i,
  /^fd[0-9a-f]{2}:/i,
  /\.local$/i,
  /^metadata\.google\.internal$/i,
  /^0\./,
  /^localhost$/i,
];

/**
 * 校验 URL 安全性，防止 SSRF
 * @param rawUrl 原始 URL 字符串
 * @param requireSameOrigin 是否要求同源（仅允许相对路径）
 */
function assertSafeUrl(rawUrl: string, requireSameOrigin = true): void {
  if (requireSameOrigin) {
    // 仅允许以 / 开头的相对路径
    if (
      !rawUrl.startsWith("/") ||
      rawUrl.startsWith("//") ||
      rawUrl.startsWith("\\") ||
      rawUrl.startsWith("/\\") ||
      rawUrl.startsWith("\\/")
    ) {
      throw new Error("Only same-origin relative URLs are allowed");
    }
    // 检测协议前缀注入（如 javascript:, data: 等）
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
      throw new Error(`Protocol prefix detected in URL: ${rawUrl}`);
    }
    // 防止路径遍历
    if (rawUrl.includes("..")) {
      throw new Error("Path traversal detected in URL");
    }
    return;
  }

  // 绝对 URL 校验
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }

  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(parsed.hostname))) {
    throw new Error(`Private/internal host blocked: ${parsed.hostname}`);
  }
}

// === [Critical] 敏感信息脱敏 ===

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "proxy-authorization",
  "x-auth-token",
  "x-csrf-token",
]);

function sanitizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  let normalized: Record<string, string>;

  if (headers instanceof Headers) {
    normalized = Object.fromEntries(headers.entries());
  } else if (Array.isArray(headers)) {
    normalized = Object.fromEntries(headers);
  } else {
    normalized = headers as Record<string, string>;
  }

  for (const [k, v] of Object.entries(normalized)) {
    out[k] = SENSITIVE_HEADER_NAMES.has(k.toLowerCase()) ? "[REDACTED]" : String(v);
  }
  return out;
}

function sanitizeOptions(options: RequestInit): RequestInit {
  const { headers, body, ...rest } = options;
  return {
    ...rest,
    headers: sanitizeHeaders(headers),
    body: body ? "[REDACTED]" : undefined,
  };
}

// === [High] 超时控制 ===

const DEFAULT_TIMEOUT_MS = 15_000;

function withTimeout(
  signal: AbortSignal | null | undefined,
  timeoutMs: number
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError()), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      controller.abort(signal.reason);
    } else {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          controller.abort(signal.reason);
        },
        { once: true }
      );
    }
  }

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

// 拦截器存储（使用快照副本防止多请求并发污染）
const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];
const errorInterceptors: ErrorInterceptor[] = [];

// 添加拦截器
export function addRequestInterceptor(interceptor: RequestInterceptor): () => void {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
}

export function addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
}

export function addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
  errorInterceptors.push(interceptor);
  return () => {
    const index = errorInterceptors.indexOf(interceptor);
    if (index > -1) errorInterceptors.splice(index, 1);
  };
}

// 默认重试配置
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
  timeoutMs: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

// 计算重试延迟（指数退避 + 抖动）
function calculateRetryDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // 添加随机抖动 (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

// 应用请求拦截器
async function applyRequestInterceptors(url: string, options: RequestInit, interceptors: RequestInterceptor[]): Promise<RequestInit> {
  let currentOptions = { ...options };
  for (const interceptor of interceptors) {
    currentOptions = await interceptor(url, currentOptions);
  }
  return currentOptions;
}

// 应用响应拦截器
async function applyResponseInterceptors(response: Response, interceptors: ResponseInterceptor[]): Promise<Response> {
  let currentResponse = response;
  for (const interceptor of interceptors) {
    currentResponse = await interceptor(currentResponse);
  }
  return currentResponse;
}

// 应用错误拦截器（传入脱敏后的 options）
async function applyErrorInterceptors(error: Error, url: string, options: RequestInit, interceptors: ErrorInterceptor[]): Promise<void> {
  const sanitizedOpts = sanitizeOptions(options);
  for (const interceptor of interceptors) {
    try {
      await interceptor(error, url, sanitizedOpts);
    } catch {
      // 拦截器自身的错误不应中断流程
    }
  }
}

// 核心 fetch 封装
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  // [Critical] SSRF 防护
  assertSafeUrl(url, true);

  const config = { ...defaultRetryConfig, ...retryConfig };

  // [Critical Fix] 快照拦截器，防止并发请求间互相污染
  const currentRequestInterceptors = [...requestInterceptors];
  const currentResponseInterceptors = [...responseInterceptors];
  const currentErrorInterceptors = [...errorInterceptors];

  // 应用请求拦截器
  const finalOptions = await applyRequestInterceptors(url, options, currentRequestInterceptors);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // [High] 超时控制 - 每次尝试创建新的 timeout
    const { signal: timeoutSignal, cancel } = withTimeout(finalOptions.signal, config.timeoutMs);

    try {
      const response = await fetch(url, { ...finalOptions, signal: timeoutSignal });

      // 检查响应状态
      if (!response.ok) {
        // 如果是可重试状态码且还有重试次数
        if (config.retryableStatuses.includes(response.status) && attempt < config.maxRetries) {
          const delay = calculateRetryDelay(attempt, config.baseDelay, config.maxDelay);
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              `[API] ${response.status} 错误，${delay}ms 后重试 (${attempt + 1}/${config.maxRetries})...`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 不可重试或已用完重试次数
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }

        throw new ApiError(response.status, response.statusText, data);
      }

      // 应用响应拦截器
      return await applyResponseInterceptors(response, currentResponseInterceptors);
    } catch (error) {
    // [Critical] 优先检测外部 signal 主动取消 —— 主动取消绝不重试
    if (finalOptions.signal?.aborted) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await applyErrorInterceptors(lastError, url, finalOptions, currentErrorInterceptors);
      throw lastError;
    }

    // [High Fix] 使用特征检测替代 DOMException instanceof，兼容 Node.js 环境
    const isAbortError = error instanceof Error && error.name === "AbortError";
    if (isAbortError) {
      lastError = new TimeoutError();
      } else if (error instanceof TimeoutError) {
        lastError = error;
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // 网络错误或超时可重试
      if (
        (lastError instanceof TypeError || lastError instanceof TimeoutError) &&
        attempt < config.maxRetries
      ) {
        const delay = calculateRetryDelay(attempt, config.baseDelay, config.maxDelay);
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[API] ${lastError.name}，${delay}ms 后重试 (${attempt + 1}/${config.maxRetries})...`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // 应用错误拦截器并抛出
      await applyErrorInterceptors(lastError, url, finalOptions, currentErrorInterceptors);
      throw lastError;
    } finally {
      cancel();
    }
  }

  // 重试耗尽
  if (lastError) {
    await applyErrorInterceptors(lastError, url, finalOptions, currentErrorInterceptors);
    throw lastError;
  }

  throw new Error("Unknown API error");
}

// 便捷方法
export async function apiGet(url: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: "GET" });
}

export async function apiPost(url: string, body: unknown, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

export async function apiPut(url: string, body: unknown, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(url: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, { ...options, method: "DELETE" });
}

/**
 * [High] 解析 JSON 响应（支持运行时校验）
 * @param response fetch 响应对象
 * @param validator 可选的运行时校验函数，校验失败时抛出异常
 */
export async function parseJson<T>(
  response: Response,
  validator?: (data: unknown) => data is T
): Promise<T> {
  const data: unknown = await response.json();

  if (validator) {
    if (!validator(data)) {
      throw new Error("Response validation failed: data does not match expected schema");
    }
    return data;
  }

  return data as T;
}

// 风险分析 API 封装
export async function analyzeRisk(address: string): Promise<unknown> {
  const response = await apiPost("/api/risk/analyze", { address });
  return parseJson(response);
}

// 规则保存 API 封装
export async function saveRulesToApi(rules: unknown[]): Promise<unknown> {
  const response = await apiPost("/api/rules/save", { rules });
  return parseJson(response);
}

// Subgraph 查询封装
export async function querySubgraph(
  query: string,
  variables?: Record<string, unknown>
): Promise<unknown> {
  const response = await apiPost("/api/subgraph", { query, variables });
  return parseJson(response);
}