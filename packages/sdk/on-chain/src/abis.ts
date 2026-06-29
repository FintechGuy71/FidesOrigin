/**
 * Contract ABIs for FidesOrigin On-Chain SDK
 * Minimal ABI fragments for Ethers.js contract interaction
 */

export const ComplianceEngineABI = [
  // Events
  "event TransferValidated(address indexed asset, address indexed from, address indexed to, uint256 amount, uint8 decision, string reason)",
  "event FundsHeld(bytes32 indexed holdId, address indexed owner, address indexed asset, uint256 amount)",
  "event FundsReleased(bytes32 indexed holdId, address indexed owner, uint256 amount)",
  
  // View functions
  "function validateTransfer(address from, address to, uint256 amount, address assetContract) view returns (uint8 decision, string reason)",
  "function getAddressRisk(address account) view returns (uint8 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned, uint256 lastUpdated)",
  "function getRiskTier(address account) view returns (uint8)",
  "function isSanctioned(address account) view returns (bool)",
  "function getDailySpent(address account, address asset) view returns (uint256)",
  "function heldFunds(address account, address asset) view returns (uint256)",
  "function getIssuerPolicy(address issuer) view returns (uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod)",
  "function getContractRisk(address contractAddr) view returns (bool verified, uint8 riskScore, string contractType)",
  "function riskRegistry() view returns (address)",
  "function policyEngine() view returns (address)",
  "function riskOracle() view returns (address)",
  
  // Write functions
  "function preTransferHook(address from, address to, uint256 amount)",
  "function postTransferHook(address from, address to, uint256 amount, bool success)",
  "function getHeldFunds(address owner, address asset) view returns (uint256)",
  "function getAllHoldRecords() view returns (bytes32[])",
  "function getHoldRecord(bytes32 holdId) view returns (tuple(address owner, address asset, uint256 amount, uint256 timestamp, string reason, bool released))",
  "function releaseHold(bytes32 holdId)",
  "function pause()",
  "function unpause()",
  
  // Role functions
  "function ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  
  // Wallet compliance
  "function validateOperation(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, address wallet) view returns (uint8 decision, string reason)",
  "function preExecutionHook(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op)",
  "function postExecutionHook(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, bool success)",
  "function validateBatch(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId)[] ops) view returns (uint8[] decisions)",
  "function analyzeOperationRisk(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op) view returns (uint8 riskScore, uint8 tier, string riskFactors)",
];

export const RiskRegistryABI = [
  "event RiskProfileUpdated(address indexed account, uint8 riskScore, uint8 tier, bool isSanctioned)",
  "event SanctionAdded(address indexed account, string reason)",
  "event SanctionRemoved(address indexed account)",
  "event AddressTagged(address indexed account, bytes32 tag)",
  "event ContractRegistered(address indexed contractAddr, bytes32 contractType, bool verified)",
  
  "function updateRiskProfile(address account, uint8 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)",
  "function batchUpdateRiskProfiles(address[] accounts, uint8[] riskScores, uint8[] tiers, bool[] isSanctionedList, bytes32[][] tags)",
  "function emergencySanction(address[] accounts, string reason)",
  "function removeSanction(address account)",
  "function addTag(address account, bytes32 tag)",
  "function removeTag(address account, bytes32 tag)",
  "function registerContract(address contractAddr, bytes32 contractType, bool verified, uint8 riskScore)",
  
  "function getRiskProfile(address account) view returns (uint8 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned, uint256 lastUpdated)",
  "function getRiskTier(address account) view returns (uint8)",
  "function getRiskScore(address account) view returns (uint8)",
  "function isSanctioned(address account) view returns (bool)",
  "function hasTag(address account, bytes32 tag) view returns (bool)",
  "function getTags(address account) view returns (bytes32[])",
  "function getContractRisk(address contractAddr) view returns (bool verified, uint8 riskScore, bytes32 contractType)",
  
  "function ORACLE_ROLE() view returns (bytes32)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function pause()",
  "function unpause()",
];

