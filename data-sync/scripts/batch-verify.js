const { StandardMerkleTree } = require('@openzeppelin/merkle-tree');
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', '..');
const treePath = path.join(baseDir, 'data-sync', 'cache', 'merkle-tree-v91.json');
const dataPath = path.join(baseDir, 'data-sync', 'cache', 'address-labels-v91.json');

const tree = StandardMerkleTree.load(
  JSON.parse(fs.readFileSync(treePath, 'utf8'))
);

const v91 = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('Testing batch verification...');
console.log('Total entries:', v91.addressLabels.length);

const testCount = Math.min(100, v91.addressLabels.length);
const indices = new Set();
while (indices.size < testCount) {
  indices.add(Math.floor(Math.random() * v91.addressLabels.length));
}

let passed = 0, failed = 0;
for (const idx of indices) {
  const entry = v91.addressLabels[idx];
  const value = [entry.address, entry.riskScore || 50, entry.riskTier || 'GREY'];
  try {
    const proof = tree.getProof(value);
    const verified = tree.verify(value, proof);
    if (verified) passed++;
    else failed++;
  } catch (e) {
    failed++;
    console.log('Error at', idx, ':', e.message);
  }
}

console.log(`\nResults: ${passed}/${testCount} passed, ${failed} failed`);
console.log(failed === 0 ? '✅ All tests passed!' : '❌ Some tests failed');
