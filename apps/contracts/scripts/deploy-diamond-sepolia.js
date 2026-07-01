/**
 * Deploy DiamondComplianceEngine
 *
 * Supports both local Hardhat and Sepolia deployment.
 *
 * Usage (local):
 *   npx hardhat run scripts/deploy-diamond-sepolia.js --network hardhat
 *
 * Usage (sepolia):
 *   ADMIN_PRIVATE_KEY=0x... SEPOLIA_RPC=... npx hardhat run scripts/deploy-diamond-sepolia.js --network sepolia
 *
 * Key fixes:
 *   1. Selector computation uses ethers v6 FunctionFragment.selector (correct for tuple/struct types)
 *   2. Global de-duplication across facets (OZ AccessControl/Pausable shared functions)
 *   3. Local Hardhat: deploys mock RiskRegistry + PolicyEngine so initialize() passes code.length check
 */

const { ethers } = require("hardhat");

// Existing contracts on Sepolia (ignored on local Hardhat — fresh mocks are deployed)
const RISK_REGISTRY_SEPOLIA = "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc";
const POLICY_ENGINE_SEPOLIA = "0x87089F67A61F9643796AE154663A6a9F21196b38";

// ─── helpers ───────────────────────────────────────────────────────────

/**
 * Build a mapping of all unique function selectors for a contract.
 *
 * Uses ethers v6 FunctionFragment.selector which correctly handles
 * tuple / struct parameter types (unlike manual signature concatenation).
 *
 * Skips:
 *   - non-function fragments (constructors, events, errors)
 *   - `initialize` (reserved for diamond init)
 *
 * Returns array of { selector, name } sorted by selector for deterministic ordering.
 */
function getSelectors(artifact) {
    const iface = new ethers.Interface(artifact.abi);
    const result = [];
    for (const frag of iface.fragments) {
        if (frag.type !== "function") continue;
        if (frag.name === "initialize") continue;
        // frag.selector is the canonical 4-byte selector as "0x........"
        result.push({ selector: frag.selector, name: frag.name });
    }
    return result;
}

/**
 * Partition selectors into those already seen (duplicates) and new ones.
 * Mutates `seen` set in place.
 */
function dedupeSelectors(selectorList, seen) {
    const unique = [];
    for (const item of selectorList) {
        if (seen.has(item.selector)) continue;
        seen.add(item.selector);
        unique.push(item);
    }
    return unique;
}

// ─── main ──────────────────────────────────────────────────────────────

