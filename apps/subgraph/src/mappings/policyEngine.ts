import {
  Policy,
  PolicyVersion,
  PolicyEvaluation,
  WalletPolicy,
  FidesRule,
} from '../../generated/schema';
import {
  IssuerPolicySet,
  WalletPolicySet,
  TransferEvaluated,
  RuleCreated,
  RuleUpdated,
  RuleActivated,
  RuleDeactivated,
  PolicyEngine as PolicyEngineContract,
} from '../../generated/PolicyEngine/PolicyEngine';
import { BigInt, log } from '@graphprotocol/graph-ts';

// [P1-3 FIX] 决策映射对齐合约 ActionType 枚举（PolicyEngine.sol L33）：
// 0=ALLOW 1=BLOCK 2=QUARANTINE 3=REQUIRE_KYC 4=REQUIRE_AML 5=FLAG_FOR_REVIEW
// schema Decision 仅 ALLOW/BLOCK/FLAG/HOLD：隔离/KYC/AML 归 HOLD，复核归 FLAG
function getDecision(decisionValue: i32): string {
  if (decisionValue === 0) return 'ALLOW';
  if (decisionValue === 1) return 'BLOCK';
  if (decisionValue === 5) return 'FLAG';
  return 'HOLD';
}

export function handleIssuerPolicySet(event: IssuerPolicySet): void {
  let issuer = event.params.issuer.toHexString();
  let engine = PolicyEngineContract.bind(event.address);
  let result = engine.try_issuerPolicies(event.params.issuer);
  if (result.reverted) {
    log.warning('[handleIssuerPolicySet] issuerPolicies reverted for {}; keeping previous state', [issuer]);
    return;
  }
  let chainPolicy = result.value;

  let policy = Policy.load(issuer);
  let previousVersion = 0;
  if (!policy) {
    policy = new Policy(issuer);
    policy.issuer = issuer;
    policy.version = 0;
  } else {
    let prevVersion = PolicyVersion.load(issuer + '-' + policy.version.toString());
    if (prevVersion) {
      prevVersion.active = false;
      prevVersion.save();
    }
    previousVersion = policy.version;
  }

  let newVersion = previousVersion + 1;
  policy.version = newVersion;
  policy.maxTxAmount = chainPolicy.getMaxTxAmount();
  policy.dailyLimit = chainPolicy.getDailyLimit();
  policy.allowMediumRisk = chainPolicy.getAllowMediumRisk();
  policy.allowHighRisk = chainPolicy.getAllowHighRisk();
  policy.blockMixer = chainPolicy.getBlockMixer();
  policy.requireDestinationKYC = chainPolicy.getRequireDestinationKYC();
  policy.cooldownPeriod = chainPolicy.getCooldownPeriod();
  policy.updatedAt = event.block.timestamp;
  policy.save();

  let version = new PolicyVersion(issuer + '-' + newVersion.toString());
  version.policy = issuer;
  version.version = newVersion;
  version.maxTxAmount = chainPolicy.getMaxTxAmount();
  version.dailyLimit = chainPolicy.getDailyLimit();
  version.allowMediumRisk = chainPolicy.getAllowMediumRisk();
  version.allowHighRisk = chainPolicy.getAllowHighRisk();
  version.blockMixer = chainPolicy.getBlockMixer();
  version.requireDestinationKYC = chainPolicy.getRequireDestinationKYC();
  version.cooldownPeriod = chainPolicy.getCooldownPeriod();
  version.updatedAt = event.block.timestamp;
  version.blockNumber = event.block.number;
  version.transactionHash = event.transaction.hash.toHexString();
  version.active = true;
  version.save();

  log.info('IssuerPolicySet: {} version={}', [issuer, newVersion.toString()]);
}

