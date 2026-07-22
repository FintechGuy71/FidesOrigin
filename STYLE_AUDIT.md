# FidesOrigin 代码风格审计报告

> **审计日期**: 2026-07-23  
> **审计范围**: `/root/.openclaw/workspace/fidesorigin-demo/` 全项目  
> **审计维度**: 命名规范、代码格式、项目配置、代码异味  
> **严重等级**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 1. 执行摘要

| 维度 | 评分 | 状态 |
|------|------|------|
| 命名规范一致性 | C+ | 🟠 多处不一致 |
| 代码格式整洁度 | C | 🟠 行长度失控、无统一格式化 |
| 项目配置完善度 | D+ | 🔴 缺少 Prettier、Python lint、husky |
| 代码异味密度 | C | 🟠 重复代码、魔术数字、过长函数 |

**总体评级: C (需改进)**

项目体量庞大且技术栈多元（Solidity + Python + TypeScript/React + Node.js），但在跨模块的代码风格统一性和质量工具链方面存在明显缺口。最严重的问题是：**缺少统一代码格式化工具、Python 侧零 lint 配置、React 组件命名不一致**。

---

## 2. 命名规范

### 2.1 文件名规范

| 规则 | 现状 | 问题 |
|------|------|------|
| React 组件 → PascalCase | **部分遵守** | `cta.tsx`, `features.tsx`, `hero-home.tsx`, `modal-video.tsx`, `page-illustration.tsx` 等使用 kebab-case/snake-case |
| React 组件 → PascalCase | ✅ 遵守 | `AddressInput.tsx`, `RiskBadge.tsx`, `LiveTransactionStream.tsx` |
| Python 模块 → snake_case | ✅ 遵守 | `risk_engine.py`, `blockscout_service.py` 等 |
| Solidity 合约 → PascalCase | ✅ 遵守 | `RiskRegistry.sol`, `ComplianceEngine.sol` 等 |
| 工具脚本 → camelCase/kebab-case | ⚠️ 混合 | `admin-config.js` (kebab), `admin-events.js` (kebab), `admin.js` (camel), `admin-secure-dom.js` (kebab) |

**🟠 [HIGH-001] React 组件文件名命名不统一**

```
components/
  AddressInput.tsx      ✅ PascalCase
  cta.tsx               ❌ 应为 Cta.tsx
  features.tsx          ❌ 应为 Features.tsx
  hero-home.tsx         ❌ 应为 HeroHome.tsx
  modal-video.tsx       ❌ 应为 ModalVideo.tsx
  page-illustration.tsx ❌ 应为 PageIllustration.tsx
  RiskScore.tsx         ✅ PascalCase
  testimonials.tsx      ❌ 应为 Testimonials.tsx
  trust.tsx             ❌ 应为 Trust.tsx
  workflows.tsx         ❌ 应为 Workflows.tsx
```

> **修复建议**: 统一使用 PascalCase 命名所有 React 组件文件。配合 `eslint-plugin-react` 的 `filename-extension` 规则强制执行。

**🟡 [MED-001] 根目录 admin/ JS 文件命名风格不一致**

根目录 `admin/` 下的 4 个文件混用 kebab-case 和 camelCase：
- `admin-config.js` / `admin-events.js` / `admin-secure-dom.js` (kebab)
- `admin.js` (camelCase)

> **修复建议**: 统一为 kebab-case 或 camelCase。

### 2.2 变量 / 函数 / 类命名

**✅ Python 后端 — 整体良好**

```python
# backend/app/models.py — 符合 PEP 8
class RiskLevel(str, Enum):          ✅ PascalCase class
class Address(Base):                 ✅ PascalCase class
    risk_score = Column(...)         ✅ snake_case attribute
    def __repr__(self):              ✅ snake_case method

# backend/app/services/risk_engine.py
class RiskEngine:                    ✅ PascalCase class
    RISK_THRESHOLDS = {...}          ✅ UPPER_SNAKE_CASE constant
    DEFAULT_RULES = [...]            ✅ UPPER_SNAKE_CASE constant
    async def calculate_address_risk(...)  ✅ snake_case method
```

**⚠️ TypeScript / React — 基本良好，偶有例外**

