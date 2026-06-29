import {
  OperationExecuted,
  BatchExecuted,
  AutoQuarantineTriggered,
  BalanceFrozen,
  BalanceReleased,
} from '../../generated/CompliantSmartWalletV3/CompliantSmartWallet';
import {
  WalletOperation,
  BatchExecution,
  QuarantineRecord,
  WalletBalance,
} from '../../generated/schema';
import { BigInt, log } from '@graphprotocol/graph-ts';

function getOpType(ot: i32): string {
  if (ot == 0) return 'TRANSFER';
  if (ot == 1) return 'TOKEN_TRANSFER';
  if (ot == 2) return 'CONTRACT_CALL';
  if (ot == 3) return 'BATCH';
  return 'UNKNOWN';
}

export function handleOperationExecuted(event: OperationExecuted): void {
  let op = new WalletOperation(event.params.opHash.toHexString());
  op.wallet = event.address.toHexString();
  op.opType = getOpType(event.params.opType);
  op.target = event.params.target.toHexString();
  op.value = event.params.value;
  op.success = true;
  op.timestamp = event.block.timestamp;
  op.blockNumber = event.block.number;
  op.transactionHash = event.transaction.hash.toHexString();
  op.save();
}

export function handleBatchExecuted(event: BatchExecuted): void {
  let batch = new BatchExecution(event.transaction.hash.toHexString());
  batch.wallet = event.address.toHexString();
  batch.count = event.params.count;
  batch.successCount = event.params.successCount;
  batch.blockedCount = event.params.blockedCount;
  batch.timestamp = event.block.timestamp;
  batch.blockNumber = event.block.number;
  batch.transactionHash = event.transaction.hash.toHexString();
  batch.save();
}

export function handleAutoQuarantineTriggered(event: AutoQuarantineTriggered): void {
  let record = new QuarantineRecord(event.params.recordId.toHexString());
  record.wallet = event.address.toHexString();
  record.token = event.params.token.toHexString();
  record.amount = event.params.amount;
  record.reason = event.params.reason;
  record.released = false;
  record.timestamp = event.block.timestamp;
  record.blockNumber = event.block.number;
  record.transactionHash = event.transaction.hash.toHexString();
  record.save();

  // Update wallet balance
  let balanceId = event.address.toHexString() + '-' + event.params.token.toHexString();
  let balance = WalletBalance.load(balanceId);
  if (!balance) {
    balance = new WalletBalance(balanceId);
    balance.wallet = event.address.toHexString();
    balance.token = event.params.token.toHexString();
    balance.totalBalance = BigInt.fromI32(0);
    balance.available = BigInt.fromI32(0);
    balance.frozen = BigInt.fromI32(0);
    balance.pendingRisk = BigInt.fromI32(0);
  }
  balance.frozen = balance.frozen.plus(event.params.amount);
  balance.updatedAt = event.block.timestamp;
  balance.save();

  log.info(
    '[handleAutoQuarantineTriggered] wallet={} token={} amount={} balanceId={} frozen={}',
    [
      event.address.toHexString(),
      event.params.token.toHexString(),
      event.params.amount.toString(),
      balanceId,
      balance.frozen.toString(),
    ]
  );
}

export function handleBalanceFrozen(event: BalanceFrozen): void {
  let balanceId = event.address.toHexString() + '-' + event.params.token.toHexString();
  let balance = WalletBalance.load(balanceId);
  if (!balance) {
    balance = new WalletBalance(balanceId);
    balance.wallet = event.address.toHexString();
    balance.token = event.params.token.toHexString();
    balance.totalBalance = BigInt.fromI32(0);
    balance.available = BigInt.fromI32(0);
    balance.frozen = BigInt.fromI32(0);
    balance.pendingRisk = BigInt.fromI32(0);
  }
  balance.frozen = balance.frozen.plus(event.params.amount);
  balance.updatedAt = event.block.timestamp;
  balance.save();

  log.info(
    '[handleBalanceFrozen] wallet={} token={} amount={} balanceId={} frozen={}',
    [
      event.address.toHexString(),
      event.params.token.toHexString(),
      event.params.amount.toString(),
      balanceId,
      balance.frozen.toString(),
    ]
  );
}

export function handleBalanceReleased(event: BalanceReleased): void {
  let balanceId = event.address.toHexString() + '-' + event.params.token.toHexString();
  let balance = WalletBalance.load(balanceId);
  if (!balance) {
    // Data consistency: do NOT create a new balance record for a release
    // event if no prior balance exists. This prevents phantom balances
    // from inflating stats and avoids negative/zero inconsistencies.
    log.warning(
      '[handleBalanceReleased] Balance not found for wallet={} token={} amount={}. Skipping release to prevent phantom balance.',
      [
        event.address.toHexString(),
        event.params.token.toHexString(),
        event.params.amount.toString(),
      ]
    );
    return;
  }

  let frozenBefore = balance.frozen;
  let releaseAmount = event.params.amount;

  if (balance.frozen.ge(releaseAmount)) {
    balance.frozen = balance.frozen.minus(releaseAmount);
    log.info(
      '[handleBalanceReleased] Normal release wallet={} token={} amount={} frozenBefore={} frozenAfter={}',
      [
        event.address.toHexString(),
        event.params.token.toHexString(),
        releaseAmount.toString(),
        frozenBefore.toString(),
        balance.frozen.toString(),
      ]
    );
  } else {
    // Data consistency: release > frozen is an anomaly. Instead of zeroing,
    // mark the delta as pendingRisk so it can be reconciled later.
    let excess = releaseAmount.minus(balance.frozen);
    balance.pendingRisk = balance.pendingRisk.plus(excess);
    balance.frozen = BigInt.fromI32(0);
    log.warning(
      '[handleBalanceReleased] Release exceeds frozen! wallet={} token={} releaseAmount={} frozenBefore={} excess={} pendingRisk={}',
      [
        event.address.toHexString(),
        event.params.token.toHexString(),
        releaseAmount.toString(),
        frozenBefore.toString(),
        excess.toString(),
        balance.pendingRisk.toString(),
      ]
    );
  }

  balance.updatedAt = event.block.timestamp;
  balance.save();
}
