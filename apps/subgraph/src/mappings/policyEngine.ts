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
import { ethereum, BigInt, log, Address } from '@graphprotocol/graph-ts';

function getDecision(decisionValue: i32): string {
  if (decisionValue === 0) return 'ALLOW';
  if (decisionValue === 1) return 'BLOCK';
  if (decisionValue === 2) return 'FLAG';
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

  let newVersion = previousVersion + 1;
  policy.version = newVersion;
  policy.maxTxAmount = event.params.maxTxAmount;
  policy.dailyLimit = event.params.dailyLimit;
  // Note: IssuerPolicySet event does not include allowMediumRisk/allowHighRisk/blockMixer/requireDestinationKYC/cooldownPeriod
  // These fields retain their previous values or defaults
  policy.updatedAt = event.block.timestamp;
  policy.save();

  let versionId = issuer + '-' + newVersion.toString();
  let version = new PolicyVersion(versionId);
  version.policy = issuer;
  version.version = newVersion;
  version.maxTxAmount = event.params.maxTxAmount;
  version.dailyLimit = event.params.dailyLimit;
  version.allowMediumRisk = policy.allowMediumRisk;
  version.allowHighRisk = policy.allowHighRisk;
  version.blockMixer = policy.blockMixer;
  version.requireDestinationKYC = policy.requireDestinationKYC;
  version.cooldownPeriod = policy.cooldownPeriod;
  version.updatedAt = event.block.timestamp;
  version.blockNumber = event.block.number;
  version.transactionHash = event.transaction.hash.toHexString();
  version.active = true;
  version.save();

  log.info('IssuerPolicySet: {} version={}', [issuer, newVersion.toString()]);
}

export function handleWalletPolicySet(event: WalletPolicySet): void {
  let wallet = event.params.wallet.toHexString();

  let walletPolicy = WalletPolicy.load(wallet);
  if (!walletPolicy) {
    walletPolicy = new WalletPolicy(wallet);
    walletPolicy.wallet = wallet;
    walletPolicy.version = 0;
  }

  let previousVersion = walletPolicy.version || 0;
  walletPolicy.version = previousVersion + 1;
  walletPolicy.updatedAt = event.block.timestamp;
  walletPolicy.blockNumber = event.block.number;
  walletPolicy.transactionHash = event.transaction.hash.toHexString();
  walletPolicy.save();

  log.info('WalletPolicySet: {}', [wallet]);
}

export function handleTransferEvaluated(event: TransferEvaluated): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let evaluation = new PolicyEvaluation(id);
  evaluation.operator = event.transaction.from.toHexString();
  evaluation.from = event.params.from.toHexString();
  evaluation.to = event.params.to.toHexString();
  evaluation.amount = event.params.amount;
  evaluation.decision = getDecision(event.params.decision as i32);
  evaluation.reason = 'Transfer evaluated';
  evaluation.timestamp = event.block.timestamp;
  evaluation.blockNumber = event.block.number;
  evaluation.transactionHash = event.transaction.hash.toHexString();
  evaluation.save();

  log.info('TransferEvaluated: {} {} -> {} decision={}', [
    evaluation.operator,
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
