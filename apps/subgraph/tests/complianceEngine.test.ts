import { assert, describe, test, beforeAll, afterEach, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  handleComplianceCheckPerformed,
  handleTransactionBlocked,
  handleTransactionQuarantined,
  handleQuarantineReleased,
  handleRulePaused,
  handleRuleUnpaused,
} from "../src/mappings/complianceEngine";
import {
  ComplianceCheckPerformed,
  TransactionBlocked,
  TransactionQuarantined,
  QuarantineReleased,
  RulePaused,
  RuleUnpaused,
} from "../generated/ComplianceEngine/ComplianceEngine";
import { newMockEvent } from "matchstick-as";

// Helper functions
function createComplianceCheckEvent(
  addr: Address,
  riskScore: BigInt,
  isCompliant: boolean,
  checkType: Bytes
): ComplianceCheckPerformed {
  let mockEvent = changetype<ComplianceCheckPerformed>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("addr", ethereum.Value.fromAddress(addr)),
    new ethereum.EventParam("riskScore", ethereum.Value.fromUnsignedBigInt(riskScore)),
    new ethereum.EventParam("isCompliant", ethereum.Value.fromBoolean(isCompliant)),
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(mockEvent.block.timestamp)),
    new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(mockEvent.block.number)),
    new ethereum.EventParam("checkType", ethereum.Value.fromBytes(checkType))
  ];
  return mockEvent;
}

function createTransactionBlockedEvent(
  from: Address,
  to: Address,
  amount: BigInt,
  token: Address,
  reason: string
): TransactionBlocked {
  let mockEvent = changetype<TransactionBlocked>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from)),
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)),
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token)),
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason)),
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(mockEvent.block.timestamp)),
    new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(mockEvent.block.number))
  ];
  return mockEvent;
}

function createTransactionQuarantinedEvent(
  from: Address,
  to: Address,
  amount: BigInt,
  token: Address,
  quarantineId: Bytes
): TransactionQuarantined {
  let mockEvent = changetype<TransactionQuarantined>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from)),
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)),
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token)),
    new ethereum.EventParam("quarantineId", ethereum.Value.fromBytes(quarantineId)),
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(mockEvent.block.timestamp)),
    new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(mockEvent.block.number))
  ];
  return mockEvent;
}

function createQuarantineReleasedEvent(
  quarantineId: Bytes,
  operator: Address
): QuarantineReleased {
  let mockEvent = changetype<QuarantineReleased>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(2000);
  mockEvent.block.number = BigInt.fromI32(2);
  mockEvent.transaction.hash = Bytes.fromHexString("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("quarantineId", ethereum.Value.fromBytes(quarantineId)),
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)),
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(mockEvent.block.timestamp))
  ];
  return mockEvent;
}

function createRulePausedEvent(ruleId: Bytes): RulePaused {
  let mockEvent = changetype<RulePaused>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("ruleId", ethereum.Value.fromBytes(ruleId))
  ];
  return mockEvent;
}

function createRuleUnpausedEvent(ruleId: Bytes): RuleUnpaused {
  let mockEvent = changetype<RuleUnpaused>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("ruleId", ethereum.Value.fromBytes(ruleId))
  ];
  return mockEvent;
}

