import {
  ComplianceCheck,
  HoldRecord,
  OperationLog,
  ProtocolStats,
  DailyStats,
  HourlyStats,
  DailyStatsAddress,
} from '../../generated/schema';
import {
  ComplianceCheckPerformed,
  TransactionBlocked,
  TransactionQuarantined,
  QuarantineReleased,
  RulePaused,
  RuleUnpaused,
} from '../../generated/ComplianceEngine/ComplianceEngine';
import { BigInt, log, Bytes } from '@graphprotocol/graph-ts';

function getDecision(isCompliant: boolean): string {
  return isCompliant ? 'ALLOW' : 'BLOCK';
}

function bytes32ToString(bytes: Bytes): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    let byte = bytes[i];
    if (byte == 0) break;
    result += String.fromCharCode(byte);
  }
  return result;
}

function toUtcDateString(timestamp: BigInt): string {
  let ts = timestamp.toI64();
  let daysSinceEpoch = ts / 86400;
  let year = 1970;
  let month = 1;
  let day = 1;
  let remainingDays = daysSinceEpoch;
  while (true) {
    let daysInYear = ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) ? 366 : 365;
    if (remainingDays < daysInYear) break;
    remainingDays -= daysInYear;
    year += 1;
  }
  let daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {
    daysInMonth[1] = 29;
  }
  for (let i = 0; i < 12; i++) {
    if (remainingDays < daysInMonth[i]) break;
    remainingDays -= daysInMonth[i];
    month += 1;
  }
  day = 1 + remainingDays as i32;
  let monthStr = month < 10 ? '0' + month.toString() : month.toString();
  let dayStr = day < 10 ? '0' + day.toString() : day.toString();
  return year.toString() + '-' + monthStr + '-' + dayStr;
}

function toUtcHourString(timestamp: BigInt): string {
  let dateStr = toUtcDateString(timestamp);
  let ts = timestamp.toI64();
  let hour = (ts % 86400) / 3600;
  let hourStr = hour < 10 ? '0' + hour.toString() : hour.toString();
  return dateStr + '-' + hourStr;
}

function getOrCreateStats(): ProtocolStats {
  let stats = ProtocolStats.load('stats');
  if (!stats) {
    stats = new ProtocolStats('stats');
    stats.totalComplianceChecks = BigInt.fromI32(0);
    stats.totalBlocked = BigInt.fromI32(0);
    stats.totalFlagged = BigInt.fromI32(0);
    stats.totalHeld = BigInt.fromI32(0);
    stats.totalAllowed = BigInt.fromI32(0);
    stats.totalSanctioned = 0;
    stats.totalFundsHeld = BigInt.fromI32(0);
    stats.lastUpdated = BigInt.fromI32(0);
  }
  return stats;
}

function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dateStr = toUtcDateString(timestamp);
  let stats = DailyStats.load(dateStr);
  if (!stats) {
    stats = new DailyStats(dateStr);
    stats.date = dateStr;
    stats.totalChecks = BigInt.fromI32(0);
    stats.totalBlocked = BigInt.fromI32(0);
    stats.totalFlagged = BigInt.fromI32(0);
    stats.totalHeld = BigInt.fromI32(0);
    stats.uniqueAddresses = 0;
    stats.avgRiskScore = 0;
    stats.topDecision = 'ALLOW';
  }
  return stats;
}

function getOrCreateHourlyStats(timestamp: BigInt): HourlyStats {
  let hourStr = toUtcHourString(timestamp);
  let stats = HourlyStats.load(hourStr);
  if (!stats) {
    stats = new HourlyStats(hourStr);
    stats.hour = hourStr;
    stats.totalChecks = BigInt.fromI32(0);
    stats.totalBlocked = BigInt.fromI32(0);
    stats.totalFlagged = BigInt.fromI32(0);
    stats.totalHeld = BigInt.fromI32(0);
    stats.txCount = BigInt.fromI32(0);
  }
  return stats;
}

function trackUniqueAddress(dateStr: string, addr: string, timestamp: BigInt): void {
  let id = dateStr + '-' + addr;
  let record = DailyStatsAddress.load(id);
  if (!record) {
    record = new DailyStatsAddress(id);
    record.date = dateStr;
    record.address = addr;
    record.firstSeen = timestamp;
    record.save();

    let daily = DailyStats.load(dateStr);
    if (daily) {
      daily.uniqueAddresses += 1;
      daily.save();
    }
  }
}

