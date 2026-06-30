const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('Debug CE', function () {
  it('debug', async function () {
    const fixture = await deployFidesOriginFixture();
    const ce = fixture.complianceEngine;
    console.log('typeof riskOracle:', typeof ce.riskOracle);
    console.log('typeof riskRegistry:', typeof ce.riskRegistry);
    console.log('typeof policyEngine:', typeof ce.policyEngine);
    try {
      const ro = await ce.riskOracle();
      console.log('riskOracle addr:', ro);
    } catch(e) {
      console.log('riskOracle error:', e.message);
    }
  });
});
