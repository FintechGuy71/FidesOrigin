#!/usr/bin/env node
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
// 现有 Sepolia 部署地址（从 sepolia-latest.json 读取）
// ═══════════════════════════════════════════════════════════════════
const EXISTING = {
    RiskRegistry: {
        proxy: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
        implementation: "0x73F97E9e33b9eb952B8Ec7e0722523bAef555A59"
    },
    PolicyEngine: {
        proxy: "0x87089F67A61F9643796AE154663A6a9F21196b38",
        implementation: "0xFD89795Bb954C175267e7d78d9492Ce22200dBA7"
    },
    ComplianceEngine: {
        proxy: "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC",
        implementation: "0x84838e8c9721e7f9475Bb379c6aF4b11240e9807"
    },
    QuarantineVault: {
        address: "0x497176b21CC2EDd90a8725a3023742358311a382"
    },
    FidesCompliance: {
        address: "0x7cc76aD60385f77F0e013f5C2771FCa32a6F97A1"
    },
    CompliantStableCoin: {
        address: "0xC6AC4eB3bc328D9482e243e6E2E5C4e0372a6Cca"
    },
    Diamond: {
        address: "0x9303Df978467839B881b67Ad6C77756D00658A5A"
    }
};

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
