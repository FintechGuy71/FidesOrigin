# FidesOrigin 全面安全审计报告（纯 GLM-5.2）

**审计日期**: 2026-06-30
**审计模型**: zhipu/glm-5.2 (thinking=high) — 全部 7 路均为 GLM-5.2 原生输出
**审计范围**: 全项目 634 文件 / 120,719 行代码
**审计方式**: 7 路深度逐行审计（前 3 路并行成功，后 4 路因 rate limit 改串行，全部 GLM-5.2）

---

## 模型确认

| # | 模块 | 子代理标签 | 模型 | 状态 | 耗时 |
|---|------|-----------|------|------|------|
| 1 | 前端 + API | audit-frontend | zhipu/glm-5.2 | ✅ 完成 | 9m53s |
| 2 | Subgraph | audit-subgraph | zhipu/glm-5.2 | ✅ 完成 | 12m9s |
| 3 | 测试 + 架构 | audit-tests-arch | zhipu/glm-5.2 | ✅ 完成 | 5m42s |
| 4 | 智能合约 | glm-audit-contracts | zhipu/glm-5.2 | ✅ 完成 | 11m30s |
| 5 | SDK + Backend | glm-audit-sdk-backend | zhipu/glm-5.2 | ✅ 完成 | 7m23s |
| 6 | 数据管道 | glm-audit-datapipeline | zhipu/glm-5.2 | ✅ 完成 | 4m23s |
| 7 | 部署脚本 + DevOps | glm-audit-scripts-devops | zhipu/glm-5.2 | ✅ 完成 | 15m8s |

**全部 7/7 路均使用 GLM-5.2 完成，无任何降级。**

---

## 总览

| 模块 | 评级 | Critical | High | Medium | Low | Info | 合计 |
|------|------|----------|------|--------|-----|------|------|
| 智能合约 | B+ | 1 | 4 | 5 | 5 | 3 | 18 |
| SDK + Backend | B- | 3 | 7 | 12 | 4 | 0 | 26 |
| 数据管道 | B+ | 0 | 4 | 9 | 12 | 8 | 33 |
| 前端 + API | B+ | 3 | 6 | 6 | 5 | 0 | 20 |
| Subgraph | B | 2 | 7 | 5 | 2 | 0 | 16 |
| 测试 + 架构 | C+ | 2 | 4 | 6 | 5 | 2 | 19 |
| 部署脚本 + DevOps | B+/A- | 0 | 3 | 6 | 10 | 5 | 24 |
| **合计** | **B+** | **11** | **35** | **49** | **43** | **18** | **156** |

---

## 全部 Critical 问题清单（10个）

### 1. [合约] FidesOriginTimelock.executeEmergencyModeChange 双重弹出数组导致必然回滚
- **文件**: FidesOriginTimelock.sol:103-115
- **问题**: 循环中 `this.cancel(id)` 已执行 `_removePendingOperation`（swap-and-pop），但循环体又额外 `pendingOperations.pop()`，导致每次迭代弹出两个元素
- **影响**: 紧急模式切换机制完全无法工作

### 2. [SDK] WebSocket API Key 明文传输（查询参数）
- **文件**: backend/app/controllers/monitor.py:~50
- **问题**: 后端 WebSocket 从 `websocket.query_params.get("api_key")` 读取 API Key，URL 查询参数会被记录在服务器日志、反向代理日志中
- **影响**: API Key 泄露风险

### 3. [Backend] JWT Secret 使用硬编码默认值
- **文件**: backend/app/core/security.py:~58,70
- **问题**: `secret = settings.SECRET_KEY or "dev-secret-key-change-in-production"`，如果环境变量未设置，使用公开在源码中的硬编码 secret
- **影响**: 攻击者可伪造任意 JWT

### 4. [Backend] API Key 数据库查询字段名不匹配
- **文件**: backend/app/core/security.py:~295; backend/app/models.py:~40
- **问题**: 查询使用 `APIKey.key` 但模型定义的是 `key_hash`；引用了不存在的 `expires_at` 字段
- **影响**: API Key 认证运行时必定失败

### 5. [前端] .env 文件泄露真实 API 密钥和敏感凭据
- **文件**: .env:9,15,31
- **问题**: 包含真实的 Etherscan API Key、OpenRouter API Key、Vercel Token
- **影响**: 密钥可被用于滥用 API、部署劫持

### 6. [前端] 管理仪表盘在客户端暴露 API Key
- **文件**: app/admin/dashboard/page.tsx:14
- **问题**: `NEXT_PUBLIC_API_KEY` 在构建时内联到客户端 JS bundle
- **影响**: 任何访问者可从 DevTools 提取 API Key

### 7. [前端] .env.example 包含 NEXT_PUBLIC_API_KEY 指导
- **文件**: .env.example:61
- **问题**: 引导开发者在客户端暴露 API Key
- **影响**: 开发者可能照搬此模式

### 8. [Subgraph] 事件签名不匹配 — subgraph/ 与 apps/subgraph/ ABI 完全不一致
- **文件**: subgraph/subgraph.yaml:33-38 vs apps/subgraph/subgraph.yaml
- **问题**: 两个 subgraph 引用同一合约地址但 ABI 完全不同
- **影响**: 其中一个 subgraph 的 handler 永远不会触发，数据完全丢失

### 9. [Subgraph] Handler 名称与事件语义完全不匹配
- **文件**: apps/subgraph/src/mappings/complianceEngine.ts:174,196,220,237
- **问题**: TransactionBlocked 的 handler 叫 handleComplianceCheck，RulePaused 的 handler 叫 handleEmergencyModeActivated 等
- **影响**: 严重降低可维护性，极易引入新 bug