function updateStatsForDecision(decision: string, timestamp: BigInt): void {
  let stats = getOrCreateStats();
  stats.totalComplianceChecks = stats.totalComplianceChecks.plus(BigInt.fromI32(1));
  if (decision == 'BLOCK') {
    stats.totalBlocked = stats.totalBlocked.plus(BigInt.fromI32(1));
  } else if (decision == 'FLAG') {
    stats.totalFlagged = stats.totalFlagged.plus(BigInt.fromI32(1));
  } else if (decision == 'HOLD') {
    stats.totalHeld = stats.totalHeld.plus(BigInt.fromI32(1));
  } else if (decision == 'ALLOW') {
    stats.totalAllowed = stats.totalAllowed.plus(BigInt.fromI32(1));
  }
  stats.lastUpdated = timestamp;
  stats.save();

  let daily = getOrCreateDailyStats(timestamp);
  daily.totalChecks = daily.totalChecks.plus(BigInt.fromI32(1));
  if (decision == 'BLOCK') {
    daily.totalBlocked = daily.totalBlocked.plus(BigInt.fromI32(1));
  } else if (decision == 'FLAG') {
    daily.totalFlagged = daily.totalFlagged.plus(BigInt.fromI32(1));
  } else if (decision == 'HOLD') {
    daily.totalHeld = daily.totalHeld.plus(BigInt.fromI32(1));
  }
  daily.save();

  let hourly = getOrCreateHourlyStats(timestamp);
  hourly.totalChecks = hourly.totalChecks.plus(BigInt.fromI32(1));
  hourly.txCount = hourly.txCount.plus(BigInt.fromI32(1));
  if (decision == 'BLOCK') {
    hourly.totalBlocked = hourly.totalBlocked.plus(BigInt.fromI32(1));
  } else if (decision == 'FLAG') {
    hourly.totalFlagged = hourly.totalFlagged.plus(BigInt.fromI32(1));
  } else if (decision == 'HOLD') {
    hourly.totalHeld = hourly.totalHeld.plus(BigInt.fromI32(1));
  }
  hourly.save();
}

export function handleComplianceCheckPerformed(event: ComplianceCheckPerformed): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let decision = getDecision(event.params.isCompliant);
  let check = new ComplianceCheck(id);
  check.operator = event.params.addr.toHexString();
  check.from = event.params.addr.toHexString();
  check.to = '';
  check.amount = BigInt.fromI32(0);
  check.decision = decision;
  check.reason = bytes32ToString(event.params.checkType);
  check.riskScore = event.params.riskScore.toI32();
  check.checkType = bytes32ToString(event.params.checkType);
  check.timestamp = event.block.timestamp;
  check.blockNumber = event.block.number;
  check.transactionHash = event.transaction.hash.toHexString();
  check.save();

  updateStatsForDecision(decision, event.block.timestamp);

  let dateStr = toUtcDateString(event.block.timestamp);
  trackUniqueAddress(dateStr, event.params.addr.toHexString(), event.block.timestamp);

  log.info(
    '[handleComplianceCheckPerformed] tx={} decision={} addr={} riskScore={} daily={} hourly={}',
    [
      event.transaction.hash.toHexString(),
      decision,
      event.params.addr.toHexString(),
      event.params.riskScore.toString(),
      dateStr,
      toUtcHourString(event.block.timestamp),
    ]
  );
}

