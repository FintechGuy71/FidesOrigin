# FidesOrigin v3.3.1 — SDK Publishing Hotfix

**发布日期**：2026-11-23  
**版本类型**：发布流程热修复  
**替代版本**：v3.3.0  
**目标环境**：Sepolia、GitHub Packages、Vercel、本机 Windows 开发/测试环境

## 1. 热修复原因

v3.3.0 已完成主分支合并、annotated tag 和 GitHub Release，但 SDK 的 `Publish to GitHub Packages` 步骤返回 `409 Conflict`：`@fintechguy71/fidesorigin-sdk@0.3.1` 已存在，GitHub Packages 不允许覆盖同一版本。

annotated tag 校验和 SDK 构建均已通过；失败仅发生在不可变包版本上传阶段。本版本不覆盖旧包、不伪造成功，也不移动已发布的 v3.3.0 标签。

## 2. 修复内容

- SDK 包版本由 0.3.1 升至 0.3.2。
- 主仓版本升至 3.3.1，与热修复标签一致。
- SDK repository URL 改为标准 `git+https://...git`，消除 npm 自动修正警告。
- 发布工作流新增 `Verify published package version`，从 GitHub Packages 回读精确版本。
- v3.3.0 途中发现的 Vercel `repo` 项目已从错误的 `services` 框架修正为官网相同的 `apps/web` / Next.js / Node 22 配置，并通过正常提交重新验收。

## 3. 已验证基础

- PR #134 的 14/14 项检查通过。
- v3.3.0 发布提交的 13 项适用检查全部通过。
- Vercel `repo`、`fidesorigin-api`、`fidesorigin-website` 三个项目均成功。
- 视觉回归具有明确路径过滤器，纯文档和版本变更不触发，不计为通过或失败。
- 数据同步 96/96、发布器 52/52、后端专项 7/7、监督器 2/2、合约 450/450 测试通过。
- 真实 dry-run 132/132 一致，Merkle 根匹配，退出码 0。
- 本机 Redis、发布器与每日调度已恢复；队列无积压、无死信。

## 4. v3.3.1 发布验收门槛

1. 热修复 PR 的全部适用检查与 Vercel 项目必须成功。
2. `v3.3.1` 必须为 annotated tag，且指向热修复提交。
3. `Publish to GitHub Packages` 必须实际成功。
4. `Verify published package version` 必须确认注册表返回 0.3.2。
5. 上述条件满足后创建 v3.3.1 GitHub Release，并设为最新版本。

## 5. 运维经验

- GitHub Release 存在不代表 SDK 包已发布。
- annotated tag 通过不代表 npm 上传成功。
- GitHub Packages 版本不可覆盖；每次 SDK 发布必须递增 `packages/sdk/package.json` 版本。
- 同一提交重试不能修复版本冲突；应使用新包版本和新热修复标签。
- 外部平台配置错误应修正并重新执行检查，不能通过关闭检查制造绿色状态。
- Windows 长驻进程应与前台任务分离，并同时核验真实 PID、状态文件和健康探针。

## 6. 兼容性与回滚

本次仅修改发布版本、发布说明、SDK 元数据和发布后的验证步骤，没有修改 SDK API、合约 ABI、Merkle leaf、数据库 schema 或本地运行逻辑。

若需回滚应用代码，可继续使用 v3.3.0 的应用提交；不要尝试删除或覆盖已发布的 SDK 包。SDK 使用方应固定到经过注册表验收的 0.3.2，或继续使用既有的 0.3.1。