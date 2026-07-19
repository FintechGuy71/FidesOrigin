#!/usr/bin/env node
/**
 * FidesOrigin — Etherscan 验证自动化脚本
 *
 * 用途：自动读取 deployments/sepolia-latest.json，逐个验证所有合约（proxy + implementation）
 *
 * 特性：
 *   1. 自动读取部署记录
 *   2. 逐个验证所有合约（proxy + implementation）
 *   3. 处理验证失败重试（指数退避）
 *   4. 生成验证报告
 *
 * 前置条件：
 *   - ETHERSCAN_API_KEY 环境变量已设置
 *   - 合约已编译（npx hardhat compile）
 *
 * 执行方式：
 *   ETHERSCAN_API_KEY=... npx hardhat run scripts/verify-all-sepolia.js --network sepolia
 *
 * 参数：
 *   DRY_RUN=true          # 仅打印验证命令，不执行
 *   MAX_RETRIES=3         # 每个合约最大重试次数（默认 3）
 *   RETRY_DELAY=30        # 初始重试延迟秒数（默认 30）
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════════
const DRY_RUN = process.env.DRY_RUN === "true";
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3", 10);
const INITIAL_RETRY_DELAY = parseInt(process.env.RETRY_DELAY || "30", 10);
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// ═══════════════════════════════════════════════════════════════════
// 读取部署记录
// ═══════════════════════════════════════════════════════════════════
function loadDeploymentRecord() {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const latestPath = path.join(deploymentsDir, "sepolia-latest.json");

    if (!fs.existsSync(latestPath)) {
        throw new Error(`Deployment record not found: ${latestPath}`);
    }

    return JSON.parse(fs.readFileSync(latestPath, "utf-8"));
}

// ═══════════════════════════════════════════════════════════════════
// 构建验证命令
// ═══════════════════════════════════════════════════════════════════
function buildVerifyCommand(contractName, address, args, isProxy = false) {
    const network = "sepolia";

    if (isProxy) {
        // UUPS Proxy 验证
        return `npx hardhat verify --network ${network} ${address}`;
    }

    // Implementation 验证（需要构造函数参数）
    if (args && args.length > 0) {
        // 将参数格式化为硬hat verify 格式
        const formattedArgs = args.map(arg => {
            if (typeof arg === "string" && arg.startsWith("0x") && arg.length === 42) {
                return `"${arg}"`;
            }
            if (typeof arg === "string") {
                return `"${arg}"`;
            }
            if (typeof arg === "boolean") {
                return arg.toString();
            }
            if (typeof arg === "number") {
                return arg.toString();
            }
            return JSON.stringify(arg);
        }).join(" ");

        return `npx hardhat verify --network ${network} ${address} ${formattedArgs}`;
    }

    return `npx hardhat verify --network ${network} ${address}`;
}

// ═══════════════════════════════════════════════════════════════════
// 执行验证命令（带重试）
// ═══════════════════════════════════════════════════════════════════
async function verifyWithRetry(contractName, address, args, isProxy) {
    const command = buildVerifyCommand(contractName, address, args, isProxy);
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n  Attempt ${attempt}/${MAX_RETRIES}: ${contractName}`);
        console.log(`  Command: ${command}`);

        if (DRY_RUN) {
            console.log(`  📝 DRY RUN: Would execute above command`);
            return { success: true, command, attempt, dryRun: true };
        }

        try {
            const output = execSync(command, {
                cwd: path.join(__dirname, ".."),
                encoding: "utf-8",
                timeout: 120000, // 2 分钟超时
                stdio: ["pipe", "pipe", "pipe"],
            });

            // 检查输出中的成功/失败标志
            if (output.includes("Successfully submitted") || output.includes("already verified")) {
                console.log(`  ✅ ${isProxy ? "Proxy" : "Implementation"} verified!`);
                return { success: true, command, attempt, output };
            }

            console.log(`  Output: ${output.substring(0, 500)}`);
            return { success: true, command, attempt, output };
        } catch (error) {
            lastError = error;
            const stderr = error.stderr ? error.stderr.toString() : error.message;

            // 已验证过
            if (stderr.includes("already verified") || stderr.includes("Already Verified")) {
                console.log(`  ✅ Already verified!`);
                return { success: true, command, attempt, alreadyVerified: true };
            }

            // 合约源码未找到（需要等区块确认）
            if (stderr.includes("does not have bytecode") || stderr.includes("Contract source code not verified")) {
                console.log(`  ⏳ Contract not yet confirmed on Etherscan, waiting...`);
            } else {
                console.log(`  ❌ Error: ${stderr.substring(0, 300)}`);
            }

            if (attempt < MAX_RETRIES) {
                const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
                console.log(`  Retrying in ${delay} seconds...`);
                await sleep(delay * 1000);
            }
        }
    }

    return { success: false, command, attempts: MAX_RETRIES, error: lastError?.message || "Unknown error" };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════════════
async function main() {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  FidesOrigin — Etherscan Verification Automation");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`Network: sepolia`);
    console.log(`Max Retries: ${MAX_RETRIES}`);
    console.log(`Retry Delay: ${INITIAL_RETRY_DELAY}s (exponential backoff)`);
    console.log(`Dry Run: ${DRY_RUN}`);
    console.log("");

    if (!ETHERSCAN_API_KEY && !DRY_RUN) {
        console.error("❌ ERROR: ETHERSCAN_API_KEY environment variable required");
        console.error("   Get API key from: https://etherscan.io/myapikey");
        process.exit(1);
    }

    // ─── 读取部署记录 ─────────────────────────────────────────────
    const deployment = loadDeploymentRecord();
    console.log(`Loaded deployment: ${deployment.version || "unknown"} (${deployment.timestamp})`);
    console.log("");

    const verificationTasks = [];
    const results = [];

    // ─── 收集需要验证的合约 ───────────────────────────────────────
    console.log("━━━ Collecting Verification Tasks ━━━\n");

    // 1. UUPS Proxy 合约（验证 proxy 本身 + implementation）
    if (deployment.upgrades) {
        for (const [name, info] of Object.entries(deployment.upgrades)) {
            if (info.status === "failed") {
                console.log(`  ⚠️  ${name}: Upgrade failed, skipping`);
                continue;
            }

            if (info.proxy) {
                verificationTasks.push({
                    name: `${name} (Proxy)`,
                    contractName: name,
                    address: info.proxy,
                    args: null,
                    isProxy: true,
                });
            }

            if (info.newImpl) {
                // 从部署记录推断构造函数参数
                const args = inferConstructorArgs(name, deployment);
                verificationTasks.push({
                    name: `${name} (Implementation)`,
                    contractName: name,
                    address: info.newImpl,
                    args,
                    isProxy: false,
                });
            } else if (info.implementation) {
                const args = inferConstructorArgs(name, deployment);
                verificationTasks.push({
                    name: `${name} (Implementation - Legacy)`,
                    contractName: name,
                    address: info.implementation,
                    args,
                    isProxy: false,
                });
            }
        }
    }

    // 2. 直接部署的合约
    if (deployment.contracts) {
        for (const [name, info] of Object.entries(deployment.contracts)) {
            if (info.status === "failed" || !info.address) {
                continue;
            }

            verificationTasks.push({
                name,
                contractName: name,
                address: info.address,
                args: info.args || null,
                isProxy: false,
            });
        }
    }

    // 3. 兼容旧格式的部署记录
    const legacyNames = ["RiskRegistry", "PolicyEngine", "ComplianceEngine", "QuarantineVault", "FidesCompliance", "CompliantStableCoin"];
    for (const name of legacyNames) {
        if (deployment[name]) {
            const info = deployment[name];
            const addr = info.proxy || info.address;
            if (addr && !verificationTasks.some(t => t.address === addr)) {
                verificationTasks.push({
                    name,
                    contractName: name,
                    address: addr,
                    args: info.args || null,
                    isProxy: !!info.proxy,
                });
            }
        }
    }

    console.log(`Total tasks: ${verificationTasks.length}`);
    verificationTasks.forEach(t => {
        console.log(`  - ${t.name}: ${t.address} ${t.isProxy ? "[Proxy]" : ""}`);
    });
    console.log("");

    // ─── 执行验证 ─────────────────────────────────────────────────
    console.log("━━━ Starting Verification ━━━\n");

    for (let i = 0; i < verificationTasks.length; i++) {
        const task = verificationTasks[i];
        console.log(`[${i + 1}/${verificationTasks.length}] Verifying ${task.name}`);

        const result = await verifyWithRetry(task.contractName, task.address, task.args, task.isProxy);
        results.push({
            name: task.name,
            address: task.address,
            ...result,
        });

        // 每个合约之间稍作延迟，避免触发 API 速率限制
        if (i < verificationTasks.length - 1 && !DRY_RUN) {
            console.log("  Waiting 5 seconds before next verification...");
            await sleep(5000);
        }
    }

    // ─── 生成报告 ─────────────────────────────────────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Verification Report");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    results.forEach(r => {
        const icon = r.success ? "✅" : "❌";
        const status = r.alreadyVerified ? "(already verified)" : r.dryRun ? "(dry run)" : "";
        console.log(`  ${icon} ${r.name}: ${r.address} ${status}`);
        if (!r.success) {
            console.log(`     Error: ${r.error?.substring(0, 200)}`);
        }
    });

    console.log("");
    console.log(`  Total:      ${results.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed:     ${failed.length}`);

    // ─── 保存报告 ─────────────────────────────────────────────────
    const report = {
        network: "sepolia",
        timestamp: new Date().toISOString(),
        dryRun: DRY_RUN,
        summary: {
            total: results.length,
            successful: successful.length,
            failed: failed.length,
        },
        results: results.map(r => ({
            name: r.name,
            address: r.address,
            success: r.success,
            attempts: r.attempt || r.attempts || 1,
            alreadyVerified: r.alreadyVerified || false,
            dryRun: r.dryRun || false,
            error: r.error || null,
        })),
    };

    const reportPath = path.join(__dirname, "..", "deployments", `verify-report-sepolia-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved to: ${reportPath}`);

    if (failed.length > 0) {
        console.log("\n❌ Some verifications failed. Check the report for details.");
        console.log("   You can re-run with higher MAX_RETRIES or verify manually.");
        process.exit(1);
    }

    console.log("\n✅ All contracts verified successfully!");
}

// ═══════════════════════════════════════════════════════════════════
// 推断构造函数参数
// ═══════════════════════════════════════════════════════════════════
function inferConstructorArgs(contractName, deployment) {
    // 从部署记录中推断特定合约的构造函数参数
    // 这些基于合约的构造函数签名

    const contracts = deployment.contracts || {};
    const info = contracts[contractName];

    if (info && info.args && info.args.length > 0) {
        return info.args;
    }

    // 基于合约类型的默认参数推断
    switch (contractName) {
        case "FidesCompliance":
            return [
                deployment.upgrades?.ComplianceEngine?.proxy || deployment.ComplianceEngine?.proxy || "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC",
                deployment.upgrades?.RiskRegistry?.proxy || deployment.RiskRegistry?.proxy || "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
                deployment.upgrades?.PolicyEngine?.proxy || deployment.PolicyEngine?.proxy || "0x87089F67A61F9643796AE154663A6a9F21196b38",
                contracts.QuarantineVault?.address || "0x497176b21CC2EDd90a8725a3023742358311a382",
            ];
        case "QuarantineVault":
            return [];
        case "CompliantStableCoin":
            return [
                "FidesOrigin USD",
                "fUSD",
                deployment.upgrades?.ComplianceEngine?.proxy || deployment.ComplianceEngine?.proxy || "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC",
            ];
        default:
            return null;
    }
}

// ─── 执行 ─────────────────────────────────────────────────────────
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
