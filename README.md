# FidesOrigin MVP Demo

## 项目概述
链上执行级可编程合规协议 - 最小可验证演示

## 黑名单地址（3个测试地址）

| 编号 | 地址 | 用途 |
|------|------|------|
| 1 | 0x1234567890123456789012345678901234567890 | 模拟黑客地址 |
| 2 | 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B | 模拟诈骗地址 |
| 3 | 0xdAC17F958D2ee523a2206206994597C13D831ec7 | 模拟风险地址 |

## 快速开始（2分钟运行Demo）

### 方式1：直接打开前端页面（无需安装）
```bash
# 进入项目目录
cd /root/.openclaw/workspace/fidesorigin-demo

# 用浏览器打开 index.html
# 或者启动简单HTTP服务器
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

### 方式2：部署到本地测试网（完整体验）

**步骤1：安装依赖（一次性）**
```bash
cd /root/.openclaw/workspace/fidesorigin-demo
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
```

**步骤2：启动本地节点**
```bash
npx hardhat node
```

**步骤3：部署合约（新终端）**
```bash
npx hardhat run scripts/deploy.js --network localhost
```

**步骤4：测试**
```bash
npx hardhat test
```

## 功能演示
1. 部署带有黑名单功能的 TestUSD 代币
2. 向白名单地址转账成功
3. 向黑名单地址转账被拦截

## 技术栈
- Hardhat (开发环境)
- Solidity (智能合约)
- React + ethers.js (前端)

## 核心代码说明

### 黑名单检查（TestUSD.sol）
```solidity
function _update(address from, address to, uint256 amount) internal virtual override {
    // 检查发送方是否在黑名单
    if (blacklist[from]) {
        revert AddressIsBlacklisted(from);
    }
    
    // 检查接收方是否在黑名单
    if (blacklist[to]) {
        revert AddressIsBlacklisted(to);
    }
    
    // 通过检查，执行转账
    super._update(from, to, amount);
}
```

## 下一步计划
- [ ] 部署到 Sepolia 测试网
- [ ] 添加更多风控规则（交易限额、时间锁）
- [ ] 开发标签管理后台
- [ ] 接入预言机实时更新黑名单

---
**FidesOrigin - 为链上金融世界注入实时风控与可信秩序**
