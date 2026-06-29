# 部署脚本 + 运维 + 网站审计报告 - Round 1

> 审计时间: 2026-06-28  
> 审计范围: 51个文件（部署脚本、合约部署脚本、CI/CD、K8s、前端、Subgraph、Forta Agent）  
> 审计重点: 私钥管理安全、环境变量暴露、权限配置、脚本错误处理、CI安全、K8s安全、前端XSS、subgraph逻辑错误、Forta监控逻辑

---

## 统计摘要

| 严重程度 | 数量 |
|----------|------|
| 🔴 Critical | 12 |
| 🟠 High | 19 |
| 🟡 Medium | 14 |
| 🔵 Low | 8 |
| ℹ️ Info | 6 |

---

## 文件: scripts/generate-wallet.js

### 问题 #1
- **行号**: 1-17
- **代码片段**:
  ```js
  const wallet = ethers.Wallet.createRandom();
  console.log('Address:', wallet.address);
  console.log('Private Key:', wallet.privateKey);
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 生成钱包后将私钥以明文形式输出到控制台。私钥一旦在控制台日志中留下，会被 shell history、CI 日志、Docker 日志永久记录。
- **影响分析**: 私钥泄露可能导致资金被盗。即使脚本只在本地运行，~/.bash_history、控制台滚动缓冲区都会留存私钥。
- **修复建议**:
  ```js
  // 写入加密文件而非打印到控制台
  const fs = require('fs');
  const path = require('path');
  const wallet = ethers.Wallet.createRandom();
  
  const outputPath = path.join(process.cwd(), '.wallet-' + Date.now() + '.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    address: wallet.address,
    mnemonic: wallet.mnemonic?.phrase, // 优先保存助记词
    createdAt: new Date().toISOString()
  }, null, 2));
  
  console.log('Wallet created. Address:', wallet.address);
  console.log('Saved to:', outputPath);
  console.log('⚠️  IMPORTANT: Back up this file securely and delete it after use.');
  ```
- **验证方法**: 检查脚本运行后控制台是否输出私钥。

---

## 文件: scripts/quarantine-keeper.js

### 问题 #2
- **行号**: 28-32
- **代码片段**:
  ```js
  const CONFIG = {
      rpcUrl: process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
      privateKey: process.env.PRIVATE_KEY,
      checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000,
      batchSize: parseInt(process.env.BATCH_SIZE) || 50,
      maxPendingTx: parseInt(process.env.MAX_PENDING_TX) || 5,
  };
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: Keeper 私钥以明文形式从环境变量加载，无任何 HSM/KMS/加密存储机制。Keeper 需要高频自动签名交易，私钥暴露在内存中。
- **影响分析**: 一旦运行环境被攻破（容器逃逸、内存 dump、核心转储），攻击者可直接提取私钥并控制隔离资金。
- **修复建议**:
  ```js
  // 使用 AWS KMS / HashiCorp Vault / Google Cloud KMS 签名
  // 或至少使用加密私钥文件 + 启动时密码
  const { KMSProvider } = require('aws-kms-provider');
  // 或
  const { GcpKmsSigner } = require('ethers-gcp-kms');
  ```
- **验证方法**: 检查进程内存中是否出现明文私钥字符串。

### 问题 #3
- **行号**: 197-199
- **代码片段**:
  ```js
  const tx = await wallet.quarantineFunds(token, amount, reason, {
      gasLimit: 500000,
  });
  ```
- **严重程度**: 🟠 High
- **类型**: 安全
- **问题描述**: 硬编码 gas limit 为 500000，没有根据实际网络状况动态估算。在网络拥堵时可能导致交易失败或 gas 浪费。
- **影响分析**: 交易可能在网络波动时失败，导致隔离操作遗漏；或 gas limit 过高被恶意矿工利用。
- **修复建议**:
  ```js
  const estimatedGas = await wallet.quarantineFunds.estimateGas(token, amount, reason);
  const tx = await wallet.quarantineFunds(token, amount, reason, {
      gasLimit: estimatedGas * 120n / 100n, // 20% buffer
  });
  ```
- **验证方法**: 模拟不同网络拥堵程度下的交易成功率。

### 问题 #4
- **行号**: 335-350
- **代码片段**:
  ```js
  setInterval(() => {
      if (walletList.length > 0) {
          this.runBatchScan(walletList, tokenList);
      }
      this.printStats();
      this.state.save();
  }, CONFIG.checkInterval);
  ```
- **严重程度**: 🟠 High
- **类型**: 逻辑
- **问题描述**: `setInterval` 的回调是异步函数 `runBatchScan`，但没有 `await`，可能导致重叠执行。如果批量扫描耗时超过 checkInterval，会产生并发扫描。
- **影响分析**: 并发扫描可能导致重复隔离、gas 浪费、nonce 冲突。
- **修复建议**:
  ```js
  let isScanning = false;
  setInterval(async () => {
      if (isScanning) return;
      isScanning = true;
      try {
          if (walletList.length > 0) {
              await this.runBatchScan(walletList, tokenList);
          }
          this.printStats();
          this.state.save();
      } finally {
          isScanning = false;
      }
  }, CONFIG.checkInterval);
  ```
- **验证方法**: 设置短 checkInterval + 模拟慢速 RPC，观察是否产生并发日志。

### 问题 #5
- **行号**: 72-78
- **代码片段**:
  ```js
  save() {
      const data = { ... };
      fs.writeFileSync(path.join(__dirname, '.keeper-state.json'), JSON.stringify(data, null, 2));
  }
  ```
- **严重程度**: 🟡 Medium
- **类型**: 安全
- **问题描述**: 状态文件 `.keeper-state.json` 以明文存储在脚本目录下，无加密、无权限控制。包含已处理交易哈希和已知钱包列表。
- **影响分析**: 信息泄露（攻击者可了解监控范围）；如果状态文件被篡改，可能导致重复处理或跳过处理。
- **修复建议**: 使用加密存储或至少设置文件权限 0o600；考虑使用 Redis/数据库替代本地文件。
- **验证方法**: 检查 `.keeper-state.json` 文件权限和内容是否明文可读。