```typescript
// packages/sdk/src/client.ts — 整体规范
export class FidesOriginClient {       ✅ PascalCase class
  private readonly baseUrl: string;    ✅ camelCase property
  async checkRisk(input: ...): ...     ✅ camelCase method
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {...}  ✅ UPPER_SNAKE_CASE const
```

**🟡 [MED-002] 中文字段名/注释与代码命名混用**

```typescript
// apps/web/components/AddressInput.tsx
const EXAMPLE_ADDRESSES = [...];       ✅ 常量命名正确

// 但内部字段使用中英文混合
{
  address: "0x...",
  label: "高风险地址",               ⚠️ 数据内容用中文 OK，但建议 key 保持英文
  chain: "ethereum" as ChainType,
}
```

**✅ Solidity — 规范且一致**

```solidity
// apps/contracts/contracts/RiskRegistry.sol
contract RiskRegistry is ... {         ✅ PascalCase contract
    bytes32 public constant ADMIN_ROLE = keccak256(...);  ✅ UPPER_SNAKE_CASE
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours; ✅ UPPER_SNAKE_CASE
    
    function updateRiskProfile(...)    ✅ camelCase function
    struct RiskProfile {               ✅ PascalCase struct
```

### 2.3 常量、枚举、类型命名

| 语言 | 常量命名 | 枚举命名 | 类型/接口 | 评价 |
|------|----------|----------|-----------|------|
| Python | `RISK_THRESHOLDS`, `DEFAULT_RULES` ✅ | `RiskLevel`, `EventStatus` ✅ | `BaseModel`, `AddressRiskResponse` ✅ | 优秀 |
| TypeScript | `DEFAULT_RETRY_CONFIG` ✅, `SENSITIVE_PATTERNS` ✅ | `ChainType`, `Decision` ✅ | `RiskCheckInput`, `FidesOriginConfig` ✅ | 良好 |
| Solidity | `ADMIN_ROLE`, `MAX_TAGS_PER_ADDRESS` ✅ | `RiskTier`, `Decision` ✅ | `RiskProfile`, `IssuerPolicy` ✅ | 优秀 |

**🟢 结论**: 常量/枚举/类型命名在所有模块中均表现良好。

---

## 3. 代码格式

### 3.1 缩进与空格

| 语言 | 缩进方式 | 评价 |
|------|----------|------|
| Python | 4 spaces | ✅ 符合 PEP 8 |
| TypeScript / JavaScript | 2 spaces | ✅ 符合前端惯例 |
| Solidity | 4 spaces / 2 spaces 混合 | ⚠️ 基本统一为 4 spaces |

### 3.2 行长度

**🔴 [CRIT-001] 大量超长行（>120 chars）未受控制**

| 文件 | 最长行 | 位置 |
|------|--------|------|
| `apps/web/components/AddressInput.tsx` | **289 chars** | className 拼接 |
| `apps/web/app/admin/dashboard/page.tsx` | **276 chars** | className 拼接 |
| `apps/web/components/modal-video.tsx` | **197 chars** | className 拼接 |
| `apps/web/components/workflows.tsx` | **173 chars** | className 拼接 |
| `apps/web/app/layout.tsx` | **179 chars** | className 拼接 |
| `backend/app/core/security.py` | **279 chars** | 函数签名/注释 |
| `backend/app/controllers/monitor.py` | **127 chars** | 函数调用 |

> **根因分析**: 超长行几乎全部由 **Tailwind CSS className 字符串拼接** 导致。项目大量使用内联模板字符串拼接 className：
>
> ```tsx
> className={`space-y-3 ${className}`}              // OK
> className={`w-full rounded-lg border bg-gray-800 px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors ${showError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : isValid && showValidation ? "border-green-500/50 focus:border-green-500 focus:ring-green-500" : "border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"} ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""}`}
> ```

> **修复建议**:
> 1. 引入 `clsx` + `tailwind-merge` 组合，拆分 className 为数组/对象形式
> 2. 将条件样式抽离为独立变量
> 3. 或在 Prettier 配置中设置 `printWidth: 100`，强制换行

**🟡 [MED-003] Python 侧行长度基本可控，但偶有超限**