export const PolicyEngineABI = [
  "event PolicyEvaluated(address indexed operator, address from, address to, uint256 amount, uint8 decision, string reason)",
  "event IssuerPolicySet(address indexed issuer, tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod) policy)",
  
  "function setIssuerPolicy(address issuer, tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod) policy)",
  "function setWalletPolicy(address wallet, tuple(uint256 maxTxValue, uint256 maxTokenTxAmount, uint256 dailyEthLimit, uint256 dailyTokenLimit, bool blockContractCalls, bool blockUnknownTokens, bool requireWhitelist, address[] allowedDex, address[] blockedContracts) policy)",
  "function addMixer(address mixer)",
  "function removeMixer(address mixer)",
  "function recordTransfer(address from, address to, uint256 amount, address asset, bool success)",
  
  "function evaluateTransfer(address from, address to, uint256 amount, address operator) view returns (uint8 decision, string reason)",
  "function evaluateOperation(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, address wallet) view returns (uint8 decision, string reason)",
  "function analyzeOperationRisk(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op) view returns (uint8 riskScore, uint8 tier, string riskFactors)",
  "function getDailySpent(address account, address asset) view returns (uint256)",
  "function defaultIssuerPolicy() view returns (uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod)",
  "function knownMixers(address) view returns (bool)",
  
  "function ADMIN_ROLE() view returns (bytes32)",
  "function COMPLIANCE_ENGINE_ROLE() view returns (bytes32)",
];

export const RiskOracleABI = [
  "event RiskUpdateRequested(bytes32 indexed requestId, uint8 requestType, address requester, string source)",
  "event RiskUpdateFulfilled(bytes32 indexed requestId, bool success, uint256 processedAt)",
  "event RiskProfileUpdated(bytes32 indexed requestId, address account, uint256 score, uint8 tier, bool isSanctioned)",
  
  "function requestRiskUpdate(string source, bytes encryptedSecretsUrls, uint8 donHostedSecretsSlotID, uint64 donHostedSecretsVersion, string[] args) returns (bytes32 requestId)",
  "function updateRiskProfile(address account, uint256 score, uint8 tier, bytes32[] tags, bool isSanctioned)",
  "function batchUpdateRiskProfiles(address[] accounts, uint256[] scores, uint8[] tiers, bool[] isSanctioned)",
  "function queueRiskUpdate(address account, uint256 score, uint8 tier, bool isSanctioned)",
  "function executeQueuedUpdates()",
  
  "function getRequestInfo(bytes32 requestId) view returns (uint8 requestType, address requester, string source, bool fulfilled, uint256 fulfilledAt, bool success)",
  "function getAllRequestIds() view returns (bytes32[])",
  "function getPendingQueueLength() view returns (uint256)",
  "function isRequestFulfilled(bytes32 requestId) view returns (bool)",
  
  "function OPERATOR_ROLE() view returns (bytes32)",
];

export const CompliantStableCoinABI = [
  "event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason)",
  "event ComplianceEngineSet(address indexed engine)",
  "event ComplianceToggled(bool enabled)",
  "event PolicyUpdated(tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod) policy)",
  "event KYCStatusUpdated(address indexed account, bool verified)",
  
  "function complianceEngine() view returns (address)",
  "function complianceEnabled() view returns (bool)",
  "function policy() view returns (uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod)",
  "function kycVerified(address) view returns (bool)",
  "function MAX_TX_AMOUNT() view returns (uint256)",
  
  "function mint(address to, uint256 amount)",
  "function burn(address from, uint256 amount)",
  "function batchTransfer(address[] recipients, uint256[] amounts) returns (bool)",
  "function simulateTransfer(address from, address to, uint256 amount) view returns (bool wouldSucceed, uint8 decision, string reason)",
  "function getAddressRiskInfo(address account) view returns (uint8 riskScore, uint8 tier, bool isSanctioned, uint256 dailySpent)",
  "function setComplianceEngine(address _engine)",
  "function toggleCompliance(bool _enabled)",
  "function setPolicy(tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod) _policy)",
  "function setKYCStatus(address account, bool verified)",
  "function batchSetKYC(address[] accounts, bool verified)",
  "function pause()",
  "function unpause()",
  
  // ERC20
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];
