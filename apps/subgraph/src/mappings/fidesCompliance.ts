import {
  RiskProfileUpdated,
  ComplianceCheck,
  TransactionBlocked,
  AuditLogCreated,
  RuleCreated,
  RuleUpdated,
} from '../../generated/FidesCompliance/FidesCompliance';
import {
  FidesRiskProfile,
  FidesComplianceCheck,
  FidesTransactionBlocked,
  FidesAuditLog,
  FidesRule,
} from '../../generated/schema';
import { BigInt, log } from '@graphprotocol/graph-ts';

function riskLevelToString(level: i32): string {
  if (level == 0) return 'NONE';
  if (level == 1) return 'LOW';
  if (level == 2) return 'MEDIUM';
  if (level == 3) return 'HIGH';
  if (level == 4) return 'BLACKLIST';
  if (level == 5) return 'WHITELIST';
  return 'UNKNOWN';
}

function ruleTypeToString(t: i32): string {
  if (t == 0) return 'TRANSACTION';
  if (t == 1) return 'VELOCITY';
  if (t == 2) return 'AMOUNT';
  if (t == 3) return 'CUSTOM';
  return 'UNKNOWN';
}

function ruleStatusToString(s: i32): string {
  if (s == 0) return 'DRAFT';
  if (s == 1) return 'ACTIVE';
  if (s == 2) return 'PAUSED';
  if (s == 3) return 'DEPRECATED';
  return 'UNKNOWN';
}

function auditEventTypeToString(t: i32): string {
  if (t == 0) return 'COMPLIANCE_CHECK';
  if (t == 1) return 'RISK_PROFILE_UPDATED';
  if (t == 2) return 'RULE_CREATED';
  if (t == 3) return 'RULE_UPDATED';
  if (t == 4) return 'RULE_ACTIVATED';
  if (t == 5) return 'RULE_PAUSED';
  if (t == 6) return 'RULE_DEPRECATED';
  if (t == 7) return 'CONFIG_UPDATED';
  if (t == 8) return 'EMERGENCY_ACTION';
  if (t == 9) return 'ROLE_GRANTED';
  if (t == 10) return 'ROLE_REVOKED';
  return 'UNKNOWN';
}

export function handleRiskProfileUpdated(event: RiskProfileUpdated): void {
  let profile = FidesRiskProfile.load(event.params.account.toHexString());
  if (!profile) {
    profile = new FidesRiskProfile(event.params.account.toHexString());
  }
  profile.level = riskLevelToString(event.params.level);
  profile.score = event.params.score;
  profile.lastUpdated = event.params.timestamp;
  profile.updatedBy = event.params.updatedBy.toHexString();
  profile.reasonHash = event.params.reasonHash.toHexString();
  profile.save();
}

export function handleComplianceCheck(event: ComplianceCheck): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let check = new FidesComplianceCheck(id);
  check.from = event.params.from.toHexString();
  check.to = event.params.to.toHexString();
  check.amount = event.params.amount;
  check.result = event.params.result;
  check.timestamp = event.block.timestamp;
  check.blockNumber = event.block.number;
  check.transactionHash = event.transaction.hash.toHexString();
  check.save();
}

export function handleTransactionBlocked(event: TransactionBlocked): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let blocked = new FidesTransactionBlocked(id);
  blocked.from = event.params.from.toHexString();
  blocked.to = event.params.to.toHexString();
  blocked.amount = event.params.amount;
  blocked.reason = event.params.reason;
  blocked.timestamp = event.block.timestamp;
  blocked.blockNumber = event.block.number;
  blocked.transactionHash = event.transaction.hash.toHexString();
  blocked.save();
}

export function handleAuditLogCreated(event: AuditLogCreated): void {
  let logEntry = new FidesAuditLog(event.params.logId.toString());
  logEntry.eventType = auditEventTypeToString(event.params.eventType);
  logEntry.actor = event.params.actor.toHexString();
  logEntry.subject = event.params.subject.toHexString();
  logEntry.timestamp = event.block.timestamp;
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}

export function handleRuleCreated(event: RuleCreated): void {
  let rule = new FidesRule(event.params.ruleId.toHexString());
  rule.name = event.params.name;
  rule.ruleType = ruleTypeToString(event.params.ruleType);
  rule.status = 'DRAFT';
  rule.priority = BigInt.fromI32(0);
  rule.creator = event.params.creator.toHexString();
  rule.createdAt = event.params.timestamp;
  rule.updatedAt = event.params.timestamp;
  rule.save();
}

export function handleRuleUpdated(event: RuleUpdated): void {
  let rule = FidesRule.load(event.params.ruleId.toHexString());
  if (!rule) {
    rule = new FidesRule(event.params.ruleId.toHexString());
  }
  rule.status = ruleStatusToString(event.params.status);
  rule.updatedAt = event.params.timestamp;
  rule.save();
}