export function handleWalletPolicySet(event: WalletPolicySet): void {
  let wallet = event.params.wallet.toHexString();
  let engine = PolicyEngineContract.bind(event.address);
  let result = engine.try_walletPolicies(event.params.wallet);
  if (result.reverted) {
    log.warning('[handleWalletPolicySet] walletPolicies reverted for {}; keeping previous state', [wallet]);
    return;
  }
  let chainPolicy = result.value;

  let walletPolicy = WalletPolicy.load(wallet);
  if (!walletPolicy) {
    walletPolicy = new WalletPolicy(wallet);
    walletPolicy.wallet = wallet;
    walletPolicy.version = 0;
    walletPolicy.allowedDex = [];
    walletPolicy.blockedContracts = [];
  }

  walletPolicy.version = walletPolicy.version + 1;
  walletPolicy.maxTxValue = chainPolicy.getMaxTxValue();
  walletPolicy.maxTokenTxAmount = chainPolicy.getMaxTokenTxAmount();
  walletPolicy.dailyEthLimit = chainPolicy.getDailyEthLimit();
  walletPolicy.dailyTokenLimit = chainPolicy.getDailyTokenLimit();
  walletPolicy.blockContractCalls = chainPolicy.getBlockContractCalls();
  walletPolicy.blockUnknownTokens = chainPolicy.getBlockUnknownToken();
  walletPolicy.requireWhitelist = chainPolicy.getRequireWhitelist();
  walletPolicy.updatedAt = event.block.timestamp;
  walletPolicy.blockNumber = event.block.number;
  walletPolicy.transactionHash = event.transaction.hash.toHexString();
  walletPolicy.save();

  log.info('WalletPolicySet: {}', [wallet]);
}

export function handleTransferEvaluated(event: TransferEvaluated): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let evaluation = new PolicyEvaluation(id);
  // [P1-3 FIX] 合约 TransferEvaluated 无 operator/reason 字段：
  // operator 以交易发送者近似，reason 置空串（schema 为非空 String!）
  evaluation.operator = event.transaction.from.toHexString();
  evaluation.from = event.params.from.toHexString();
  evaluation.to = event.params.to.toHexString();
  evaluation.amount = event.params.amount;
  evaluation.decision = getDecision(event.params.decision as i32);
  evaluation.reason = '';
  evaluation.timestamp = event.block.timestamp;
  evaluation.blockNumber = event.block.number;
  evaluation.transactionHash = event.transaction.hash.toHexString();
  evaluation.save();

  log.info('TransferEvaluated: {} -> {} decision={}', [
    evaluation.from,
    evaluation.to,
    evaluation.decision,
  ]);
}

export function handleRuleCreated(event: RuleCreated): void {
  let id = event.params.ruleId.toHexString();
  let rule = new FidesRule(id);
  rule.name = event.params.name;
  rule.ruleType = getDecision(event.params.action as i32);
  rule.status = 'ACTIVE';
  rule.priority = BigInt.fromI32(0);
  rule.creator = event.transaction.from.toHexString();
  rule.createdAt = event.block.timestamp;
  rule.updatedAt = event.block.timestamp;
  rule.save();
}

export function handleRuleUpdated(event: RuleUpdated): void {
  let id = event.params.ruleId.toHexString();
  let rule = FidesRule.load(id);
  if (!rule) {
    rule = new FidesRule(id);
    rule.creator = event.transaction.from.toHexString();
    rule.createdAt = event.block.timestamp;
  }
  rule.name = event.params.name;
  rule.ruleType = getDecision(event.params.action as i32);
  rule.updatedAt = event.block.timestamp;
  rule.save();
}

export function handleRuleActivated(event: RuleActivated): void {
  let id = event.params.ruleId.toHexString();
  let rule = FidesRule.load(id);
  if (rule) {
    rule.status = 'ACTIVE';
    rule.updatedAt = event.block.timestamp;
    rule.save();
  }
}

export function handleRuleDeactivated(event: RuleDeactivated): void {
  let id = event.params.ruleId.toHexString();
  let rule = FidesRule.load(id);
  if (rule) {
    rule.status = 'PAUSED';
    rule.updatedAt = event.block.timestamp;
    rule.save();
  }
}
