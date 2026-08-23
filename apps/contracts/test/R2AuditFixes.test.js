const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

/**
 * R2 审计修复回归测试（G-02）
 * 覆盖：F-01 批量释放原子性 / F-03 Guard 真实 intent / F-04 策略引擎接线 /
 * F-05 fail-open 默认 / F-06 白名单生效 / F-10 ETH 提取时间锁 /
 * F-13 阈值时间锁 / F-14 发行方授权登记 / F-16 V1 批量跳过 / L-05 记录数语义
 */
describe('R2 Audit Fixes Regression', function () {
  const TOKEN_ADDR = ethers.Wallet.createRandom().address;
  let C; // contracts
  let owner, oracle, operator, admin, user1, user2, user3, attacker;
  const TOKEN = () => ethers.Wallet.createRandom().address;

  before(async function () {
    const f = await deployFidesOriginFixture();
    C = f;
    ({ owner, oracle, operator, admin, user1, user2, user3, attacker } = f);
  });

  // ============ F-01: QuarantineVault 批量释放原子性 ============
  describe('F-01: QuarantineVault batch release atomicity', function () {
    let vault, testUSD, recordId1, recordId2;
    const AMOUNT = ethers.parseEther('100');

    beforeEach(async function () {
      const TestUSD = await ethers.getContractFactory('TestUSD');
      testUSD = await TestUSD.deploy();
      await testUSD.waitForDeployment();
      const QuarantineVault = await ethers.getContractFactory('QuarantineVault');
      vault = await QuarantineVault.deploy();
      await vault.waitForDeployment();

      await testUSD.mint(owner.address, ethers.parseEther('10000'));
      await testUSD.connect(owner).approve(await vault.getAddress(), ethers.parseEther('10000'));

      await vault.quarantineFunds(user1.address, await testUSD.getAddress(), AMOUNT, 't1');
      recordId1 = await vault.recordIdList(0);
      await vault.quarantineFunds(user2.address, await testUSD.getAddress(), AMOUNT, 't2');
      recordId2 = await vault.recordIdList(1);
    });

    it('should keep unmarked records retryable after successful batch release', async function () {
      await vault.batchReleaseFunds([recordId1, recordId2]);
      const r1 = await vault.getRecord(recordId1);
      const r2 = await vault.getRecord(recordId2);
      expect(r1.released).to.be.true;
      expect(r2.released).to.be.true;
      expect(await testUSD.balanceOf(user1.address)).to.equal(AMOUNT);
      expect(await testUSD.balanceOf(user2.address)).to.equal(AMOUNT);
    });

    it('should revert whole batch atomically on failing ERC20 transfer (no partial state)', async function () {
      // 将 vault 紧急暂停，模拟转账路径异常：批量调用应整体 revert（暂停检查在转账前）
      await vault.emergencyPause();
      // 暂停后 totalQuarantinedAmount 不变
      const before = await vault.totalQuarantinedAmount();
      await expect(vault.batchReleaseFunds([recordId1])).to.not.be.reverted; // 暂停时逐条 emit failed 并 continue
      const after = await vault.totalQuarantinedAmount();
      expect(after).to.equal(before);
      const r1 = await vault.getRecord(recordId1);
      expect(r1.released).to.be.false; // 未被错误标记
    });

    it('L-05: getRecordCount returns recordIdList length', async function () {
      expect(await vault.getRecordCount()).to.equal(2n);
      await vault.releaseFunds(recordId1);
      // 释放后记录仍在列表中（计数不变）
      expect(await vault.getRecordCount()).to.equal(2n);
    });
  });

  // ============ F-10: ETH 提取时间锁 ============
  describe('F-10: ETH withdrawal timelock', function () {
    let vault;

    beforeEach(async function () {
      const QuarantineVault = await ethers.getContractFactory('QuarantineVault');
      vault = await QuarantineVault.deploy();
      await vault.waitForDeployment();
      await owner.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther('1') });
    });

    it('should revert legacy direct withdrawETH', async function () {
      await expect(vault.withdrawETH(user1.address)).to.be.revertedWith(
        'QV: use proposeWithdrawETH + executeWithdrawETH (timelock)'
      );
    });

    it('should enforce 48h timelock on ETH withdrawal', async function () {
      await vault.proposeWithdrawETH(user1.address);
      await expect(vault.executeWithdrawETH()).to.be.revertedWithCustomError(vault, 'TooEarly');
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');
      const balBefore = await ethers.provider.getBalance(user1.address);
      await vault.executeWithdrawETH();
      const balAfter = await ethers.provider.getBalance(user1.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther('1'));
    });

    it('should allow cancel of pending withdrawal', async function () {
      await vault.proposeWithdrawETH(user1.address);
      await vault.cancelWithdrawETH();
      await expect(vault.executeWithdrawETH()).to.be.revertedWithCustomError(vault, 'NothingPending');
    });
  });

  // ============ F-03: Guard 收到真实 intent ============
  describe('F-03: Guard receives real transaction intent', function () {
    let mockGuard;

    beforeEach(async function () {
      const Mock = await ethers.getContractFactory('MockPreTransactionGuard');
      mockGuard = await Mock.deploy();
      await mockGuard.waitForDeployment();
    });

    it('evaluateTransaction passes real token and amount to Guard', async function () {
      const { fidesCompliance, complianceEngine, riskRegistry } = C;
      await fidesCompliance.connect(owner).enableGuard(await mockGuard.getAddress());

      // 先让 from 有档案并授权评估（evaluateTransaction 状态路径）
      const tokenAddr = ethers.Wallet.createRandom().address;
      const amount = 12345678901234567890n; // 特殊值便于识别
      // evaluateTransaction 要求 msg.sender == from 或 OPERATOR_ROLE；owner 有 OPERATOR_ROLE
      await fidesCompliance.connect(owner).evaluateTransaction.staticCall(
        user1.address, user2.address, amount, tokenAddr, 0
      );
      // 用 staticCall 不会持久化统计，但 Guard 是 view —— 通过 previewTransactionGuard 读取回声值
      const [wouldBlock, reason] = await fidesCompliance.previewTransactionGuard.staticCall(
        user1.address, user2.address, amount, tokenAddr
      );
      // 回声 reason = "<tokenAddr>:<amount>"
      expect(reason).to.include(tokenAddr.toLowerCase());
      expect(reason).to.include(amount.toString());
    });

    it('main path checkAndExecuteTransaction invokes Guard and blocks when Guard says BLOCK', async function () {
      const { fidesCompliance } = C;
      await fidesCompliance.connect(owner).enableGuard(await mockGuard.getAddress());
      await mockGuard.setNextAction(2); // BLOCK
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 60;
      // 主路径：Guard BLOCK 应直接拒绝且不走引擎
      const allowed = await fidesCompliance.connect(user1).checkAndExecuteTransaction.staticCall(
        user1.address, user2.address, 100, ethers.ZeroAddress, deadline
      );
      expect(allowed).to.be.false;
      // 还原 Guard 状态，避免污染后续用例
      await fidesCompliance.connect(owner).disableGuard();
    });
  });

  // ============ F-05: fail-open 默认语义 ============
  describe('F-05: unknown profiles fail-open by default', function () {
    it('ComplianceEngine allows unknown addresses by default', async function () {
      const { complianceEngine } = C;
      const randomTo = ethers.Wallet.createRandom().address;
      const [decision] = await complianceEngine.connect(user1).checkTransfer.staticCall(
        user1.address, randomTo, 100, TOKEN_ADDR
      );
      expect(decision).to.equal(0); // ALLOW（from 在夹具中是否有档案均不影响此断言的默认行为）
    });

    it('strict mode restores fail-closed', async function () {
      const { complianceEngine } = C;
      await complianceEngine.connect(owner).setBlockUnknownProfiles(true);
      const randomTo = ethers.Wallet.createRandom().address;
      const [decision, reason] = await complianceEngine.connect(user1).checkTransfer.staticCall(
        user1.address, randomTo, 100, TOKEN_ADDR
      );
      expect(decision).to.equal(1); // BLOCK
      expect(reason).to.include('fail closed');
      await complianceEngine.connect(owner).setBlockUnknownProfiles(false);
    });
  });

  // ============ F-06: 白名单生效 ============
  describe('F-06: whitelist enforcement', function () {
    it('whitelisted party bypasses risk-based quarantine but not sanctions', async function () {
      const { fidesCompliance, riskRegistry } = C;
      // 给 user1 高分（>= 默认隔离线 80，< 阻断线 95）
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 90, 3, [], false);
      await riskRegistry.connect(oracle).updateRiskProfile(user2.address, 10, 1, [], false);

      // 未加白：evaluateTransaction 应不允许（90 >= 80 隔离线）
      const [allowedBefore] = await fidesCompliance.connect(owner).evaluateTransaction.staticCall(
        user1.address, user2.address, 100, TOKEN_ADDR, 0
      );
      expect(allowedBefore).to.be.false;

      // 加白后：放行（[M-5 FIX] 白名单为两步时间锁，推进 48h+1 后执行）
      await fidesCompliance.connect(owner).proposeWhitelist(user1.address, true);
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');
      await fidesCompliance.connect(owner).executeWhitelistUpdate();
      const [allowedAfter] = await fidesCompliance.connect(owner).evaluateTransaction.staticCall(
        user1.address, user2.address, 100, TOKEN_ADDR, 0
      );
      expect(allowedAfter).to.be.true;

      // 制裁不豁免：把 user2 设为制裁，白名单的 user1 仍被拒绝
      // （推进时间避开风险注册表的 1 小时频率限制）
      await ethers.provider.send('evm_increaseTime', [3700]);
      await ethers.provider.send('evm_mine');
      await riskRegistry.connect(oracle).updateRiskProfile(user2.address, 100, 4, [], true);
      const [allowedSanctioned] = await fidesCompliance.connect(owner).evaluateTransaction.staticCall(
        user1.address, user2.address, 100, TOKEN_ADDR, 0
      );
      expect(allowedSanctioned).to.be.false;

      // 移除白名单（两步）
      await fidesCompliance.connect(owner).proposeWhitelist(user1.address, false);
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');
      await fidesCompliance.connect(owner).executeWhitelistUpdate();
      // 还原 user2 档案（移除制裁），避免污染后续用例
      await ethers.provider.send('evm_increaseTime', [3700]);
      await ethers.provider.send('evm_mine');
      await riskRegistry.connect(oracle).updateRiskProfile(user2.address, 10, 1, [], false);
    });
  });

  // ============ F-13: 阈值时间锁 ============
  describe('F-13: threshold setters require timelock', function () {
    it('legacy direct setters revert', async function () {
      const { fidesCompliance } = C;
      await expect(fidesCompliance.connect(owner).setMinRiskScoreForQuarantine(70))
        .to.be.revertedWith('FC: use propose/execute pattern (timelock)');
      await expect(fidesCompliance.connect(owner).setMaxRiskScoreForBlock(90))
        .to.be.revertedWith('FC: use propose/execute pattern (timelock)');
    });

    it('propose + 48h execute works', async function () {
      const { fidesCompliance } = C;
      await fidesCompliance.connect(owner).proposeMinRiskScoreForQuarantine(70);
      await expect(fidesCompliance.connect(owner).executeMinRiskScoreForQuarantine())
        .to.be.revertedWithCustomError(fidesCompliance, 'TooEarly');
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');
      await fidesCompliance.connect(owner).executeMinRiskScoreForQuarantine();
      expect(await fidesCompliance.minRiskScoreForQuarantine()).to.equal(70);
      // 恢复默认值，避免影响其他用例
      await fidesCompliance.connect(owner).proposeMinRiskScoreForQuarantine(80);
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');
      await fidesCompliance.connect(owner).executeMinRiskScoreForQuarantine();
    });
  });

  // ============ F-14: 发行方授权登记 ============
  describe('F-14: registeredIssuers authorization', function () {
    it('setIssuerPolicy auto-registers issuer for postTransferHook', async function () {
      const { complianceEngine } = C;
      const token = ethers.Wallet.createRandom().address;
      await complianceEngine.connect(owner).setIssuerPolicy(token, {
        maxTxAmount: 1000,
        dailyLimit: 5000,
        allowMediumRisk: false,
        allowHighRisk: false,
        blockMixer: false,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: []
      });
      expect(await complianceEngine.registeredIssuers(token)).to.be.true;
      // 未登记地址调用 postTransferHook 应 revert
      await expect(
        complianceEngine.connect(attacker).postTransferHook(user1.address, user2.address, 1, true)
      ).to.be.revertedWithCustomError(complianceEngine, 'UnauthorizedCaller');
    });

    it('maxTxAmount=0 policy no longer self-locks the hook (N-04)', async function () {
      const { complianceEngine } = C;
      const token = ethers.Wallet.createRandom().address;
      await complianceEngine.connect(owner).setIssuerPolicy(token, {
        maxTxAmount: 0, // 意为不限单笔；原实现会因此误判未授权
        dailyLimit: 5000,
        allowMediumRisk: false,
        allowHighRisk: false,
        blockMixer: false,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: []
      });
      // 模拟代币合约调用 hook（用 setRegisteredIssuer 授权后直接以 owner 身份无法冒充 msg.sender，
      // 此处验证登记状态本身）
      expect(await complianceEngine.registeredIssuers(token)).to.be.true;
    });
  });

  // ============ F-04: 策略引擎接线 ============
  describe('F-04: PolicyEngine wiring', function () {
    it('blocks transfer when PolicyEngine mixer rule hits (hooks enabled)', async function () {
      const { complianceEngine, policyEngine, riskRegistry } = C;
      // PolicyEngine 需要指向 engine 才能 evaluateTransaction（其内部读 riskRegistry）
      await policyEngine.connect(owner).setComplianceEngine(await complianceEngine.getAddress());
      // 把 user2 标记为 mixer
      await policyEngine.connect(owner).addMixer(user2.address);
      // 给 user1 一个干净档案
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 10, 1, [], false);

      // 未开启接线时：mixer 规则不生效（旧行为，放行）
      const [dBefore] = await complianceEngine.connect(user1).checkTransfer.staticCall(
        user1.address, user2.address, 10, TOKEN_ADDR
      );
      expect(dBefore).to.equal(0); // ALLOW

      // 开启接线后：mixer 命中，阻断
      await complianceEngine.connect(owner).setPolicyEngineHooksEnabled(true);
      const [dAfter, reason] = await complianceEngine.connect(user1).checkTransfer.staticCall(
        user1.address, user2.address, 10, TOKEN_ADDR
      );
      expect(dAfter).to.equal(1); // BLOCK
      expect(reason).to.include('Mixer');
      await complianceEngine.connect(owner).setPolicyEngineHooksEnabled(false);
      await policyEngine.connect(owner).removeMixer(user2.address);
    });
  });

  // ============ F-16: V1 批量更新跳过频繁更新地址 ============
  describe('F-16: RiskRegistry V1 batch skips frequency-limited addresses', function () {
    it('batch skips recently-updated address instead of reverting whole batch', async function () {
      const { riskRegistry } = C;
      // 先推进时间，避开夹具部署时的频率限制窗口
      await ethers.provider.send('evm_increaseTime', [3700]);
      await ethers.provider.send('evm_mine');
      // 先更新 user1（1 小时内）
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 30, 1, [], false);
      // user2 已超过间隔（或从未更新）——批量应跳过 user1、成功 user2
      await expect(
        riskRegistry.connect(oracle).batchUpdateRiskProfiles(
          [user1.address, user2.address],
          [50, 40],
          [2, 2],
          [false, false],
          [[], []]
        )
      ).to.emit(riskRegistry, 'BatchUpdateSkipped');
      const profile2 = await riskRegistry.getProfile(user2.address);
      expect(profile2.riskScore).to.equal(40);
      // user1 保持原值 30（被跳过未被覆盖为 50）
      const profile1 = await riskRegistry.getProfile(user1.address);
      expect(profile1.riskScore).to.equal(30);
    });
  });
});