---

## 文件: scripts/update-merkle-root-v11.js

### 问题 #6
- **行号**: 4-21
- **代码片段**:
  ```js
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!privateKey || !contractAddress) {
      console.log('Missing PRIVATE_KEY or CONTRACT_ADDRESS');
      return;
  }
  
  const merkleRoot = fs.readFileSync('./data-sync/cache/merkle-root-v11.txt', 'utf8').trim();
  
  const wallet = new ethers.Wallet(privateKey, provider);
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 从环境变量读取私钥，无加密存储；Merkle Root 从本地文件读取，无校验和验证；缺少 `isAddress` 验证 contractAddress。
- **影响分析**: 私钥泄露风险；如果 merkle-root 文件被篡改，会更新错误的 root 到链上，可能导致合法用户被排除或恶意用户被纳入。
- **修复建议**:
  ```js
  // 1. 验证地址格式
  if (!ethers.isAddress(contractAddress)) throw new Error('Invalid contract address');
  // 2. 验证 merkle root 格式（32字节 hex）
  if (!/^0x[0-9a-fA-F]{64}$/.test(merkleRoot)) throw new Error('Invalid merkle root format');
  // 3. 使用 KMS 签名
  // 4. 更新前在链上读取当前 root，记录 diff
  ```
- **验证方法**: 检查是否有多签/时间锁保护 merkle root 更新；检查 merkle root 文件是否有校验和。

---

## 文件: scripts/check-balances.js

### 问题 #7
- **行号**: 4-5
- **代码片段**:
  ```js
  const deployer = '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
  const wallet = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
  ```
- **严重程度**: 🟠 High
- **类型**: 配置
- **问题描述**: 硬编码生产环境地址（与多个其他脚本共用同一套地址），无环境变量覆盖机制。
- **影响分析**: 脚本在不同环境（测试网/主网）复用时容易误操作到生产地址；地址泄露虽然是公开的，但硬编码模式增加了维护负担。
- **修复建议**:
  ```js
  const deployer = process.env.DEPLOYER_ADDRESS || '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
  const wallet = process.env.WALLET_ADDRESS || '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
  ```
- **验证方法**: 检查脚本是否支持通过环境变量覆盖地址。

---

## 文件: scripts/cleanup-quarantine.js

### 问题 #8
- **行号**: 7-10
- **代码片段**:
  ```js
  const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
  const tokenAddress = '0x9c9f4d5775BAf5DB2f4E8f8cD1C5ca695D5c7BDb';
  const vaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';
  ```
- **严重程度**: 🟠 High
- **类型**: 配置
- **问题描述**: 硬编码合约地址，无参数化。此脚本执行资金释放操作，一旦在错误网络运行可能释放错误资金。
- **影响分析**: 在错误网络运行脚本可能导致意外的资金操作。
- **修复建议**: 从部署文件或环境变量读取地址，并在运行时验证网络。
- **验证方法**: 在错误网络上运行脚本，观察是否会操作错误的合约。

---

## 文件: scripts/fix-wallet-config.js

### 问题 #9
- **行号**: 6-7
- **代码片段**:
  ```js
  const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
  const riskRegistry = '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3';
  ```
- **严重程度**: 🟠 High
- **类型**: 配置
- **问题描述**: 硬编码地址，脚本用于修改合规配置（禁用合规检查、修改 fidesCompliance 地址），属于高危操作。
- **影响分析**: 在错误环境运行会直接修改生产合约配置。
- **修复建议**: 参数化地址，添加网络确认提示。
- **验证方法**: 检查脚本是否有 `--dry-run` 模式或网络确认。

---

## 文件: scripts/fix-vault-permissions.js

### 问题 #10
- **行号**: 6-7
- **代码片段**:
  ```js
  const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
  const newVaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';
  ```
- **严重程度**: 🟠 High
- **类型**: 配置
- **问题描述**: 硬编码地址，脚本直接授予 QUARANTINE_ROLE 和 RELEASE_ROLE，属于权限管理操作。
- **影响分析**: 在错误环境运行可能向错误地址授予敏感权限。
- **修复建议**: 参数化所有地址，添加目标地址确认。
- **验证方法**: 检查脚本是否支持从命令行参数传入地址。

---

## 文件: scripts/diagnose-contracts.js / diagnose-wallet.js / diagnose-quarantine.js / diagnose-transfer.js

### 问题 #11
- **行号**: 多个文件（4-10行）
- **代码片段**:
  ```js
  // diagnose-contracts.js
  const tokenAddress = '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A';
  const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
  const deployer = '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
  ```
- **严重程度**: 🟠 High
- **类型**: 配置
- **问题描述**: 四个诊断脚本全部硬编码相同的生产地址集合，无环境变量覆盖。诊断脚本本应灵活适配不同环境。
- **影响分析**: 无法用于诊断其他环境或新部署的合约；地址泄露虽不敏感但维护困难。
- **修复建议**: 统一从 `deployments/sepolia.json` 或环境变量读取地址。
- **验证方法**: 检查诊断脚本是否能在不提供地址的情况下诊断其他部署。

---

## 文件: scripts/deploy-full.js

### 问题 #12
- **行号**: 56-60
- **代码片段**:
  ```js
  // Grant deployer ORACLE_ROLE for testing
  await riskRegistry.grantRole(ORACLE_ROLE, deployer.address);
  console.log("✅ Granted ORACLE_ROLE to deployer");
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 部署脚本无条件向 deployer 授予 ORACLE_ROLE，即使在生产环境（非 hardhat 网络）也会执行。ORACLE_ROLE 是数据写入权限，不应长期授予部署者。
- **影响分析**: 如果部署者私钥泄露，攻击者可篡改风险数据，绕过合规检查。
- **修复建议**:
  ```js
  if (network === 'hardhat' || network === 'localhost') {
      await riskRegistry.grantRole(ORACLE_ROLE, deployer.address);
      console.log("✅ Granted ORACLE_ROLE to deployer (test only)");
  }
  ```
