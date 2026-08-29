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
  event.logIndex = BigInt.fromI32(0);
  return event;
}

describe("RiskRegistry handlers", () => {
  afterEach(() => {
    clearStore();
  });

  test("handleRiskProfileUpdated creates RiskProfile", () => {
    let event = createMockEvent<RiskProfileUpdated>();
    event.params.account = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    event.params.riskScore = 75;
    event.params.tier = 2;
    event.params.isSanctioned = false;

    handleRiskProfileUpdated(event);

    assert.entityCount("RiskProfile", 1);
    assert.fieldEquals("RiskProfile", "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", "riskScore", "75");
    assert.fieldEquals("RiskProfile", "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", "tier", "MEDIUM");
  });

  test("handleRiskProfileUpdated creates SanctionedAddress when sanctioned", () => {
    let event = createMockEvent<RiskProfileUpdated>();
    event.params.account = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    event.params.riskScore = 95;
    event.params.tier = 4;
    event.params.isSanctioned = true;

    handleRiskProfileUpdated(event);

    assert.entityCount("SanctionedAddress", 1);
    assert.fieldEquals("SanctionedAddress", "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", "isActive", "true");
  });

  test("handleAddressTagged adds tag to RiskProfile", () => {
    // First create a profile
    let profileEvent = createMockEvent<RiskProfileUpdated>();
    profileEvent.params.account = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    profileEvent.params.riskScore = 50;
    profileEvent.params.tier = 1;
    profileEvent.params.isSanctioned = false;
    handleRiskProfileUpdated(profileEvent);

    // Then tag it
    let tagEvent = createMockEvent<AddressTagged>();
    tagEvent.params.account = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    tagEvent.params.tag = Bytes.fromHexString("0x65786368616e6765000000000000000000000000000000000000000000000000") as Bytes;
    handleAddressTagged(tagEvent);

    let profile = assert.fieldEquals("RiskProfile", "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", "tags", "[exchange]");
  });

  test("handleSanctionAdded marks address as sanctioned", () => {
    let event = createMockEvent<SanctionAdded>();
    event.params.account = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    event.params.reason = "OFAC list";

    handleSanctionAdded(event);

    assert.entityCount("SanctionedAddress", 1);
    assert.fieldEquals("SanctionedAddress", "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", "reason", "OFAC list");
  });

  test("handleSanctionRemoved deactivates sanction", () => {
    // First add sanction
    let addEvent = createMockEvent<SanctionAdded>();
    addEvent.params.account = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    addEvent.params.reason = "Test";
    handleSanctionAdded(addEvent);

    // Then remove
    let removeEvent = createMockEvent<SanctionRemoved>();
    removeEvent.params.account = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    handleSanctionRemoved(removeEvent);

    assert.fieldEquals("SanctionedAddress", "0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee", "isActive", "false");
  });
});

describe("ComplianceEngine handlers", () => {
  afterEach(() => {
    clearStore();
  });

  test("handleComplianceCheckPerformed creates ComplianceCheck", () => {
    let event = createMockEvent<ComplianceCheckPerformed>();
    event.params.addr = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    event.params.riskScore = BigInt.fromI32(50);
    event.params.isCompliant = true;
    event.params.checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;

    handleComplianceCheckPerformed(event);

    assert.entityCount("ComplianceCheck", 1);
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "decision", "ALLOW");
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "riskScore", "50");
  });

  test("handleTransactionBlocked creates blocked check", () => {
    let event = createMockEvent<TransactionBlocked>();
    event.params.from = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    event.params.to = Address.fromString("0x8ba1f109551bD432803012645Hac136c82C3e8C");
    event.params.amount = BigInt.fromI32(1000);
    event.params.reason = "Sanctioned";
    event.params.token = Address.zero();

    handleTransactionBlocked(event);

    assert.entityCount("ComplianceCheck", 1);
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "decision", "BLOCK");
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "reason", "Sanctioned");
  });

  test("handleTransactionQuarantined creates HoldRecord", () => {
    let event = createMockEvent<TransactionQuarantined>();
    event.params.from = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    event.params.to = Address.fromString("0x8ba1f109551bD432803012645Hac136c82C3e8C");
    event.params.amount = BigInt.fromI32(500);
    event.params.token = Address.zero();
    event.params.quarantineId = Bytes.fromHexString("0xabcd") as Bytes;

    handleTransactionQuarantined(event);

    assert.entityCount("HoldRecord", 1);
    assert.fieldEquals("HoldRecord", "0xabcd", "released", "false");
    assert.fieldEquals("HoldRecord", "0xabcd", "amount", "500");
  });

  test("handleQuarantineReleased updates HoldRecord", () => {
    // First quarantine
    let qEvent = createMockEvent<TransactionQuarantined>();
    qEvent.params.from = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    qEvent.params.to = Address.fromString("0x8ba1f109551bD432803012645Hac136c82C3e8C");
    qEvent.params.amount = BigInt.fromI32(500);
    qEvent.params.token = Address.zero();
    qEvent.params.quarantineId = Bytes.fromHexString("0xabcd") as Bytes;
    handleTransactionQuarantined(qEvent);

    // Then release
    let rEvent = createMockEvent<QuarantineReleased>();
    rEvent.params.quarantineId = Bytes.fromHexString("0xabcd") as Bytes;
    rEvent.params.operator = Address.fromString("0x1111111111111111111111111111111111111111");
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
      event.params.addr = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
      event.params.riskScore = BigInt.fromI32(50);
      event.params.isCompliant = i % 2 === 0;
      event.params.checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;
      event.logIndex = BigInt.fromI32(i);
      handleComplianceCheckPerformed(event);
    }

    assert.entityCount("ComplianceCheck", 5);
    assert.fieldEquals("ProtocolStats", "stats", "totalComplianceChecks", "5");
  });

  test("data consistency between ComplianceCheck and ProtocolStats", () => {
    let event = createMockEvent<ComplianceCheckPerformed>();
    event.params.addr = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");
    event.params.riskScore = BigInt.fromI32(85);
    event.params.isCompliant = false;
    event.params.checkType = Bytes.fromHexString("0x6164647265737300000000000000000000000000000000000000000000000000") as Bytes;

    handleComplianceCheckPerformed(event);

    // Check both entities are consistent
    assert.fieldEquals("ComplianceCheck", "0x1234-0", "decision", "BLOCK");
    assert.fieldEquals("ProtocolStats", "stats", "totalBlocked", "1");
    assert.fieldEquals("ProtocolStats", "stats", "totalComplianceChecks", "1");
  });
});
