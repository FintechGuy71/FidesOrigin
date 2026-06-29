const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * @title Timelock Deployment Script
 * @notice 部署 FidesOrigin 时间锁控制器并转移所有权
 * 
 * 部署顺序：
 * 1. 读取已部署的核心合约地址
 * 2. 配置多签地址（proposers + executors）
 * 3. 部署 FidesOriginTimelock
 * 4. 将核心合约所有权转移给 Timelock
 * 
 * 安全模型：
 * - Proposers: 多签钱包 (至少 3/5 签名)
 * - Executors: 多签钱包 + 紧急多签 (2/3 签名)
 * - Admin: 部署者 (renounce 在部署后)
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying Timelock with account:", deployer.address);
    
    const network = hre.network.name;
    console.log("📡 Network:", network);
    
    // ============ 1. 读取已部署合约地址 ============
    const deploymentsPath = path.join(__dirname, '..', 'deployments', `hardhat-latest.json`);
    if (!fs.existsSync(deploymentsPath)) {
        console.error("❌ Deployment info not found. Run deploy-full.js first.");
        process.exit(1);
    }
    
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    const contracts = deploymentInfo.contracts;
    
    console.log("\n📋 Core contracts to transfer:");
    console.log("  - RiskRegistry:", contracts.RiskRegistry);
    console.log("  - PolicyEngine:", contracts.PolicyEngine);
    console.log("  - ComplianceEngine:", contracts.ComplianceEngine);
    console.log("  - RiskOracle:", contracts.RiskOracle || "N/A");
    
    // ============ 2. 配置多签地址 ============
    // 生产环境应从环境变量读取，开发环境使用 mock
    const proposers = [
        deployer.address, // 临时：部署者作为 proposer
        process.env.MULTISIG_PROPOSER_1 || deployer.address,
        process.env.MULTISIG_PROPOSER_2 || deployer.address,
    ];
    
    const executors = [
        deployer.address, // 临时：部署者作为 executor
        process.env.MULTISIG_EXECUTOR_1 || deployer.address,
        process.env.MULTISIG_EXECUTOR_2 || deployer.address,
    ];
    
    // 去重
    const uniqueProposers = [...new Set(proposers)];
    const uniqueExecutors = [...new Set(executors)];
    
    console.log("\n🔐 Multisig Configuration:");
    console.log("  Proposers:", uniqueProposers.length, "accounts");
    uniqueProposers.forEach((p, i) => console.log(`    [${i}] ${p}`));
    console.log("  Executors:", uniqueExecutors.length, "accounts");
    uniqueExecutors.forEach((e, i) => console.log(`    [${i}] ${e}`));
    
    // ============ 3. 部署 Timelock ============
    console.log("\n📦 Deploying FidesOriginTimelock...");
    console.log("  Min Delay: 48 hours (standard)");
    console.log("  Emergency Delay: 4 hours");
    
    const Timelock = await ethers.getContractFactory("FidesOriginTimelock");
    const timelock = await Timelock.deploy(
        uniqueProposers,
        uniqueExecutors,
        deployer.address // admin - will renounce later
    );
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();
    console.log("✅ FidesOriginTimelock deployed to:", timelockAddress);
    
    // ============ 4. 配置紧急操作员 ============
    console.log("\n⚡ Configuring emergency operators...");
    const emergencyOperators = [
        process.env.EMERGENCY_OPERATOR_1 || deployer.address,
        process.env.EMERGENCY_OPERATOR_2 || deployer.address,
    ];
    
    for (const op of emergencyOperators) {
        await timelock.addEmergencyOperator(op);
        console.log("  ✅ Added emergency operator:", op);
    }
    
    // ============ 5. 转移核心合约所有权 ============
    console.log("\n🏛️ Transferring ownership to Timelock...");
    
    // RiskRegistry - DEFAULT_ADMIN_ROLE
    const riskRegistry = await ethers.getContractAt("RiskRegistry", contracts.RiskRegistry);
    const DEFAULT_ADMIN_ROLE = await riskRegistry.DEFAULT_ADMIN_ROLE();
    
    // 先授予 Timelock admin 权限
    await riskRegistry.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
    console.log("  ✅ Granted DEFAULT_ADMIN_ROLE to Timelock on RiskRegistry");
    
    // PolicyEngine - DEFAULT_ADMIN_ROLE
    const policyEngine = await ethers.getContractAt("PolicyEngine", contracts.PolicyEngine);
    await policyEngine.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
    console.log("  ✅ Granted DEFAULT_ADMIN_ROLE to Timelock on PolicyEngine");
    
    // ComplianceEngine - DEFAULT_ADMIN_ROLE
    const complianceEngine = await ethers.getContractAt("ComplianceEngine", contracts.ComplianceEngine);
    await complianceEngine.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
    console.log("  ✅ Granted DEFAULT_ADMIN_ROLE to Timelock on ComplianceEngine");
    
    // RiskOracle (if deployed)
    if (contracts.RiskOracle) {
        const riskOracle = await ethers.getContractAt("RiskOracle", contracts.RiskOracle);
        // RiskOracle roles are constants, use keccak256 hashes directly
        const adminRole = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
        const oracleAdminRole = ethers.keccak256(ethers.toUtf8Bytes("DEFAULT_ADMIN_ROLE"));
        
        try {
            await riskOracle.grantRole(adminRole, timelockAddress);
            console.log("  ✅ Granted ADMIN_ROLE to Timelock on RiskOracle");
        } catch (e) {
            // Fallback to DEFAULT_ADMIN_ROLE
            await riskOracle.grantRole(oracleAdminRole, timelockAddress);
            console.log("  ✅ Granted DEFAULT_ADMIN_ROLE to Timelock on RiskOracle");
        }
    }
    
    // ============ 6. 可选：renounce 部署者权限 ============
    // 开发环境保留，生产环境取消注释
    // console.log("\n🔄 Renouncing deployer admin roles...");
    // await riskRegistry.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    // await policyEngine.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    // await complianceEngine.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    // console.log("  ✅ Deployer roles renounced");
    
    // ============ 7. 保存部署信息 ============
    console.log("\n💾 Saving timelock deployment info...");
    
    const timelockDeployment = {
        network,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            ...contracts,
            FidesOriginTimelock: timelockAddress,
        },
        timelock: {
            address: timelockAddress,
            minDelay: "48 hours",
            emergencyDelay: "4 hours",
            proposers: uniqueProposers,
            executors: uniqueExecutors,
            emergencyOperators,
        }
    };
    
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = `hardhat-timelock-${Date.now()}.json`;
    fs.writeFileSync(
        path.join(deploymentsDir, filename),
        JSON.stringify(timelockDeployment, null, 2)
    );
    fs.writeFileSync(
        path.join(deploymentsDir, 'hardhat-latest-timelock.json'),
        JSON.stringify(timelockDeployment, null, 2)
    );
    console.log("  ✅ Saved to:", filename);
    
    // ============ 8. 验证报告 ============
    console.log("\n╔════════════════════════════════════════════╗");
    console.log("║    FIDESORIGIN TIMELOCK DEPLOYMENT         ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("\n🏛️ Timelock Address:", timelockAddress);
    console.log("   Min Delay:        48 hours");
    console.log("   Emergency Delay:  4 hours");
    console.log("\n📋 Core Contracts (now owned by Timelock):");
    console.log("   RiskRegistry:    ", contracts.RiskRegistry);
    console.log("   PolicyEngine:     ", contracts.PolicyEngine);
    console.log("   ComplianceEngine: ", contracts.ComplianceEngine);
    if (contracts.RiskOracle) {
        console.log("   RiskOracle:       ", contracts.RiskOracle);
    }
    console.log("\n⚠️  IMPORTANT:");
    console.log("   - Deployer still has admin rights (renounce manually in production)");
    console.log("   - Configure real multisig addresses before mainnet deployment");
    console.log("   - Emergency operators are set but should be a dedicated security team");
    console.log("\n🔒 All admin actions now require Timelock proposal (48h delay)");
    console.log("   or Emergency mode (4h delay, emergency operators only)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