- **验证方法**: 在 Sepolia 上运行部署脚本，检查 deployer 是否被错误授予 ORACLE_ROLE。

### 问题 #13
- **行号**: 78-90
- **代码片段**:
  ```js
  for (let i = 0; i < testAddresses.length; i++) {
      await riskRegistry.updateRiskProfile(
          testAddresses[i],
          80 + i * 5,
          3,
          [ethers.encodeBytes32String("test")],
          i === 0
      );
  }
  ```
- **严重程度**: 🟡 Medium
- **类型**: 逻辑
- **问题描述**: 测试数据种子化逻辑无条件执行，即使部署到生产网络也会写入测试数据。
- **影响分析**: 污染生产环境数据；测试地址可能被误标为高风险。
- **修复建议**: 仅在测试网络执行种子数据写入。
- **验证方法**: 检查部署到非本地网络时是否写入测试数据。

---

## 文件: scripts/deploy-sepolia.js

### 问题 #14
- **行号**: 30-34
- **代码片段**:
  ```js
  const NETWORK_CONFIG = {
    name: 'Sepolia Testnet',
    network: 'sepolia',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io',
    confirmations: 5,
    verify: true,
  };
  ```
- **严重程度**: 🟡 Medium
- **类型**: 配置
- **问题描述**: 硬编码 Sepolia 配置，但脚本名称暗示专用于 Sepolia，这不是严重问题。不过 `verify: true` 默认开启，如果 ETHERSCAN_API_KEY 未设置会被自动关闭。
- **影响分析**: 低风险，但配置不够灵活。
- **修复建议**: 无严重问题，保持现状或从配置文件中读取。

### 问题 #15
- **行号**: 126-138
- **代码片段**:
  ```js
  const artifact = await hre.artifacts.readArtifact('FidesCompliance');
  deployments.FidesCompliance = {
      name: 'FidesCompliance',
      address,
      abi: artifact.abi,  // <-- 完整 ABI 被写入部署文件
      ...
  };
  ```
- **严重程度**: 🟡 Medium
- **类型**: 信息暴露
- **问题描述**: 部署文件包含完整 ABI，文件体积大，且 ABI 可能包含开发者注释（如果有）或内部函数签名。
- **影响分析**: 信息泄露风险低，但增加部署文件体积，不利于版本控制。
- **修复建议**: 存储 ABI 哈希或指向版本化 ABI 文件的链接，而非完整 ABI。
- **验证方法**: 检查部署文件大小是否异常膨胀。

---

## 文件: scripts/verify-contracts.js / verify-contracts.ts

### 问题 #16
- **行号**: verify-contracts.ts 第1行
- **代码片段**:
  ```ts
  import { execSync } from 'child_process';
  ```
- **严重程度**: 🟡 Medium
- **类型**: 安全
- **问题描述**: `execSync` 被导入但从未使用。虽然当前无害，但如果未来误用可能导致命令注入。
- **影响分析**: 当前无直接影响，但保留未使用的危险导入是隐患。
- **修复建议**: 删除未使用的导入。
- **验证方法**: 搜索 `execSync` 在文件中的使用位置。

---

## 文件: apps/contracts/scripts/deploy-v2.3.js

### 问题 #17
- **行号**: 8
- **代码片段**:
  ```js
  const PROXY_ADDR = "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc";
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 硬编码生产代理合约地址。此脚本执行 `upgradeToAndCall`，直接升级代理合约逻辑。没有多签或时间锁保护。
- **影响分析**: 任何人获取 ADMIN_ROLE 私钥即可通过此脚本直接升级合约，无需额外审批流程。如果私钥泄露，攻击者可立即替换为恶意实现。
- **修复建议**:
  ```js
  // 1. 从环境变量读取地址
  const PROXY_ADDR = process.env.RISK_REGISTRY_PROXY;
  if (!PROXY_ADDR) throw new Error('RISK_REGISTRY_PROXY not set');
  
  // 2. 检查是否有 Timelock/Multisig 保护
  // 3. 如果是直接升级，添加二次确认提示
  ```
- **验证方法**: 检查 PROXY_ADDR 是否可通过环境变量覆盖；检查升级前是否有多签验证。

### 问题 #18
- **行号**: 9
- **代码片段**:
  ```js
  const TEST_ADDR = "0xe950dc316b836e4eefb8308bf32bf7c72a1358ff";
  ```
- **严重程度**: 🟡 Medium
- **类型**: 设计
- **问题描述**: 硬编码测试地址用于升级后验证 `isSanctioned`。此地址的制裁状态可能变化，导致验证脚本误报失败。
- **影响分析**: 升级后验证可能因测试数据变化而失败，导致不必要的回滚或手动干预。
- **修复建议**: 使用已知必然被制裁的 OFAC 地址（如 Tornado Cash），或从配置文件读取验证地址。
- **验证方法**: 检查 TEST_ADDR 的制裁状态是否稳定。

### 问题 #19
- **行号**: 62-72
- **代码片段**:
  ```js
  const tx = await ProxyContract.upgradeToAndCall(implAddr, "0x");
  console.log("    Upgrade tx hash:", tx.hash);
  console.log("    Waiting for confirmation...");
  const receipt = await tx.wait();
  ```
- **严重程度**: 🟠 High
- **类型**: 安全
- **问题描述**: 升级交易直接发送，没有时间锁延迟。即使脚本运行者有 ADMIN_ROLE，也缺少升级审批流程。
- **影响分析**: 单点故障：一个被攻破的私钥即可瞬间升级合约，无缓冲时间让用户反应。
- **修复建议**: 集成 Timelock 合约，升级需先 propose，等待时间锁延迟后再 execute。
- **验证方法**: 检查 RiskRegistryV2 是否已有 `UPGRADE_TIMELOCK` 机制，以及脚本是否遵循该机制。

### 问题 #20
- **行号**: 77-80
- **代码片段**:
  ```js
  const totalProfiles = await ProxyContract.totalProfiles();
  if (totalProfiles !== 2636n) {
      console.log("    ⚠️  WARNING: Expected 2636, got", totalProfiles.toString());
  }
  ```
- **严重程度**: 🟡 Medium
- **类型**: 逻辑
- **问题描述**: 硬编码期望的 totalProfiles 为 2636，这是一个特定时间点的快照。随着数据更新，此检查会频繁误报。
- **影响分析**: 验证噪音，可能导致 CI/CD 流程不稳定或开发者忽略真正的警告。
- **修复建议**: 改为检查 `totalProfiles >= 0` 或从 pre-upgrade 状态对比，而非硬编码值。
- **验证方法**: 在新数据写入后运行脚本，观察是否误报。

---

## 文件: apps/contracts/scripts/upgrade-v2.3.js

### 问题 #21
- **行号**: 13
- **代码片段**:
  ```js
  const PROXY = '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 同 deploy-v2.3.js，硬编码代理地址，直接执行升级无时间锁保护。
