// FidesOrigin Contract ABIs
// Generated from Solidity contracts

const ComplianceEngineABI = [
    // View functions
    "function validateTransfer(address from, address to, uint256 amount, address assetContract) view returns (uint8 decision, string reason)",
    "function getAddressRisk(address account) view returns (tuple(uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool isSanctioned))",
    "function getRiskTier(address account) view returns (uint8)",
    "function isSanctioned(address account) view returns (bool)",
    "function getIssuerPolicy(address issuer) view returns (tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod))",
    "function getDailySpent(address account, address asset) view returns (uint256)",
    "function validateOperation(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, address walletContract) view returns (uint8 decision, string reason)",
    "function validateBatch(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId)[] ops) view returns (uint8[] decisions)",
    "function analyzeOperationRisk(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op) view returns (uint8 riskScore, uint8 tier, string riskFactors)",
    "function getWalletPolicy(address wallet) view returns (tuple(uint256 maxTxValue, uint256 maxTokenTxAmount, uint256 dailyEthLimit, uint256 dailyTokenLimit, bool blockContractCalls, bool blockUnknownTokens, bool requireWhitelist, address[] allowedDex, address[] blockedContracts))",
    "function heldFunds(address owner, address asset) view returns (uint256)",
    "function emergencyMode() view returns (bool)",
    "function getOperationLogs(uint256 start, uint256 limit) view returns (tuple(uint256 timestamp, address operator, bytes32 operationType, bytes32 result, string details)[])",
    
    // Write functions
    "function preTransferHook(address from, address to, uint256 amount)",
    "function postTransferHook(address from, address to, uint256 amount, bool success)",
    "function preExecutionHook(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op)",
    "function postExecutionHook(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, bool success)",
    "function preBatchExecutionHook(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId)[] ops)",
    "function releaseHold(bytes32 holdId)",
    "function activateEmergencyMode()",
    "function deactivateEmergencyMode()",
    "function emergencyPause()",
    "function emergencyUnpause()",
    "function setRiskRegistry(address _riskRegistry)",
    "function setPolicyEngine(address _policyEngine)",
    
    // Events
    "event ComplianceCheck(address indexed operator, address indexed from, address indexed to, uint256 amount, uint8 decision, string reason)",
    "event FundsHeld(bytes32 indexed holdId, address indexed owner, address asset, uint256 amount)",
    "event FundsReleased(bytes32 indexed holdId, address indexed owner, uint256 amount)",
    "event EmergencyModeActivated(address indexed triggeredBy)",
    "event EmergencyModeDeactivated(address indexed triggeredBy)"
];

const RiskRegistryABI = [
    // View functions
    "function getRiskProfile(address account) view returns (tuple(uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool isSanctioned))",
    "function getRiskTier(address account) view returns (uint8)",
    "function getRiskScore(address account) view returns (uint8)",
    "function isSanctioned(address account) view returns (bool)",
    "function hasTag(address account, bytes32 tag) view returns (bool)",
    "function getTags(address account) view returns (bytes32[])",
    "function contractRegistry(address) view returns (bool isVerified, uint8 riskScore, bytes32 contractType, uint256 verifiedAt, address verifiedBy)",
    "function sanctionedAddresses(address) view returns (bool)",
    "function entityAddresses(bytes32 entityType) view returns (address[])",
    
    // Write functions
    "function updateRiskProfile(address account, uint8 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)",
    "function batchUpdateRiskProfiles(address[] accounts, uint8[] riskScores, uint8[] tiers, bool[] isSanctionedList)",
    "function emergencySanction(address[] accounts, string reason)",
    "function removeSanction(address account)",
    "function addTag(address account, bytes32 tag)",
    "function removeTag(address account, bytes32 tag)",
    "function registerContract(address contractAddr, bytes32 contractType, bool verified, uint8 riskScore)",
    "function pause()",
    "function unpause()",
    
    // Roles
    "function ORACLE_ROLE() view returns (bytes32)",
    "function ADMIN_ROLE() view returns (bytes32)",
    "function OPERATOR_ROLE() view returns (bytes32)",
    "function grantRole(bytes32 role, address account)",
    "function revokeRole(bytes32 role, address account)",
    "function hasRole(bytes32 role, address account) view returns (bool)"
];

const PolicyEngineABI = [
    // View functions
    "function evaluateTransfer(address from, address to, uint256 amount, address operator) view returns (uint8 decision, string reason)",
    "function evaluateOperation(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, address wallet) view returns (uint8 decision, string reason)",
    "function analyzeOperationRisk(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op) view returns (uint8 riskScore, uint8 tier, string riskFactors)",
    "function issuerPolicies(address) view returns (uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod)",
    "function walletPolicies(address) view returns (uint256 maxTxValue, uint256 maxTokenTxAmount, uint256 dailyEthLimit, uint256 dailyTokenLimit, bool blockContractCalls, bool blockUnknownTokens, bool requireWhitelist, address[] allowedDex, address[] blockedContracts)",
    "function defaultIssuerPolicy() view returns (uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod)",
    "function knownMixers(address) view returns (bool)",
    "function dailySpent(address account, address asset, uint256 day) view returns (uint256)",
    "function getDailySpent(address account, address asset) view returns (uint256)",
    
    // Write functions
    "function recordTransfer(address from, address to, uint256 amount, address asset, bool success)",
    "function recordOperation(address walletOwner, tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, bool success)",
    "function setIssuerPolicy(address issuer, tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod) policy)",
    "function setWalletPolicy(address wallet, tuple(uint256 maxTxValue, uint256 maxTokenTxAmount, uint256 dailyEthLimit, uint256 dailyTokenLimit, bool blockContractCalls, bool blockUnknownTokens, bool requireWhitelist, address[] allowedDex, address[] blockedContracts) policy)",
    "function setDefaultIssuerPolicy(tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod) policy)",
    "function addMixer(address mixer)",
    "function removeMixer(address mixer)"
];

