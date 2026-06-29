const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * @title Full Deployment Script
 * @notice 部署完整的FidesOrigin协议栈
 * 
 * 部署顺序：
 * 1. RiskRegistry - 风险数据注册中心
 * 2. PolicyEngine - 策略引擎
 * 3. ComplianceEngine - 核心合规引擎
 * 4. RiskOracle - Chainlink Functions预言机
 * 5. Demo合约 - CompliantStableCoin + CompliantSmartWallet
 */

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    
    const network = hre.network.name;
    console.log("Network:", network);
    
    const deployments = {};
    
    // ============ 1. Deploy RiskRegistry ============
    console.log("\n📦 Deploying RiskRegistry...");
    const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
    const riskRegistry = await RiskRegistry.deploy();
    await riskRegistry.waitForDeployment();
    const riskRegistryAddress = await riskRegistry.getAddress();
    console.log("✅ RiskRegistry deployed to:", riskRegistryAddress);
    deployments.RiskRegistry = riskRegistryAddress;
    
    // ============ 2. Deploy PolicyEngine ============
    console.log("\n📦 Deploying PolicyEngine...");
    const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
    const policyEngine = await PolicyEngine.deploy(riskRegistryAddress);
    await policyEngine.waitForDeployment();
    const policyEngineAddress = await policyEngine.getAddress();
    console.log("✅ PolicyEngine deployed to:", policyEngineAddress);
    deployments.PolicyEngine = policyEngineAddress;
    
    // ============ 3. Deploy ComplianceEngine ============
    console.log("\n📦 Deploying ComplianceEngine...");
    const ComplianceEngine = await ethers.getContractFactory("ComplianceEngine");
    const complianceEngine = await ComplianceEngine.deploy(
        riskRegistryAddress,
        policyEngineAddress
    );
    await complianceEngine.waitForDeployment();
    const complianceEngineAddress = await complianceEngine.getAddress();
    console.log("✅ ComplianceEngine deployed to:", complianceEngineAddress);
    deployments.ComplianceEngine = complianceEngineAddress;
    
    // ============ 4. Setup Roles ============
    console.log("\n🔐 Setting up roles...");
    
    // Grant ComplianceEngine ORACLE_ROLE on RiskRegistry
    const ORACLE_ROLE = await riskRegistry.ORACLE_ROLE();
    await riskRegistry.grantRole(ORACLE_ROLE, complianceEngineAddress);
    console.log("✅ Granted ORACLE_ROLE to ComplianceEngine");
    
    // Grant deployer ORACLE_ROLE for testing
    await riskRegistry.grantRole(ORACLE_ROLE, deployer.address);
    console.log("✅ Granted ORACLE_ROLE to deployer");
    
    // ============ 5. Deploy RiskOracle (if Chainlink config available) ============
    const chainlinkRouter = process.env.CHAINLINK_FUNCTIONS_ROUTER;
    const chainlinkDonId = process.env.CHAINLINK_DON_ID;
    const chainlinkSubscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID;
    
    if (chainlinkRouter && chainlinkDonId && chainlinkSubscriptionId) {
        console.log("\n📦 Deploying RiskOracle...");
        const RiskOracle = await ethers.getContractFactory("RiskOracle");
        const riskOracle = await RiskOracle.deploy(
            chainlinkRouter,
            ethers.encodeBytes32String(chainlinkDonId),
            parseInt(chainlinkSubscriptionId),
            riskRegistryAddress
        );
        await riskOracle.waitForDeployment();
        const riskOracleAddress = await riskOracle.getAddress();
        console.log("✅ RiskOracle deployed to:", riskOracleAddress);
        deployments.RiskOracle = riskOracleAddress;
        
        // Grant RiskOracle ORACLE_ROLE
        await riskRegistry.grantRole(ORACLE_ROLE, riskOracleAddress);
        console.log("✅ Granted ORACLE_ROLE to RiskOracle");
    } else {
        console.log("\n⚠️ Skipping RiskOracle deployment - Chainlink config not found");
        console.log("   Set CHAINLINK_FUNCTIONS_ROUTER, CHAINLINK_DON_ID, CHAINLINK_SUBSCRIPTION_ID");
    }
    
    // ============ 6. Deploy Demo StableCoin ============
    console.log("\n📦 Deploying Demo CompliantStableCoin...");
    const CompliantStableCoin = await ethers.getContractFactory("CompliantStableCoin");
    const stableCoin = await CompliantStableCoin.deploy(
        "FidesOrigin Demo USD",
        "fUSD",
        complianceEngineAddress
    );
    await stableCoin.waitForDeployment();
    const stableCoinAddress = await stableCoin.getAddress();
    console.log("✅ CompliantStableCoin deployed to:", stableCoinAddress);
    deployments.CompliantStableCoin = stableCoinAddress;
    
    // ============ 7. Deploy Demo SmartWallet ============
    console.log("\n📦 Deploying Demo CompliantSmartWallet...");
    const CompliantSmartWallet = await ethers.getContractFactory("CompliantSmartWallet");
    const smartWallet = await CompliantSmartWallet.deploy(
        deployer.address,
        complianceEngineAddress
    );
    await smartWallet.waitForDeployment();
    const smartWalletAddress = await smartWallet.getAddress();
    console.log("✅ CompliantSmartWallet deployed to:", smartWalletAddress);
    deployments.CompliantSmartWallet = smartWalletAddress;
    
    // ============ 8. Seed Test Data ============
    console.log("\n🌱 Seeding test data...");
    
    // Add some test risk profiles
    const testAddresses = [
        "0x1234567890123456789012345678901234567890",
        "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    ];
    
    for (let i = 0; i < testAddresses.length; i++) {
        await riskRegistry.updateRiskProfile(
            testAddresses[i],
            80 + i * 5,  // Risk score
            3,  // HIGH tier
            [ethers.encodeBytes32String("test")],
            i === 0  // First one sanctioned
        );
    }
    console.log("✅ Added test risk profiles");
    
    // Mint some test tokens
    await stableCoin.mint(deployer.address, ethers.parseUnits("1000000", 6));
    console.log("✅ Minted 1M fUSD to deployer");
    
    // ============ 9. Save Deployment Info ============
    console.log("\n💾 Saving deployment info...");
    
    const deploymentInfo = {
        network: network,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: deployments
    };
    
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = `${network}-${Date.now()}.json`;
    fs.writeFileSync(
        path.join(deploymentsDir, filename),
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    // Also update latest.json
    fs.writeFileSync(
        path.join(deploymentsDir, 'latest.json'),
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`✅ Deployment info saved to deployments/${filename}`);
    console.log("✅ Updated deployments/latest.json");
    
    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("\nDeployed Contracts:");
    for (const [name, address] of Object.entries(deployments)) {
        console.log(`  ${name}: ${address}`);
    }
    console.log("\nNext Steps:");
    console.log("  1. Verify contracts on Etherscan");
    console.log("  2. Configure policies via admin functions");
    console.log("  3. Set up Chainlink Functions subscription");
    console.log("  4. Test with demo applications");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
