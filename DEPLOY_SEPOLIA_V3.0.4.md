# FidesOrigin V3.0.4 Sepolia 重新部署指南

> **部署日期**: 2026-07-19  
> **目标网络**: Sepolia Testnet (Chain ID: 11155111)  
> **部署者**: `0x5F6Ae278e7a62E64F9F467a91B693f372b84a374`

---

## 前置条件

1. **Sepolia ETH 余额** > 0.5 ETH（建议 1 ETH 以备不时之需）
2. **环境变量设置**:
   ```bash
   export ADMIN_PRIVATE_KEY=0x...你的私钥...
   export SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
   # 或 Alchemy/Infura 节点: https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   ```
3. **Node.js 依赖安装**:
   ```bash
   cd apps/contracts
   npm install
   ```

---

## 执行步骤

### Step 1: 部署/升级合约

```bash
cd apps/contracts
ADMIN_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-v3.0.4-sepolia.js --network sepolia
```

此脚本会：
1. 升级 RiskRegistry、PolicyEngine、ComplianceEngine 的 UUPS Proxy
2. 重新部署 FidesCompliance、QuarantineVault、CompliantStableCoin
3. 配置角色权限
4. 保存部署记录到 `deployments/sepolia-v3.0.4-<timestamp>.json`

### Step 2: 更新 Subgraph

```bash
cd apps/subgraph
bash deploy-sepolia.sh
```

或手动执行：
```bash
# 更新合约地址
# 编辑 subgraph.yaml，替换 address 字段

graph codegen
graph build
graph auth --studio <YOUR_DEPLOY_KEY>
graph deploy --studio fidesorigin-sepolia
```

### Step 3: Etherscan 验证

```bash
cd apps/contracts

# 验证 RiskRegistry 新实现
npx hardhat verify --network sepolia <NEW_RISK_REGISTRY_IMPL>

# 验证 PolicyEngine 新实现
npx hardhat verify --network sepolia <NEW_POLICY_ENGINE_IMPL>

# 验证 ComplianceEngine 新实现
npx hardhat verify --network sepolia <NEW_COMPLIANCE_ENGINE_IMPL>

# 验证 QuarantineVault（新部署）
npx hardhat verify --network sepolia <NEW_QUARANTINE_VAULT>

# 验证 FidesCompliance（新部署）
npx hardhat verify --network sepolia <NEW_FIDES_COMPLIANCE> \
  '<COMPLIANCE_ENGINE_PROXY>' '<RISK_REGISTRY_PROXY>' '<POLICY_ENGINE_PROXY>' '<QUARANTINE_VAULT>'

# 验证 CompliantStableCoin（新部署）
npx hardhat verify --network sepolia <NEW_STABLECOIN> \
  'FidesOrigin USD' 'fUSD' 6 '<COMPLIANCE_ENGINE_PROXY>'
```

**提示**: 从 `deployments/sepolia-latest.json` 获取新地址。

### Step 4: 更新前端配置

编辑以下文件，替换为新的合约地址：
- `apps/web/public/address-check.js`
- `apps/web/public/admin/admin-config.js`
- `data-publisher/.env`

---

## 部署后检查清单

- [ ] Sepolia Etherscan 上所有合约已验证
- [ ] Subgraph 成功部署且同步正常
- [ ] 前端地址配置已更新
- [ ] 角色权限配置正确（ORACLE_ROLE、COMPLIANCE_ENGINE_ROLE 等）
- [ ] 测试交易通过（transfer、checkCompliance）

---

## 应急回滚

如果部署失败，使用备份的部署记录回滚：
```bash
# 使用 recovery 脚本
npx hardhat run scripts/recovery-upgrade.js --network sepolia
```

---

## 部署记录

部署完成后，记录会保存在：
- `apps/contracts/deployments/sepolia-v3.0.4-<timestamp>.json`
- `apps/contracts/deployments/sepolia-latest.json`（始终指向最新）
