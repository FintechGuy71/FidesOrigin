# FidesOrigin v3.3.3 — Subgraph Deployment Compatibility Hotfix

**发布日期**：2026-11-24  
**版本类型**：生产部署热修复  
**包含基础**：v3.3.2 的全部代码、系统、每日验证、官网和真实视觉基线修复

## 1. 原因

v3.3.2 主分支的功能检查、SDK 0.3.3 上传和注册表回读均成功，但 `Deploy Subgraph` 在生产部署步骤失败。Graph CLI 0.98.1 的 jayson 4.2.0 仍以 CommonJS 和旧文件名引用 stream-json，而安全新版 stream-json 3.9.0 使用 ESM 与新的文件名。

我没有隐藏失败，也没有保留 stream-json 1.9.1 的降级方案，因为该降级会重新引入三条中危公告。

## 2. 修复

新增源码审查可见的 `patches/jayson@4.2.0.patch`，仅修改 jayson 的两个导入：

- `stream-json/streamers/stream-values.js` 的 `.default` 导出。
- `stream-json/utils/verifier.js` 的 `.default` 导出。

pnpm 在 `patchedDependencies` 中显式固定补丁。没有覆盖本机 node_modules 冒充修复，没有关闭安全审计，没有修改 Graph CLI 的部署逻辑。

## 3. 验证

- `graph deploy --help` 真实加载部署命令成功，修复了 `StreamValues` 的 MODULE_NOT_FOUND。
- 生产依赖审计：高/中危均为 0；仅保留上游尚无修复版本的 elliptic 低危公告。
- 既有全部功能测试和构建继续作为合并门禁。
- 合并后必须确认 `Deploy to The Graph Studio` 实际成功，不能只凭 codegen/build 成功宣称部署完成。

## 4. 版本与历史

- 主仓、Web：3.3.3。
- SDK：0.3.4；API 无变化，递增用于遵守 GitHub Packages 不可变版本约束。
- v3.3.2 标签保留失败历史；SDK 0.3.3 已实际发布，但 v3.3.3 才是完整部署验收版本。
- 合约 ABI、Merkle leaf、数据库 schema 均无变化。

## 5. 运维经验

- 全局安全覆盖可能改变间接依赖的模块格式与文件布局，必须实际加载生产命令。
- 发现不兼容时先验证安全兼容补丁，不能直接降级到仍有公告的版本。
- Subgraph 的 codegen/build 成功不等于部署成功，最终验收必须覆盖真实 deploy 步骤和最新查询端点。
