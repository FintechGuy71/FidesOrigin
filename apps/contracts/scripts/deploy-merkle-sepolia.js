/**
 * Deploy MerkleRiskRegistryFacet and add to Diamond
 *
 * Usage (sepolia):
 *   ADMIN_PRIVATE_KEY=0x... SEPOLIA_RPC=... npx hardhat run scripts/deploy-merkle-sepolia.js --network sepolia
 *
 * Usage (local):
 *   npx hardhat run scripts/deploy-merkle-sepolia.js --network hardhat
 */

const { ethers } = require("hardhat");
const fs = require("fs");

// ─── Config ──────────────────────────────────────────────────────────

// Diamond address (replace with actual deployed Diamond)
const DIAMOND_SEPOLIA = process.env.DIAMOND_ADDRESS || "";

// Initial Merkle Root (bytes32 zero = no initial root, must be set by admin)
const INITIAL_MERKLE_ROOT = process.env.INITIAL_MERKLE_ROOT || "0x0000000000000000000000000000000000000000000000000000000000000000";

// ─── helpers ─────────────────────────────────────────────────────────

function getSelectors(artifact) {
    const iface = new ethers.Interface(artifact.abi);
    const result = [];
    for (const frag of iface.fragments) {
        if (frag.type !== "function") continue;
        if (frag.name === "initialize") continue;
        result.push({ selector: frag.selector, name: frag.name });
    }
    return result;
}

// ─── main ────────────────────────────────────────────────────────────

async function main() {
    const [signer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const isLocal = network.chainId === 31337n;

    console.log("═══════════════════════════════════════");
    console.log("  MerkleRiskRegistryFacet Deployment");
    console.log("═══════════════════════════════════════");
    console.log("Network:", network.name || `chainId=${network.chainId}`);
    console.log("Signer:", signer.address);
    console.log("");

    // ── Resolve Diamond address ─────────────────────────────────────
    let diamondAddr;
    if (isLocal) {
        // Try to load from local deployment record
        const recordPath = "deployments/hardhat-v3.0.3-diamond.json";
        if (fs.existsSync(recordPath)) {
            const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
            diamondAddr = record.diamond;
            console.log("Loaded Diamond from deployment record:", diamondAddr);
        } else {
            console.error("❌ No Diamond deployment found. Deploy Diamond first.");
            process.exit(1);
        }
    } else {
        if (!DIAMOND_SEPOLIA) {
            console.error("❌ DIAMOND_ADDRESS not set. Pass via env var.");
            process.exit(1);
        }
        diamondAddr = DIAMOND_SEPOLIA;
    }
    console.log("Target Diamond:", diamondAddr);
    console.log("");

    // ── Step 1: Deploy MerkleRiskRegistryFacet ──────────────────────
    console.log("Deploying MerkleRiskRegistryFacet...");
    const FacetFactory = await ethers.getContractFactory("MerkleRiskRegistryFacet");
    const facet = await FacetFactory.deploy();
    await facet.waitForDeployment();
    const facetAddr = await facet.getAddress();
    console.log("✅ MerkleRiskRegistryFacet deployed:", facetAddr);
    console.log("");

    // ── Step 2: Build facet cut ─────────────────────────────────────
    const artifactPath = "artifacts/contracts/facets/MerkleRiskRegistryFacet.sol/MerkleRiskRegistryFacet.json";
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const selectors = getSelectors(artifact);

    console.log("Facet selectors to add:");
    for (const s of selectors) {
        console.log(`  ${s.selector}  ${s.name}`);
    }
    console.log(`Total: ${selectors.length} selectors`);
    console.log("");

    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const cut = [{
        facetAddress: facetAddr,
        action: FacetCutAction.Add,
        functionSelectors: selectors.map((s) => s.selector),
    }];

    // ── Step 3: Execute diamondCut ──────────────────────────────────
    console.log("Executing diamondCut...");

    // DiamondCut ABI
    const diamondCutAbi = [
        "function diamondCut(tuple(address facetAddress,uint8 action,bytes4[] functionSelectors)[] calldata _diamondCut,address _init,bytes calldata _calldata) external",
    ];
    const diamondCut = new ethers.Contract(diamondAddr, diamondCutAbi, signer);

    const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("✅ Diamond cut executed successfully");
    console.log("");

    // ── Step 4: Initialize Merkle Root (if non-zero) ────────────────
    if (INITIAL_MERKLE_ROOT !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log("Initializing Merkle Root...");
        const merkleFacet = new ethers.Contract(
            diamondAddr,
            artifact.abi,
            signer
        );
        const initTx = await merkleFacet.updateMerkleRoot(INITIAL_MERKLE_ROOT);
        await initTx.wait();
        console.log("✅ Merkle Root initialized");
    } else {
        console.log("⚠️  Initial Merkle Root is zero — must be set by admin later");
    }
    console.log("");

    // ── Step 5: Verify ──────────────────────────────────────────────
    console.log("═══════════════════════════════════════");
    console.log("  Verification");
    console.log("═══════════════════════════════════════");

    const loupeAbi = [
        "function facets() external view returns (tuple(address,bytes4[])[])",
    ];
    const loupe = new ethers.Contract(diamondAddr, loupeAbi, signer);
    const facetList = await loupe.facets();

    let found = false;
    for (const f of facetList) {
        const addr = f[0];
        const sels = f[1];
        if (addr.toLowerCase() === facetAddr.toLowerCase()) {
            console.log(`✅ MerkleRiskRegistryFacet registered with ${sels.length} selectors`);
            found = true;
            break;
        }
    }
    if (!found) {
        console.error("❌ Facet not found in Diamond");
        process.exit(1);
    }

    // ── Step 6: Save deployment record ──────────────────────────────
    const record = {
        network: isLocal ? "hardhat" : "sepolia",
        chainId: Number(network.chainId),
        timestamp: new Date().toISOString(),
        deployer: signer.address,
        diamond: diamondAddr,
        merkleFacet: facetAddr,
        initialMerkleRoot: INITIAL_MERKLE_ROOT,
        selectors: selectors.map((s) => ({ selector: s.selector, name: s.name })),
    };

    const deploymentsDir = "deployments";
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
    const recordPath = `${deploymentsDir}/${isLocal ? "hardhat" : "sepolia"}-merkle-facet.json`;
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    console.log(`\n📋 Deployment record saved: ${recordPath}`);
    console.log("\n✅ MerkleRiskRegistryFacet Deployment Complete!");
    console.log(`   Diamond: ${diamondAddr}`);
    console.log(`   Facet: ${facetAddr}`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("❌ Deployment failed:", e);
        process.exit(1);
    });