const RiskOracleABI = [
    // Chainlink Functions
    "function requestRiskData(address targetAddress, bytes32 sourceId) returns (bytes32 requestId)",
    "function batchRequestRiskData(address[] addresses, bytes32 sourceId)",
    "function executeBatchUpdate()",
    "function manualRiskUpdate(address account, uint8 riskScore, uint8 tier, bool isSanctioned)",
    
    // View
    "function pendingRequests(bytes32) view returns (bytes32 requestId, address targetAddress, uint256 timestamp, bool fulfilled)",
    "function pendingUpdates(uint256) view returns (address account, uint8 riskScore, uint8 tier, bool isSanctioned, bytes32 source, uint256 timestamp)",
    "function getPendingUpdateCount() view returns (uint256)",
    "function getRequestHistoryCount() view returns (uint256)",
    "function dataSources(bytes32) view returns (string name, string apiEndpoint, bool isActive, uint256 weight)",
    "function donId() view returns (bytes32)",
    "function gasLimit() view returns (uint32)",
    "function subscriptionId() view returns (uint64)",
    "function batchThreshold() view returns (uint256)",
    "function autoBatchUpdate() view returns (bool)",
    
    // Admin
    "function addDataSource(bytes32 sourceId, string name, string apiEndpoint, uint256 weight)",
    "function updateDataSource(bytes32 sourceId, bool isActive)",
    "function setSubscriptionId(uint64 _subscriptionId)",
    "function setDonId(bytes32 _donId)",
    "function setGasLimit(uint32 _gasLimit)",
    "function setEncryptedSecretsUrls(bytes _encryptedSecretsUrls)",
    "function setBatchThreshold(uint256 _threshold)",
    "function setAutoBatchUpdate(bool _auto)"
];

const CompliantStableCoinABI = [
    // ERC20 standard
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    
    // Compliance
    "function complianceEngine() view returns (address)",
    "function complianceEnabled() view returns (bool)",
    "function policy() view returns (uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod)",
    "function kycVerified(address) view returns (bool)",
    "function getAddressRiskInfo(address account) view returns (uint8 riskScore, uint8 tier, bool isSanctioned, uint256 dailySpent)",
    "function simulateTransfer(address from, address to, uint256 amount) view returns (bool wouldSucceed, uint8 decision, string memory reason)",
    
    // Admin
    "function mint(address to, uint256 amount)",
    "function burn(address from, uint256 amount)",
    "function batchTransfer(address[] recipients, uint256[] amounts) returns (bool)",
    "function setComplianceEngine(address _engine)",
    "function toggleCompliance(bool _enabled)",
    "function setPolicy(tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod) _policy)",
    "function setKYCStatus(address account, bool verified)",
    "function batchSetKYC(address[] accounts, bool verified)",
    "function pause()",
    "function unpause()"
];

const CompliantSmartWalletABI = [
    // View
    "function owner() view returns (address)",
    "function complianceEngine() view returns (address)",
    "function complianceEnabled() view returns (bool)",
    "function policy() view returns (uint256 maxTxValue, uint256 maxTokenTxAmount, uint256 dailyEthLimit, uint256 dailyTokenLimit, bool blockContractCalls, bool blockUnknownTokens, bool requireWhitelist, address[] allowedDex, address[] blockedContracts)",
    "function whitelistedTargets(address) view returns (bool)",
    "function dailyEthSpent(uint256) view returns (uint256)",
    "function dailyTokenSpent(address, uint256) view returns (uint256)",
    "function simulateOperation(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op) view returns (bool wouldSucceed, uint8 decision, string reason, uint8 riskScore, uint8 tier)",
    "function getDailyUsage() view returns (uint256 ethSpent, uint256 ethLimit, uint256 remainingEth)",
    "function getTargetRisk(address target) view returns (bool isContract, bool isWhitelisted, bool isBlocked, uint8 riskScore)",
    
    // Execution
    "function execute(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op) returns (bytes)",
    "function transferETH(address to, uint256 amount) returns (bool)",
    "function transferToken(address token, address to, uint256 amount) returns (bool)",
    "function callContract(address target, uint256 value, bytes data) returns (bytes)",
    "function executeBatch(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId)[] ops) returns (tuple(bool success, bytes returnData, uint8 decision, string reason)[] results)",
    "function executeWithSignature(tuple(uint8 opType, address target, uint256 value, bytes data, address token, uint256 tokenAmount, uint256 chainId) op, bytes signature, uint256 deadline) returns (bytes)",
    
    // Admin
    "function setOwner(address _owner)",
    "function setComplianceEngine(address _engine)",
    "function toggleCompliance(bool _enabled)",
    "function setPolicy(tuple(uint256 maxTxValue, uint256 maxTokenTxAmount, uint256 dailyEthLimit, uint256 dailyTokenLimit, bool blockContractCalls, bool blockUnknownTokens, bool requireWhitelist, address[] allowedDex, address[] blockedContracts) _policy)",
    "function addToWhitelist(address target)",
    "function removeFromWhitelist(address target)"
];

module.exports = {
    ComplianceEngine: ComplianceEngineABI,
    RiskRegistry: RiskRegistryABI,
    PolicyEngine: PolicyEngineABI,
    RiskOracle: RiskOracleABI,
    CompliantStableCoin: CompliantStableCoinABI,
    CompliantSmartWallet: CompliantSmartWalletABI
};
