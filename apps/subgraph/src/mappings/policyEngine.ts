import {
  Policy,
  PolicyVersion,
  PolicyEvaluation,
  WalletPolicy,
} from '../../generated/schema';
import {
  IssuerPolicySet,
  WalletPolicySet,
  PolicyEvaluated,
} from '../../generated/PolicyEngine/PolicyEngine';
import { ethereum, BigInt, log } from '@graphprotocol/graph-ts';

function getDecision(decisionValue: i32): string {
  if (decisionValue === 0) return 'ALLOW';
  if (decisionValue === 1) return 'BLOCK';
  if (decisionValue === 2) return 'FLAG';
  return 'HOLD';
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

  // [High Fix #26] Ensure WalletPolicy entity is always persisted.
  let policy = WalletPolicy.load(wallet);
  if (!policy) {
    policy = new WalletPolicy(wallet);
    policy.wallet = wallet;
    policy.version = 0;
  }

  // [Medium Fix #29] Track WalletPolicy version for audit trail.
  let previousVersion = policy.version || 0;
  policy.version = previousVersion + 1;

  policy.maxTxValue = policyData.maxTxValue;
  policy.maxTokenTxAmount = policyData.maxTokenTxAmount;
  policy.dailyEthLimit = policyData.dailyEthLimit;
  policy.dailyTokenLimit = policyData.dailyTokenLimit;
  policy.blockContractCalls = policyData.blockContractCalls;
  policy.blockUnknownTokens = policyData.blockUnknownTokens;
  policy.requireWhitelist = policyData.requireWhitelist;

  let allowedDex: string[] = [];
  for (let i = 0; i < policyData.allowedDex.length; i++) {
    allowedDex.push(policyData.allowedDex[i].toHexString());
  }
  policy.allowedDex = allowedDex;

  let blockedContracts: string[] = [];
  for (let i = 0; i < policyData.blockedContracts.length; i++) {
    blockedContracts.push(policyData.blockedContracts[i].toHexString());
  }
  policy.blockedContracts = blockedContracts;

  policy.updatedAt = event.block.timestamp;
  policy.blockNumber = event.block.number;
  policy.transactionHash = event.transaction.hash.toHexString();
  policy.save();

  log.info('WalletPolicySet: {} maxTxValue={} dailyEthLimit={}', [
    wallet,
    policyData.maxTxValue.toString(),
    policyData.dailyEthLimit.toString(),
  ]);
}

export function handlePolicyEvaluated(event: PolicyEvaluated): void {
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

  log.info('PolicyEvaluated: {} {} -> {} decision={} reason={}', [
    evaluation.operator,
    evaluation.from,
    evaluation.to,
    evaluation.decision,
    evaluation.reason,
  ]);
}