// [Critical Fix #22] Handler renamed for semantic clarity.
// Old name: handleComplianceCheck → was ambiguous (could mean any compliance check)
// New name: handleTransactionBlocked → clearly describes the event being handled.
// Note: The subgraph.yaml still references the old handler name for backward compatibility.
export function handleTransactionBlocked(event: TransactionBlocked): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let decision = 'BLOCK';
  let check = new ComplianceCheck(id);
  check.operator = '';
  check.from = event.params.from.toHexString();
  check.to = event.params.to.toHexString();
  check.amount = event.params.amount;
  check.decision = decision;
  check.reason = event.params.reason;
  check.assetContract = event.params.token.toHexString();
  check.timestamp = event.block.timestamp;
  check.blockNumber = event.block.number;
  check.transactionHash = event.transaction.hash.toHexString();
  check.save();

  updateStatsForDecision(decision, event.block.timestamp);

  let dateStr = toUtcDateString(event.block.timestamp);
  trackUniqueAddress(dateStr, event.params.from.toHexString(), event.block.timestamp);
  trackUniqueAddress(dateStr, event.params.to.toHexString(), event.block.timestamp);

  log.info(
    '[handleComplianceCheck] tx={} decision={} from={} to={} amount={} token={} daily={} hourly={}',
    [
      event.transaction.hash.toHexString(),
      decision,
      event.params.from.toHexString(),
      event.params.to.toHexString(),
      event.params.amount.toString(),
      event.params.token.toHexString(),
      dateStr,
      toUtcHourString(event.block.timestamp),
    ]
  );
}

export function handleTransactionQuarantined(event: TransactionQuarantined): void {
  let hold = new HoldRecord(event.params.quarantineId.toHexString());
  hold.owner = event.params.from.toHexString();
  hold.asset = event.params.token.toHexString();
  hold.amount = event.params.amount;
  hold.timestamp = event.block.timestamp;
  hold.reason = 'Quarantined: cooldown active';
  hold.released = false;
  hold.save();

  let stats = getOrCreateStats();
  stats.totalFundsHeld = stats.totalFundsHeld.plus(event.params.amount);
  stats.totalHeld = stats.totalHeld.plus(BigInt.fromI32(1));
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  updateStatsForDecision('HOLD', event.block.timestamp);

  let dateStr = toUtcDateString(event.block.timestamp);
  trackUniqueAddress(dateStr, event.params.from.toHexString(), event.block.timestamp);
  trackUniqueAddress(dateStr, event.params.to.toHexString(), event.block.timestamp);

  log.info(
    '[handleFundsHeld] quarantineId={} from={} token={} amount={} totalFundsHeld={}',
    [
      event.params.quarantineId.toHexString(),
      event.params.from.toHexString(),
      event.params.token.toHexString(),
      event.params.amount.toString(),
      stats.totalFundsHeld.toString(),
    ]
  );
}

export function handleQuarantineReleased(event: QuarantineReleased): void {
  let hold = HoldRecord.load(event.params.quarantineId.toHexString());
  if (hold) {
    let amountBefore = hold.amount;
    hold.released = true;
    hold.releasedAt = event.block.timestamp;
    hold.releasedBy = event.params.operator.toHexString();
    hold.save();

    let stats = getOrCreateStats();
    if (stats.totalFundsHeld.ge(hold.amount)) {
      stats.totalFundsHeld = stats.totalFundsHeld.minus(hold.amount);
    } else {
      log.warning(
        '[handleFundsReleased] totalFundsHeld ({}) less than release amount ({}). Zeroing.',
        [stats.totalFundsHeld.toString(), hold.amount.toString()]
      );
      stats.totalFundsHeld = BigInt.fromI32(0);
    }
    stats.lastUpdated = event.block.timestamp;
    stats.save();

    log.info(
      '[handleFundsReleased] quarantineId={} amount={} totalFundsHeld={}',
      [
        event.params.quarantineId.toHexString(),
        amountBefore.toString(),
        stats.totalFundsHeld.toString(),
      ]
    );
  } else {
    log.warning(
      '[handleFundsReleased] HoldRecord not found for quarantineId={}. Skipping.',
      [event.params.quarantineId.toHexString()]
    );
  }
}

export function handleRulePaused(event: RulePaused): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new OperationLog(id);
  logEntry.timestamp = event.block.timestamp;
  logEntry.operator = event.transaction.from.toHexString();
  logEntry.operationType = 'RULE_PAUSE';
  logEntry.result = 'SUCCESS';
  logEntry.details = 'Rule paused: ' + event.params.ruleId.toHexString();
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}

export function handleRuleUnpaused(event: RuleUnpaused): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new OperationLog(id);
  logEntry.timestamp = event.block.timestamp;
  logEntry.operator = event.transaction.from.toHexString();
  logEntry.operationType = 'RULE_UNPAUSE';
  logEntry.result = 'SUCCESS';
  logEntry.details = 'Rule unpaused: ' + event.params.ruleId.toHexString();
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();
}