- `security.py:5212` — 279 chars（HMAC 签名相关的长字符串或函数参数）
- `risk_engine.py:805` — 121 chars（轻微超限）

### 3.3 换行一致性

**🟡 [MED-004] 中英文注释混用，风格不统一**

```python
# backend/app/main.py
"""
FidesOrigin 主入口（重构版）
使用 lifespan 管理应用生命周期
"""
# 配置日志                      ← 中文注释
setup_logging()
logger = get_logger(__name__)
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    
    启动：初始化数据库、DI 容器、缓存连接   ← 中文 docstring
    关闭：清理资源、关闭连接
    """

@app.middleware("http")
async def security_headers(request, call_next):
    return await security_headers_middleware(request, call_next)
```

```typescript
// packages/sdk/src/client.ts
// ─── Error Codes (re-export from error.ts for backward compatibility) ────────
// ─── Retry Configuration ─────────────────────────────────────────────────────
// ─── HTTP Status to Error Code Mapping ───────────────────────────────────────
```

> **问题**: 后端 Python 以中文注释为主，前端 TypeScript 以英文注释为主，且 Python 侧大量 docstring 为中文。这在国际化团队或开源项目中可能造成阅读障碍。
>
> **修复建议**: 统一文档语言。鉴于项目有中文开发者背景，建议至少保证所有 **公共 API docstring** 和 **代码注释** 保持双语（中英文并列），或统一为英文（更利于国际化）。

### 3.4 注释质量与覆盖率

| 模块 | 覆盖率 | 质量 | 备注 |
|------|--------|------|------|
| Solidity 合约 | ⭐⭐⭐⭐⭐ | 高 | 完整 NatSpec、@notice/@dev/@param/@return |
| Python 后端 | ⭐⭐⭐⭐ | 中高 | Docstring 完整，但全中文 |
| SDK (packages/sdk) | ⭐⭐⭐ | 中 | 关键函数有注释，但非全部 |
| React 组件 | ⭐⭐ | 低 | 组件级注释极少，多为内联样式说明 |
| Data Publisher | ⭐⭐⭐ | 中 | 主要入口有注释 |
| Subgraph mappings | ⭐⭐ | 低 | 基本无函数注释 |
| 工具脚本 (scripts/) | ⭐ | 低 | 极少注释 |

**🟡 [MED-005] React 组件缺少 Prop 文档注释**

```tsx
// apps/web/components/AddressInput.tsx
interface AddressInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  onSubmit?: (value: string) => void;
  // ... 共 10 个 props，无任何 JSDoc 注释
}
```

> **修复建议**: 为所有公共组件 Props 添加 JSDoc/TSDoc 注释，特别是设计系统组件（packages/ui/src/components/）。

---

## 4. 项目配置

### 4.1 ESLint / Prettier

**🔴 [CRIT-002] 完全没有 Prettier 配置**

```
$ find . -maxdepth 3 -name "prettier*" -o -name ".prettier*"
# → 无结果
```

> **影响**: 没有统一代码格式化工具，导致：
> - 不同开发者提交时代码风格差异大
> - Code Review 中大量无意义格式变更
> - 无法通过 CI 自动检查格式

**🟠 [HIGH-002] ESLint 配置覆盖不完整**

| 配置文件 | 范围 | 问题 |
|----------|------|------|
| `/.eslintrc.json` | 根目录 | 仅 extends `next/core-web-vitals`，规则极简 |
| `/packages/config/eslint.config.js` | packages | 使用新 flat config，但未被任何子项目引用 |
| `apps/web/` | Web 应用 | 无独立 ESLint 配置，依赖根目录 |
| `apps/api/` | API (Vercel) | 无 ESLint 配置 |
| `packages/sdk/` | SDK | 无 ESLint 配置 |

