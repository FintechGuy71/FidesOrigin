import {
  Policy,
  PolicyVersion,
} from '../../generated/schema';
import {
  IssuerPolicySet,
  WalletPolicySet,
  PolicyEvaluated,
} from '../../generated/PolicyEngine/PolicyEngine';
import { ethereum, BigInt, log } from '@graphprotocol/graph-ts';

// Decision mapping
function getDecision(decisionValue: i32): string {
  if (decisionValue === 0) return 'ALLOW';
  if (decisionValue === 1) return 'BLOCK';
  if (decisionValue === 2) return 'FLAG';
  return 'HOLD';
}

// Handle IssuerPolicySet event
export function handleIssuerPolicySet(event: IssuerPolicySet): void {
  let issuer = event.params.issuer.toHexString();
  let policyData = event.params.policy;

  // Get or create Policy
  let policy = Policy.load(issuer);
  let previousVersion = 0;

  if (!policy) {
    policy = new Policy(issuer);
    policy.issuer = issuer;
    policy.version = 0;
  } else {
    // Deactivate previous version
    let prevVersionId = issuer + '-' + policy.version.toString();
    let prevVersion = PolicyVersion.load(prevVersionId);
    if (prevVersion) {
      prevVersion.active = false;
      prevVersion.save();
    }
    previousVersion = policy.version;
  }

  // Increment version
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

  // Create version snapshot
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

// Handle WalletPolicySet event
export function handleWalletPolicySet(event: WalletPolicySet): void {
  // Wallet policies are tracked but stored differently
  // For now, log the event
  let wallet = event.params.wallet.toHexString();
  log.info('WalletPolicySet: {}', [wallet]);
}

// Handle PolicyEvaluated event
export function handlePolicyEvaluated(event: PolicyEvaluated): void {
  let operator = event.params.operator.toHexString();
  let from = event.params.from.toHexString();
  let to = event.params.to.toHexString();
  let decision = getDecision(event.params.decision as i32);

  log.info('PolicyEvaluated: {} {} -> {} decision={} reason={}', [
    operator,
    from,
    to,
    decision,
    event.params.reason,
  ]);
}
