import { FidesGuard, GUARD_ADDRESSES } from '../src/index.js';

async function main() {
  // Connect to Hardhat local network
  const guard = new FidesGuard('http://127.0.0.1:8545', GUARD_ADDRESSES.hardhat);

  console.log('=== FidesOrigin Guard SDK Demo ===\n');

  // Test 1: Check unknown address
  const addr1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const r1 = await guard.checkAddress(addr1);
  console.log('Unknown address:', r1.action === 0 ? 'ALLOW' : r1.action === 2 ? 'BLOCK' : 'WARN', 
    `| Score: ${r1.riskScore} | ${r1.reason}`);

  // Test 2: Intercept transaction
  try {
    await guard.intercept(
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      '0x0000000000000000000000000000000000000001'
    );
  } catch (e) {
    console.log('Intercept result:', e.message);
  }

  console.log('\n✅ SDK demo complete');
}

main().catch(console.error);