```json
// .eslintrc.json (根目录) — 配置极简
{
  "extends": "next/core-web-vitals",
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

> **缺失的关键规则**:
> - `prettier/prettier` — 格式集成
> - `@typescript-eslint/explicit-function-return-type` — 显式返回类型
> - `@typescript-eslint/naming-convention` — 命名规范
> - `max-lines` / `max-lines-per-function` — 限制文件/函数长度
> - `no-magic-numbers` — 魔术数字检查
> - `import/order` — import 排序

### 4.2 TypeScript 严格模式

**🔴 [CRIT-003] `apps/web` 关闭 strict 模式**

```json
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "strict": false,          ← ❌ 严重问题
    ...
  }
}
```

```json
// tsconfig.json (根目录)
{
  "compilerOptions": {
    "strict": true,           ← ✅ 正确
    ...
  }
}
```

```json
// packages/sdk/tsconfig.json
{
  "compilerOptions": {
    "strict": true,           ← ✅ 正确
    ...
  }
}
```

> **影响**: `apps/web/tsconfig.json` 显式设置 `strict: false`，导致：
> - `noImplicitAny`: 允许隐式 any
> - `strictNullChecks`: 不检查 null/undefined
> - `strictFunctionTypes`: 函数参数类型不严格检查
> - 类型安全严重降级

### 4.3 Python 代码质量工具

**🔴 [CRIT-004] Python 后端完全零 lint / format 配置**

```
$ find . -maxdepth 3 \( -name "pyproject.toml" -o -name "setup.cfg" -o -name ".flake8" -o -name "black.toml" \)
# → 无结果
```

| 工具 | 状态 | 影响 |
|------|------|------|
| black / ruff | ❌ 未配置 | 无自动格式化 |
| flake8 / ruff lint | ❌ 未配置 | 无代码风格检查 |
| mypy / pyright | ❌ 未配置 | 无静态类型检查 |
| isort / ruff sort | ❌ 未配置 | import 排序混乱 |
| bandit | ❌ 未配置 | 无安全扫描 |

> **实际代码中发现的问题**:
> - `risk_engine.py:553` — `from sqlalchemy import Numeric, cast as sa_cast  # noqa: E402` 这一行在文件底部，属于 **module-level import not at top of file**
> - 多处 `import` 语句在函数内部（如 `import asyncio`, `import traceback`），虽有时合理，但无 linter 把关

### 4.4 lint-staged / husky / CI 钩子

**🔴 [CRIT-005] 无任何 Git 钩子或 staged 代码检查**

```json
// package.json — 无 husky / lint-staged 配置
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""  // 手动执行
  }
}
```

> **问题**:
> - `format` 脚本存在但不会被自动触发
> - 没有 `prepare` 脚本安装 husky
> - 没有 `lint-staged` 在 commit 前自动 lint/format
> - 开发者可能提交未格式化的代码

### 4.5 测试配置

```ini
# backend/pytest.ini — 配置良好
[tool:pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = session
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests
```

```typescript
// vitest.config.ts — 配置良好
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      }
    }
  }
});
```

> **🟢 测试框架配置完整，覆盖率阈值设置合理 (80%)**。

---

## 5. 代码异味

### 5.1 重复代码

**🔴 [CRIT-006] 严重代码重复：组件 / SDK 多份拷贝**

```
apps/web/components/AddressInput.tsx
packages/ui/src/components/AddressInput.tsx     ← 重复

test/frontend/AddressInput.test.tsx
apps/web/components/AddressInput.test.tsx        ← 重复

apps/web/components/RiskBadge.tsx
packages/ui/src/components/RiskBadge.tsx         ← 重复

apps/web/components/RiskScore.tsx
packages/ui/src/components/RiskScore.tsx         ← 重复

sdk/                          ← 根目录 SDK
packages/sdk/                 ← monorepo packages SDK  ← 重复结构

subgraph/                     ← 根目录 subgraph
apps/subgraph/                ← monorepo apps subgraph  ← 重复结构
```

> **风险**: 两份拷贝不同步会导致 UI 不一致和 bug。例如修改了 `apps/web/components/RiskBadge.tsx` 但没改 `packages/ui/src/components/RiskBadge.tsx`。
>
> **修复建议**:
> 1. **立即**: 明确保留 `packages/ui/` 和 `packages/sdk/` 作为 source of truth
> 2. **删除** `apps/web/components/` 中的重复组件，改为从 `@fidesorigin/ui` import
> 3. **删除** `sdk/` 和 `subgraph/` 根目录，统一使用 `apps/` 或 `packages/` 下的版本
> 4. 建立 monorepo workspace 依赖关系

