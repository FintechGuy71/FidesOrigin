# FidesOrigin Deployment Guide

## 部署记录

### TestUSD 合约

| 网络 | 合约地址 | 部署时间 | 版本 |
|------|----------|----------|------|
| Sepolia Testnet | `待部署` | 2025-03-31 | v0.3.0 |
| Goerli Testnet | `待部署` | - | v0.3.0 |
| Mainnet | `未部署` | - | - |

### Phase 3 新功能

- ✅ 时间锁机制 (Timelock)
- ✅ 多签管理 (Multisig)
- ✅ 角色管理 (RBAC)
- ✅ 操作日志 (Audit Log)
- ✅ 紧急暂停 (Emergency Pause)

---

## 部署步骤

### 1. 环境准备

```bash
# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的私钥和 RPC 端点
```

### 2. 配置 .env

```env
# 必需: 部署用的私钥 (不包含 0x 前缀)
PRIVATE_KEY=your_private_key_here

# RPC 端点
SEPOLIA_RPC=https://rpc.sepolia.org
GOERLI_RPC=https://rpc.goerli.eth.gateway.fm

# 可选: Etherscan API Key (用于合约验证)
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 3. 编译合约

```bash
npx hardhat compile
```

### 4. 部署到测试网

#### Sepolia
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

#### Goerli
```bash
npx hardhat run scripts/deploy.js --network goerli
```

### 5. 验证合约

部署脚本会自动尝试验证合约。如需手动验证：

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

---

## 合约功能概览

### 角色权限

| 角色 | 权限 |
|------|------|
| `DEFAULT_ADMIN_ROLE` | 最高权限，可分配其他角色 |
| `ADMIN_ROLE` | 管理时间锁、多签配置 |
| `OPERATOR_ROLE` | 标签管理、限额配置 |
| `VIEWER_ROLE` | 只读访问 |
| `SIGNER_ROLE` | 多签操作签名 |

### 时间锁配置

- **默认延迟**: 2 天
- **最小延迟**: 1 天
- **最大延迟**: 30 天
- **宽限期**: 14 天（超时未执行的操作将被取消）

### 多签配置

- **默认所需签名**: 2
- **支持操作**: 所有关键管理操作都需要时间锁 + 多签

---

## 前端配置

部署完成后，更新前端配置：

1. 打开 `admin/index.html`
2. 修改 `CONTRACT_ADDRESS` 为实际部署地址
3. 或使用设置页面配置

```javascript
const CONTRACT_ADDRESS = '0xYourDeployedContractAddress';
```

---

## 测试流程

### 1. 基础功能测试

```javascript
// 连接钱包
await contract.getContractInfo();

// 检查角色
const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
await contract.hasRole(ADMIN_ROLE, userAddress);
```

### 2. 时间锁测试

```javascript
// 调度一个新操作
const tx = await contract.scheduleOperation(
    0, // OperationType.MINT
    recipientAddress,
    0,
    ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [recipientAddress, ethers.utils.parseEther('1000')])
);

// 其他签名者签名
await contract.signOperation(operationId);

// 等待延迟时间后执行
await contract.executeOperation(operationId);
```

### 3. 多签测试

```javascript
// 添加新签名者
await contract.addSigner(newSignerAddress);

// 更新所需签名数
await contract.updateRequiredSignatures(3);
```

### 4. 紧急暂停测试

```javascript
// 触发暂停
await contract.emergencyPause();

// 检查暂停状态
await contract.paused();

// 解除暂停
await contract.emergencyUnpause();
```

---

## 故障排除

### 部署失败

1. **Gas 不足**: 确保账户有足够 ETH 支付 gas
2. **Nonce 错误**: 重置 MetaMask 账户 nonce
3. **网络问题**: 检查 RPC 端点可用性

### 合约交互失败

1. **角色错误**: 确认调用者有所需角色
2. **时间锁未就绪**: 检查是否已过延迟时间
3. **签名不足**: 确认已获得足够签名

---

## 安全建议

1. **私钥管理**: 使用硬件钱包或专用部署账户
2. **多签设置**: 生产环境至少 3 个签名者
3. **时间锁**: 生产环境建议使用 7 天以上延迟
4. **角色分离**: Admin、Operator、Signer 应使用不同账户

---

## 升级路径

### 从 v0.2.0 升级

1. 部署新合约
2. 迁移标签数据（通过批量打标签）
3. 重新配置多签和时间锁
4. 更新前端合约地址

### 数据迁移脚本

```javascript
// 读取旧合约数据
const oldVips = await oldContract.getVIPList();
const oldBlacks = await oldContract.getBlackList();

// 批量迁移到新合约
await newContract.batchTagAddresses(oldVips, 1, "Migrated from v0.2.0");
await newContract.batchTagAddresses(oldBlacks, 4, "Migrated from v0.2.0");
```

---

## 相关链接

- [合约源码](https://github.com/FintechGuy71/FidesOrigin/tree/main/contracts)
- [前端代码](https://github.com/FintechGuy71/FidesOrigin/tree/main/admin)
- [Hardhat 文档](https://hardhat.org/docs)
- [OpenZeppelin 文档](https://docs.openzeppelin.com/contracts)

---

*最后更新: 2025-03-31*
