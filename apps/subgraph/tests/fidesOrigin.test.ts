import { assert, describe, test, clearStore, beforeAll, afterEach } from "matchstick-as/assembly/index";
import { newMockEvent } from "matchstick-as";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { handleRiskProfileUpdated, handleAddressTagged, handleSanctionAdded, handleSanctionRemoved } from "../src/mappings/riskRegistry";
import { handleComplianceCheckPerformed, handleTransactionBlocked, handleTransactionQuarantined, handleQuarantineReleased } from "../src/mappings/complianceEngine";
import { RiskProfileUpdated, AddressTagged, SanctionAdded, SanctionRemoved } from "../generated/RiskRegistry/RiskRegistry";
import { ComplianceCheckPerformed, TransactionBlocked, TransactionQuarantined, QuarantineReleased } from "../generated/ComplianceEngine/ComplianceEngine";

function createMockEvent<T>(): T {
  let event = changetype<T>(newMockEvent());
  event.address = Address.fromString("0x953f985f38f94d6159c0600d1f15D543895cE896");
  event.transaction.hash = Bytes.fromHexString("0x1234") as Bytes;
  event.logIndex = BigInt.fromI32(0);
  return event;
}

describe("RiskRegistry handlers", () => {
  afterEach(() => {
    clearStore();
  });

  test("handleRiskProfileUpdated creates RiskProfile", () => {
    let event = createMockEvent<RiskProfileUpdated>();
    event.parameters = [
      new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("riskScore", ethereum.Value.fromI32(75)),
      new ethereum.EventParam("tier", ethereum.Value.fromI32(2)),
      new ethereum.EventParam("isSanctioned", ethereum.Value.fromBoolean(false))
    ];

    handleRiskProfileUpdated(event);

    assert.entityCount("RiskProfile", 1);
    assert.fieldEquals("RiskProfile", "0x742d35cc6634c0532925a3b844bc9e7595f8deee", "riskScore", "75");
    assert.fieldEquals("RiskProfile", "0x742d35cc6634c0532925a3b844bc9e7595f8deee", "tier", "MEDIUM");
  });

  test("handleRiskProfileUpdated creates SanctionedAddress when sanctioned", () => {
    let event = createMockEvent<RiskProfileUpdated>();
    event.parameters = [
      new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("riskScore", ethereum.Value.fromI32(95)),
      new ethereum.EventParam("tier", ethereum.Value.fromI32(4)),
      new ethereum.EventParam("isSanctioned", ethereum.Value.fromBoolean(true))
    ];

    handleRiskProfileUpdated(event);

    assert.entityCount("SanctionedAddress", 1);
    assert.fieldEquals("SanctionedAddress", "0x742d35cc6634c0532925a3b844bc9e7595f8deee", "isActive", "true");
  });

  test("handleAddressTagged adds tag to RiskProfile", () => {
    // First create a profile
    let profileEvent = createMockEvent<RiskProfileUpdated>();
    profileEvent.parameters = [
      new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("riskScore", ethereum.Value.fromI32(50)),
      new ethereum.EventParam("tier", ethereum.Value.fromI32(1)),
      new ethereum.EventParam("isSanctioned", ethereum.Value.fromBoolean(false))
    ];
    handleRiskProfileUpdated(profileEvent);

    // Then tag it
    let tagEvent = createMockEvent<AddressTagged>();
    tagEvent.parameters = [
      new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("tag", ethereum.Value.fromBytes(Bytes.fromHexString("0x65786368616e6765000000000000000000000000000000000000000000000000") as Bytes))
    ];
    handleAddressTagged(tagEvent);

    assert.fieldEquals("RiskProfile", "0x742d35cc6634c0532925a3b844bc9e7595f8deee", "tags", "[0x65786368616e6765000000000000000000000000000000000000000000000000]");
  });

  test("handleSanctionAdded marks address as sanctioned", () => {
    let event = createMockEvent<SanctionAdded>();
    event.parameters = [
      new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("reason", ethereum.Value.fromString("OFAC list"))
    ];

    handleSanctionAdded(event);

    assert.entityCount("SanctionedAddress", 1);
    assert.fieldEquals("SanctionedAddress", "0x742d35cc6634c0532925a3b844bc9e7595f8deee", "reason", "OFAC list");
  });

  test("handleSanctionRemoved deactivates sanction", () => {
    // First add sanction
    let addEvent = createMockEvent<SanctionAdded>();
    addEvent.parameters = [
      new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("reason", ethereum.Value.fromString("Test"))
    ];
    handleSanctionAdded(addEvent);

    // Then remove
    let removeEvent = createMockEvent<SanctionRemoved>();
    removeEvent.parameters = [
      new ethereum.EventParam("account", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee")))
    ];
    handleSanctionRemoved(removeEvent);

    assert.fieldEquals("SanctionedAddress", "0x742d35cc6634c0532925a3b844bc9e7595f8deee", "isActive", "false");
  });
});

describe("ComplianceEngine handlers", () => {
  afterEach(() => {
    clearStore();
  });

  test("handleComplianceCheckPerformed creates ComplianceCheck", () => {
    let event = createMockEvent<ComplianceCheckPerformed>();
    event.parameters = [
      new ethereum.EventParam("addr", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("riskScore", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))),
      new ethereum.EventParam("isCompliant", ethereum.Value.fromBoolean(true)),
      new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
      new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
      new ethereum.EventParam("checkType", ethereum.Value.fromBytes(Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes))
    ];

    handleComplianceCheckPerformed(event);

    assert.entityCount("ComplianceCheck", 1);
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "decision", "ALLOW");
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "riskScore", "50");
  });

  test("handleTransactionBlocked creates blocked check", () => {
    let event = createMockEvent<TransactionBlocked>();
    event.parameters = [
      new ethereum.EventParam("from", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("to", ethereum.Value.fromAddress(Address.fromString("0x1111111111111111111111111111111111111111"))),
      new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
      new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.zero())),
      new ethereum.EventParam("reason", ethereum.Value.fromString("Sanctioned")),
      new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
      new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)))
    ];

    handleTransactionBlocked(event);

    assert.entityCount("ComplianceCheck", 1);
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "decision", "BLOCK");
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "reason", "Sanctioned");
  });

  test("handleTransactionQuarantined creates HoldRecord", () => {
    let event = createMockEvent<TransactionQuarantined>();
    event.parameters = [
      new ethereum.EventParam("from", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("to", ethereum.Value.fromAddress(Address.fromString("0x1111111111111111111111111111111111111111"))),
      new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
      new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.zero())),
      new ethereum.EventParam("quarantineId", ethereum.Value.fromBytes(Bytes.fromHexString("0xabcd") as Bytes)),
      new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
      new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)))
    ];

    handleTransactionQuarantined(event);

    assert.entityCount("HoldRecord", 1);
    assert.fieldEquals("HoldRecord", "0xabcd", "released", "false");
    assert.fieldEquals("HoldRecord", "0xabcd", "amount", "500");
  });

  test("handleQuarantineReleased updates HoldRecord", () => {
    // First quarantine
    let qEvent = createMockEvent<TransactionQuarantined>();
    qEvent.parameters = [
      new ethereum.EventParam("from", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("to", ethereum.Value.fromAddress(Address.fromString("0x1111111111111111111111111111111111111111"))),
      new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
      new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.zero())),
      new ethereum.EventParam("quarantineId", ethereum.Value.fromBytes(Bytes.fromHexString("0xabcd") as Bytes)),
      new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
      new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)))
    ];
    handleTransactionQuarantined(qEvent);

    // Then release
    let rEvent = createMockEvent<QuarantineReleased>();
    rEvent.parameters = [
      new ethereum.EventParam("quarantineId", ethereum.Value.fromBytes(Bytes.fromHexString("0xabcd") as Bytes)),
      new ethereum.EventParam("operator", ethereum.Value.fromAddress(Address.fromString("0x1111111111111111111111111111111111111111"))),
      new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)))
    ];
    handleQuarantineReleased(rEvent);

    assert.fieldEquals("HoldRecord", "0xabcd", "released", "true");
  });
});

