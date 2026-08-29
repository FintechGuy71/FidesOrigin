#!/usr/bin/env node
/**
 * ============================================================================
 * [DEPRECATED] 历史遗留脚本（v2.x/v3.0.x 时代），仅作历史记录保留。
 * 引用已弃用的旧合约地址/实现，切勿执行（会操作错误的合约）。
 * 现役部署/升级请参考 scripts/deploy-full.js（v3.1.0 权威脚本集）。
 * ============================================================================
 */

/**
 * FidesOrigin V3.0.4 — Sepolia 重新部署/升级脚本
 * 
 * 用途：将今天修复后的合约部署/升级到 Sepolia 测试网
 * 
 * 前置条件：
 *   1. 确保 Sepolia 测试网账户有足够 ETH（建议 > 0.5 ETH）
 *   2. 设置环境变量：ADMIN_PRIVATE_KEY=0x...
 * 
 * 执行方式：
 *   ADMIN_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-v3.0.4-sepolia.js --network sepolia
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// 现有 Sepolia 部署地址 — 从环境变量或配置文件读取
// SECURITY FIX (CRIT-2): 不再硬编码地址，支持从环境变量或配置文件加载
// ═══════════════════════════════════════════════════════════════════

// 加载配置优先级: 1) 环境变量 2) sepolia-deployment.config.json 3) 报错
function loadExistingAddresses() {
    // 1. 尝试从环境变量 JSON 读取
    const envConfig = process.env.FIDES_SEPOLIA_CONFIG;
    if (envConfig) {
        try {
            const parsed = JSON.parse(envConfig);
            validateAddresses(parsed);
            console.log("✅ Loaded deployment addresses from FIDES_SEPOLIA_CONFIG env var");
            return parsed;
        } catch (e) {
            console.error("❌ FIDES_SEPOLIA_CONFIG is not valid JSON:", e.message);
            process.exit(1);
        }
    }

    // 2. 尝试从配置文件读取
    const configPath = path.join(__dirname, '..', 'sepolia-deployment.config.json');
    if (fs.existsSync(configPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            validateAddresses(parsed);
            console.log("✅ Loaded deployment addresses from sepolia-deployment.config.json");
            return parsed;
        } catch (e) {
            console.error("❌ Failed to parse sepolia-deployment.config.json:", e.message);
            process.exit(1);
        }
    }

    // 3. 无配置可用，报错退出
    console.error(`
❌ ERROR: No deployment configuration found.

You must provide existing Sepolia contract addresses via ONE of:

  Option A — Environment variable:
    FIDES_SEPOLIA_CONFIG='{"RiskRegistry":{"proxy":"0x..."},...}' npx hardhat run ...

  Option B — Config file (not in git):
    Create apps/contracts/sepolia-deployment.config.json with the addresses.

See deploy-v3.0.4-sepolia.js for the expected JSON structure.
`);
    process.exit(1);
}

// 验证地址格式和必需字段
function validateAddresses(config) {
    const required = ['RiskRegistry', 'PolicyEngine', 'ComplianceEngine', 'QuarantineVault', 'FidesCompliance'];
    for (const key of required) {
        if (!config[key]) {
            throw new Error(`Missing required contract config: ${key}`);
        }
    }
    // 验证所有地址是有效的 Ethereum 地址
    const addresses = [];
    for (const [name, entry] of Object.entries(config)) {
        const addr = entry.proxy || entry.address;
        if (!addr || !addr.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error(`Invalid address for ${name}: ${addr}`);
        }
        addresses.push(addr);
    }
    // 检查重复地址
    const unique = new Set(addresses);
    if (unique.size !== addresses.length) {
        throw new Error("Duplicate contract addresses detected in configuration");
    }
}

const EXISTING = loadExistingAddresses();

// ═══════════════════════════════════════════════════════════════════
// 部署结果记录
// ═══════════════════════════════════════════════════════════════════
const deploymentResults = {
    network: 'sepolia',
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    version: 'v3.0.4',
    contracts: {},
    upgrades: {},
    roles: {}
};

async function main() {
    const [signer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  FidesOrigin V3.0.4 — Sepolia Deployment / Upgrade");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Network:", network.name, `(chainId=${network.chainId})`);
    console.log("Signer:", signer.address);
    
    const balance = await ethers.provider.getBalance(signer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.1")) {
        console.error("\n❌ ERROR: Insufficient balance. Need at least 0.1 Sepolia ETH.");
        console.error("   Get Sepolia ETH from: https://sepoliafaucet.com/");
        process.exit(1);
    }
    
    console.log("\n");

    // ═══════════════════════════════════════════════════════════════
    // Phase 1: 升级 UUPS Proxy 合约
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Phase 1: Upgrade UUPS Proxies ━━━\n");
    
    // 1.1 Upgrade RiskRegistry
    await upgradeProxy('RiskRegistry', EXISTING.RiskRegistry.proxy);
    
    // 1.2 Upgrade PolicyEngine
    await upgradeProxy('PolicyEngine', EXISTING.PolicyEngine.proxy);
    
    // 1.3 Upgrade ComplianceEngine
    await upgradeProxy('ComplianceEngine', EXISTING.ComplianceEngine.proxy);

    // ═══════════════════════════════════════════════════════════════
    // Phase 2: 重新部署非 Proxy 合约（修复后的版本）
    // ═══════════════════════════════════════════════════════════════
    console.log("\n━━━ Phase 2: Re-deploy Direct Contracts ━━━\n");
    
    // 2.1 Re-deploy FidesCompliance
    await deployDirect('FidesCompliance', [
        EXISTING.ComplianceEngine.proxy,
        EXISTING.RiskRegistry.proxy,
        EXISTING.PolicyEngine.proxy,
        EXISTING.QuarantineVault.address
    ]);
    
    // 2.2 Re-deploy QuarantineVault
    await deployDirect('QuarantineVault');
    
    // 2.3 Re-deploy CompliantStableCoin
    await deployDirect('CompliantStableCoin', [
        "FidesOrigin USD",
        "fUSD",
        6,
        EXISTING.ComplianceEngine.proxy
    ]);

    // ═══════════════════════════════════════════════════════════════
    // Phase 3: 配置角色
    // ═══════════════════════════════════════════════════════════════
    console.log("\n━━━ Phase 3: Configure Roles ━━━\n");
    
    await configureRoles(signer.address);

    // ═══════════════════════════════════════════════════════════════
    // Phase 4: 保存部署记录
    // ═══════════════════════════════════════════════════════════════
    console.log("\n━━━ Phase 4: Save Deployment Record ━━━\n");
    
    const outputPath = path.join(__dirname, '..', 'deployments', `sepolia-v3.0.4-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(deploymentResults, null, 2));
    console.log("✅ Deployment record saved to:", outputPath);
    
    // 同时更新 latest.json
    const latestPath = path.join(__dirname, '..', 'deployments', 'sepolia-latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(deploymentResults, null, 2));
    console.log("✅ Updated sepolia-latest.json");

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  Deployment Complete!");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("\n下一步：");
    console.log("  1. 更新 subgraph.yaml 中的合约地址");
    console.log("  2. 重新部署 Subgraph");
    console.log("  3. 在 Etherscan 上验证合约");
    console.log("  4. 更新前端地址配置");
}

// ─── 升级 UUPS Proxy ──────────────────────────────────────────────
async function upgradeProxy(contractName, proxyAddress) {
    console.log(`━━━ Upgrading ${contractName} ━━━`);
    try {
        const ContractFactory = await ethers.getContractFactory(contractName);
        const newImpl = await ContractFactory.deploy();
        await newImpl.waitForDeployment();
        const newImplAddr = await newImpl.getAddress();
        
        console.log(`  New implementation: ${newImplAddr}`);
        
        // 获取 proxy 合约并升级
        const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external payable'];
        const proxy = new ethers.Contract(proxyAddress, proxyAbi, (await ethers.getSigners())[0]);
        
        const tx = await proxy.upgradeToAndCall(newImplAddr, '0x', { gasLimit: 1000000 });
        console.log(`  Upgrade tx: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`  ✅ Upgraded! Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`);
        
        deploymentResults.upgrades[contractName] = {
            proxy: proxyAddress,
            oldImpl: EXISTING[contractName]?.implementation,
            newImpl: newImplAddr,
            tx: tx.hash,
            block: receipt.blockNumber
        };
    } catch (e) {
        console.error(`  ❌ ${contractName} upgrade failed:`, e.message);
        deploymentResults.upgrades[contractName] = { status: 'failed', error: e.message };
    }
    console.log("");
}

// ─── 直接部署合约 ─────────────────────────────────────────────────
async function deployDirect(contractName, args = []) {
    console.log(`━━━ Deploying ${contractName} ━━━`);
    try {
        const ContractFactory = await ethers.getContractFactory(contractName);
        const contract = args.length > 0 
            ? await ContractFactory.deploy(...args)
            : await ContractFactory.deploy();
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        console.log(`  Address: ${address}`);
        console.log(`  ✅ Deployed!`);
        
        deploymentResults.contracts[contractName] = {
            address,
            type: 'Direct Deploy',
            args
        };
    } catch (e) {
        console.error(`  ❌ ${contractName} deployment failed:`, e.message);
        deploymentResults.contracts[contractName] = { status: 'failed', error: e.message };
    }
    console.log("");
}

// ─── 配置角色 ─────────────────────────────────────────────────────
async function configureRoles(deployer) {
    try {
        // 读取已部署的合约
        const registry = await ethers.getContractAt('RiskRegistry', EXISTING.RiskRegistry.proxy);
        const policy = await ethers.getContractAt('PolicyEngine', EXISTING.PolicyEngine.proxy);
        const compliance = await ethers.getContractAt('ComplianceEngine', EXISTING.ComplianceEngine.proxy);
        
        const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
        const COMPLIANCE_ENGINE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMPLIANCE_ENGINE_ROLE"));
        const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
        
        // 授予角色
        const roleTx1 = await registry.grantRole(ORACLE_ROLE, EXISTING.ComplianceEngine.proxy);
        await roleTx1.wait();
        console.log("  ✅ Granted ORACLE_ROLE to ComplianceEngine");
        
        const roleTx2 = await registry.grantRole(ORACLE_ROLE, deployer);
        await roleTx2.wait();
        console.log("  ✅ Granted ORACLE_ROLE to deployer");
        
        const roleTx3 = await policy.grantRole(COMPLIANCE_ENGINE_ROLE, EXISTING.ComplianceEngine.proxy);
        await roleTx3.wait();
        console.log("  ✅ Granted COMPLIANCE_ENGINE_ROLE to ComplianceEngine");
        
        const roleTx4 = await compliance.grantRole(OPERATOR_ROLE, deployer);
        await roleTx4.wait();
        console.log("  ✅ Granted OPERATOR_ROLE to deployer");
        
        deploymentResults.roles = {
            ORACLE_ROLE: [EXISTING.ComplianceEngine.proxy, deployer],
            COMPLIANCE_ENGINE_ROLE: [EXISTING.ComplianceEngine.proxy],
            OPERATOR_ROLE: [deployer]
        };
    } catch (e) {
        console.error("  ❌ Role configuration failed:", e.message);
    }
}

// ─── 执行 ─────────────────────────────────────────────────────────
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
