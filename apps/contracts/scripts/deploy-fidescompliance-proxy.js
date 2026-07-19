/**
 * Deploy FidesCompliance with UUPS Proxy
 *
 * Usage (local):
 *   npx hardhat run scripts/deploy-fidescompliance-proxy.js --network hardhat
 *
 * Usage (sepolia):
 *   ADMIN_PRIVATE_KEY=0x... SEPOLIA_RPC=... npx hardhat run scripts/deploy-fidescompliance-proxy.js --network sepolia
 */

const { ethers, upgrades } = require("hardhat");

// Existing contracts on Sepolia (ignored on local Hardhat)
const COMPLIANCE_ENGINE_SEPOLIA = "0x0000000000000000000000000000000000000000"; // Replace with actual
const RISK_REGISTRY_SEPOLIA = "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc";
const POLICY_ENGINE_SEPOLIA = "0x87089F67A61F9643796AE154663A6a9F21196b38";
const QUARANTINE_VAULT_SEPOLIA = "0x0000000000000000000000000000000000000000"; // Replace with actual

async function main() {
    const [signer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const isLocal = network.chainId === 31337n;

    console.log("═══════════════════════════════════════");
    console.log("  FidesCompliance UUPS Proxy Deployment");
    console.log("═══════════════════════════════════════");
    console.log("Network:", network.name || `chainId=${network.chainId}`);
    console.log("Signer:", signer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");
    console.log("");

    // ── Resolve dependencies ──────────────────────────────────────────
    let complianceEngineAddr, riskRegistryAddr, policyEngineAddr, quarantineVaultAddr;

    if (isLocal) {
        console.log("Local network detected — deploying mock dependencies...");

        // Deploy mock ComplianceEngine (already UUPS, but we need a fresh one for testing)
        const ComplianceEngine = await ethers.getContractFactory("ComplianceEngine");
        const ce = await upgrades.deployProxy(ComplianceEngine, [
            signer.address, // _riskRegistry - we'll use a mock
            signer.address, // _policyEngine - we'll use a mock
        ], { kind: "uups" });
        await ce.waitForDeployment();
        complianceEngineAddr = await ce.getAddress();
        console.log("  ✅ Mock ComplianceEngine:", complianceEngineAddr);

        // Deploy mock RiskRegistry
        const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
        const rr = await RiskRegistry.deploy();
        await rr.waitForDeployment();
        riskRegistryAddr = await rr.getAddress();
        console.log("  ✅ Mock RiskRegistry:", riskRegistryAddr);

        // Deploy mock PolicyEngine
        const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
        const pe = await PolicyEngine.deploy();
        await pe.waitForDeployment();
        policyEngineAddr = await pe.getAddress();
        console.log("  ✅ Mock PolicyEngine:", policyEngineAddr);

        // Deploy mock QuarantineVault
        const QuarantineVault = await ethers.getContractFactory("QuarantineVault");
        const qv = await QuarantineVault.deploy(signer.address);
        await qv.waitForDeployment();
        quarantineVaultAddr = await qv.getAddress();
        console.log("  ✅ Mock QuarantineVault:", quarantineVaultAddr);

        // Update ComplianceEngine with real addresses
        await ce.setRiskRegistry(riskRegistryAddr);
        await ce.setPolicyEngine(policyEngineAddr);
        console.log("  ✅ Mock ComplianceEngine dependencies updated");
        console.log("");
    } else {
        complianceEngineAddr = COMPLIANCE_ENGINE_SEPOLIA;
        riskRegistryAddr = RISK_REGISTRY_SEPOLIA;
        policyEngineAddr = POLICY_ENGINE_SEPOLIA;
        quarantineVaultAddr = QUARANTINE_VAULT_SEPOLIA;
        console.log("Using existing Sepolia contracts:");
        console.log("  ComplianceEngine:", complianceEngineAddr);
        console.log("  RiskRegistry:", riskRegistryAddr);
        console.log("  PolicyEngine:", policyEngineAddr);
        console.log("  QuarantineVault:", quarantineVaultAddr);
        console.log("");
    }

    // ── Deploy FidesCompliance with UUPS Proxy ───────────────────────
    console.log("Deploying FidesCompliance UUPS Proxy...");
    const FidesCompliance = await ethers.getContractFactory("FidesCompliance");

    const proxy = await upgrades.deployProxy(FidesCompliance, [
        complianceEngineAddr,
        riskRegistryAddr,
        policyEngineAddr,
        quarantineVaultAddr,
    ], { kind: "uups" });

    await proxy.waitForDeployment();

    const proxyAddr = await proxy.getAddress();
    const implAddr = await upgrades.erc1967.getImplementationAddress(proxyAddr);

    console.log("✅ FidesCompliance Proxy deployed:", proxyAddr);
    console.log("✅ FidesCompliance Implementation:", implAddr);
    console.log("");

    // ── Verification ─────────────────────────────────────────────────
    console.log("═══════════════════════════════════════");
    console.log("  Verification");
    console.log("═══════════════════════════════════════");

    const version = await proxy.VERSION();
    console.log("Contract VERSION:", version);

    const hasAdminRole = await proxy.hasRole(
        await proxy.ADMIN_ROLE(),
        signer.address
    );
    console.log("Deployer has ADMIN_ROLE:", hasAdminRole);

    const ce = await proxy.complianceEngine();
    const rr = await proxy.riskRegistry();
    const pe = await proxy.policyEngine();
    const qv = await proxy.quarantineVault();

    console.log("complianceEngine:", ce);
    console.log("riskRegistry:", rr);
    console.log("policyEngine:", pe);
    console.log("quarantineVault:", qv);
    console.log("");

    // ── Save deployment record ───────────────────────────────────────
    const fs = require("fs");
    const record = {
        network: isLocal ? "hardhat" : "sepolia",
        chainId: Number(network.chainId),
        timestamp: new Date().toISOString(),
        deployer: signer.address,
        version: version,
        proxy: proxyAddr,
        implementation: implAddr,
        dependencies: {
            ComplianceEngine: complianceEngineAddr,
            RiskRegistry: riskRegistryAddr,
            PolicyEngine: policyEngineAddr,
            QuarantineVault: quarantineVaultAddr,
        },
    };

    const deploymentsDir = "deployments";
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
    const recordPath = `${deploymentsDir}/${isLocal ? "hardhat" : "sepolia"}-fidescompliance-uups.json`;
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    console.log(`📋 Deployment record saved: ${recordPath}`);
    console.log("\n✅ FidesCompliance UUPS Proxy Deployment Complete!");
    console.log(`   Proxy address: ${proxyAddr}`);
    console.log(`   Implementation: ${implAddr}`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("❌ Deployment failed:", e);
        process.exit(1);
    });
