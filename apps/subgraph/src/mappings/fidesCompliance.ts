import {
  TransactionChecked,
  TransactionBlocked,
  TransactionQuarantined,
  EmergencyModeActivated,
  EmergencyModeDeactivated,
  RoleGrantedDetailed,
  RoleRevokedDetailed,
  WhitelistUpdated,
  GuardCheck,
} from '../../generated/FidesCompliance/FidesCompliance';
import {
  FidesComplianceCheck,
  FidesTransactionBlocked,
  FidesTransactionQuarantined,
  FidesAuditLog,
} from '../../generated/schema';
import { BigInt, log } from '@graphprotocol/graph-ts';

// Centralized audit log event type constants (High Fix #6)
const AUDIT_EMERGENCY_ACTIVATED = 'EMERGENCY_ACTIVATED';
const AUDIT_EMERGENCY_DEACTIVATED = 'EMERGENCY_DEACTIVATED';
const AUDIT_ROLE_GRANTED = 'ROLE_GRANTED';
const AUDIT_ROLE_REVOKED = 'ROLE_REVOKED';
const AUDIT_WHITELIST_ADDED = 'WHITELIST_ADDED';
const AUDIT_WHITELIST_REMOVED = 'WHITELIST_REMOVED';

export function handleGuardCheck(event: GuardCheck): void {
  log.info('[handleGuardCheck] from={} to={} action={} riskScore={}', [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.action.toString(),
    event.params.riskScore.toString(),
  ]);
}

export function handleTransactionChecked(event: TransactionChecked): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let check = new FidesComplianceCheck(id);
  check.from = event.params.from.toHexString();
  check.to = event.params.to.toHexString();
  check.amount = event.params.amount;
  check.result = event.params.allowed;
  check.timestamp = event.block.timestamp;
  check.blockNumber = event.block.number;
  check.transactionHash = event.transaction.hash.toHexString();
  check.save();

  log.info('[handleTransactionChecked] from={} to={} amount={} allowed={}', [
    check.from,
    check.to,
    check.amount.toString(),
    event.params.allowed ? 'true' : 'false',
  ]);
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

  log.info('[handleTransactionBlocked] from={} to={} amount={} reason={}', [
    blocked.from,
    blocked.to,
    blocked.amount.toString(),
    blocked.reason,
  ]);
}

export function handleTransactionQuarantined(event: TransactionQuarantined): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let quarantined = new FidesTransactionQuarantined(id);
  quarantined.from = event.params.from.toHexString();
  quarantined.to = event.params.to.toHexString();
  quarantined.amount = event.params.amount;
  quarantined.reason = 'Quarantined';
  quarantined.timestamp = event.block.timestamp;
  quarantined.blockNumber = event.block.number;
  quarantined.transactionHash = event.transaction.hash.toHexString();
  quarantined.save();

  log.info('[handleTransactionQuarantined] from={} to={} amount={} quarantineId={}', [
    quarantined.from,
    quarantined.to,
    quarantined.amount.toString(),
    event.params.quarantineId.toHexString(),
  ]);
}

export function handleEmergencyModeActivated(event: EmergencyModeActivated): void {
  let id = 'emergency-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new FidesAuditLog(id);
  logEntry.eventType = AUDIT_EMERGENCY_ACTIVATED;
  logEntry.actor = event.transaction.from.toHexString();
  logEntry.subject = '';
  logEntry.timestamp = event.block.timestamp;
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}

export function handleEmergencyModeDeactivated(event: EmergencyModeDeactivated): void {
  let id = 'emergency-off-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new FidesAuditLog(id);
  logEntry.eventType = AUDIT_EMERGENCY_DEACTIVATED;
  logEntry.actor = event.transaction.from.toHexString();
  logEntry.subject = '';
  logEntry.timestamp = event.block.timestamp;
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}

export function handleRoleGrantedDetailed(event: RoleGrantedDetailed): void {
  let id = 'role-granted-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new FidesAuditLog(id);
  logEntry.eventType = AUDIT_ROLE_GRANTED;
  logEntry.actor = event.params.sender.toHexString();
  logEntry.subject = event.params.account.toHexString();
  logEntry.timestamp = event.block.timestamp;
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}

export function handleRoleRevokedDetailed(event: RoleRevokedDetailed): void {
  let id = 'role-revoked-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new FidesAuditLog(id);
  logEntry.eventType = AUDIT_ROLE_REVOKED;
  logEntry.actor = event.params.sender.toHexString();
  logEntry.subject = event.params.account.toHexString();
  logEntry.timestamp = event.block.timestamp;
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}

export function handleWhitelistUpdated(event: WhitelistUpdated): void {
  let id = 'whitelist-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new FidesAuditLog(id);
  logEntry.eventType = event.params.status ? AUDIT_WHITELIST_ADDED : AUDIT_WHITELIST_REMOVED;
  logEntry.actor = event.params.admin.toHexString();
  logEntry.subject = event.params.account.toHexString();
  logEntry.timestamp = event.block.timestamp;
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}
