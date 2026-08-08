# FidesOrigin 新一轮审计 — Round 1 问题汇总

**日期**: 2026-07-27
**来源**: 重新独立深度审计（Round 1）

## 统计

| 模块 | Critical | High | Medium | Low | 总计 |
|------|----------|------|--------|-----|------|
| Contracts | 10 | 10 | 10 | 5 | 35 |
| Backend | 7 | 12 | 15+ | 5+ | 40+ |
| Frontend | 4 | 8 | 14 | 16 | 42 |
| **总计** | **21** | **30** | **39+** | **26+** | **117+** |

## 合约 Critical (10)

1. **C-02: claimFunds 溢出 panic** — `record.timestamp + type(uint256).max` 在 Solidity 0.8.x 溢出
2. **C-01: Diamond facet 缺少 access control** — `checkAddressCompliance` 完全公开
3. **C-03: DiamondCut 无法取消提案** — 恶意提案只能等 48h 后执行
4. **C-10: 部署脚本语法错误** — `fs` 重复声明
5. **C-06: 新函数零测试覆盖** — claimFunds, setClaimDelay, proposeDiamondCut 等
6. **C-04: CompliantStableCoin postTransferHook 仍 broken** — 未修复
7. **C-05: DiamondLoupeFacet 未验证 facet code** — addFunctions 未检查 code.length
8. **C-07: 缺少 emergency mode 测试** — Diamond 模式下紧急模式未测试
9. **C-08: RiskOracleConsensus 质押不足检查** — 允许质押 0
10. **C-09: FidesBridgeReceiver 多签阈值配置** — REQUIRED_RELAYER_CONFIRMATIONS 硬编码

## 后端 Critical (7)

1. **S-1: ContextVar bug** — 每次创建新实例，request_id 始终为 None
2. **S-2: Login 返回缺少 refresh_token** — Pydantic ValidationError
3. **S-3: Admin 密码验证意外接受 bcrypt 哈希**
4. **S-4: verify_api_key 调用 db.commit() 破坏原子性**
5. **S-5: WebSocket 认证前 accept** — 连接耗尽 DoS
6. **S-6: L1 缓存无大小限制**
7. **S-7: Pickle fallback RCE 风险**

## 前端 Critical (4)

1. **CN nav logo 链接到 /zh-CN/** — 404
2. **TW nav logo 链接到 /zh-TW/** — 404
3. **Admin CSP 阻止内联 onchange** — 功能失效
4. **address-check.js 引用不存在的 JSON**
