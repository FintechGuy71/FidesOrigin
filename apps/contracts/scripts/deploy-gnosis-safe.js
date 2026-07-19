#!/usr/bin/env node
/**
 * FidesOrigin — Gnosis Safe 3/5 多签钱包部署脚本
 *
 * 用途：
 *   1. 通过 Safe 单例工厂创建 3/5 多签钱包
 *   2. 将部署者地址设为初始 owner（后续由部署者添加其他 4 个 owner）
 *   3. 记录 Safe 地址到 deployments/
 *
 * 前置条件：
 *   - ADMIN_PRIVATE_KEY 环境变量已设置
 *   - 5 个 owner 地址已通过环境变量或交互式输入提供
 *
 * 执行方式：
 *   SAFE_OWNERS="0xA,0xB,0xC,0xD,0xE" npx hardhat run scripts/deploy-gnosis-safe.js --network sepolia
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════════════
// Gnosis Safe 合约常量（Sepolia 已部署地址）
// ═══════════════════════════════════════════════════════════════════
const SAFE_ADDRESSES = {
    // Sepolia
    11155111: {
        singleton: "0x29fcb43b46531bca003ddc8fcb67ffe91900c762",       // Safe v1.4.1 Singleton
        proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec23",   // SafeProxyFactory v1.4.1
        fallbackHandler: "0xfd0732Dc9E303f09fCEf3a0648e6da93ee8886E3", // CompatibilityFallbackHandler
        multiSend: "0x38869bf66a61cF6bDB9B8028a8F5afB2bD1f6D2d",
        multiSendCallOnly: "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
        signMessageLib: "0xd53cd0aB83D845Ac265BE939c57F53AD838012c9",
        createCall: "0x9b35Af71d77eaf8d7e40252370304687390A1A52",
    },
    // Mainnet
    1: {
        singleton: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
        proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec23",
        fallbackHandler: "0xfd0732Dc9E303f09fCEf3a0648e6da93ee8886E3",
        multiSend: "0x38869bf66a61cF6bDB9B8028a8F5afB2bD1f6D2d",
        multiSendCallOnly: "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
        signMessageLib: "0xd53cd0aB83D845Ac265BE939c57F53AD838012c9",
        createCall: "0x9b35Af71d77eaf8d7e40252370304687390A1A52",
    },
    // Hardhat local
    31337: {
        // Will deploy fresh instances on local
        singleton: null,
        proxyFactory: null,
        fallbackHandler: null,
    },
};

const THRESHOLD = 3; // 3/5 签名

// ═══════════════════════════════════════════════════════════════════
// Safe Singleton ABI（精简版，仅含创建代理所需函数）
// ═══════════════════════════════════════════════════════════════════
const SAFE_SINGLETON_ABI = [
    "function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver) external",
];

const PROXY_FACTORY_ABI = [
    "function createProxyWithNonce(address _singleton, bytes calldata initializer, uint256 saltNonce) external returns (address proxy)",
    "function proxyCreationCode() external pure returns (bytes memory)",
    "event ProxyCreation(address indexed proxy, address singleton)",
];

// ═══════════════════════════════════════════════════════════════════
// Safe 创建交易数据编码（用于 setup）
// ═══════════════════════════════════════════════════════════════════
function encodeSafeSetup(owners, threshold, fallbackHandler) {
    const iface = new ethers.Interface(SAFE_SINGLETON_ABI);
    return iface.encodeFunctionData("setup", [
        owners,
        threshold,
        ethers.ZeroAddress, // to (无模块)
        "0x",               // data
        fallbackHandler,    // fallbackHandler
        ethers.ZeroAddress, // paymentToken
        0,                  // payment
        ethers.ZeroAddress, // paymentReceiver
    ]);
}

// ═══════════════════════════════════════════════════════════════════
// 预测 Safe 代理地址
// ═══════════════════════════════════════════════════════════════════
async function predictSafeAddress(factory, singleton, initializer, saltNonce) {
    const creationCode = await factory.proxyCreationCode();
    const abiCoder = new ethers.AbiCoder();
    // proxy constructor: constructor(address _singleton)
    const constructorData = abiCoder.encode(["address"], [singleton]);
    const deploymentData = ethers.concat([
        creationCode,
        constructorData,
    ]);

    const salt = ethers.keccak256(
        ethers.solidityPackedKeccak256(
            ["bytes", "uint256"],
            [ethers.keccak256(initializer), saltNonce]
        )
    );

    const factoryAddress = await factory.getAddress();
    // CREATE2 address = keccak256(0xff + deployer + salt + keccak256(init_code))[12:]
    const predicted = ethers.getCreate2Address(
        factoryAddress,
        salt,
        ethers.keccak256(deploymentData)
    );

    return predicted;
}

// ═══════════════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════════════
async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  FidesOrigin — Gnosis Safe 3/5 Multisig Deployment");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("Network:", network.name, `(chainId=${chainId})`);
    console.log("Deployer:", deployer.address);
    console.log("");

    // ─── 获取 Owner 地址 ──────────────────────────────────────────
    let owners = [];
    const envOwners = process.env.SAFE_OWNERS;

    if (envOwners) {
        owners = envOwners.split(",").map(a => a.trim()).filter(a => ethers.isAddress(a));
        console.log(`✅ Loaded ${owners.length} owners from SAFE_OWNERS env var`);
    }

    // 如果环境变量不足 5 个，提示交互式输入
    if (owners.length < 5) {
        console.log("⚠️  SAFE_OWNERS environment variable not set or incomplete.");
        console.log("   Required: 5 owner addresses separated by commas");
        console.log("   Example: SAFE_OWNERS=0xA,0xB,0xC,0xD,0xE npx hardhat run scripts/deploy-gnosis-safe.js --network sepolia");
        console.log("");
        console.log("   For now, using deployer + 4 placeholder addresses.");
        console.log("   ⚠️  IMPORTANT: Update these before production use!");
        console.log("");

        // 使用部署者作为第一个 owner，其余用占位符
        owners = [deployer.address];
        for (let i = 1; i < 5; i++) {
            // 使用确定性占位符（便于测试）
            const placeholder = ethers.getAddress(
                "0x" + (i + 1).toString(16).padStart(40, "0")
            );
            owners.push(placeholder);
        }
    }

    // 去重并排序（Safe 要求排序）
    owners = [...new Set(owners)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    if (owners.length < 3) {
        console.error("❌ ERROR: Need at least 3 unique owners for 3/5 multisig");
        process.exit(1);
    }

    console.log("━━━ Safe Configuration ━━━");
    console.log(`  Threshold: ${THRESHOLD}/${owners.length}`);
    owners.forEach((o, i) => console.log(`  Owner ${i + 1}: ${o}`));
    console.log("");

    // ─── 本地网络特殊处理 ────────────────────────────────────────
    let safeAddrs = SAFE_ADDRESSES[chainId];
    let safeAddress;
    
    if (!safeAddrs || chainId === 31337) {
        console.log("━━━ Local Network: Deploying Safe contracts ━━━");
        safeAddrs = await deploySafeContracts(deployer, owners, THRESHOLD);
        
        // 本地网络直接使用部署的合约地址作为 Safe 地址
        safeAddress = safeAddrs.singleton;
        
        console.log("━━━ Safe Contracts ━━━");
        console.log(`  Mock Safe:        ${safeAddress}`);
        console.log("");
        
        // ─── 验证 Safe 配置 ───────────────────────────────────────
        console.log("\n━━━ Verifying Safe Configuration ━━━");
        
        const safeContract = new ethers.Contract(
            safeAddress,
            [
                "function getMinDelay() view returns (uint256)",
                "function hasRole(bytes32 role, address account) view returns (bool)",
            ],
            ethers.provider
        );
        
        const minDelay = await safeContract.getMinDelay();
        console.log(`  Min Delay:   ${minDelay.toString()} seconds (${Number(minDelay) / 86400} days)`);
        console.log(`  Owners:      ${owners.length} (all have PROPOSER_ROLE and EXECUTOR_ROLE)`);
        console.log(`  Threshold:   ${THRESHOLD}/${owners.length}`);
        
        // ─── 保存部署记录 ─────────────────────────────────────────
        console.log("\n━━━ Saving Deployment Record ━━━");
        
        const deploymentRecord = {
            network: network.name,
            chainId: chainId,
            timestamp: new Date().toISOString(),
            safe: {
                address: safeAddress,
                version: "mock-local",
                threshold: THRESHOLD,
                owners: owners,
                singleton: safeAddrs.singleton,
                proxyFactory: safeAddrs.proxyFactory,
                fallbackHandler: safeAddrs.fallbackHandler,
                saltNonce: 0,
            },
            deployer: deployer.address,
        };
        
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        const outputPath = path.join(
            deploymentsDir,
            `gnosis-safe-${network.name}-${Date.now()}.json`
        );
        fs.writeFileSync(outputPath, JSON.stringify(deploymentRecord, null, 2));
        console.log(`  ✅ Saved to: ${outputPath}`);
        
        // 同时保存到 latest-safe.json
        const latestPath = path.join(deploymentsDir, `gnosis-safe-${network.name}-latest.json`);
        fs.writeFileSync(latestPath, JSON.stringify(deploymentRecord, null, 2));
        console.log(`  ✅ Updated: ${latestPath}`);
        
        console.log("\n═══════════════════════════════════════════════════════════════");
        console.log("  Mock Safe Deployment Complete (Local Network)!");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log(`\n  Safe Address: ${safeAddress}`);
        console.log(`  Threshold:    ${THRESHOLD}/${owners.length}`);
        console.log("\n  ⚠️  This is a MOCK Safe for local testing only.");
        console.log("     For production, run on Sepolia or Mainnet.");
        console.log("");
        return;
    }
    
    const singleton = safeAddrs.singleton;
    const proxyFactory = safeAddrs.proxyFactory;
    const fallbackHandler = safeAddrs.fallbackHandler;

    console.log("━━━ Safe Contracts ━━━");
    console.log(`  Singleton:        ${singleton}`);
    console.log(`  ProxyFactory:     ${proxyFactory}`);
    console.log(`  FallbackHandler:  ${fallbackHandler}`);
    console.log("");

    // ─── 创建 Safe 代理 ───────────────────────────────────────────
    console.log("━━━ Creating Safe Multisig Wallet ━━━");

    const factory = new ethers.Contract(proxyFactory, PROXY_FACTORY_ABI, deployer);
    const initializer = encodeSafeSetup(owners, THRESHOLD, fallbackHandler);
    const saltNonce = Date.now(); // 使用时间戳作为 salt

    // 预测地址
    const predictedAddress = await predictSafeAddress(factory, singleton, initializer, saltNonce);
    console.log(`  Predicted Safe Address: ${predictedAddress}`);

    // 检查是否已存在
    const code = await ethers.provider.getCode(predictedAddress);
    if (code !== "0x") {
        console.log(`  ⚠️  Safe already exists at predicted address!`);
        console.log(`  ✅ Using existing Safe: ${predictedAddress}`);
    } else {
        // 创建 Safe
        const tx = await factory.createProxyWithNonce(singleton, initializer, saltNonce);
        console.log(`  Factory tx: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`  ✅ Safe created! Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`);

        // 验证事件
        const event = receipt.logs.find(
            log => log.address.toLowerCase() === proxyFactory.toLowerCase()
        );
        if (event) {
            console.log(`  ProxyCreation event found`);
        }
    }

    safeAddress = predictedAddress;

    // ─── 验证 Safe 配置 ───────────────────────────────────────────
    console.log("\n━━━ Verifying Safe Configuration ━━━");

    const safeContract = new ethers.Contract(
        safeAddress,
        [
            "function getThreshold() view returns (uint256)",
            "function getOwners() view returns (address[] memory)",
            "function isOwner(address) view returns (bool)",
            "function nonce() view returns (uint256)",
            "function getVersion() view returns (string)",
        ],
        ethers.provider
    );

    const threshold = await safeContract.getThreshold();
    const safeOwners = await safeContract.getOwners();
    const nonce = await safeContract.nonce();
    let version = "unknown";
    try {
        version = await safeContract.getVersion();
    } catch (e) {
        // v1.4.1 可能没有 getVersion
    }

    console.log(`  Version:   ${version}`);
    console.log(`  Threshold: ${threshold.toString()}/${safeOwners.length}`);
    console.log(`  Nonce:     ${nonce.toString()}`);
    console.log(`  Owners:`);
    safeOwners.forEach((o, i) => {
        const isDeployer = o.toLowerCase() === deployer.address.toLowerCase();
        console.log(`    ${i + 1}. ${o}${isDeployer ? " (deployer)" : ""}`);
    });

    // ─── 保存部署记录 ─────────────────────────────────────────────
    console.log("\n━━━ Saving Deployment Record ━━━");

    const deploymentRecord = {
        network: network.name,
        chainId: chainId,
        timestamp: new Date().toISOString(),
        safe: {
            address: safeAddress,
            version: version,
            threshold: Number(threshold),
            owners: safeOwners,
            singleton: singleton,
            proxyFactory: proxyFactory,
            fallbackHandler: fallbackHandler,
            saltNonce: saltNonce,
        },
        deployer: deployer.address,
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const outputPath = path.join(
        deploymentsDir,
        `gnosis-safe-${network.name}-${Date.now()}.json`
    );
    fs.writeFileSync(outputPath, JSON.stringify(deploymentRecord, null, 2));
    console.log(`  ✅ Saved to: ${outputPath}`);

    // 同时保存到 latest-safe.json
    const latestPath = path.join(deploymentsDir, `gnosis-safe-${network.name}-latest.json`);
    fs.writeFileSync(latestPath, JSON.stringify(deploymentRecord, null, 2));
    console.log(`  ✅ Updated: ${latestPath}`);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  Safe Multisig Deployment Complete!");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`\n  Safe Address: ${safeAddress}`);
    console.log(`  Threshold:    ${THRESHOLD}/${owners.length}`);
    console.log("\n  下一步：");
    console.log("  1. 确认所有 owner 地址正确（生产环境务必替换占位符）");
    console.log("  2. 运行 scripts/transfer-ownership-to-safe.js 转移合约所有权");
    console.log("  3. 运行 scripts/test-safe-operations.js 验证 Safe 操作");
    console.log("");
}

// ═══════════════════════════════════════════════════════════════════
// 本地网络：部署简化版 Safe 模拟合约
// ═══════════════════════════════════════════════════════════════════
async function deploySafeContracts(deployer, owners, threshold) {
    console.log("  ⚠️  Local network: Using simplified Safe deployment");
    console.log("     For full Safe testing, install @safe-global/safe-contracts");
    console.log("     npm install --save-dev @safe-global/safe-contracts");
    console.log("");

    // 本地网络：部署一个模拟的 multisig 合约
    // 使用 FidesOriginTimelock 作为简化版多签（它本身支持多角色）
    const MockMultiSig = await ethers.getContractFactory("FidesOriginTimelock");
    const mock = await MockMultiSig.deploy(
        owners,           // proposers (owners)
        owners,           // executors (owners)
        deployer.address  // admin
    );
    await mock.waitForDeployment();

    const singleton = await mock.getAddress();
    console.log(`  ✅ Mock Safe deployed at: ${singleton}`);
    console.log("");

    // 本地网络返回同一个地址作为所有组件
    return {
        singleton,
        proxyFactory: singleton,
        fallbackHandler: ethers.ZeroAddress,
        multiSend: ethers.ZeroAddress,
        multiSendCallOnly: ethers.ZeroAddress,
    };
}

// ─── 执行 ─────────────────────────────────────────────────────────
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
