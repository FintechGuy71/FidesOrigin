# FidesOrigin - 链上执行级可编程合规协议

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.3.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/Solidity-^0.8.19-green" alt="Solidity">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

> 为链上金融世界注入实时风控与可信秩序，推动合规化 RWA 与区块链融合发展的下一代基础设施

## 🚀 项目简介

FidesOrigin 是一个**链上执行级可编程合规协议**，专为稳定币发行方、RWA 资产发行机构和 Web2 Fintech 设计。通过智能合约原生风控、多标签风险管理和链上实时拦截，帮助机构满足香港稳定币法案等合规要求。

### 核心特性

- ✅ **AI 驱动风控** - 多维度风险标签 (VIP/普通/灰名单/黑名单)
- ✅ **链上实时拦截** - 转账即检查，违规即拦截
- ✅ **交易限额管理** - 按风险等级配置差异化限额
- ✅ **时间锁保护** - 关键操作延迟执行，防止即时攻击
- ✅ **多签安全** - 需要多方确认才能执行管理操作
- ✅ **操作审计** - 完整的链上操作日志
- ✅ **紧急暂停** - 一键暂停应对安全事件

## 📁 项目结构

```
fidesorigin-demo/
├── contracts/
│   └── TestUSD.sol          # Phase 3 智能合约 (时间锁 + 多签)
├── scripts/
│   └── deploy.js            # Hardhat 部署脚本
├── deployments/             # 部署记录
│   └── latest.json
├── admin/
│   └── index.html           # 运营后台 (Ethers.js v6 + Chart.js)
├── website/
│   └── index.html           # 品牌官网
├── hardhat.config.js        # Hardhat 配置
├── package.json
├── .env.example
├── DEPLOYMENT.md            # 部署指南
└── README.md                # 项目说明
```

## 🛠 技术栈

| 组件 | 技术 |
|------|------|
| 智能合约 | Solidity ^0.8.19, OpenZeppelin Contracts v5 |
| 开发框架 | Hardhat |
| 前端框架 | 原生 HTML5 + CSS3 + JavaScript |
| Web3 库 | Ethers.js v6 |
| 图表库 | Chart.js |
| 钱包支持 | MetaMask, WalletConnect |

## 🚦 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/FintechGuy71/FidesOrigin.git
cd FidesOrigin
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的私钥
```

### 4. 编译合约

```bash
npx hardhat compile
```

### 5. 部署合约

```bash
# 部署到 Sepolia 测试网
npx hardhat run scripts/deploy.js --network sepolia
```

### 6. 配置前端

修改 `admin/index.html` 中的合约地址：

```javascript
const CONTRACT_ADDRESS = '0xYourDeployedContractAddress';
```

然后打开 `admin/index.html` 在浏览器中访问。

## 📊 Phase 3 新功能

### 时间锁 (Timelock)

- 所有关键管理操作需要延迟执行
- 可配置延迟时间 (1-30 天)
- 14 天宽限期防止操作过期

```solidity
// 调度一个新操作
scheduleOperation(OperationType, target, value, data);

// 签名确认
signOperation(operationId);

// 延迟后执行
executeOperation(operationId);
```

### 多签 (Multisig)

- 配置多个签名者
- 设置所需签名阈值
- 支持动态添加/移除签名者

```solidity
// 添加签名者
addSigner(address signer);

// 更新所需签名数
updateRequiredSignatures(uint256 newRequired);
```

### 角色管理 (RBAC)

| 角色 | 说明 |
|------|------|
| `ADMIN_ROLE` | 系统管理员，管理时间锁和多签 |
| `OPERATOR_ROLE` | 日常操作员，管理标签和限额 |
| `VIEWER_ROLE` | 只读用户 |
| `SIGNER_ROLE` | 多签签名者 |

### 操作日志

- 所有管理操作自动记录
- 支持链上查询和导出
- 包含操作类型、操作人、时间戳

```solidity
function getOperationLogs(uint256 start, uint256 limit) view returns (OperationLog[] memory);
```

## 🌐 前端功能

### 数据看板

- 实时链上数据监控
- 风险分布饼图
- 交易统计图表
- 角色分布可视化

### 标签管理

- 添加/移除地址标签
- 批量标签操作
- 标签历史查询

### 限额配置

- 按风险等级配置限额
- 实时生效
- 权限控制

### 时间锁管理

- 查看待执行操作
- 提交签名
- 执行已就绪操作

### 多签管理

- 签名者列表
- 阈值配置
- 添加/移除签名者

### 紧急暂停

- 一键暂停合约
- 权限验证
- 快速恢复

## 🔒 安全特性

1. **重入保护** - OpenZeppelin ReentrancyGuard
2. **访问控制** - Role-Based Access Control
3. **溢出保护** - Solidity ^0.8 内置
4. **时间锁** - 延迟执行防止即时攻击
5. **多签** - 关键操作多方确认
6. **紧急暂停** - 应对安全事件

## 📈 版本历史

### v0.3.0 (2025-03-31)

- ✅ 时间锁机制
- ✅ 多签管理
- ✅ 角色管理 (RBAC)
- ✅ 操作日志
- ✅ 紧急暂停
- ✅ Ethers.js v6 集成
- ✅ Chart.js 图表

### v0.2.0 (2025-03-30)

- ✅ 多标签风控 (VIP/普通/灰名单/黑名单)
- ✅ 交易限额管理
- ✅ 品牌官网
- ✅ 运营后台基础版

### v0.1.0 (2025-03-28)

- ✅ ERC20 基础合约
- ✅ 黑白名单功能
- ✅ 水龙头

## 📝 合约接口

### 读取函数

```solidity
function getContractInfo() view returns (...)
function getRiskLevel(address account) view returns (RiskLevel)
function getLimitInfo(address account) view returns (...)
function getVIPList() view returns (address[])
function getBlackList() view returns (address[])
function getPendingOperations() view returns (bytes32[])
function getOperationDetails(bytes32 operationId) view returns (...)
```

### 写入函数

```solidity
function tagAddress(address account, RiskLevel level, string reason)
function untagAddress(address account)
function scheduleOperation(OperationType opType, address target, uint256 value, bytes data)
function signOperation(bytes32 operationId)
function executeOperation(bytes32 operationId)
function emergencyPause()
function emergencyUnpause()
```

## 🧪 测试

```bash
# 运行测试
npx hardhat test

# 运行测试并生成 gas 报告
REPORT_GAS=true npx hardhat test
```

## 🚀 部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系

- Email: contact@fidesorigin.com
- GitHub: [@FintechGuy71](https://github.com/FintechGuy71)

---

<p align="center">
  Built with ❤️ for the Web3 Fintech future
</p>
