// R3 升级：单独补提 proposeDiamondCut（主脚本 ethers Result 只读数组导致失败）
// 复用已部署的 facet 地址，selectors 从 loupe 读出后复制为普通数组
const { ethers } = require("hardhat");

const ADMIN = "0x5F6Ae278e7a62E64F9F467a91B693f372b84a374";
const DIAMOND = "0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E";
const NEW_FACETS = {
  WalletComplianceFacet: "0x012e3074325c324D69119eAeCA5911495fcf9D92",
  AssetComplianceFacet: "0x21c40C012729891431f8b111190f11fA6F7114eF",
  DiamondLoupeFacet: "0x19D3B58E62e6ba8469BA9FB0e02E61b792692621",
};
const OLD_FACETS = {
  WalletComplianceFacet: "0x3C99EF323832FB723A6eff4A43B03A03b8CC3917",
  AssetComplianceFacet: "0xD80Ccee6167818E307bbAF436060003EeB6e415d",
  DiamondLoupeFacet: "0x3d9C891145226Bc49D43a82Ec3cc95Ff526EBeE3",
};

const LOUPE_ABI = ["function facetFunctionSelectors(address facet) view returns (bytes4[])"];
const CUT_ABI = ["function proposeDiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)"];

async function main() {
  const [signer] = await ethers.getSigners();
  if (signer.address.toLowerCase() !== ADMIN.toLowerCase()) throw new Error("signer mismatch");

  const loupe = new ethers.Contract(DIAMOND, LOUPE_ABI, signer);
  const cuts = [];
  for (const name of Object.keys(NEW_FACETS)) {
    const raw = await loupe.facetFunctionSelectors(OLD_FACETS[name]);
    const selectors = [...raw].map(s => String(s)); // 解冻 Result 数组
    console.log(name, "selectors:", selectors.length);
    cuts.push([NEW_FACETS[name], 1, selectors]); // Replace
  }

  const cutter = new ethers.Contract(DIAMOND, CUT_ABI, signer);
  const tx = await cutter.proposeDiamondCut(cuts, ethers.ZeroAddress, "0x");
  const receipt = await tx.wait();
  console.log("proposed diamondCut tx:", receipt.hash);
  console.log("48h 后（约 2026-09-20T12:35Z 之后）执行 diamondCut");
}

main().catch((e) => { console.error(e); process.exit(1); });
