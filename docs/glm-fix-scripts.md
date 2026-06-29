# GLM 修复摘要 — 脚本 + 运维 + CI

**修复时间:** 2026-06-29  
**修复者:** Kimi k2p7 (subagent)  
**项目:** fidesorigin-demo

---

## Critical — 9个崩溃脚本 (全部修复 ✅)

之前批量sed将 `process.env.XXX` 改为简短变量名但未声明，导致加载即崩溃。

| # | 文件 | 问题 | 修复方式 |
|---|------|------|----------|
| 1 | `upgrade-proxy.js` | `proxyAddress`, `v2Impl` 未定义 | `process.env.PROXY_ADDRESS` / `process.env.V2_IMPL` + 缺失时报错退出 |
| 2 | `verify-v2.3.js` | `proxyAddress` 未定义 | `process.env.PROXY_ADDRESS` + 缺失时报错退出 |
| 3 | `verify-v2.3.1.js` | `proxyAddress`, `testAddr` 未定义 | `process.env.PROXY_ADDRESS` / `process.env.TEST_ADDRESS` + 缺失时报错退出 |
| 4 | `verify-v2.2.js` | 字符串字面量 `"process.env.XXX"` 而非实际变量 | 提取为 `process.env.PROXY_ADDRESS` / `process.env.TEST_ADDRESS` 并校验 |
| 5 | `deploy-reader.js` | `proxyAddress`, `testAddr` 未定义 | `process.env.PROXY_ADDRESS` / `process.env.TEST_ADDRESS` + 缺失时报错退出 |
| 6 | `deploy-v2-upgrade.js` | `proxyAddress`, `testAddr` 未定义 | 同上 |
| 7 | `recovery-v220.js` | `proxyAddress`, `testAddr` 未定义 | 同上 |
| 8 | `upgrade-v2.1-backfill.js` | `proxyAddress` 未定义 | `process.env.PROXY_ADDRESS` + 缺失时报错退出 |
| 9 | `upgrade-v2.2.js` | `proxyAddress` 未定义 | 同上 |

---

## Critical — 其他

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 10 | `verify-v2.2.js` | 字符串字面量 `"process.env.TEST_ADDRESS"` | ✅ 已修复（同#4） |
| 11 | `.gitignore` | 缺失 `.wallet-*.json` | ✅ 已添加 |

---

## High Priority (全部修复 ✅)

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 12 | `deploy-v2-upgrade.js` | 缺失 BYPASS_TIMELOCK 保护 | ✅ 已添加 |
| 12 | `recovery-v220.js` | 缺失 BYPASS_TIMELOCK 保护 | ✅ 已添加 |
| 12 | `upgrade-v2.1-backfill.js` | 缺失 BYPASS_TIMELOCK 保护 | ✅ 已添加 |
| 12 | `upgrade-v2.2.js` | 缺失 BYPASS_TIMELOCK 保护 | ✅ 已添加 |
| 13 | `scripts/generate-wallet.js` | 助记词明文写入JSON无警告 | ✅ 添加 `chmodSync(0o600)` + 明文警告 |
| 14 | `ci.yml` / `deploy.yml` | Node/pnpm 版本不一致 | ✅ 统一为 Node 22 + pnpm 11.6.0 |
| 15 | `deploy.yml` | PR 可触发 production 部署 | ✅ 移除 `pull_request` 触发器 |
| 16 | `docker-compose.yml` | 生产环境挂载宿主机源码 | ✅ 注释掉 volumes 挂载 |
| 17 | `quarantine-keeper.js` | 批量扫描无并发锁 | ✅ 添加 `batchScanLock` 互斥锁 |

---

## 验证结果

### JS 语法检查 (`node --check`)
```
upgrade-proxy.js         ✅ PASS
verify-v2.3.js           ✅ PASS
verify-v2.3.1.js         ✅ PASS
verify-v2.2.js           ✅ PASS
deploy-reader.js         ✅ PASS
deploy-v2-upgrade.js     ✅ PASS
recovery-v220.js         ✅ PASS
upgrade-v2.1-backfill.js ✅ PASS
upgrade-v2.2.js          ✅ PASS
generate-wallet.js       ✅ PASS
quarantine-keeper.js     ✅ PASS
```

### YAML 语法检查
```
ci.yml           ✅ PASS
deploy.yml       ✅ PASS
docker-compose.yml ✅ PASS
```

---

## 修复后统一变量声明模式

所有脚本现在遵循以下模式：

```javascript
const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/xxx.js --network sepolia');
  process.exit(1);
}
```

升级类脚本额外包含：
```javascript
// ⚠️  SECURITY WARNING: This script directly calls upgradeToAndCall, bypassing any Timelock.
const BYPASS_TIMELOCK = process.env.BYPASS_TIMELOCK === 'true';

async function main() {
  if (!BYPASS_TIMELOCK) {
    console.error("❌  SECURITY HALT: Direct upgrade bypasses Timelock protection.");
    process.exit(1);
  }
  // ...
}
```
