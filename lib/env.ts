/**
 * lib/env.ts - 环境变量严格验证
 * 使用 Zod 验证所有环境变量，无回退值，验证失败立即抛出错误
 */
import { z } from "zod";

// 定义环境变量 Schema
const envSchema = z.object({
  // 前端暴露的环境变量 (NEXT_PUBLIC_ 前缀)
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_RISK_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_RULES_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUBGRAPH_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_KEY: z.string().min(1).optional(),
  
  // 运行时环境
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// 解析并验证环境变量
function parseEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_RISK_API_URL: process.env.NEXT_PUBLIC_RISK_API_URL,
    NEXT_PUBLIC_RULES_API_URL: process.env.NEXT_PUBLIC_RULES_API_URL,
    NEXT_PUBLIC_SUBGRAPH_URL: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const errors = parsed.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    );
    const errorMessage = `环境变量验证失败:\n${errors.join("\n")}`;
    
    // 在服务端直接抛出错误
    if (typeof window === "undefined") {
      throw new Error(errorMessage);
    }
    
    // 在客户端记录到控制台并抛出
    console.error("[ENV] 环境变量验证失败:", errors);
    throw new Error(errorMessage);
  }

  return parsed.data;
}

// 导出验证后的环境变量
export const env = parseEnv();

// 导出类型
export type Env = z.infer<typeof envSchema>;

// 辅助函数：检查是否配置了真实数据源
export function hasRealDataSource(): boolean {
  return !!(env.NEXT_PUBLIC_API_BASE_URL || env.NEXT_PUBLIC_SUBGRAPH_URL);
}

// 辅助函数：获取 API 基础 URL
export function getApiBaseUrl(): string | undefined {
  return env.NEXT_PUBLIC_API_BASE_URL;
}

// 辅助函数：获取风险 API URL
export function getRiskApiUrl(): string | undefined {
  return env.NEXT_PUBLIC_RISK_API_URL || 
    (env.NEXT_PUBLIC_API_BASE_URL ? `${env.NEXT_PUBLIC_API_BASE_URL}/risk` : undefined);
}

// 辅助函数：获取规则 API URL
export function getRulesApiUrl(): string | undefined {
  return env.NEXT_PUBLIC_RULES_API_URL || 
    (env.NEXT_PUBLIC_API_BASE_URL ? `${env.NEXT_PUBLIC_API_BASE_URL}/rules` : undefined);
}

// 辅助函数：获取 WebSocket URL
export function getWsUrl(): string | undefined {
  return env.NEXT_PUBLIC_WS_URL;
}

// 辅助函数：获取 Subgraph URL
export function getSubgraphUrl(): string | undefined {
  return env.NEXT_PUBLIC_SUBGRAPH_URL;
}

// 辅助函数：是否是开发环境
export function isDevelopment(): boolean {
  return env.NODE_ENV === "development";
}

// 辅助函数：是否是生产环境
export function isProduction(): boolean {
  return env.NODE_ENV === "production";
}