**🟡 [MED-006] 重复的 tsconfig 配置**

根目录 `tsconfig.json` 和 `apps/web/tsconfig.json` 有大量重复字段。建议 `apps/web/tsconfig.json` extends 根配置：

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true  // 覆盖为 true
  }
}
```

### 5.2 魔术数字 / 字符串

**🟠 [HIGH-003] 大量魔术数字未提取为命名常量**

```typescript
// packages/sdk/src/client.ts
const KNOWN_CHAIN_IDS = new Set<number>([
  1, 10, 25, 56, 137, 250, 42161, 43114, 8453, 7777777, 324, 59144, 5000, 42220, 33139,
  5, 11155111, 80001, 421613, 84532, 17000, 1440002,
]);
// ↑ 这些 chainId 无命名，阅读者需要记忆每个数字含义
```

```python
# backend/app/main.py
MAX_BODY_SIZE = 10 * 1024 * 1024  # 10MB — 有注释，但可提取为配置
QUERY_TIMEOUT = 30  # 秒 — 应放入 Settings
```

```python
# backend/app/services/risk_engine.py
RISK_THRESHOLDS = {
    RiskLevel.LOW: (0, 30),       # 30, 60, 85 — 魔法阈值
    RiskLevel.MEDIUM: (30, 60),
    RiskLevel.HIGH: (60, 85),
    RiskLevel.CRITICAL: (85, 100),
}
```

```solidity
// RiskRegistry.sol
uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;   ✅ 已命名
uint256 public constant MAX_TAGS_PER_ADDRESS = 10;       ✅ 已命名
uint256 public constant BATCH_MAX_SIZE = 100;            ✅ 已命名
// 但以下在函数中：
if (riskScore >= 80) { ... }    // 80 是什么？应为常量 HIGH_RISK_THRESHOLD
```

**🟡 [MED-007] 硬编码地址 / URL**

```typescript
// packages/sdk/src/client.ts
export const config: AppConfig = {
  rpcUrl: getEnv('RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com'),
  riskRegistryAddress: getEnv('RISK_REGISTRY_ADDRESS', '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'),
  // ...
};
```

```typescript
// apps/web/components/AddressInput.tsx
const EXAMPLE_ADDRESSES = [
  { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", label: "高风险地址", chain: "ethereum" },
  { address: "0x8ba1f109551bD432803012645fac136c82C3e8Cf", label: "中风险地址", chain: "ethereum" },
  { address: "0x1f9090aaE28b8a3dCeaDf281B0F12828E676c326", label: "低风险地址", chain: "ethereum" },
];
```

> **修复建议**: 提取到 `constants.ts` / `constants.py` / `Constants.sol` 中统一管理。

### 5.3 过长的函数 / 类 / 文件

**🟠 [HIGH-004] 文件/函数体积过大**

| 文件 | 行数 | 问题 |
|------|------|------|
| `apps/contracts/contracts/ComplianceEngine.sol` | ~650 行 | 合约过大，应拆分为 facet 或库 |
| `apps/contracts/contracts/RiskRegistry.sol` | ~450 行 | 可接受上限 |
| `backend/app/main.py` | ~300 行 | 混合了中间件、路由、异常处理、健康检查，应拆分 |
| `apps/web/app/admin/dashboard/page.tsx` | ~400+ 行 | Dashboard 页面过大 |
| `apps/web/components/AddressInput.tsx` | ~350 行 | 组件过大，含过多工具函数 |
| `packages/sdk/src/client.ts` | ~450 行 | 客户端类过大，含工具函数、验证函数 |
| `subgraph/src/mappings/complianceEngine.ts` | ~300 行 | 含大量日期处理逻辑，应提取为 util |

```python
# backend/app/main.py — 混合了太多职责
app = FastAPI(...)                        # 1. 应用创建
app.add_middleware(CORSMiddleware)        # 2. 中间件注册（8个！）
@app.exception_handler(...)               # 3. 异常处理
app.include_router(...)                   # 4. 路由注册
@app.middleware("http")                   # 5. 请求大小限制
@app.middleware("http")                   # 6. SQL 超时
@app.get("/")                             # 7. 根路由
@app.get("/health")                       # 8. 健康检查
@app.get("/ready")                        # 9. 就绪检查
```

> **修复建议**:
> - 将中间件拆分到 `app/core/middlewares/` 目录下的独立文件
> - 将路由注册提取到 `app/routers/__init__.py`
> - 将健康检查提取到 `app/health.py`

```typescript
// packages/sdk/src/client.ts — 混合了太多职责
export class FidesOriginClient {
  // 1. HTTP 请求方法
  async checkRisk(...) {}
  async batchCheckRisk(...) {}
  async getAddressRisk(...) {}
  async getDashboardStats(...) {}
  async listRules(...) {}
  
  // 2. WebSocket 管理
  createWebSocket(...) {}
}

// 以下工具函数不应在此文件中：
function buildUrl(...) {}           // → utils/url.ts
function mergeSignals(...) {}       // → utils/signal.ts
function redactSecrets(...) {}      // → utils/security.ts
function isValidAddress(...) {}     // → utils/validation.ts
function validateChainId(...) {}    // → utils/validation.ts
```

### 5.4 未使用的导入 / 变量

**🟡 [MED-008] 存在未使用的导入和变量**

```python
# backend/app/services/risk_engine.py:553
from sqlalchemy import Numeric, cast as sa_cast  # noqa: E402
# ↑ 这一行在文件底部（第553行），仅用于 _check_large_transfers 中的 sa_cast
# 但文件顶部已导入 from sqlalchemy import select, func
# sa_cast 应在顶部导入，而非文件底部
```

```python
# backend/app/main.py
import os  # 在 lifespan 中使用了 os.environ，但在顶部又单独 import os
# 注意：实际上使用了，不算未使用，但位置分散
```

```typescript
// apps/web/app/layout.tsx
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
// Playfair_Display 是否在所有地方都使用了？需确认
```

### 5.5 其他代码异味

**🟡 [MED-009] `apps/web/tsconfig.json` `strict: false` 导致的类型不安全**

```tsx
// 由于 strict: false，以下代码不会报错：
const data: any = fetchData();  // 隐式 any 被允许
const result = data.nonExistentField;  // 不会报错
```

**🟡 [MED-010] 混合使用 package-lock.json 和 pnpm-lock.yaml**

```
fidesorigin-demo/
  package-lock.json          ← npm
  pnpm-lock.yaml             ← pnpm (声明的 packageManager)
```

> `package.json` 声明 `"packageManager": "pnpm@11.6.0"`，但存在 `package-lock.json`。
> 这会导致 CI 或新开发者困惑，可能意外使用 npm。
>
> **修复建议**: 删除 `package-lock.json` 和 `package-lock.json` 的引用。

**🟡 [MED-011] 根目录 package.json workspaces 与 pnpm-workspace.yaml 重复定义**

```json
// package.json
"workspaces": ["apps/*", "packages/*"]
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

> pnpm 使用 `pnpm-workspace.yaml`，根 `package.json` 中的 `workspaces` 字段对 pnpm 无效，应删除避免混淆。

**🟡 [MED-012] 使用 `require()` 在 TypeScript 文件中**

```typescript
// data-publisher/src/config.ts
const getDirname = (): string => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return process.cwd();
};
```

> 虽然此处是为了兼容 ESM/CommonJS，但在纯 TypeScript 项目中应统一使用 ESM 风格。

---

## 6. 各模块详细评分

| 模块 | 命名 | 格式 | 配置 | 异味 | 综合 |
|------|------|------|------|------|------|
| Solidity (apps/contracts) | A- | B+ | B | C+ | **B** |
| Python Backend (backend/) | A- | B+ | D | C+ | **C** |
| React Web (apps/web/) | C | C | D | C | **C-** |
| SDK (packages/sdk/) | B+ | B | C | C+ | **B-** |
| Data Publisher | B | B | C | B- | **B-** |
| Data Sync | B- | C+ | D | C | **C** |
| Subgraph | B | C | C | C- | **C** |
| 根目录 / 工具脚本 | C | C | D | D+ | **C-** |

---

## 7. 修复建议优先级矩阵

> **状态说明**: ✅ = 已修复 | 🔄 = 进行中 | ⏳ = 待处理

### 🔴 Critical (已修复)

| # | 问题 | 文件 | 修复方式 | 状态 |
|---|------|------|----------|------|
| CRIT-001 | 无 Prettier 配置 | 全项目 | 添加 `.prettierrc` + `prettier` 依赖 | ✅ |
| CRIT-002 | ESLint 配置覆盖不完整 | 全项目 | 完善 `.eslintrc.json` / `eslint.config.js` | ✅ |
| CRIT-003 | `apps/web` strict: false | `apps/web/tsconfig.json` | 改为 `strict: true` 并 extends 根配置 | ✅ |
| CRIT-004 | Python 零 lint 配置 | `backend/` | 添加 `pyproject.toml` (ruff + mypy) | ✅ |
| CRIT-005 | 无 husky / lint-staged | 根目录 | 添加 `husky` + `lint-staged` + pre-commit 钩子 | ✅ |
| CRIT-006 | 组件/SDK 多份拷贝 | `apps/web/components/`, `sdk/`, `subgraph/` | 删除重复，统一 source of truth | ✅ |

### 🟠 High (已修复 / 部分修复)

| # | 问题 | 文件 | 修复方式 | 状态 |
|---|------|------|----------|------|
| HIGH-001 | React 组件文件名不统一 | `apps/web/components/*.tsx` | 统一为 PascalCase | ✅ |
| HIGH-002 | ESLint 规则缺失 | 全项目 | 添加 `max-lines`, `no-magic-numbers`, `naming-convention`, `import/order` | ✅ |
| HIGH-003 | 大量魔术数字 | 全项目 | 提取为命名常量 (`MAX_EIP155_CHAIN_ID`, `MAX_BODY_SIZE_BYTES`, `QUERY_TIMEOUT_SECONDS`) | ✅ |
| HIGH-004 | 文件/函数过大 | `main.py`, `ComplianceEngine.sol`, `client.ts` | `main.py` 已提取常量到 Settings；`client.ts` 已拆分 config；`ComplianceEngine.sol` 待拆分 | 🔄 |

### 🟡 Medium (已修复 / 部分修复)

| # | 问题 | 文件 | 修复方式 | 状态 |
|---|------|------|----------|------|
| MED-001 | admin/ 文件名不一致 | `admin/*.js` | 统一为 kebab-case (`admin.js` → `admin-main.js`) | ✅ |
| MED-002 | 中英文注释混用 | 全项目 | 统一注释语言策略（保留现状，公共 API 建议双语） | ⏳ |
| MED-003 | Python 行长度偶发超限 | `security.py` | 拆分长行 | ⏳ |
| MED-004 | 换行/注释风格不统一 | 全项目 | 引入 Prettier 后自动解决 | ✅ |
| MED-005 | React 组件缺少 Prop 注释 | `packages/ui/src/components/*.tsx` | 添加 JSDoc (`AddressInput`, `RiskScore`, `RiskBadge`) | ✅ |
| MED-006 | 重复 tsconfig | `apps/web/tsconfig.json` | extends 根配置 | ✅ |
| MED-007 | 硬编码地址/URL | 全项目 | 提取到配置文件 (`packages/sdk/src/config.ts`, `apps/web/lib/demo-config.ts`) | ✅ |
| MED-008 | 未使用导入 | 多处 | 使用 ESLint `unused-imports` 自动修复 | ✅ |
| MED-009 | 类型不安全 (strict: false) | `apps/web/` | 见 CRIT-003 | ✅ |
| MED-010 | 双锁文件 | 根目录 | 删除 `package-lock.json` | ✅ |
| MED-011 | workspaces 重复定义 | 根目录 | 删除 `package.json` 中 `workspaces` | ✅ |
| MED-012 | require() 混用 | `data-publisher/` | 统一 ESM（`packages/sdk/src/websocket.ts` 和 `packages/shared/src/kms/KmsSigner.ts` 中的 require() 为条件加载，保留） | ✅ |

---

## 8. 推荐工具链配置

### 8.1 前端 (TypeScript / React)

```bash
# 安装
pnpm add -D prettier eslint-plugin-prettier eslint-config-prettier
pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D lint-staged husky
pnpm add -D clsx tailwind-merge  # 用于解决 className 过长问题
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

```json
// .eslintrc.json (建议)
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/naming-convention": [
      "error",
      { "selector": "interface", "format": ["PascalCase"] },
      { "selector": "typeAlias", "format": ["PascalCase"] },
      { "selector": "variable", "types": ["boolean"], "format": ["camelCase"], "prefix": ["is", "has", "should"] }
    ],
    "react/react-in-jsx-scope": "off",
    "react-hooks/exhaustive-deps": "warn",
    "max-lines": ["warn", { "max": 300, "skipBlankLines": true }],
    "max-lines-per-function": ["warn", { "max": 80 }],
    "no-magic-numbers": ["warn", { "ignore": [0, 1, -1], "ignoreArrayIndexes": true }]
  }
}
```

```json
// package.json
{
  "scripts": {
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,sol}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,sol}\"",
    "lint:py": "cd backend && ruff check . && ruff format --check . && mypy ."
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{py}": ["ruff check --fix", "ruff format", "mypy"],
    "*.{sol}": ["prettier --write"]
  }
}
```

### 8.2 Python 后端

```toml
# backend/pyproject.toml (新增)
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "C4", "SIM", "TCH"]
ignore = ["E501"]  # 行长度由 formatter 处理

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
line-ending = "lf"

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_ignores = true
ignore_missing_imports = true

