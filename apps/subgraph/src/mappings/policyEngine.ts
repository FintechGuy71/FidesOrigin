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

  let policy = Policy.load(issuer);
  let previousVersion = 0;

  if (!policy) {
    policy = new Policy(issuer);
    policy.issuer = issuer;
    policy.version = 0;
  } else {
    let prevVersionId = issuer + '-' + policy.version.toString();
    let prevVersion = PolicyVersion.load(prevVersionId);
    if (prevVersion) {
      prevVersion.active = false;
      prevVersion.save();
    }
    previousVersion = policy.version;
  }

  // [P1-3 FIX] v3.1.0 合约事件为平铺参数（旧 tuple 订阅的 topic0 永不匹配，已实证零触发）；
  // blockMixer/requireDestinationKYC/cooldownPeriod 不在新事件中，置缺省值
  let newVersion = previousVersion + 1;
  policy.version = newVersion;
  policy.maxTxAmount = event.params.maxTxAmount;
  policy.dailyLimit = event.params.dailyLimit;
  policy.allowMediumRisk = event.params.allowMediumRisk;
  policy.allowHighRisk = event.params.allowHighRisk;
  policy.blockMixer = false;
  policy.requireDestinationKYC = false;
  policy.cooldownPeriod = BigInt.zero();
  policy.updatedAt = event.block.timestamp;
  policy.save();

  let versionId = issuer + '-' + newVersion.toString();
  let version = new PolicyVersion(versionId);
  version.policy = issuer;
  version.version = newVersion;
  version.maxTxAmount = event.params.maxTxAmount;
  version.dailyLimit = event.params.dailyLimit;
  version.allowMediumRisk = event.params.allowMediumRisk;
  version.allowHighRisk = event.params.allowHighRisk;
  version.blockMixer = false;
  version.requireDestinationKYC = false;
  version.cooldownPeriod = BigInt.zero();
  version.updatedAt = event.block.timestamp;
  version.blockNumber = event.block.number;
  version.transactionHash = event.transaction.hash.toHexString();
  version.active = true;
  version.save();

  log.info('IssuerPolicySet: {} version={}', [issuer, newVersion.toString()]);
}

export function handleWalletPolicySet(event: WalletPolicySet): void {
  let wallet = event.params.wallet.toHexString();

  // [P1-3 FIX] v3.1.0 合约 WalletPolicySet 仅携带 wallet 地址（策略明细不再上事件），
  // 明细字段置缺省；实体保留，作为"哪些钱包被设置过策略"的台账
  let walletPolicy = WalletPolicy.load(wallet);
  if (!walletPolicy) {
    walletPolicy = new WalletPolicy(wallet);
    walletPolicy.wallet = wallet;
    walletPolicy.version = 0;
  }

  walletPolicy.version = walletPolicy.version + 1;
  walletPolicy.maxTxValue = BigInt.zero();
  walletPolicy.maxTokenTxAmount = BigInt.zero();
  walletPolicy.dailyEthLimit = BigInt.zero();
  walletPolicy.dailyTokenLimit = BigInt.zero();
  walletPolicy.blockContractCalls = false;
  walletPolicy.blockUnknownTokens = false;
  walletPolicy.requireWhitelist = false;
  walletPolicy.allowedDex = [];
  walletPolicy.blockedContracts = [];
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
