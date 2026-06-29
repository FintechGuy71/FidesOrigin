/**
 * Merkle Builder — Merkle Tree 构建与验证
 *
 * 负责：
 * 1. 对地址排序后计算 keccak256 叶子节点
 * 2. 逐层构建 Merkle Tree
 * 3. 输出 root hash
 */

'use strict';

const { ethers } = require('ethers');

/**
 * 构建 Merkle Tree
 * @param {Array<{address: string}>} addresses - 地址列表
 * @returns {{root: string, leaves: string[], layers: string[][], count: number}}
 */
function buildMerkleTree(addresses) {
  // 对地址排序后计算 keccak256 叶子节点
  const leaves = addresses
    .map((a) => a.address)
    .sort()
    .map((addr) => ethers.keccak256(ethers.toUtf8Bytes(addr)));

  if (leaves.length === 0) {
    return { root: ethers.ZeroHash, leaves: [], layers: [], count: 0 };
  }

  if (leaves.length === 1) {
    return { root: leaves[0], leaves, layers: [leaves], count: 1 };
  }

  // 补齐到 2 的幂次
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length & (paddedLeaves.length - 1)) {
    paddedLeaves.push(ethers.ZeroHash);
  }

  const layers = [paddedLeaves];
  let currentLayer = paddedLeaves;

  while (currentLayer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      // 排序后哈希（防止第二原像攻击）
      const [left, right] = [currentLayer[i], currentLayer[i + 1]];
      const hash = ethers.keccak256(ethers.concat([left, right]));
      nextLayer.push(hash);
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    root: currentLayer[0],
    leaves: paddedLeaves,
    layers,
    count: leaves.length,
  };
}

module.exports = {
  buildMerkleTree,
};
