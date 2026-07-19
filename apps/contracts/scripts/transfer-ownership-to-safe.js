#!/usr/bin/env node
/**
 * FidesOrigin — 合约所有权转移脚本
 *
 * 用途：将所有合约的 ADMIN_ROLE / DEFAULT_ADMIN_ROLE 从 deployer 转移到 Gnosis Safe 多签钱包
 *
 * 前置条件：
 *   1. Gnosis Safe 已部署（见 deploy-gnosis-safe.js）
 *   2. ADMIN_PRIVATE_KEY 环境变量已设置
 *   3. 可选：SAFE_ADDRESS 环境变量（否则自动读取 latest-safe.json）
 *
 * 执行方式：
 *   SAFE_ADDRESS=0x... npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia
 *
 * 安全说明：
 *   - 本脚本执行后，deployer 将失去所有管理员权限
 *   - 所有管理操作需通过 Safe 3/5 多签执行
 *   - 建议先在测试网完整验证后再执行主网转移
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════════════
// 角色常量
// ═══════════════════════════════════════════════════════════════════
const ROLES = {
    DEFAULT_ADMIN_ROLE: ethers.ZeroHash, // bytes32(0)
    ADMIN_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE")),
    ORACLE_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE")),
    OPERATOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE")),
    COMPLIANCE_ENGINE_ROLE: ethers.keccak256(ethers.toUtf8Bytes("COMPLIANCE_ENGINE_ROLE")),
    RULE_MANAGER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("RULE_MANAGER_ROLE")),
};

// ═══════════════════════════════════════════════════════════════════
// 读取部署记录
// ═══════════════════════════════════════════════════════════════════
function loadDeploymentRecord(networkName) {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const latestPath = path.join(deploymentsDir, `sepolia-latest.json`);

    if (!fs.existsSync(latestPath)) {
        throw new Error(`Deployment record not found: ${latestPath}`);
    }

    return JSON.parse(fs.readFileSync(latestPath, "utf-8"));
}

function loadSafeRecord(networkName) {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const latestPath = path.join(deploymentsDir, `gnosis-safe-${networkName}-latest.json`);

    if (!fs.existsSync(latestPath)) {
        throw new Error(`Safe record not found: ${latestPath}. Run deploy-gnosis-safe.js first.`);
    }

    return JSON.parse(fs.readFileSync(latestPath, "utf-8"));
}

// ═══════════════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════════════
async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    const networkName = network.name === "unknown" && chainId === 31337 ? "hardhat" : network.name;

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  FidesOrigin — Transfer Ownership to Gnosis Safe");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Network:", networkName, `(chainId=${chainId})`);
    console.log("Deployer:", deployer.address);
    console.log("");

    // ─── 获取 Safe 地址 ───────────────────────────────────────────
    let safeAddress = process.env.SAFE_ADDRESS;
    let safeRecord = null;

    if (!safeAddress) {
        try {
            safeRecord = loadSafeRecord(networkName);
            safeAddress = safeRecord.safe.address;
            console.log(`✅ Loaded Safe from gnosis-safe-${networkName}-latest.json`);
        } catch (e) {
            console.error("❌ ERROR: SAFE_ADDRESS env var not set and no Safe record found.");
            console.error("   Run: SAFE_ADDRESS=0x... npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia");
            process.exit(1);
        }
    }

    console.log(`  Safe Address: ${safeAddress}`);
    if (safeRecord) {
        console.log(`  Threshold:    ${safeRecord.safe.threshold}/${safeRecord.safe.owners.length}`);
    }
    console.log("");

    // ─── 读取合约部署记录 ─────────────────────────────────────────
    const deployment = loadDeploymentRecord(networkName);
    console.log("━━━ Contracts to Transfer ━━━");

    const contracts = [];

    // UUPS Proxy 合约
    if (deployment.upgrades) {
        for (const [name, info] of Object.entries(deployment.upgrades)) {
            if (info.proxy) {
                contracts.push({ name, address: info.proxy, type: "UUPS Proxy" });
            }
        }
    }

    // 直接部署的合约
    if (deployment.contracts) {
        for (const [name, info] of Object.entries(deployment.contracts)) {
            if (info.address && info.status !== "failed") {
                contracts.push({ name, address: info.address, type: info.type || "Direct Deploy" });
            }
        }
    }

    // 兼容旧版本部署记录
    const legacyContracts = [
        { name: "RiskRegistry", address: deployment.RiskRegistry?.proxy || deployment.RiskRegistry?.address },
        { name: "PolicyEngine", address: deployment.PolicyEngine?.proxy || deployment.PolicyEngine?.address },
        { name: "ComplianceEngine", address: deployment.ComplianceEngine?.proxy || deployment.ComplianceEngine?.address },
        { name: "QuarantineVault", address: deployment.QuarantineVault?.address },
        { name: "FidesCompliance", address: deployment.FidesCompliance?.address },
        { name: "CompliantStableCoin", address: deployment.CompliantStableCoin?.address },
    ];

    for (const legacy of legacyContracts) {
        if (legacy.address && !contracts.some(c => c.name === legacy.name)) {
            contracts.push({ name: legacy.name, address: legacy.address, type: "Legacy" });
        }
    }

    contracts.forEach(c => console.log(`  ${c.name}: ${c.address} (${c.type})`));
    console.log("");

    // ─── 检查 dry-run 模式 ────────────────────────────────────────
    const DRY_RUN = process.env.DRY_RUN === "true";
    if (DRY_RUN) {
        console.log("⚠️  DRY RUN MODE — No transactions will be sent\n");
    }

    // ─── 转移所有权 ───────────────────────────────────────────────
    const transferResults = [];

    for (const contract of contracts) {
        console.log(`━━━ Transferring ${contract.name} ━━━`);
        const result = await transferContractOwnership(
            contract.name,
            contract.address,
            deployer,
            safeAddress,
            DRY_RUN
        );
        transferResults.push(result);
        console.log("");
    }

    // ─── 汇总报告 ─────────────────────────────────────────────────
    console.log("━━━ Transfer Summary ━━━");
    const successCount = transferResults.filter(r => r.success).length;
    const failedCount = transferResults.filter(r => !r.success).length;

    console.log(`  Total:    ${transferResults.length}`);
    console.log(`  Success:  ${successCount}`);
    console.log(`  Failed:   ${failedCount}`);
    console.log("");

    if (failedCount > 0) {
        console.log("  Failed transfers:");
        transferResults.filter(r => !r.success).forEach(r => {
            console.log(`    ❌ ${r.name}: ${r.error}`);
        });
        console.log("");
    }

    // ─── 保存转移记录 ─────────────────────────────────────────────
    const transferRecord = {
        network: networkName,
        chainId: chainId,
        timestamp: new Date().toISOString(),
        safeAddress,
        deployer: deployer.address,
        transfers: transferResults,
        dryRun: DRY_RUN,
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const outputPath = path.join(
        deploymentsDir,
        `ownership-transfer-${networkName}-${Date.now()}.json`
    );
    fs.writeFileSync(outputPath, JSON.stringify(transferRecord, null, 2));
    console.log(`✅ Transfer record saved to: ${outputPath}`);

    if (DRY_RUN) {
        console.log("\n⚠️  This was a DRY RUN. Set DRY_RUN=false to execute actual transfers.");
    } else {
        console.log("\n🔒 Ownership transfer complete!");
        console.log("   Deployer no longer has admin rights.");
        console.log("   All management operations require Safe 3/5 multisig.");
    }
}

// ═══════════════════════════════════════════════════════════════════
// 转移单个合约的所有权
// ═══════════════════════════════════════════════════════════════════
async function transferContractOwnership(name, address, deployer, safeAddress, dryRun) {
    const result = {
        name,
        address,
        success: false,
        actions: [],
        error: null,
    };

    try {
        // 通用 AccessControl ABI
        const accessControlAbi = [
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "function grantRole(bytes32 role, address account)",
            "function revokeRole(bytes32 role, address account)",
            "function getRoleAdmin(bytes32 role) view returns (bytes32)",
            "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
            "function ADMIN_ROLE() view returns (bytes32)",
            "function ORACLE_ROLE() view returns (bytes32)",
            "function OPERATOR_ROLE() view returns (bytes32)",
            "function COMPLIANCE_ENGINE_ROLE() view returns (bytes32)",
            "function RULE_MANAGER_ROLE() view returns (bytes32)",
        ];

        const contract = new ethers.Contract(address, accessControlAbi, deployer);

        // 获取合约实际的角色定义
        let roleNames = ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE"];
        const actualRoles = {};

        for (const roleName of roleNames) {
            try {
                if (roleName === "DEFAULT_ADMIN_ROLE") {
                    actualRoles[roleName] = ethers.ZeroHash;
                } else {
                    actualRoles[roleName] = await contract[roleName]();
                }
            } catch (e) {
                // 角色不存在，跳过
                continue;
            }
        }

        // 检查 deployer 是否拥有这些角色
        const rolesToTransfer = [];
        for (const [roleName, roleHash] of Object.entries(actualRoles)) {
            const hasRole = await contract.hasRole(roleHash, deployer.address);
            if (hasRole) {
                rolesToTransfer.push({ name: roleName, hash: roleHash });
            }
        }

        if (rolesToTransfer.length === 0) {
            console.log(`  ℹ️  Deployer has no admin roles on ${name}`);
            result.success = true;
            return result;
        }

        console.log(`  Found ${rolesToTransfer.length} role(s) to transfer:`);
        rolesToTransfer.forEach(r => console.log(`    - ${r.name}: ${r.hash}`));

        if (dryRun) {
            console.log(`  📝 DRY RUN: Would grant ${rolesToTransfer.length} role(s) to Safe`);
            result.success = true;
            return result;
        }

        // 执行转移：先授予 Safe 角色，再撤销 deployer 的角色
        for (const role of rolesToTransfer) {
            // 1. 授予 Safe
            console.log(`  Granting ${role.name} to Safe...`);
            const grantTx = await contract.grantRole(role.hash, safeAddress);
            await grantTx.wait();
            result.actions.push({ type: "grantRole", role: role.name, tx: grantTx.hash });
            console.log(`    ✅ Granted (tx: ${grantTx.hash})`);

            // 2. 验证 Safe 已获得角色
            const safeHasRole = await contract.hasRole(role.hash, safeAddress);
            if (!safeHasRole) {
                throw new Error(`Safe does not have ${role.name} after grant`);
            }

            // 3. 撤销 deployer（DEFAULT_ADMIN_ROLE 最后撤销，避免中间状态失去权限）
            if (role.name !== "DEFAULT_ADMIN_ROLE") {
                console.log(`  Revoking ${role.name} from deployer...`);
                const revokeTx = await contract.revokeRole(role.hash, deployer.address);
                await revokeTx.wait();
                result.actions.push({ type: "revokeRole", role: role.name, tx: revokeTx.hash });
                console.log(`    ✅ Revoked (tx: ${revokeTx.hash})`);
            }
        }

        // 最后撤销 DEFAULT_ADMIN_ROLE
        const adminRole = rolesToTransfer.find(r => r.name === "DEFAULT_ADMIN_ROLE");
        if (adminRole) {
            console.log(`  Revoking DEFAULT_ADMIN_ROLE from deployer...`);
            const revokeTx = await contract.revokeRole(adminRole.hash, deployer.address);
            await revokeTx.wait();
            result.actions.push({ type: "revokeRole", role: "DEFAULT_ADMIN_ROLE", tx: revokeTx.hash });
            console.log(`    ✅ Revoked (tx: ${revokeTx.hash})`);
        }

        result.success = true;
    } catch (error) {
        result.error = error.message;
        console.error(`  ❌ Failed: ${error.message}`);
    }

    return result;
}

// ─── 执行 ─────────────────────────────────────────────────────────
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