describe("ProtocolStats race conditions", () => {
  afterEach(() => {
    clearStore();
  });

  test("multiple compliance checks update stats correctly", () => {
    for (let i = 0; i < 5; i++) {
      let event = createMockEvent<ComplianceCheckPerformed>();
      event.parameters = [
        new ethereum.EventParam("addr", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
        new ethereum.EventParam("riskScore", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))),
        new ethereum.EventParam("isCompliant", ethereum.Value.fromBoolean(i % 2 === 0)),
        new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
        new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
        new ethereum.EventParam("checkType", ethereum.Value.fromBytes(Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes))
      ];
      event.logIndex = BigInt.fromI32(i);
      handleComplianceCheckPerformed(event);
    }

    assert.entityCount("ComplianceCheck", 5);
    assert.fieldEquals("ProtocolStats", "stats", "totalComplianceChecks", "5");
  });

  test("data consistency between ComplianceCheck and ProtocolStats", () => {
    let event = createMockEvent<ComplianceCheckPerformed>();
    event.parameters = [
      new ethereum.EventParam("addr", ethereum.Value.fromAddress(Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee"))),
      new ethereum.EventParam("riskScore", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(85))),
      new ethereum.EventParam("isCompliant", ethereum.Value.fromBoolean(false)),
      new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
      new ethereum.EventParam("blockNumber", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))),
      new ethereum.EventParam("checkType", ethereum.Value.fromBytes(Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes))
    ];

    handleComplianceCheckPerformed(event);

    // Check both entities are consistent
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "decision", "BLOCK");
    assert.fieldEquals("ProtocolStats", "stats", "totalBlocked", "1");
    assert.fieldEquals("ProtocolStats", "stats", "totalComplianceChecks", "1");
  });
});
