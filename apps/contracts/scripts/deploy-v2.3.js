/**
 * Deploy RiskRegistryV2 V2.3.0 Implementation + Upgrade Proxy
 * 
 * Usage:
 *   ADMIN_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-v2.3.js --network sepolia
 */

const { ethers } = require("hardhat");

// [P1 Fix] 从环境变量读取地址，不再硬编码
const PROXY_ADDR = process.env.PROXY_ADDRESS;
if (!PROXY_ADDR) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/deploy-v2.3.js --network sepolia');
  process.exit(1);
}
const TEST_ADDR = process.env.TEST_ADDRESS || '0xe950dc316b836e4eefb8308bf32bf7c72a1358ff';

// ⚠️  SECURITY WARNING: This script directly calls upgradeToAndCall, bypassing any Timelock.
// Production deployments MUST use a TimelockController with a two-phase process:
//   1. schedule()  - propose the upgrade with a delay
//   2. execute()   - execute after the delay expires
// To bypass this check for testing/emergency, set BYPASS_TIMELOCK=true
const BYPASS_TIMELOCK = process.env.BYPASS_TIMELOCK === 'true';

async function main() {
  if (!BYPASS_TIMELOCK) {
    console.error("❌  SECURITY HALT: Direct upgrade bypasses Timelock protection.");
    console.error("   Production: Use TimelockController.schedule() + execute()");
    console.error("   Testing:     Set BYPASS_TIMELOCK=true to proceed");
    console.error("");
    console.error("   Example Timelock flow:");
    console.error("     const timelock = await ethers.getContractAt('TimelockController', TIMELOCK_ADDR);");
    console.error("     const data = proxy.interface.encodeFunctionData('upgradeToAndCall', [implAddr, '0x']);");
    console.error("     await timelock.schedule(proxyAddr, 0, data, bytes32(0), bytes32(0), delay);");
    console.error("     // wait for delay...");
    console.error("     await timelock.execute(proxyAddr, 0, data, bytes32(0), bytes32(0));");
    process.exit(1);
  }

  console.warn("⚠️  BYPASSING TIMELOCK — direct upgradeToAndCall will be used");
  console.log("=".repeat(60));
  console.log("  RiskRegistryV2 V2.3.0 Deployment & Upgrade");
  console.log("=".repeat(60));

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Proxy:", PROXY_ADDR);
  console.log();

  // --- Step 1: Deploy new implementation ---
  console.log(">>> Step 1: Deploy new implementation...");
  const Factory = await ethers.getContractFactory("RiskRegistryV2");
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("    Implementation deployed:", implAddr);

  // --- Step 2: Verify code exists ---
  console.log(">>> Step 2: Verify bytecode...");
  const code = await ethers.provider.getCode(implAddr);
  console.log("    Code size:", code.length, "bytes");
  if (code.length < 100) {
    throw new Error("FAIL: Implementation bytecode too small — not deployed correctly");
  }
  console.log("    ✅ Bytecode verified");

  // --- Step 3: Verify VERSION on implementation ---
  console.log(">>> Step 3: Verify VERSION on implementation...");
  const version = await impl.VERSION();
  console.log("    Implementation VERSION:", version);
  if (version !== "2.3.0") {
    throw new Error(`FAIL: Expected VERSION "2.3.0", got "${version}"`);
  }
  console.log("    ✅ VERSION confirmed: 2.3.0");

  // --- Step 4: Upgrade proxy ---
  console.log(">>> Step 4: Upgrade proxy via upgradeToAndCall...");
  const ProxyContract = await ethers.getContractAt("RiskRegistryV2", PROXY_ADDR);

  // Check if signer has ADMIN_ROLE
  const ADMIN_ROLE = await ProxyContract.ADMIN_ROLE();
  const hasRole = await ProxyContract.hasRole(ADMIN_ROLE, signer.address);
  console.log("    Signer has ADMIN_ROLE:", hasRole);
  if (!hasRole) {
    throw new Error("FAIL: Signer does not have ADMIN_ROLE on proxy");
  }

  // Call upgradeToAndCall
  const tx = await ProxyContract.upgradeToAndCall(implAddr, "0x");
  console.log("    Upgrade tx hash:", tx.hash);
  console.log("    Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("    ✅ Upgrade confirmed! Block:", receipt.blockNumber, "Gas:", receipt.gasUsed.toString());
  console.log();

  // --- Step 5: Post-upgrade verification via proxy ---
  console.log(">>> Step 5: Post-upgrade verification via proxy...");
  const proxyVersion = await ProxyContract.VERSION();
  console.log("    Proxy VERSION:", proxyVersion);
  if (proxyVersion !== "2.3.0") {
    throw new Error(`FAIL: Proxy VERSION mismatch. Expected "2.3.0", got "${proxyVersion}"`);
  }
  console.log("    ✅ Proxy VERSION = 2.3.0");

  const totalProfiles = await ProxyContract.totalProfiles();
  console.log("    totalProfiles:", totalProfiles.toString());
  if (totalProfiles !== 2636n) {
    console.log("    ⚠️  WARNING: Expected 2636, got", totalProfiles.toString());
  } else {
    console.log("    ✅ totalProfiles = 2636");
  }

  const isSanc = await ProxyContract.isSanctioned(TEST_ADDR);
  console.log("    isSanctioned(" + TEST_ADDR + "):", isSanc);
  if (!isSanc) {
    console.log("    ⚠️  WARNING: Expected true for sanctioned address");
  } else {
    console.log("    ✅ isSanctioned = true");
  }

  // getProfile - C1 backward compatibility check
  console.log();
  console.log(">>> Step 6: Verify getProfile() backward compatibility...");
  try {
    const profile = await ProxyContract.getProfile(TEST_ADDR);
    console.log("    getProfile() returned:");
    console.log("      riskScore:", profile[0].toString());
    console.log("      profileAddr:", profile[1]);
    console.log("      lastUpdated:", profile[2].toString());
    console.log("      riskTier:", profile[3].toString());
    console.log("      sourceConfidence:", profile[4].toString());
    console.log("      sanctioned:", profile[5]);
    console.log("      exists:", profile[6]);
    console.log("      tags length:", profile[7].length);
    console.log("    ✅ getProfile() works — 8 values returned");
  } catch (e) {
    console.log("    ❌ getProfile() FAILED:", e.message);
    throw new Error("FAIL: getProfile() backward compatibility broken — storage layout may be corrupted");
  }

  console.log();
  console.log("=".repeat(60));
  console.log("  ✅ V2.3.0 DEPLOYMENT & UPGRADE COMPLETE");
  console.log("=".repeat(60));
  console.log("  Implementation:", implAddr);
  console.log("  Proxy:", PROXY_ADDR);
  console.log("  Version: 2.3.0");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ DEPLOYMENT FAILED:", e.message);
    console.error(e.stack);
    process.exit(1);
  });