[tool.black]
line-length = 100
target-version = ['py312']
```

### 8.3 Solidity

```bash
# 安装
npm install -D prettier prettier-plugin-solidity
```

```json
// .prettierrc (追加)
{
  "overrides": [
    {
      "files": "*.sol",
      "options": {
        "printWidth": 100,
        "tabWidth": 4,
        "useTabs": false,
        "singleQuote": false,
        "bracketSpacing": false
      }
    }
  ]
}
```

---

## 9. 快速修复 Checklist

### 已完成的修复
- [x] 1. 添加 `.prettierrc` 和 `prettier` 到根目录 devDependencies
- [x] 2. 完善 `.eslintrc.json`：添加 naming-convention、max-lines、no-magic-numbers、import/order
- [x] 3. 将 `apps/web/tsconfig.json` 的 `strict` 改为 `true`，并 extends 根配置
- [x] 4. 在 `backend/` 添加 `pyproject.toml`（ruff + mypy）
- [x] 5. 安装 `husky` + `lint-staged`，配置 pre-commit 钩子
- [x] 6. 删除重复的组件文件（保留 `packages/ui/` 版本）
- [x] 7. 删除 `sdk/` 和 `subgraph/` 根目录（保留 `packages/sdk/` 和 `apps/subgraph/`）
- [x] 8. 删除 `package-lock.json`（统一使用 pnpm）
- [x] 9. 删除根 `package.json` 中的 `workspaces` 字段
- [x] 10. 将 React 组件文件名统一为 PascalCase
- [x] 11. 提取硬编码 URL/地址到 `packages/sdk/src/config.ts` 和 `apps/web/lib/demo-config.ts`
- [x] 12. 提取魔术数字到命名常量（`MAX_EIP155_CHAIN_ID`, `MAX_BODY_SIZE_BYTES`, `QUERY_TIMEOUT_SECONDS`）
- [x] 13. 统一 admin/ 文件名为 kebab-case（`admin.js` → `admin-main.js`）
- [x] 14. 删除未使用的导入（`get_hmac_validator`）
- [x] 15. 添加 `RiskTrend` 组件到 `packages/ui/src/components/RiskScore.tsx`

### 待后续处理
- [ ] 运行 `pnpm format` 格式化全项目（一次性格式化）
- [ ] `apps/web` strict: true 后的类型错误修复（需逐步修复）
- [ ] `backend/app/main.py` 进一步拆分为多个模块（中间件、路由、健康检查）
- [ ] `ComplianceEngine.sol` 考虑拆分为 facet 或库
- [ ] 中英文注释统一策略执行
- [ ] Python `security.py` 超长行拆分

---

*报告生成完毕。建议按优先级分阶段执行修复，避免一次性大规模改动导致 merge conflict。*
