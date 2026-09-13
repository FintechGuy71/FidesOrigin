/**
 * FidesOrigin On-Chain SDK —— 合约 ABI（human-readable，ethers v6 Interface）
 * 逐字对应 apps/contracts 的 IAssetCompliance / RiskRegistry / FidesCompliance / RiskRegistryV2。
 * 全部是 view 函数（gas-free）+ 事件；不含任何写方法。
 */

/** GuardedComplianceEngine / DiamondComplianceEngine —— Guard 交易前校验 */
export const COMPLIANCE_ENGINE_ABI = [
  // IAssetCompliance.validateTransfer
  'function validateTransfer(address from, address to, uint256 amount, address assetContract) view returns (uint8 decision, string reason)',
  // 事件
  'event TransferValidated(address indexed asset, address indexed from, address indexed to, uint256 amount, uint8 decision, string reason)',
] as const;

/** RiskRegistry —— 地址风险画像只读查询 */
export const RISK_REGISTRY_ABI = [
  'function getRiskProfile(address addr) view returns (uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool sanctioned)',
  'function isSanctioned(address addr) view returns (bool)',
  'function getRiskTier(address addr) view returns (uint8)',
  'function getRiskScore(address addr) view returns (uint8)',
  'function getTags(address addr) view returns (bytes32[])',
  // RiskRegistryV2 事件
  'event SanctionAdded(address indexed account, string reason)',
] as const;

/** FidesCompliance —— 兼容画像（quickCheck/getRiskProfile 备用通道） */
export const FIDES_COMPLIANCE_ABI = [
  'function getRiskProfile(address account) view returns (uint256 riskScore, bool isSanctioned, uint256 lastUpdated)',
  'function quickCheckAddress(address addr) view returns (bool isCompliant, uint256 riskScore)',
] as const;

/* 已部署合约地址（Sepolia，见仓库 DEPLOYED.md）。
   这里仅作"文档默认/参考"导出，生产集成应通过构造参数传入自己的地址集。 */
export const SEPOLIA_ADDRESSES = {
  complianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E', // DiamondComplianceEngine
  riskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',     // RiskRegistry
  policyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',     // PolicyEngine
  fidesCompliance: '0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5',  // FidesCompliance (UUPS)
} as const;