### 10. [测试] 合规引擎接口缺失 — 核心功能被测试跳过
- **文件**: CompliantStableCoin.test.js:36, CompliantSmartWallet.test.js:28, integration.test.js:46-47
- **问题**: ComplianceEngine 未实现 IAssetCompliance/IWalletCompliance 接口，所有测试通过 toggleCompliance(false) 禁用合规检查
- **影响**: 核心合规检查在生产环境中可能无法按设计运作

---

## 全部 High 问题清单（34个）

### 智能合约（4个）
1. RiskRegistry V1→V2 升级存储布局不兼容（slot 错位导致数据丢失）
2. ComplianceEngine 调用者验证无法穿透 FidesCompliance 中间合约
3. ComplianceEngine.setIssuerPolicy 缺少事件（策略变更不可审计）
4. QuarantineVault 自动隔离的 ETH 无标准释放路径

### SDK + Backend（6个）
5. 两套并行的 WebSocket 实现安全级别不一致（旧版允许 ws:// 明文）
6. 两套 SDK Client 实现接口不一致（方法签名、类型定义不同）
7. Admin 默认密码通过环境变量且无强度检查
8. CSRF 保护对 API 端点完全跳过（JWT cookie 可被 CSRF 攻击）
9. 地址搜索 ilike(f"%{query}%") 存在 SQL 通配符注入
10. WebSocket 连接缺少 Origin 验证（跨站 WebSocket 劫持）

### 数据管道（4个）
11. publisher.ts 缺少 nonce 管理（交易排序问题）
12. 文件锁 TOCTOU 竞态条件
13. ofacSimpleAdapter 正则误报（制裁名单匹配错误）
14. ABI 类型不匹配（链上交互参数错误）

### 前端 + API（6个）
15. 管理面板地址检查页面使用内联 onclick 事件处理器
16. app/demo/page.tsx loadRules 函数缺乏严格验证
17. API 规则端点缺乏 CSRF 防护
18. WebSocket 连接缺乏认证（hooks/useWebSocket.ts）
19. CSP 允许 'unsafe-eval' 和 'unsafe-inline' 脚本
20. API 速率限制使用可伪造的 IP 头部

### Subgraph（7个）
21. FidesCompliance 合约地址在两个 subgraph 中不一致
22. PolicyEvaluated 事件完全未持久化（仅打印日志）
23. WalletPolicySet 事件完全未持久化
24. AddressTagged 事件中地址不存在时静默丢弃标签
25. SanctionAdded 事件中地址不存在时不创建 RiskProfile
26. ContractRegistered 新 RiskProfile 未初始化必填字段
27. RiskProfileUpdated 创建新 RiskProfile 时未初始化必填字段

### 测试 + 架构（4个）
28. 测试固件中使用 Math.random() 导致非确定性
29. KmsSigner 测试中使用不安全的私钥模式
30. conftest.py 绕过所有安全中间件
31. 多个关键测试被跳过（资金冻结、多预言机确认、紧急模式）

### 部署脚本 + DevOps（3个）
32. 所有升级脚本均可通过 BYPASS_TIMELOCK 绕过 Timelock
33. GitHub Actions 缺少 permissions 声明（默认 contents:write）
34. K8s 缺少 RBAC Role/RoleBinding

---

## 修复优先级建议

### P0 — 立即修复（上线前必须）
1. 轮换 .env 中泄露的所有真实密钥
2. 修复 FidesOriginTimelock 双重 pop 导致紧急模式失效
3. 修复 API Key 模型字段不匹配（认证必定失败）
4. 移除 JWT 硬编码默认 secret
5. 实现 ComplianceEngine 接口或修改直接调用方式
6. 统一两个 Subgraph 的 ABI 和事件签名

### P1 — 上线前修复
7. 移除管理面板客户端 API Key 暴露
8. 收紧 CSP 策略（移除 unsafe-eval/unsafe-inline）
9. 添加 GitHub Actions permissions 声明
10. 修复 SQL 通配符注入
11. 添加 WebSocket Origin 验证
12. 移除 BYPASS_TIMELOCK 或限制为 hardhat 网络

### P2 — 上线后优先修复
13. 统一 SDK 为一套实现
14. 统一 WebSocket 认证机制
15. 修复 Subgraph handler 语义命名
16. 补全缺失的 Subgraph 数据持久化
17. 实现被跳过的测试用例
18. 添加存储布局兼容性验证
19. 修复后端 Alembic 迁移与模型不一致

---

## 架构总体评价

**优点**:
- 合约层分层清晰（FidesCompliance → ComplianceEngine → RiskRegistry/PolicyEngine）
- Docker/K8s 安全上下文配置优秀（非 root、seccomp、capabilities drop ALL）
- 前端 DOM 安全（安全 DOM API 替代 innerHTML）
- SSRF 防护、敏感头脱敏完整
- Secret 管理提供三种方案（SealedSecret/ExternalSecret/KMS）
- Forta Agent 质量优秀
- DLQ + 重试机制完善

**最需要关注的系统性问题**:
1. **双版本并存**: SDK 两套、Subgraph 两套、RiskRegistry 两套 — 统一为一个
2. **接口断裂**: ComplianceEngine 未实现 example 合约期望的接口
3. **测试与生产脱节**: 大量测试在禁用合规检查的情况下运行
4. **Timelock 可被绕过**: BYPASS_TIMELOCK 机制削弱安全模型
