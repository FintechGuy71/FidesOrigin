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
  PolicyEvaluated,
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

function addressArrayToStrings(addrs: Array<Address>): Array<string> {
  let result: Array<string> = [];
  for (let i = 0; i < addrs.length; i++) {
    result.push(addrs[i].toHexString());
  }
  return result;
}

export function handleIssuerPolicySet(event: IssuerPolicySet): void {
  let issuer = event.params.issuer.toHexString();
  let policyData = event.params.policy;

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
  policy.maxTxAmount = policyData.maxTxAmount;
  policy.dailyLimit = policyData.dailyLimit;
  policy.allowMediumRisk = policyData.allowMediumRisk;
  policy.allowHighRisk = policyData.allowHighRisk;
  policy.blockMixer = policyData.blockMixer;
  policy.requireDestinationKYC = policyData.requireDestinationKYC;
  policy.cooldownPeriod = policyData.cooldownPeriod;
  policy.updatedAt = event.block.timestamp;
  policy.save();

  let versionId = issuer + '-' + newVersion.toString();
  let version = new PolicyVersion(versionId);
  version.policy = issuer;
  version.version = newVersion;
  version.maxTxAmount = policyData.maxTxAmount;
  version.dailyLimit = policyData.dailyLimit;
  version.allowMediumRisk = policyData.allowMediumRisk;
  version.allowHighRisk = policyData.allowHighRisk;
  version.blockMixer = policyData.blockMixer;
  version.requireDestinationKYC = policyData.requireDestinationKYC;
  version.cooldownPeriod = policyData.cooldownPeriod;
  version.updatedAt = event.block.timestamp;
  version.blockNumber = event.block.number;
  version.transactionHash = event.transaction.hash.toHexString();
  version.active = true;
  version.save();

  log.info('IssuerPolicySet: {} version={}', [issuer, newVersion.toString()]);
}

export function handleWalletPolicySet(event: WalletPolicySet): void {
  let wallet = event.params.wallet.toHexString();
  let policyData = event.params.policy;

  let walletPolicy = WalletPolicy.load(wallet);
  if (!walletPolicy) {
    walletPolicy = new WalletPolicy(wallet);
    walletPolicy.wallet = wallet;
    walletPolicy.version = 0;
  }

  let previousVersion = walletPolicy.version || 0;
  walletPolicy.version = previousVersion + 1;
  walletPolicy.maxTxValue = policyData.maxTxValue;
  walletPolicy.maxTokenTxAmount = policyData.maxTokenTxAmount;
  walletPolicy.dailyEthLimit = policyData.dailyEthLimit;
  walletPolicy.dailyTokenLimit = policyData.dailyTokenLimit;
  walletPolicy.blockContractCalls = policyData.blockContractCalls;
  walletPolicy.blockUnknownTokens = policyData.blockUnknownTokens;
  walletPolicy.requireWhitelist = policyData.requireWhitelist;
  walletPolicy.allowedDex = addressArrayToStrings(policyData.allowedDex);
  walletPolicy.blockedContracts = addressArrayToStrings(policyData.blockedContracts);
  walletPolicy.updatedAt = event.block.timestamp;
  walletPolicy.blockNumber = event.block.number;
  walletPolicy.transactionHash = event.transaction.hash.toHexString();
  walletPolicy.save();

  log.info('WalletPolicySet: {}', [wallet]);
}

export function handleTransferEvaluated(event: PolicyEvaluated): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let evaluation = new PolicyEvaluation(id);
  evaluation.operator = event.params.operator.toHexString();
  evaluation.from = event.params.from.toHexString();
  evaluation.to = event.params.to.toHexString();
  evaluation.amount = event.params.amount;
  evaluation.decision = getDecision(event.params.decision as i32);
  evaluation.reason = event.params.reason;
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
