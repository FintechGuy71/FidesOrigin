const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('Debug RiskOracle', function () {
  it('should debug queueRiskUpdate', async function () {
    const fixture = await deployFidesOriginFixture();
    const { riskOracle, owner, user1, user2 } = fixture;
    
    console.log('Owner address:', owner.address);
    console.log('RiskOracle address:', await riskOracle.getAddress());
    console.log('Has OPERATOR_ROLE:', await riskOracle.hasRole(await riskOracle.OPERATOR_ROLE(), owner.address));
    console.log('Paused:', await riskOracle.paused());
    console.log('Block timestamp:', await ethers.provider.getBlock('latest').then(b => b.timestamp));
    
    // First call
    try {
      await riskOracle.queueRiskUpdate(user1.address, 50, 1, false);
      console.log('First call succeeded');
    } catch (e) {
      console.log('First call failed:', e.message);
    }
    
    // Second call (should fail with CallerCooldownActive)
    try {
      await riskOracle.queueRiskUpdate(user2.address, 75, 2, false);
      console.log('Second call succeeded');
    } catch (e) {
      console.log('Second call failed:', e.message);
    }
  });
});
