/**
 * Merkle Builder — Merkle Tree 构建与验证
 *
 * [M-1/M-2 FIX] 与链上验证合约格式对齐（本次修复前该模块产出的树
 * 无法被仓库内任何合约验证）：
 *
 *   1. Leaf 规范（全仓库唯一权威格式，与 MerkleRiskRegistry.sol、
 *      MerkleRiskRegistryFacet.sol、ComplianceEngine.verifyMerkleRisk 一致）：
 *        leaf = keccak256(bytes.concat(keccak256(abi.encode(addr, riskScore, tier))))
 *      其中 abi.encode 参数类型为 (address, uint256, uint8)，
 *      tier 编码：0=UNKNOWN 1=LOW 2=MEDIUM 3=HIGH 4=CRITICAL
 *
 *   2. 内部节点：keccak256(sortedPair) —— 与 OZ Solidity MerkleProof._hashPair
 *      一致（按字典序排序两子节点后哈希，奇数节点复制补齐）。
 *      原实现的 0x00/0x01 域分离前缀是良好的安全实践，但与链上验证器不兼容
 *      （链上根本不认识前缀），属于"自说自话"的树。第二原像风险由类型化双哈希
 *      leaf 缓解。
 *
 *   3. 奇数节点：复制最后一个节点补齐（与 OZ JS 库行为一致）。
 *
 *   4. 提供证明生成（getProof）与可序列化 dump/load，供
 *      MerkleRiskRegistry.verifyAddress / batchVerify 消费。
 */

'use strict';

const { ethers } = require('ethers');

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

/**
 * 风险分 → tier 编码（与合约 RiskTier 枚举一致；阈值与合规引擎阻断线对齐）
 * @param {number} riskScore 0-100
 * @returns {number} 0-4
 */
function scoreToTier(riskScore) {
  const score = Number(riskScore) || 0;
  if (score >= 95) return 4; // CRITICAL
  if (score >= 80) return 3; // HIGH
  if (score >= 50) return 2; // MEDIUM
  if (score >= 30) return 1; // LOW
  return 0;                  // UNKNOWN
}

/**
 * 计算规范 leaf（与合约 _leaf() 完全一致）
 * @param {string} address 0x...
 * @param {number} riskScore 0-100
 * @param {number} tier 0-4（可选，缺省由 riskScore 推导）
 */
function computeLeaf(address, riskScore, tier) {
  const t = Number.isInteger(tier) ? tier : scoreToTier(riskScore);
  const encoded = ABI_CODER.encode(
    ['address', 'uint256', 'uint8'],
    [address, riskScore, t]
  );
  // 合约：keccak256(bytes.concat(keccak256(abi.encode(...))))
  return ethers.keccak256(ethers.keccak256(encoded));
}

/**
 * 构建 Merkle Tree（OZ MerkleProof 兼容）
 * @param {Array<{address: string, riskScore: number, tier?: number}>} entries
 * @returns {{root: string, leaves: string[], layers: string[][], count: number, entries: Array}}
 */
function buildMerkleTree(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { root: ethers.ZeroHash, leaves: [], layers: [], count: 0, entries: [] };
  }

  // 排序（按地址小写）保证确定性
  const sorted = [...entries].sort((a, b) =>
    a.address.toLowerCase().localeCompare(b.address.toLowerCase())
  );

  const leaves = sorted.map((e) =>
    computeLeaf(e.address, Number(e.riskScore) || 0, e.tier)
  );

  // 奇数层复制最后一个节点（OZ JS 行为）
  const layers = [leaves];
  let currentLayer = leaves;

  while (currentLayer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] ?? currentLayer[i]; // 复制补齐
      // OZ MerkleProof._hashPair 语义：按字典序排序后哈希。
      // （按索引序哈希的树无法通过 OZ 链上验证）
      const [a, b] = BigInt(left) <= BigInt(right) ? [left, right] : [right, left];
      nextLayer.push(ethers.keccak256(ethers.concat([a, b])));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    root: currentLayer[0],
    leaves,
    layers,
    count: leaves.length,
    entries: sorted,
  };
}

/**
 * 生成某条目的 Merkle 证明（可直接传给合约 verifyAddress / batchVerify）
 * @param {object} tree buildMerkleTree 的返回值
 * @param {string} address 目标地址
 * @param {number} riskScore 该地址的风险分（必须与构建时一致）
 * @param {number} [tier] 可选 tier（缺省由 riskScore 推导）
 * @returns {string[] | null} proof 数组；地址不在树中时返回 null
 */
function getProof(tree, address, riskScore, tier) {
  if (!tree || !tree.layers || tree.layers.length === 0) return null;
  const leaf = computeLeaf(address, Number(riskScore) || 0, tier);
  let index = tree.leaves.indexOf(leaf);
  if (index === -1) return null;

  const proof = [];
  for (let i = 0; i < tree.layers.length - 1; i++) {
    const layer = tree.layers[i];
    const pairIndex = index % 2 === 0 ? index + 1 : index - 1;
    // 奇数复制节点场景：pair 即自身，OZ verify 对 (a,a) 哈希安全
    proof.push(layer[pairIndex] ?? layer[index]);
    index = Math.floor(index / 2);
  }
  return proof;
}

/**
 * 序列化树（供缓存/断点续传）
 */
function dumpTree(tree) {
  return JSON.stringify({
    root: tree.root,
    count: tree.count,
    entries: tree.entries.map((e) => ({
      address: e.address,
      riskScore: Number(e.riskScore) || 0,
      tier: Number.isInteger(e.tier) ? e.tier : scoreToTier(e.riskScore),
    })),
  });
}

/**
 * 从序列化数据重建树
 */
function loadTree(dumped) {
  const data = typeof dumped === 'string' ? JSON.parse(dumped) : dumped;
  return buildMerkleTree(data.entries || []);
}

module.exports = {
  buildMerkleTree,
  computeLeaf,
  getProof,
  scoreToTier,
  dumpTree,
  loadTree,
};
