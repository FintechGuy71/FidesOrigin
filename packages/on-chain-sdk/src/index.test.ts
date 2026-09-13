import { describe, it, expect } from 'vitest';
import { FidesOriginSDK, Decision, RiskTier, SEPOLIA_ADDRESSES } from '../src/index';
import { JsonRpcProvider } from 'ethers';

describe('on-chain-sdk', () => {
  it('导出 Decision / RiskTier 枚举', () => {
    expect(Decision.ALLOW).toBe(0);
    expect(Decision.BLOCK).toBe(1);
    expect(Decision.FLAG).toBe(2);
    expect(Decision.HOLD).toBe(3);
    expect(RiskTier.UNKNOWN).toBe(0);
    expect(RiskTier.CRITICAL).toBe(4);
  });

  it('SEPOLIA_ADDRESSES 含已部署合约', () => {
    expect(SEPOLIA_ADDRESSES.complianceEngine).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(SEPOLIA_ADDRESSES.riskRegistry).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('构造参数缺失时抛出', () => {
    const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    expect(() => new FidesOriginSDK({ complianceEngine: '', riskRegistry: '0x0' } as never, provider)).toThrow();
    expect(() => new FidesOriginSDK({ complianceEngine: '0x0', riskRegistry: '' } as never, provider)).toThrow();
    expect(() => new FidesOriginSDK({ complianceEngine: '0x0', riskRegistry: '0x0' }, null as never)).toThrow();
  });

  it('正常构造（不发链上请求）', () => {
    const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const sdk = new FidesOriginSDK(
      {
        complianceEngine: SEPOLIA_ADDRESSES.complianceEngine,
        riskRegistry: SEPOLIA_ADDRESSES.riskRegistry,
      },
      provider
    );
    expect(sdk).toBeInstanceOf(FidesOriginSDK);
    expect(typeof sdk.validateTransfer).toBe('function');
    expect(typeof sdk.wouldTransferSucceed).toBe('function');
    expect(typeof sdk.getRiskProfile).toBe('function');
    expect(typeof sdk.isSanctioned).toBe('function');
    expect(typeof sdk.getRiskTier).toBe('function');
    expect(typeof sdk.getTags).toBe('function');
    expect(typeof sdk.onTransferValidated).toBe('function');
    expect(typeof sdk.onSanctionAdded).toBe('function');
    expect(typeof sdk.removeAllListeners).toBe('function');
  });
});
