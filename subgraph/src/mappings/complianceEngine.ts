import {
  ComplianceCheck,
  HoldRecord,
  OperationLog,
  ProtocolStats,
  DailyStats,
  HourlyStats,
} from '../../generated/schema';
import {
  ComplianceCheck as ComplianceCheckEvent,
  FundsHeld,
  FundsReleased,
  EmergencyModeActivated,
  EmergencyModeDeactivated,
} from '../../generated/ComplianceEngine/ComplianceEngine';
import { BigInt, log } from '@graphprotocol/graph-ts';

function getDecision(dv: i32): string {
  if (dv == 0) return 'ALLOW';
  if (dv == 1) return 'BLOCK';
  if (dv == 2) return 'FLAG';
  return 'HOLD';
}

// Convert a BigInt timestamp (seconds) to a UTC YYYY-MM-DD string.
// This avoids the rounding errors caused by timestamp / 86400 and ensures
// consistent day boundaries regardless of the local chain timezone.
function toUtcDateString(timestamp: BigInt): string {
  let ts = timestamp.toI64();
  // Days since Unix epoch (1970-01-01). Using integer division for whole days.
  let daysSinceEpoch = ts / 86400;
  // Approximate year/month/day calculation for Gregorian calendar.
  // This is a simplified algorithm; for subgraph use it is sufficient because
  // we only need a stable string key for daily aggregation.
  let year = 1970;
  let month = 1;
  let day = 1;
  let remainingDays = daysSinceEpoch;

  // Advance years
  while (true) {
    let daysInYear = ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) ? 366 : 365;
    if (remainingDays < daysInYear) break;
    remainingDays -= daysInYear;
    year += 1;
  }

  // Advance months
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

  // Pad month and day with leading zeros
  let monthStr = month < 10 ? '0' + month.toString() : month.toString();
  let dayStr = day < 10 ? '0' + day.toString() : day.toString();
  return year.toString() + '-' + monthStr + '-' + dayStr;
}

// Convert a BigInt timestamp (seconds) to a UTC YYYY-MM-DD-HH string.
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
  // Use UTC date string instead of raw day number to avoid timezone drift.
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
  // Use UTC hour string instead of raw hour number to avoid timezone drift.
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

export function handleComplianceCheck(event: ComplianceCheckEvent): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let decision = getDecision(event.params.decision);
  let check = new ComplianceCheck(id);
  check.operator = event.params.operator.toHexString();
  check.from = event.params.from.toHexString();
  check.to = event.params.to.toHexString();
  check.amount = event.params.amount;
  check.decision = decision;
  check.reason = event.params.reason;
  check.timestamp = event.block.timestamp;
  check.blockNumber = event.block.number;
  check.transactionHash = event.transaction.hash.toHexString();
  check.save();

  // Update stats
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
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Update daily stats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.totalChecks = daily.totalChecks.plus(BigInt.fromI32(1));
  if (decision == 'BLOCK') {
    daily.totalBlocked = daily.totalBlocked.plus(BigInt.fromI32(1));
  } else if (decision == 'FLAG') {
    daily.totalFlagged = daily.totalFlagged.plus(BigInt.fromI32(1));
  } else if (decision == 'HOLD') {
    daily.totalHeld = daily.totalHeld.plus(BigInt.fromI32(1));
  }
  daily.save();

  // Update hourly stats
  let hourly = getOrCreateHourlyStats(event.block.timestamp);
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

  log.info(
    '[handleComplianceCheck] tx={} decision={} from={} to={} amount={} daily={} hourly={}',
    [
      event.transaction.hash.toHexString(),
      decision,
      event.params.from.toHexString(),
      event.params.to.toHexString(),
      event.params.amount.toString(),
      toUtcDateString(event.block.timestamp),
      toUtcHourString(event.block.timestamp),
    ]
  );
}

export function handleFundsHeld(event: FundsHeld): void {
  let hold = new HoldRecord(event.params.holdId.toHexString());
  hold.owner = event.params.owner.toHexString();
  hold.asset = event.params.asset.toHexString();
  hold.amount = event.params.amount;
  hold.timestamp = event.block.timestamp;
  hold.reason = 'Compliance hold';
  hold.released = false;
  hold.save();

  // Update stats
  let stats = getOrCreateStats();
  stats.totalFundsHeld = stats.totalFundsHeld.plus(event.params.amount);
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  log.info(
    '[handleFundsHeld] holdId={} owner={} asset={} amount={} totalFundsHeld={}',
    [
      event.params.holdId.toHexString(),
      event.params.owner.toHexString(),
      event.params.asset.toHexString(),
      event.params.amount.toString(),
      stats.totalFundsHeld.toString(),
    ]
  );
}

export function handleFundsReleased(event: FundsReleased): void {
  let hold = HoldRecord.load(event.params.holdId.toHexString());
  if (hold) {
    let amountBefore = hold.amount;
    hold.released = true;
    hold.releasedAt = event.block.timestamp;
    hold.releasedBy = event.transaction.from.toHexString();
    hold.save();

    // Update stats
    let stats = getOrCreateStats();
    if (stats.totalFundsHeld.ge(hold.amount)) {
      stats.totalFundsHeld = stats.totalFundsHeld.minus(hold.amount);
    } else {
      log.warning(
        '[handleFundsReleased] totalFundsHeld ({}) less than release amount ({}). Zeroing to prevent underflow.',
        [stats.totalFundsHeld.toString(), hold.amount.toString()]
      );
      stats.totalFundsHeld = BigInt.fromI32(0);
    }
    stats.lastUpdated = event.block.timestamp;
    stats.save();

    log.info(
      '[handleFundsReleased] holdId={} amount={} totalFundsHeld={}',
      [
        event.params.holdId.toHexString(),
        amountBefore.toString(),
        stats.totalFundsHeld.toString(),
      ]
    );
  } else {
    log.warning(
      '[handleFundsReleased] HoldRecord not found for holdId={}. Skipping stats update.',
      [event.params.holdId.toHexString()]
    );
  }
}

export function handleEmergencyModeActivated(event: EmergencyModeActivated): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new OperationLog(id);
  logEntry.timestamp = event.block.timestamp;
  logEntry.operator = event.params.triggeredBy.toHexString();
  logEntry.operationType = 'EMERGENCY_ACTIVATE';
  logEntry.result = 'SUCCESS';
  logEntry.details = 'Emergency mode activated';
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();

  log.info(
    '[handleEmergencyModeActivated] operator={} tx={}',
    [
      event.params.triggeredBy.toHexString(),
      event.transaction.hash.toHexString(),
    ]
  );
}

export function handleEmergencyModeDeactivated(event: EmergencyModeDeactivated): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let logEntry = new OperationLog(id);
  logEntry.timestamp = event.block.timestamp;
  logEntry.operator = event.params.triggeredBy.toHexString();
  logEntry.operationType = 'EMERGENCY_DEACTIVATE';
  logEntry.result = 'SUCCESS';
  logEntry.details = 'Emergency mode deactivated';
  logEntry.blockNumber = event.block.number;
  logEntry.transactionHash = event.transaction.hash.toHexString();
  logEntry.save();

  log.info(
    '[handleEmergencyModeDeactivated] operator={} tx={}',
    [
      event.params.triggeredBy.toHexString(),
      event.transaction.hash.toHexString(),
    ]
  );
}