describe("ComplianceEngine Handlers", () => {
  afterEach(() => {
    clearStore();
  });
  beforeAll(() => {
    clearStore();
  });

  test("handleComplianceCheckPerformed creates ComplianceCheck entity for ALLOW", () => {
    let addr = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;
    let event = createComplianceCheckEvent(addr, BigInt.fromI32(30), true, checkType);
    handleComplianceCheckPerformed(event);

    assert.entityCount("ComplianceCheck", 1);
    assert.entityCount("ProtocolStats", 1);
    assert.entityCount("DailyStats", 1);
    assert.entityCount("HourlyStats", 1);
    assert.fieldEquals("ProtocolStats", "stats", "totalAllowed", "1");
    assert.fieldEquals("ProtocolStats", "stats", "totalBlocked", "0");
  });

  test("handleComplianceCheckPerformed creates ComplianceCheck entity for BLOCK", () => {
    clearStore();
    let addr = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;
    let event = createComplianceCheckEvent(addr, BigInt.fromI32(90), false, checkType);
    handleComplianceCheckPerformed(event);

    assert.entityCount("ComplianceCheck", 1);
    assert.fieldEquals("ProtocolStats", "stats", "totalBlocked", "1");
    assert.fieldEquals("ProtocolStats", "stats", "totalAllowed", "0");
  });

  test("handleTransactionBlocked creates ComplianceCheck with BLOCK decision", () => {
    clearStore();
    let from = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let to = Address.fromString("0x1111111111111111111111111111111111111111");
    let event = createTransactionBlockedEvent(from, to, BigInt.fromI32(1000000), Address.zero(), "High risk");
    handleTransactionBlocked(event);

    assert.entityCount("ComplianceCheck", 1);
    assert.fieldEquals("ProtocolStats", "stats", "totalBlocked", "1");
  });

  test("handleTransactionQuarantined creates HoldRecord and updates stats", () => {
    clearStore();
    let from = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let to = Address.fromString("0x1111111111111111111111111111111111111111");
    let quarantineId = Bytes.fromHexString("0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678") as Bytes;
    let event = createTransactionQuarantinedEvent(from, to, BigInt.fromI32(500000), Address.zero(), quarantineId);
    handleTransactionQuarantined(event);

    assert.entityCount("HoldRecord", 1);
    assert.fieldEquals("ProtocolStats", "stats", "totalHeld", "1");
    assert.fieldEquals("ProtocolStats", "stats", "totalFundsHeld", "500000");
  });

  test("handleQuarantineReleased updates HoldRecord and decrements stats", () => {
    clearStore();
    let from = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let to = Address.fromString("0x1111111111111111111111111111111111111111");
    let quarantineId = Bytes.fromHexString("0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678") as Bytes;
    let operator = Address.fromString("0x0000000000000000000000000000000000000002");

    let qEvent = createTransactionQuarantinedEvent(from, to, BigInt.fromI32(500000), Address.zero(), quarantineId);
    handleTransactionQuarantined(qEvent);

    let rEvent = createQuarantineReleasedEvent(quarantineId, operator);
    handleQuarantineReleased(rEvent);

    assert.fieldEquals("HoldRecord", quarantineId.toHexString(), "released", "true");
    assert.fieldEquals("HoldRecord", quarantineId.toHexString(), "releasedBy", operator.toHexString());
    assert.fieldEquals("ProtocolStats", "stats", "totalFundsHeld", "0");
  });

  test("handleRulePaused creates OperationLog", () => {
    clearStore();
    let ruleId = Bytes.fromHexString("0x1111111111111111111111111111111111111111111111111111111111111111") as Bytes;
    let event = createRulePausedEvent(ruleId);
    handleRulePaused(event);

    assert.entityCount("OperationLog", 1);
    assert.fieldEquals("OperationLog", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef-0", "operationType", "RULE_PAUSE");
  });

  test("handleRuleUnpaused creates OperationLog", () => {
    clearStore();
    let ruleId = Bytes.fromHexString("0x1111111111111111111111111111111111111111111111111111111111111111") as Bytes;
    let event = createRuleUnpausedEvent(ruleId);
    handleRuleUnpaused(event);

    assert.entityCount("OperationLog", 1);
    assert.fieldEquals("OperationLog", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef-0", "operationType", "RULE_UNPAUSE");
  });

  test("DailyStats tracks unique addresses correctly", () => {
    clearStore();
    let addr1 = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let addr2 = Address.fromString("0x1111111111111111111111111111111111111111");
    let checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;

    let event1 = createComplianceCheckEvent(addr1, BigInt.fromI32(30), true, checkType);
    handleComplianceCheckPerformed(event1);

    let event2 = createComplianceCheckEvent(addr2, BigInt.fromI32(40), true, checkType);
    handleComplianceCheckPerformed(event2);

    // Check DailyStatsAddress entities
    assert.entityCount("DailyStatsAddress", 2);
    assert.fieldEquals("DailyStats", "1970-01-01", "uniqueAddresses", "2");
  });

  test("ProtocolStats race condition - concurrent updates maintain consistency", () => {
    clearStore();
    let addr = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;

    // Multiple checks in same block
    for (let i = 0; i < 10; i++) {
      let event = createComplianceCheckEvent(addr, BigInt.fromI32(30), true, checkType);
      event.logIndex = BigInt.fromI32(i);
      handleComplianceCheckPerformed(event);
    }

    assert.fieldEquals("ProtocolStats", "stats", "totalComplianceChecks", "10");
    assert.fieldEquals("ProtocolStats", "stats", "totalAllowed", "10");
  });

  test("Data consistency - ComplianceCheck and ProtocolStats alignment", () => {
    clearStore();
    let addr = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;

    let event = createComplianceCheckEvent(addr, BigInt.fromI32(50), false, checkType);
    handleComplianceCheckPerformed(event);

    // ComplianceCheck count should match ProtocolStats
    assert.entityCount("ComplianceCheck", 1);
    assert.fieldEquals("ProtocolStats", "stats", "totalComplianceChecks", "1");
    assert.fieldEquals("ProtocolStats", "stats", "totalBlocked", "1");
  });
});