- **影响分析**: 同问题 #17。
- **修复建议**: 同问题 #17。

---

## 文件: apps/contracts/scripts/upgrade-proxy.js

### 问题 #22
- **行号**: 4-5
- **代码片段**:
  ```js
  const PROXY = '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';
  const V2_IMPL = '0x788c534acd7E377b86a2f7E9284C2f3b03DD749a';
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 两个关键地址全部硬编码，且 V2_IMPL 是已经部署的实现地址。脚本直接升级代理到此实现，无任何验证逻辑地址是否正确。
- **影响分析**: 如果 V2_IMPL 被错误设置为 EOA 或恶意合约，升级后代理可能永久损坏。
- **修复建议**:
  ```js
  // 验证实现地址有代码
  const code = await ethers.provider.getCode(V2_IMPL);
  if (code.length < 100) throw new Error('Invalid implementation address');
  
  // 验证实现地址的 VERSION
  const impl = await ethers.getContractAt('RiskRegistryV2', V2_IMPL);
  const version = await impl.VERSION();
  console.log('Implementation version:', version);
  ```
- **验证方法**: 检查脚本是否在升级前验证实现地址。

---

## 文件: apps/contracts/scripts/recovery-upgrade.js

### 问题 #23
- **行号**: 4
- **代码片段**:
  ```js
  const PROXY = '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';
  ```
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 硬编码代理地址，脚本名称含 "recovery" 暗示紧急恢复用途，但无任何额外的安全检查或审批流程。
- **影响分析**: 紧急恢复脚本通常用于修复严重问题，但缺少多签确认或时间锁，反而可能成为攻击向量。
- **修复建议**: 恢复脚本应至少要求多个签名者确认，或集成多签合约执行。
- **验证方法**: 检查恢复脚本是否有额外的访问控制或确认机制。

---

## 文件: apps/contracts/scripts/grant-role.js

### 问题 #24
- **行号**: 12
- **代码片段**:
  ```js
  const riskRegistryAddress = process.env.RISK_REGISTRY || '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';
  ```
- **严重程度**: 🟠 High
- **类型**: 配置
- **问题描述**: 有环境变量回退到硬编码地址。授权脚本的默认地址是生产地址，如果用户忘记设置环境变量，会在生产环境执行授权。
- **影响分析**: 误操作风险：忘记设置 RISK_REGISTRY 环境变量时，脚本会操作生产合约。
- **修复建议**: 删除默认值，强制要求环境变量。
  ```js
  const riskRegistryAddress = process.env.RISK_REGISTRY;
  if (!riskRegistryAddress) {
      console.error('RISK_REGISTRY env var required');
      process.exit(1);
  }
  ```
- **验证方法**: 在无环境变量情况下运行脚本，观察是否报错退出。

---

## 文件: .github/workflows/ci.yml

### 问题 #25
- **行号**: 16, 28, 40
- **代码片段**:
  ```yaml
  - run: pnpm install --no-frozen-lockfile
  ```
- **严重程度**: 🟡 Medium
- **类型**: 安全
- **问题描述**: `--no-frozen-lockfile` 允许 lockfile 与实际安装版本不一致，可能导致依赖漂移和供应链攻击（如依赖被篡改）。
- **影响分析**: 恶意依赖更新可能在 CI 中被静默接受，破坏构建的可复现性。
- **修复建议**: 使用 `--frozen-lockfile` 确保 lockfile 与实际安装严格一致。
- **验证方法**: 修改 package.json 版本约束但不更新 lockfile，观察 CI 是否应失败。

---

## 文件: .github/workflows/deploy.yml

### 问题 #26
- **行号**: 22
- **代码片段**:
  ```yaml
  - name: Install dependencies
    run: pnpm install --no-frozen-lockfile --ignore-scripts
  ```
- **严重程度**: 🟡 Medium
- **类型**: 安全
- **问题描述**: `--ignore-scripts` 跳过所有 postinstall 脚本。虽然可以防止恶意 postinstall 脚本执行，但也跳过了合法的安全检查钩子（如 husky、安全扫描）。`--no-frozen-lockfile` 同样存在依赖漂移问题。
- **影响分析**: 跳过后续的安全钩子；依赖版本可能漂移。
- **修复建议**: 如果使用 `--ignore-scripts`，确保在后续步骤中手动运行必要的安全检查和构建脚本。
- **验证方法**: 检查 CI 流程中是否有替代的安全检查步骤。

---

## 文件: .github/workflows/secret-scan.yml

### 问题 #27
- **行号**: 21-27
- **代码片段**:
  ```yaml
  - name: Check for .env files
    run: |
      if git ls-files | grep -E '^\.env$|^.*\.env$'; then
        echo "ERROR: .env files found in git tracking!"
        exit 1
  ```
- **严重程度**: 🟡 Medium
- **类型**: 安全
- **问题描述**: 仅检查 `.env` 文件，未覆盖其他常见的密钥存储模式（如 `*.pem`、`*.key`、`id_rsa`、`credentials.json`、AWS 凭证文件等）。
- **影响分析**: 其他类型的密钥文件可能意外提交到仓库。
- **修复建议**: 扩展检查范围：
  ```yaml
  - name: Check for sensitive files
    run: |
      patterns='\.env|\.pem|\.key|id_rsa|credentials|secret|private'
      if git ls-files | grep -iE "$patterns"; then
        echo "ERROR: Sensitive files found in git tracking!"
        exit 1
      fi
  ```
- **验证方法**: 尝试提交 `test.pem` 文件，观察 secret-scan 是否拦截。

---

## 文件: k8s/secret.yaml

### 问题 #28
- **行号**: 1-28
- **代码片段**:
  ```yaml
  apiVersion: v1
  kind: Secret
  metadata:
    name: fidesorigin-keys
  type: Opaque
  stringData:
    publisher-private-key: ""
    aws-access-key-id: ""
    aws-secret-access-key: ""
    vault-token: ""
    fatf-oracle-private-key: ""
  ```
- **严重程度**: 🟠 High
- **类型**: 安全
- **问题描述**: Secret 清单文件以空字符串为值提交到仓库。虽然当前值是空的，但此文件的存在模式鼓励开发者直接编辑并提交密钥。没有使用 external-secrets operator 或 Sealed Secrets。
- **影响分析**: 历史提交中可能曾包含真实密钥（即使已删除仍可在 git history 中恢复）；开发者可能误以为空值是安全的而直接填入真实值提交。
- **修复建议**:
  1. 从 git 中完全删除此文件（包括历史）
  2. 使用 `.gitignore` 排除 `k8s/secret.yaml`
  3. 提供 `k8s/secret.example.yaml` 作为模板
  4. 生产环境使用 external-secrets operator 或 Vault
- **验证方法**: 检查 git history 中是否曾包含非空值的 secret.yaml。

---

## 文件: k8s/cronjob.yaml

### 问题 #29
- **行号**: 56-61
- **代码片段**:
  ```yaml
  - name: PUBLISHER_PRIVATE_KEY
    valueFrom:
      secretKeyRef:
        name: fidesorigin-keys
        key: publisher-private-key
        optional: true  # <-- 与 deployment.yaml 的 optional: false 不一致
  ```
- **严重程度**: 🟡 Medium
- **类型**: 配置
- **问题描述**: CronJob 中的 `PUBLISHER_PRIVATE_KEY` 标记为 `optional: true`，而 Deployment 中同一密钥是 `optional: false`。不一致可能导致 CronJob 在密钥缺失时静默失败而非报错。
- **影响分析**: CronJob 可能以空私钥运行，导致签名失败但不会被立即发现。
- **修复建议**: 统一 `optional` 设置，私钥应为 `optional: false`。
- **验证方法**: 对比 deployment.yaml 和 cronjob.yaml 中同一 secret 的 optional 设置。

---

## 文件: apps/web/lib/env.ts

### 问题 #30
- **行号**: 10-16
- **代码片段**:
  ```ts
  const envSchema = z.object({
    NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_RISK_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_RULES_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUBGRAPH_URL: z.string().url().optional(),
    NEXT_PUBLIC_WS_URL: z.string().url().optional(),
    NEXT_PUBLIC_API_KEY: z.string().min(1).optional(),  // <-- API Key 暴露到客户端
  });
  ```
- **严重程度**: 🟠 High
- **类型**: 安全
- **问题描述**: `NEXT_PUBLIC_API_KEY` 以 `NEXT_PUBLIC_` 前缀定义，意味着它会被 Next.js 打包到客户端 JavaScript 中。任何访问网站的用户都可以在浏览器 DevTools 中看到此 API Key。
- **影响分析**: API Key 泄露给所有网站访问者，可能被滥用导致配额耗尽、费用暴增或数据泄露。
- **修复建议**:
  ```ts
  // 服务端环境变量（无前缀）
  API_KEY: z.string().min(1).optional(), // 仅服务端可用
  
  // 客户端环境变量（保留 NEXT_PUBLIC_ 前缀但用于非敏感数据）
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  ```
  敏感 API Key 应通过 Next.js API Route（服务端代理）调用，不直接暴露给客户端。
- **验证方法**: 构建应用后，在浏览器 DevTools 的 Sources 面板搜索 `NEXT_PUBLIC_API_KEY` 的值。

---

## 文件: apps/web/components/AddressInput.tsx

### 问题 #31
- **行号**: 58-75
- **代码片段**:
  ```tsx
  const EXAMPLE_ADDRESSES = [
    { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", label: "高风险地址", chain: "ethereum" },
    { address: "0x8ba1f109551bD432803012645fac136c82C3e8Cf", label: "中风险地址", chain: "ethereum" },
    { address: "0x1f9090aaE28b8a3dCeaDf281B0F12828E676c326", label: "低风险地址", chain: "ethereum" },
  ];
  ```
- **严重程度**: 🔵 Low
- **类型**: 设计
- **问题描述**: 示例地址硬编码在组件中。如果这些地址对应真实用户地址，可能无意中暴露他人的地址信息。
- **影响分析**: 隐私泄露风险低，但不够专业。
- **修复建议**: 使用明显是示例的地址（如 `0x1234...5678`）或从配置文件读取。
- **验证方法**: 检查示例地址是否为真实地址。

---

## 文件: admin/admin.js

### 问题 #32
- **行号**: 85-95
- **代码片段**:
  ```js
  async function connectWallet() {
    if (!window.ethereum) {
      showToast('请安装 MetaMask 钱包', 'error');
      return;
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
  ```
- **严重程度**: 🟠 High
- **类型**: 安全
- **问题描述**: `window.ethereum` 检测过于简单，没有验证 provider 的可靠性和来源。用户可能安装了多个钱包扩展（MetaMask + Rabby + Coinbase），`window.ethereum` 可能是被恶意注入的 provider。
- **影响分析**: 用户可能通过恶意 provider 连接，导致交易被篡改或钓鱼。
- **修复建议**:
  ```js
  // 使用 EIP-6963 多钱包发现
  // 或至少检查 provider 是否来自已知来源
  if (!window.ethereum?.isMetaMask && !window.ethereum?.isRabby) {
      showToast('请使用 MetaMask 或 Rabby 钱包', 'error');
      return;
  }
  ```
- **验证方法**: 安装恶意钱包模拟器，检查 admin 页面是否接受其 provider。

### 问题 #33
- **行号**: 880-882
- **代码片段**:
  ```js
  window.ethereum.on('chainChanged', function() {
    window.location.reload();
  });
  ```
- **严重程度**: 🟡 Medium
- **类型**: 逻辑
- **问题描述**: 链切换时直接 `window.location.reload()`，会丢失所有未保存的表单数据和页面状态。
- **影响分析**: 用户体验差；如果用户在填写重要表单时切换链，数据全部丢失。
- **修复建议**: 优雅地重置应用状态而非强制刷新，或至少提示用户保存数据。
- **验证方法**: 在表单填写过程中切换链，观察是否丢失数据。

### 问题 #34
- **行号**: 多处（如 220-230, 280-290）
- **代码片段**:
  ```js
  const mockData = [
    { time: '2026-06-16 14:30:00', address: '0x1234...5678', tag: '黑名单', reason: 'OFAC 制裁', amount: '10,000 TUSD' },
    ...
  ];
  ```
- **严重程度**: 🔵 Low
- **类型**: 设计
- **问题描述**: 大量 mock 数据硬编码在生产代码中。虽然功能未完全实现时使用 mock 数据是常见做法，但应在生产构建中移除或明确标记为演示模式。
- **影响分析**: 生产环境展示虚假数据，损害可信度。
- **修复建议**: 添加 `isDemoMode` 标志，仅在演示模式下显示 mock 数据，否则显示"数据加载失败"提示。
- **验证方法**: 检查生产构建中是否仍显示 mock 数据。

---

## 文件: admin/admin-config.js

### 问题 #35
- **行号**: 12-18
- **代码片段**:
  ```js
  if (typeof require !== 'undefined') {
    try {
      require('dotenv').config();
    } catch (_e) {
      /* dotenv 未安装时忽略（如前端打包场景） */
    }
  }
  ```
- **严重程度**: 🟠 High
- **类型**: 安全
- **问题描述**: 此文件是客户端 JavaScript（通过 `<script>` 标签加载），但尝试 `require('dotenv')`。在浏览器中 `require` 不存在，此代码块不会执行。然而，文件开头的 REQUIRED_ENV 检查会尝试读取 `process.env`，这在浏览器中也不存在，会导致脚本抛出错误并拒绝"启动"。
- **影响分析**: 在浏览器环境中，`typeof process !== 'undefined'` 通常为 false（除非被 bundler polyfill），所以实际影响取决于打包方式。但如果使用 webpack/vite 等工具，可能 polyfill `process.env`，导致 REQUIRED_ENV 检查在构建时或运行时失败。
- **修复建议**: 将配置分为服务端和客户端两部分。客户端配置应通过构建时注入（如 Vite 的 `import.meta.env` 或 webpack 的 `DefinePlugin`），而非运行时读取 process.env。
  ```js
  // 客户端版本 - 从 window.__CONFIG__ 或构建常量读取
  const CONFIG = {
    version: '0.4.0',
    networks: {
      sepolia: {
        chainId: 11155111,
        // 地址应由构建工具注入，而非运行时读取
        contractAddress: __SEPOLIA_CONTRACT_ADDR__, // 由 DefinePlugin 替换
      }
    }
  };
  ```
- **验证方法**: 在浏览器控制台检查 `process.env` 是否存在；检查构建后的 JS 是否包含明文环境变量。

### 问题 #36
- **行号**: 32-45
- **代码片段**:
  ```js
  const REQUIRED_ENV = [
    'SEPOLIA_CONTRACT_ADDR',
    'MAINNET_CONTRACT_ADDR',
    'ALCHEMY_API_KEY',
    'SUBGRAPH_ID'
  ];
  
  const _missing = REQUIRED_ENV.filter((key) => !ENV[key]);
  if (_missing.length > 0) {
    throw new Error(`[BOOTSTRAP FATAL] ...`);
  }
  ```
- **严重程度**: 🟠 High
- **类型**: 逻辑
- **问题描述**: `ALCHEMY_API_KEY` 被列为 REQUIRED_ENV，但此文件是客户端 JS。如果 Alchemy API Key 被注入到客户端，所有网站访问者都能获取此 key 并滥用 Alchemy API。
- **影响分析**: API Key 泄露导致配额被刷、费用暴增。
- **修复建议**: 客户端不应直接使用 Alchemy API Key。RPC 调用应通过服务端代理或公开的免费 RPC（如 publicnode）。
- **验证方法**: 检查浏览器 Network 面板中是否有直接调用 Alchemy API 的请求。

---

## 文件: admin/admin-events.js

### 问题 #37
- **行号**: 无严重问题
- **严重程度**: ℹ️ Info
- **类型**: 设计
- **问题描述**: 整体安全实践良好（AsyncLock、withConfirmation、safeExecute、debounce、事件委托）。但 `initDelegatedEvents` 在 `admin-secure-dom.js` 中定义，而 `admin-events.js` 中没有调用它，依赖 `admin.js` 的 `DOMContentLoaded` 中通过 `initAllEvents()` 间接调用。
- **影响分析**: 依赖链复杂，如果加载顺序错误可能导致委托事件未绑定。
- **修复建议**: 在 `initAdminEvents()` 末尾显式调用 `initDelegatedEvents()`，确保委托事件总是初始化。
- **验证方法**: 检查页面加载后表格按钮是否响应点击。

---

## 文件: subgraph/subgraph.yaml

### 问题 #38
- **行号**: 9-14, 25-30, 41-46, 57-62, 73-78
- **代码片段**:
  ```yaml
  - kind: ethereum
    name: RiskRegistry
    network: sepolia
    source:
      address: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc"
      startBlock: 7650000
  ```
- **严重程度**: 🟡 Medium
- **类型**: 配置
- **问题描述**: 硬编码多个合约地址和 startBlock。subgraph.yaml 中的地址与多个部署脚本中的地址一致，但这是 Sepolia 测试网地址。切换到主网需要手动修改多处。
- **影响分析**: 人为失误风险：忘记更新某处地址会导致索引错误的合约。
- **修复建议**: 使用 mustache 模板或环境变量替换，在部署时根据目标网络生成 subgraph.yaml。
  ```yaml
  # subgraph.template.yaml
  address: "{{riskRegistryAddress}}"
  startBlock: {{riskRegistryStartBlock}}
  ```
- **验证方法**: 检查是否可以通过环境变量切换网络而无需修改 subgraph.yaml。

---

## 文件: subgraph/src/mappings/riskRegistry.ts

### 问题 #39
- **行号**: 108-115
- **代码片段**:
  ```ts
  export function handleSanctionRemoved(event: SanctionRemoved): void {
    // ...
    if (sanctioned) {
      // ...
      let stats = getOrCreateStats();
      stats.totalSanctioned -= 1;
      stats.lastUpdated = event.block.timestamp;
      stats.save();
    }
  }
  ```
- **严重程度**: 🟡 Medium
- **类型**: 逻辑
- **问题描述**: `stats.totalSanctioned -= 1` 没有下溢检查。虽然 The Graph 的 AssemblyScript 运行时下溢会回绕（wrap around），但语义上不正确。如果 `handleSanctionRemoved` 被调用但对应的 `handleSanctionAdded` 未被索引（如 startBlock 设置导致遗漏），`totalSanctioned` 可能变为负数（在 u32/i32 下会回绕为极大值）。
- **影响分析**: 统计数据不准确。
- **修复建议**:
  ```ts
  if (stats.totalSanctioned > 0) {
    stats.totalSanctioned -= 1;
  } else {
    log.warning('totalSanctioned underflow prevented for account {}', [account]);
  }
  ```
- **验证方法**: 模拟制裁移除事件在对应添加事件未被索引时的行为。

---

## 文件: subgraph/src/mappings/complianceEngine.ts

### 问题 #40
- **行号**: 150-165
- **代码片段**:
  ```ts
  export function handleFundsReleased(event: FundsReleased): void {
    let hold = HoldRecord.load(event.params.holdId.toHexString());
    if (hold) {
      // ...
      if (stats.totalFundsHeld.ge(hold.amount)) {
        stats.totalFundsHeld = stats.totalFundsHeld.minus(hold.amount);
      } else {
        stats.totalFundsHeld = BigInt.fromI32(0);
      }
    }
  }
  ```
- **严重程度**: 🟡 Medium
- **类型**: 逻辑
- **问题描述**: 有下溢保护（`ge` 检查），但如果 `hold.amount` 在释放前被修改（如多次释放同一 holdId），统计会不准确。
- **影响分析**: 统计数据可能偏离实际。
- **修复建议**: 记录已释放金额，确保只减去未释放部分。
- **验证方法**: 检查 HoldRecord 是否有部分释放的逻辑。

---

## 文件: forta-agents/fidesorigin-monitor/src/agent.ts

### 问题 #41
- **行号**: 9-14
- **代码片段**:
  ```ts
  const COMPLIANCE_ENGINE =
    process.env.COMPLIANCE_ENGINE || '0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa';
  const COMPLIANT_STABLECOIN =
    process.env.COMPLIANT_STABLECOIN || '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A';
  const RISK_REGISTRY =
    process.env.RISK_REGISTRY || '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3';
  ```
- **严重程度**: 🟡 Medium
- **类型**: 配置
- **问题描述**: 使用环境变量但有硬编码默认值。Forta Agent 运行时如果没有正确设置环境变量，会监控错误的合约地址。
- **影响分析**: 监控范围错误，可能遗漏真实事件或产生误报。
- **修复建议**: 删除默认值，启动时验证地址已设置且格式正确。
  ```ts
  const COMPLIANCE_ENGINE = process.env.COMPLIANCE_ENGINE;
  if (!COMPLIANCE_ENGINE || !ethers.isAddress(COMPLIANCE_ENGINE)) {
    throw new Error('COMPLIANCE_ENGINE env var required');
  }
  ```
- **验证方法**: 在无环境变量情况下启动 Agent，观察是否报错。

### 问题 #42
- **行号**: 22-24
- **代码片段**:
  ```ts
  const TOKEN_DECIMALS = 6;
  const HIGH_VALUE_THRESHOLD = parseUnits('100000', TOKEN_DECIMALS);
  ```
- **严重程度**: 🔵 Low
- **类型**: 逻辑
- **问题描述**: `TOKEN_DECIMALS` 硬编码为 6，但不同稳定币可能有不同精度（如 DAI 是 18，USDC 是 6）。如果监控多种代币，此硬编码不正确。
- **影响分析**: 大额阈值监控可能因精度错误而误报或漏报。
- **修复建议**: 从合约读取 `decimals()` 或在配置中按代币指定精度。
- **验证方法**: 检查被监控代币的实际精度。

---

## 文件: scripts/data-sources/risk-aggregator.js

### 问题 #43
- **行号**: 115-125
- **代码片段**:
  ```js
  class SlowMistSource extends RiskDataSource {
    constructor() {
      super('SlowMist');
      this.url = 'https://api.slowmist.io/v1/hacked/list';
    }
    async fetch() {
      const response = await fetch(this.url);
      // ...
    }
  }
  ```
- **严重程度**: 🟡 Medium
- **类型**: 逻辑
- **问题描述**: SlowMist API URL 可能不存在或已更改（`https://api.slowmist.io/v1/hacked/list`）。没有备用数据源或缓存机制。
- **影响分析**: 数据源不可用时会静默失败（返回空数组），可能导致风险数据不完整。
- **修复建议**: 添加备用数据源；验证 API 响应结构；缓存上次成功获取的数据。
- **验证方法**: 直接访问 API URL，检查是否返回有效数据。

---

## 跨文件问题

### 问题 #44 - 地址硬编码泛滥
- **影响文件**: scripts/check-balances.js, scripts/cleanup-quarantine.js, scripts/fix-wallet-config.js, scripts/fix-vault-permissions.js, scripts/diagnose-*.js, apps/contracts/scripts/deploy-v2.3.js, upgrade-v2.3.js, upgrade-proxy.js, recovery-upgrade.js
- **严重程度**: 🟠 High
- **类型**: 配置
- **问题描述**: 至少 12 个脚本硬编码同一套地址（`0x5F6Ae278e7a62E64F9F467a91B693f372b84a374`, `0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1`, `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` 等）。这些地址分布在诊断脚本、修复脚本、升级脚本中。
- **影响分析**: 维护困难；地址变更时需要修改多处；新团队成员容易遗漏某处修改；不同环境（测试/预发布/生产）无法区分。
- **修复建议**: 创建统一的地址配置文件 `config/addresses.json`，按网络分组，所有脚本从中读取。
  ```js
  // config/addresses.js
  module.exports = {
    sepolia: {
      deployer: process.env.DEPLOYER_ADDRESS || '0x...',
      wallet: process.env.WALLET_ADDRESS || '0x...',
      riskRegistry: '0x...',
      // 等等
    }
  };
  ```
- **验证方法**: 搜索所有脚本中的 `0x` 字符串，统计硬编码地址数量。

### 问题 #45 - 私钥管理不一致
- **影响文件**: scripts/quarantine-keeper.js, scripts/update-merkle-root-v11.js, scripts/deploy-sepolia.js（注释中提到）, apps/contracts/scripts/grant-role.js（提到 ADMIN_PRIVATE_KEY）
- **严重程度**: 🔴 Critical
- **类型**: 安全
- **问题描述**: 不同脚本使用不同的私钥环境变量名：`PRIVATE_KEY`、`ADMIN_PRIVATE_KEY`。没有统一的密钥管理策略。Keeper 脚本直接使用明文私钥，而 K8s 配置提到了 KMS/Vault 但未被实际使用。
- **影响分析**: 密钥分散管理增加泄露风险；不同脚本可能复用同一私钥，扩大泄露影响范围。
- **修复建议**: 
  1. 统一环境变量命名（如 `FIDES_PRIVATE_KEY`）
  2. 所有自动签名脚本必须支持 KMS/Vault 签名
  3. 本地开发使用加密 keystore 文件而非明文环境变量
- **验证方法**: 搜索所有文件中的 `privateKey`、`PRIVATE_KEY` 等关键词。

### 问题 #46 - 缺乏 --dry-run 模式
- **影响文件**: 所有部署和升级脚本
- **严重程度**: 🟡 Medium
- **类型**: 设计
- **问题描述**: 没有部署/升级脚本支持 `--dry-run` 模式，无法在不实际发送交易的情况下验证脚本逻辑。
- **影响分析**: 测试脚本时必须在真实网络上执行，消耗 gas 且产生不可逆操作。
- **修复建议**: 为关键脚本添加 `--dry-run` 标志，仅模拟交易并打印将要执行的操作。
- **验证方法**: 尝试运行 `npx hardhat run scripts/deploy-v2.3.js --network sepolia --dry-run`。

### 问题 #47 - 缺少输入校验
- **影响文件**: 多个脚本
- **严重程度**: 🟡 Medium
- **类型**: 安全
- **问题描述**: 多个脚本接收地址参数但缺少 `ethers.isAddress()` 校验，如 `grant-role.js` 的 `PUBLISHER_ADDRESS`。
- **影响分析**: 错误的地址格式可能导致交易失败或资金发送到错误地址。
- **修复建议**: 在所有接收地址参数的脚本中添加校验。
- **验证方法**: 向各脚本传入无效地址，观察是否报错。

---

## 缺失文件说明

以下文件在审计清单中列出但不存在于项目路径：
- `website/lang-utils.js` — 未找到
- `website/sw.js` — 未找到
- `website/interactions.js` — 未找到

替代读取了：
- `admin/admin-secure-dom.js` — 安全 DOM 操作模块，实现良好（无 innerHTML、无 eval）
- `website/website-events.js` — 简单的事件处理，无安全问题

---

## 优先级修复建议

### P0 - 立即修复（Critical）
1. **统一私钥管理**: 所有自动签名脚本必须迁移到 KMS/Vault 签名，停止明文私钥环境变量
2. **升级脚本增加时间锁**: `deploy-v2.3.js`, `upgrade-v2.3.js`, `upgrade-proxy.js`, `recovery-upgrade.js` 必须集成 Timelock/Multisig
3. **删除或保护 generate-wallet.js**: 停止明文打印私钥，改用加密文件存储
4. **grant-role.js 删除默认值**: 删除生产地址默认值，强制环境变量

### P1 - 本周修复（High）
5. **统一地址配置**: 创建 `config/addresses.js`，消除 12+ 个脚本中的硬编码地址
6. **admin-config.js 拆分**: 将服务端和客户端配置分离，Alchemy Key 不得暴露到前端
7. **env.ts 移除 NEXT_PUBLIC_API_KEY**: API Key 不得使用 NEXT_PUBLIC_ 前缀
8. **K8s secret.yaml 从 git 移除**: 添加 .gitignore，使用 external-secrets operator

### P2 - 下周修复（Medium）
9. **subgraph 下溢保护**: `riskRegistry.ts` 的 `totalSanctioned` 添加下溢检查
10. **Forta Agent 验证**: 删除硬编码默认值，启动时校验地址
11. **CI 使用 frozen-lockfile**: 所有工作流统一使用 `--frozen-lockfile`
12. **keeper.js 状态文件加密**: 使用加密存储或数据库替代明文 JSON

### P3 - 后续优化（Low/Info）
13. **添加 --dry-run 模式**: 关键部署脚本支持模拟运行
14. **Mock 数据清理**: 生产构建中移除 admin 的 mock 数据
15. **subgraph.yaml 模板化**: 使用 mustache 支持多网络部署

---

*报告结束*