async function main() {
    const [signer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const isLocal = network.chainId === 31337n;

    console.log("═══════════════════════════════════════");
    console.log("  DiamondComplianceEngine Deployment");
    console.log("═══════════════════════════════════════");
    console.log("Network:", network.name || `chainId=${network.chainId}`);
    console.log("Signer:", signer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");
    console.log("");

    // ── Resolve dependencies ──────────────────────────────────────────
    let riskRegistryAddr, policyEngineAddr;

    if (isLocal) {
        console.log("Local network detected — deploying mock RiskRegistry + PolicyEngine...");
        const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
        const riskReg = await RiskRegistry.deploy();
        await riskReg.waitForDeployment();
        riskRegistryAddr = await riskReg.getAddress();
        console.log("  ✅ Mock RiskRegistry:", riskRegistryAddr);

        const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
        const polEng = await PolicyEngine.deploy();
        await polEng.waitForDeployment();
        policyEngineAddr = await polEng.getAddress();
        console.log("  ✅ Mock PolicyEngine:", policyEngineAddr);
        console.log("");
    } else {
        riskRegistryAddr = RISK_REGISTRY_SEPOLIA;
        policyEngineAddr = POLICY_ENGINE_SEPOLIA;
        console.log("Using existing Sepolia contracts:");
        console.log("  RiskRegistry:", riskRegistryAddr);
        console.log("  PolicyEngine:", policyEngineAddr);
        console.log("");
    }

    // ── Step 1: Deploy all facets ─────────────────────────────────────
    const facetNames = [
        "DiamondCutFacet",
        "DiamondLoupeFacet",
        "ComplianceCoreFacet",
        "AssetComplianceFacet",
        "WalletComplianceFacet",
        "AdminFacet",
    ];
    const facetAddresses = {};
    const facetArtifacts = {}; // cache artifacts

    const fs = require("fs");

    for (const name of facetNames) {
        const Factory = await ethers.getContractFactory(name);
        const facet = await Factory.deploy();
        await facet.waitForDeployment();
        facetAddresses[name] = await facet.getAddress();
        // Load artifact for selector computation
        const artifactPath = `artifacts/contracts/facets/${name}.sol/${name}.json`;
        facetArtifacts[name] = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        console.log(`✅ ${name}: ${facetAddresses[name]}`);
    }
    console.log("");

    // ── Step 2: Build facet cuts with global de-duplication ───────────
    //
    // Multiple facets inherit OZ AccessControl / Pausable, producing
    // identical selectors (hasRole, grantRole, supportsInterface, paused, …).
    // LibDiamond.addFunctions reverts if a selector already exists, so we
    // must ensure each selector is only added to ONE facet cut.
    //
    // Strategy: process facets in order; first facet wins ownership of
    // any shared selector. Later facets silently skip selectors that are
    // already registered.

    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const globalSeen = new Set(); // tracks selector → facet
    const cuts = [];

    for (const name of facetNames) {
        if (name === "DiamondCutFacet") continue; // handled in constructor initial cut
        const allSelectors = getSelectors(facetArtifacts[name]);
        const unique = dedupeSelectors(allSelectors, globalSeen);
        if (unique.length === 0) {
            console.log(`⚠️  ${name}: all selectors were duplicates, skipping cut`);
            continue;
        }
        console.log(
            `  ${name}: ${unique.length} unique selectors` +
            (allSelectors.length > unique.length
                ? ` (${allSelectors.length - unique.length} duplicates skipped)`
                : "")
        );
        cuts.push({
            facetAddress: facetAddresses[name],
            action: FacetCutAction.Add,
            functionSelectors: unique.map((s) => s.selector),
        });
    }

    // DiamondCutFacet also goes into the initial cut
    const diamondCutSelectors = getSelectors(facetArtifacts["DiamondCutFacet"]);
    dedupeSelectors(diamondCutSelectors, globalSeen);

    const initialCuts = [
        {
            facetAddress: facetAddresses.DiamondCutFacet,
            action: FacetCutAction.Add,
            functionSelectors: diamondCutSelectors.map((s) => s.selector),
        },
        ...cuts,
    ];

    console.log(`\nTotal unique selectors to register: ${globalSeen.size}`);
    console.log("");

    // ── Step 3: Prepare init calldata ─────────────────────────────────
    const adminIface = new ethers.Interface(facetArtifacts["AdminFacet"].abi);
    const initCalldata = adminIface.encodeFunctionData("initialize", [
        riskRegistryAddr,
        policyEngineAddr,
        signer.address,
    ]);
    console.log("Init calldata:", initCalldata);
    console.log("Init contract (AdminFacet):", facetAddresses.AdminFacet);
    console.log("");

    // ── Step 4: Deploy Diamond ────────────────────────────────────────
    console.log("Deploying DiamondComplianceEngine...");
    const Diamond = await ethers.getContractFactory("DiamondComplianceEngine");
    const diamond = await Diamond.deploy(
        signer.address,     // _contractOwner
        initialCuts,        // _diamondCut
        facetAddresses.AdminFacet, // _init
        initCalldata,       // _calldata
        { gasLimit: 5000000 }
    );
    await diamond.waitForDeployment();
    const diamondAddr = await diamond.getAddress();
    console.log("✅ Diamond deployed:", diamondAddr);
    console.log("");

    // ── Step 5: Verify via DiamondLoupe ───────────────────────────────
    console.log("═══════════════════════════════════════");
    console.log("  Verification");
    console.log("═══════════════════════════════════════");

    const loupeAbi = [
        "function facets() external view returns (tuple(address,bytes4[])[])",
        "function facetAddresses() external view returns (address[])",
    ];
    const loupe = new ethers.Contract(diamondAddr, loupeAbi, signer);

    const facetList = await loupe.facets();
    console.log("Registered facets:", facetList.length);
    let totalSelectors = 0;
    for (const f of facetList) {
        const addr = f[0];
        const sels = f[1];
        const label =
            Object.entries(facetAddresses).find(([, a]) => a === addr)?.[0] ||
            "unknown";
        console.log(`  ${label} (${addr}): ${sels.length} selectors`);
        totalSelectors += sels.length;
    }
    console.log(`Total selectors registered on Diamond: ${totalSelectors}`);

    // ── Step 6: Save deployment record ────────────────────────────────
    const record = {
        network: isLocal ? "hardhat" : "sepolia",
        chainId: Number(network.chainId),
        timestamp: new Date().toISOString(),
        deployer: signer.address,
        version: "v3.0.3-diamond",
        diamond: diamondAddr,
        facets: facetAddresses,
        dependencies: {
            RiskRegistry: riskRegistryAddr,
            PolicyEngine: policyEngineAddr,
        },
    };

    const deploymentsDir = "deployments";
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
    const recordPath = `${deploymentsDir}/${isLocal ? "hardhat" : "sepolia"}-v3.0.3-diamond.json`;
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    console.log(`\n📋 Deployment record saved: ${recordPath}`);
    console.log("\n✅ Diamond Deployment Complete!");
    console.log(`   Diamond address: ${diamondAddr}`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("❌ Deployment failed:", e);
        process.exit(1);
    });
