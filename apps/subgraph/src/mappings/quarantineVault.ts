import {
  FundsFrozen,
  FundsQuarantined,
  FundsReleased,
  ClaimDelayUpdated,
} from '../../generated/QuarantineVault/QuarantineVault'
import { QuarantineRecord, QuarantineRelease } from '../../generated/schema'
import { BigInt, log } from '@graphprotocol/graph-ts'

export function handleFundsFrozen(event: FundsFrozen): void {
  let id = event.params.recordId.toHexString()
  let record = new QuarantineRecord(id)
  record.owner = event.params.originalOwner.toHexString()
  record.asset = event.params.token.toHexString()
  record.amount = event.params.amount
  record.reason = 'Frozen by admin'
  record.timestamp = event.block.timestamp
  record.blockNumber = event.block.number
  record.transactionHash = event.transaction.hash.toHexString()
  record.released = false
  record.expired = false
  record.save()
}

export function handleFundsQuarantined(event: FundsQuarantined): void {
  let id = event.params.recordId.toHexString()
  let record = new QuarantineRecord(id)
  record.owner = event.params.originalOwner.toHexString()
  record.asset = event.params.token.toHexString()
  record.amount = event.params.amount
  record.reason = event.params.reason
  record.timestamp = event.block.timestamp
  record.blockNumber = event.block.number
  record.transactionHash = event.transaction.hash.toHexString()
  record.released = false
  record.expired = false
  record.save()
}

export function handleFundsReleased(event: FundsReleased): void {
  let id = event.params.recordId.toHexString()
  let record = QuarantineRecord.load(id)
  if (record) {
    record.released = true
    record.releasedAt = event.block.timestamp
    record.save()
  }

  let releaseId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  let release = new QuarantineRelease(releaseId)
  release.quarantineId = id
  release.owner = event.params.originalOwner.toHexString()
  release.amount = event.params.amount
  release.timestamp = event.block.timestamp
  release.blockNumber = event.block.number
  release.transactionHash = event.transaction.hash.toHexString()
  release.save()
}

export function handleClaimDelayUpdated(event: ClaimDelayUpdated): void {
  log.info('[handleClaimDelayUpdated] newDelay={}', [event.params.newDelay.toString()])
}
