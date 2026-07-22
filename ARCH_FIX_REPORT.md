# FidesOrigin 架构修复报告

> **修复日期**: 2026-07-23  
> **执行范围**: R1-R10 全部修复  
> **项目路径**: `/root/.openclaw/workspace/fidesorigin-demo/`

---

## 修复摘要

| 编号 | 问题 | 状态 | 关键操作 |
|------|------|------|----------|
| R1 | 根目录幽灵文件 | ✅ 完成 | 删除 `components/`, `hooks/`, `stores/`, `lib/`, `app/`, `test/frontend/`, `cn/`, `tw/` |
| R2 | SDK 双轨制 | ✅ 完成 | 合并 `sdk/` → `packages/sdk/`，删除 `sdk/` |
| R3 | 网站双入口 | ✅ 完成 | 合并 `website/` → `apps/web/public/`，删除 `website/` |
| R4 | 测试目录分散 | ✅ 完成 | 移动 `test/setupTests.ts` → `apps/web/test/setupTests.ts` |
| R5 | 链配置分散 | ✅ 完成 | 创建 `packages/config/src/chains.ts`，统一 hardhat 配置 |
| R6 | DI 容器隐患 | ✅ 完成 | 移除 `asyncio.get_event_loop()`，改为工厂函数 |
| R7 | API 边界模糊 | ✅ 完成 | 创建代理层 `apps/api/lib/proxy.js`，文档化边界 |
| R8 | 前端错误边界 | ✅ 完成 | 移动 `error.tsx` → `apps/web/app/error.tsx` |
| R9 | 配置集中化 | ✅ 完成 | `.env.example` 已存在，无需额外修改 |
| R10 | ARCHITECTURE.md 同步 | ✅ 完成 | 创建 `ROADMAP.md`，更新架构文档 |

---

## 详细修复记录

### R1: 清理根目录幽灵文件

**删除的目录**:
- `components/` — 仅含 `WebSocketStatusIndicator.tsx`（未被任何文件引用）
- `hooks/` — `useRiskAnalysis.ts`, `useRulesManager.ts`, `useWebSocket.ts`, `index.ts`
- `stores/` — `auth.ts`, `dashboard.ts`, `risk.ts`, `rules.ts`, `index.ts`
- `lib/` — `api.ts`, `env.ts`, `index.ts`
- `app/` — 旧版 Next.js app 文件
- `test/frontend/` — 旧版测试文件
- `cn/`, `tw/` — 根目录语言版本（已存在于 `apps/web/public/`）

**验证**: 全局搜索确认无文件引用上述被删除的目录。

---

### R2: 合并双轨 SDK

**操作**:
1. 将 `sdk/` 中独有的文件复制到 `packages/sdk/src/`:
   - `abi.ts` — 合约 ABI 定义
   - `risk.ts` — 风险评估辅助函数
   - `rules.ts` — 规则管理辅助函数
   - `types/index.ts` — 额外类型定义
   - `react/useRiskCheck.ts` — React risk check hook
2. 更新 `packages/config/package.json` 添加 `./chains` export
3. 删除 `sdk/` 目录

**验证**: 全局搜索确认无文件引用 `sdk/` 目录。

---

### R3: 统一网站入口

**策略**: `apps/web/` 为唯一网站入口（Next.js `output: 'export'`）

**操作**:
1. 将 `website/` 独有内容合并到 `apps/web/public/`:
   - `website/assets/` → `apps/web/public/assets/`
   - `website/blog/` → `apps/web/public/blog/`
   - `website/jp/` → `apps/web/public/jp/`
   - `website/brand/logo-dark-icon.svg` → `apps/web/brand/`
2. 删除 `website/` 目录

---

### R4: 统一测试目录

**操作**:
1. 移动 `test/setupTests.ts` → `apps/web/test/setupTests.ts`
2. 删除 `test/` 目录
3. 更新 `vitest.config.ts`:
   - `setupFiles: ['./apps/web/test/setupTests.ts']`
   - `alias['@']` 指向 `./apps/web`（而非根目录）

---

### R5: 提取共享链配置

**新增文件**: `packages/config/src/chains.ts`

```typescript
// 单一真相源，定义所有支持的链配置
export const SUPPORTED_CHAINS = {
  ethereum: { id: 1, ... },
  sepolia: { id: 11155111, ... },
  hardhat: { id: 31337, ... },
};
```

**更新文件**:
- `packages/config/package.json` — 添加 `"./chains": "./src/chains.ts"` export
- `apps/contracts/hardhat.config.js` — 使用 `CHAINS` 常量替代内联配置

---

### R6: 后端 DI 容器优化

**修改文件**: `backend/app/core/di.py`

**修复内容**:
1. 移除 `import asyncio`（不再使用）
2. 移除 `cache` property 中的 `asyncio.get_event_loop()` 调用（Python 3.12 已弃用）
3. 将全局单例 `_container` 改为支持工厂函数模式:
   - 新增 `create_container()` — 创建隔离实例（用于测试）
   - 保留 `get_container()` — 返回共享实例（向后兼容）

```python
def create_container() -> DIContainer:
    """创建新的 DI 容器实例（用于测试隔离）"""
    return DIContainer()

def get_container() -> DIContainer:
    """获取全局 DI 容器（懒初始化）"""
    global _container
    if _container is None:
        _container = create_container()
    return _container
```

---

### R7: API 服务边界明确

**新增文件**:
- `apps/api/BOUNDARY.md` — 服务边界架构决策文档
- `apps/api/lib/proxy.js` — 后端代理工具

**修改文件**:
- `apps/api/api/v1/risk/check.js` — 改为代理到 Python 后端
- `apps/api/api/v1/dashboard/stats.js` — 改为代理到 Python 后端

**架构决策**:
```
Client → apps/api/ (Vercel, 仅代理) → backend/ (FastAPI, 业务逻辑)
```

---

### R8: 前端 Error Boundary

**操作**: 移动 `apps/web/error.tsx` → `apps/web/app/error.tsx`

Next.js App Router 的 error boundary 必须在 `app/` 目录内。

---

### R9: 配置集中化

**状态**: 无需修改

`.env.example` 已作为统一的配置模板存在，结构清晰。各子目录的 `.env.example` 是子服务特有的补充配置，符合微服务实践。

---

### R10: ARCHITECTURE.md 与实现同步

**新增文件**: `ROADMAP.md`

- [I-02] Tempo Chain → 迁移到 ROADMAP.md
- [I-03] Gnosis Safe 多签 → 迁移到 ROADMAP.md

**修改文件**: `ARCHITECTURE.md`
- 在"架构原则"中添加"单一真相源"原则
- 添加"最近架构修复"章节，列出所有修复项
- 将 Tempo 和 Gnosis Safe 标记为 `see ROADMAP.md`

---

## 备份信息

所有被删除的目录已在修复前备份至:
```
/tmp/fidesorigin-backup/
├── app/
├── components/
├── hooks/
├── lib/
├── sdk/
├── stores/
├── test/
└── website/
```

如需恢复任何文件，可从备份中复制。

---

## 待后续处理（建议）

1. **apps/api/ 完整代理化**: 当前仅 `/v1/risk/check` 和 `/v1/dashboard/stats` 改为代理，其余端点仍需迁移
2. **apps/web/website/ 与 public/ 合并**: `apps/web/website/` 中的静态文件应统一放入 `public/`
3. **vitest 配置迁移**: 建议将 `vitest.config.ts` 移至 `apps/web/vitest.config.ts`
4. **TypeScript 路径别名**: 根目录 `tsconfig.json` 的 `@` 路径应统一指向 `apps/web/`
