# Round 2 Critical 修复报告

## 修复时间
2026-06-29

## 修复项

### 1. Critical: fallback() delegatecall → call
- **文件**: `apps/contracts/contracts/examples/CompliantSmartWalletBase.sol`
- **问题**: `fallback()` 使用 `delegatecall` 调用白名单 DeFi 协议，攻击者可利用被攻击协议完全控制钱包 storage
- **修复**: 将 `delegatecall` 改为普通 `call`，并正确处理返回值（失败时 revert，成功时 return）
- **验证**: ✅ `npx hardhat compile` 通过

### 2. Critical: 升级脚本绕过 Timelock
- **文件**: 
  - `apps/contracts/scripts/deploy-v2.3.js`
  - `apps/contracts/scripts/upgrade-v2.3.js`
  - `apps/contracts/scripts/upgrade-proxy.js`
  - `apps/contracts/scripts/recovery-upgrade.js`
  - `apps/contracts/scripts/deploy-v2.3.1.js`
  - `apps/contracts/scripts/upgrade-v2-fix.js`
- **问题**: 全部直接调用 `upgradeToAndCall`，绕过时间锁保护
- **修复**: 每个脚本添加 `BYPASS_TIMELOCK` 环境变量检查。未设置时脚本输出安全警告并退出，强制开发者显式绕过
- **验证**: ✅ 脚本语法检查通过

### 3. P0: data-publisher TypeScript 编译错误
- **文件**: `data-publisher/src/key-manager.ts`, `data-publisher/src/types.ts`
- **问题**:
  - `AWSKMSKeyManager`: `this.address` 不存在（应使用 `cachedAddress`）
  - `AzureKeyVaultManager`: `this.address` 不存在，且 `txBytes` 重复声明
  - `SyncJob.status`: 缺少 `'skipped'` 值，但 `scheduler.ts` 赋值了 `'skipped'`
- **修复**:
  - `AWSKMSKeyManager`: `this.address` → `this.cachedAddress!`
  - `AzureKeyVaultManager`: 添加 `cachedAddress` 属性，`this.address` → `this.cachedAddress!`，第二个 `txBytes` 改名为 `txHash`
  - `types.ts`: `SyncJob.status` 添加 `'skipped'`
- **验证**: ✅ `npx tsc --noEmit` 通过

### 4. Medium: releaseQuarantinedAssets 验证
- **文件**: `apps/contracts/contracts/examples/CompliantSmartWalletBase.sol`
- **问题**: `releaseQuarantinedAssets` 不验证 `recordId` 与 `token`/`amount` 匹配
- **修复**:
  - 新增 `QuarantineRecord` struct 和 `quarantineRecords` mapping
  - `quarantineAssets` 创建记录时存储 token/amount 到 mapping
  - `releaseQuarantinedAssets` 添加验证：record 存在、token 匹配、amount 匹配
  - 释放成功后删除记录
- **验证**: ✅ 编译通过

### 5. Medium: quarantineAssets SafeERC20
- **文件**: `apps/contracts/contracts/examples/CompliantSmartWalletBase.sol`
- **问题**: ERC20 approve 使用低级别 call，USDT 等代币失败
- **修复**: 
  - 引入 `SafeERC20`
  - 使用 `IERC20(token).forceApprove(qv, amount)` 替代低级别 `call`
- **验证**: ✅ 编译通过

### 6. grant-role.js fallback 硬编码地址
- **文件**: `apps/contracts/scripts/grant-role.js`
- **问题**: `|| '0x7a41...'` 硬编码地址
- **修复**: 移除 fallback，RISK_REGISTRY 必须显式提供，否则脚本报错退出
- **验证**: ✅ 语法检查通过

### 7. .gitignore 补充
- **文件**: `.gitignore`
- **修复**: 添加 `deployments/` 和 `k8s/secret.yaml`
- **验证**: ✅

## 编译状态
- Solidity: ✅ 通过
- TypeScript: ✅ 通过

## 安全影响
- **Critical #1 (delegatecall)**: 消除存储覆盖风险，攻击者无法通过被攻击 DeFi 协议控制钱包 storage
- **Critical #2 (Timelock)**: 强制显式绕过，防止意外绕过时间锁保护
- **Medium #4 (releaseQuarantinedAssets)**: 防止释放错误的隔离记录
- **Medium #5 (SafeERC20)**: 兼容 USDT 等不标准 ERC20 代币
