import {
  TokenTransfer,
  TokenTransferBlocked,
  KYCStatus,
  TokenPolicy,
} from '../../generated/schema';
import {
  Transfer,
  TransferBlocked,
  KYCStatusUpdated,
  PolicyUpdated,
} from '../../generated/CompliantStableCoin/CompliantStableCoin';
import { BigInt, log } from '@graphprotocol/graph-ts';

export function handleTransfer(event: Transfer): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let transfer = new TokenTransfer(id);
  transfer.from = event.params.from.toHexString();
  transfer.to = event.params.to.toHexString();
  transfer.amount = event.params.value;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash.toHexString();
  transfer.save();

  log.info('[handleTransfer] from={} to={} amount={}', [
    transfer.from,
    transfer.to,
    transfer.amount.toString(),
  ]);
}

export function handleTransferBlocked(event: TransferBlocked): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let blocked = new TokenTransferBlocked(id);
  blocked.from = event.params.from.toHexString();
  blocked.to = event.params.to.toHexString();
  blocked.amount = event.params.amount;
  blocked.reason = event.params.reason;
  blocked.timestamp = event.block.timestamp;
  blocked.blockNumber = event.block.number;
  blocked.transactionHash = event.transaction.hash.toHexString();
  blocked.save();

  log.info('[handleTransferBlocked] from={} to={} amount={} reason={}', [
    blocked.from,
    blocked.to,
    blocked.amount.toString(),
    blocked.reason,
  ]);
}

export function handleKYCStatusUpdated(event: KYCStatusUpdated): void {
  let account = event.params.account.toHexString();
  let status = KYCStatus.load(account);
  if (!status) {
    status = new KYCStatus(account);
    status.account = account;
  }
  status.verified = event.params.verified;
  status.updatedAt = event.block.timestamp;
  status.blockNumber = event.block.number;
  status.transactionHash = event.transaction.hash.toHexString();
  status.save();

  log.info('[handleKYCStatusUpdated] account={} verified={}', [
    account,
    event.params.verified ? 'true' : 'false',
  ]);
}

export function handlePolicyUpdated(event: PolicyUpdated): void {
  let policy = TokenPolicy.load('policy');
  if (!policy) {
    policy = new TokenPolicy('policy');
  }
  policy.maxTxAmount = event.params.maxTxAmount;
  policy.dailyLimit = event.params.dailyLimit;
  policy.allowMediumRisk = event.params.allowMediumRisk;
  policy.allowHighRisk = event.params.allowHighRisk;
  policy.blockMixer = event.params.blockMixer;
  policy.requireDestinationKYC = event.params.requireDestinationKYC;
  policy.cooldownPeriod = event.params.cooldownPeriod;
  policy.updatedAt = event.block.timestamp;
  policy.blockNumber = event.block.number;
  policy.transactionHash = event.transaction.hash.toHexString();
  policy.save();

  log.info('[handlePolicyUpdated] maxTxAmount={} dailyLimit={}', [
    event.params.maxTxAmount.toString(),
    event.params.dailyLimit.toString(),
  ]);
}
