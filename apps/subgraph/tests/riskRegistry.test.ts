import { assert, describe, test, beforeAll, afterEach, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  handleRiskProfileUpdated,
  handleAddressTagged,
  handleSanctionAdded,
  handleSanctionRemoved,
  handleContractRegistered,
} from "../src/mappings/riskRegistry";
import {
  RiskProfileUpdated,
  AddressTagged,
  SanctionAdded,
  SanctionRemoved,
  ContractRegistered,
} from "../generated/RiskRegistry/RiskRegistry";
import { newMockEvent } from "matchstick-as";

// Helper to create mock event
function createRiskProfileUpdatedEvent(
  account: Address,
  riskScore: i32,
  tier: i32,
  isSanctioned: boolean
): RiskProfileUpdated {
  let mockEvent = changetype<RiskProfileUpdated>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account)),
    new ethereum.EventParam("riskScore", ethereum.Value.fromI32(riskScore)),
    new ethereum.EventParam("tier", ethereum.Value.fromI32(tier)),
    new ethereum.EventParam("isSanctioned", ethereum.Value.fromBoolean(isSanctioned))
  ];
  return mockEvent;
}

function createAddressTaggedEvent(account: Address, tag: Bytes): AddressTagged {
  let mockEvent = changetype<AddressTagged>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account)),
    new ethereum.EventParam("tag", ethereum.Value.fromBytes(tag))
  ];
  return mockEvent;
}

function createSanctionAddedEvent(account: Address, reason: string): SanctionAdded {
  let mockEvent = changetype<SanctionAdded>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account)),
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason))
  ];
  return mockEvent;
}

function createSanctionRemovedEvent(account: Address): SanctionRemoved {
  let mockEvent = changetype<SanctionRemoved>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(2000);
  mockEvent.block.number = BigInt.fromI32(2);
  mockEvent.transaction.hash = Bytes.fromHexString("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  ];
  return mockEvent;
}

function createContractRegisteredEvent(
  contractAddr: Address,
  contractType: Bytes,
  verified: boolean
): ContractRegistered {
  let mockEvent = changetype<ContractRegistered>(newMockEvent());
  mockEvent.block.timestamp = BigInt.fromI32(1000);
  mockEvent.block.number = BigInt.fromI32(1);
  mockEvent.transaction.hash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") as Bytes;
  mockEvent.transaction.from = Address.fromString("0x0000000000000000000000000000000000000001");
  mockEvent.logIndex = BigInt.fromI32(0);
  mockEvent.parameters = [
    new ethereum.EventParam("contractAddr", ethereum.Value.fromAddress(contractAddr)),
    new ethereum.EventParam("contractType", ethereum.Value.fromBytes(contractType)),
    new ethereum.EventParam("verified", ethereum.Value.fromBoolean(verified))
  ];
  return mockEvent;
}

describe("RiskRegistry Handlers", () => {
  afterEach(() => {
    clearStore();
  });
  beforeAll(() => {
    clearStore();
  });

  test("handleRiskProfileUpdated creates RiskProfile entity", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event = createRiskProfileUpdatedEvent(account, 50, 1, false);
    handleRiskProfileUpdated(event);

    let id = account.toHexString();
    assert.entityCount("RiskProfile", 1);
    assert.fieldEquals("RiskProfile", id, "riskScore", "50");
    assert.fieldEquals("RiskProfile", id, "tier", "LOW");
    assert.fieldEquals("RiskProfile", id, "isSanctioned", "false");
  });

  test("handleRiskProfileUpdated updates existing RiskProfile", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event1 = createRiskProfileUpdatedEvent(account, 50, 1, false);
    handleRiskProfileUpdated(event1);

    let event2 = createRiskProfileUpdatedEvent(account, 75, 2, false);
    handleRiskProfileUpdated(event2);

    let id = account.toHexString();
    assert.entityCount("RiskProfile", 1);
    assert.fieldEquals("RiskProfile", id, "riskScore", "75");
    assert.fieldEquals("RiskProfile", id, "tier", "MEDIUM");
  });

  test("handleRiskProfileUpdated creates SanctionedAddress when sanctioned", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event = createRiskProfileUpdatedEvent(account, 90, 3, true);
    handleRiskProfileUpdated(event);

    let id = account.toHexString();
    assert.entityCount("SanctionedAddress", 1);
    assert.fieldEquals("SanctionedAddress", id, "isActive", "true");
    assert.fieldEquals("SanctionedAddress", id, "account", id);
  });

  test("handleRiskProfileUpdated deactivates SanctionedAddress when unsanctioned", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event1 = createRiskProfileUpdatedEvent(account, 90, 3, true);
    handleRiskProfileUpdated(event1);

    let event2 = createRiskProfileUpdatedEvent(account, 50, 1, false);
    handleRiskProfileUpdated(event2);

    let id = account.toHexString();
    assert.fieldEquals("SanctionedAddress", id, "isActive", "false");
    assert.fieldEquals("SanctionedAddress", id, "removedAt", "1000");
  });

  test("handleRiskProfileUpdated creates RiskProfileUpdate audit record", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event = createRiskProfileUpdatedEvent(account, 50, 1, false);
    handleRiskProfileUpdated(event);

    assert.entityCount("RiskProfileUpdate", 1);
  });

  test("handleAddressTagged adds tag to RiskProfile", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let tag = Bytes.fromHexString("0x65786368616e6765000000000000000000000000000000000000000000000000") as Bytes;
    let event = createAddressTaggedEvent(account, tag);
    handleAddressTagged(event);

    let id = account.toHexString();
    assert.fieldEquals("RiskProfile", id, "tags", "[0x65786368616e6765000000000000000000000000000000000000000000000000]");
  });

  test("handleSanctionAdded creates SanctionedAddress", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event = createSanctionAddedEvent(account, "OFAC sanctions");
    handleSanctionAdded(event);

    let id = account.toHexString();
    assert.entityCount("SanctionedAddress", 1);
    assert.fieldEquals("SanctionedAddress", id, "reason", "OFAC sanctions");
    assert.fieldEquals("SanctionedAddress", id, "isActive", "true");
  });

  test("handleSanctionRemoved deactivates SanctionedAddress", () => {
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let addEvent = createSanctionAddedEvent(account, "OFAC sanctions");
    handleSanctionAdded(addEvent);

    let removeEvent = createSanctionRemovedEvent(account);
    handleSanctionRemoved(removeEvent);

    let id = account.toHexString();
    assert.fieldEquals("SanctionedAddress", id, "isActive", "false");
    assert.fieldEquals("SanctionedAddress", id, "removedAt", "2000");
  });

  test("handleContractRegistered creates RiskProfile for contract", () => {
    let contract = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    let contractType = Bytes.fromHexString("0x6572633230000000000000000000000000000000000000000000000000000000") as Bytes;
    let event = createContractRegisteredEvent(contract, contractType, true);
    handleContractRegistered(event);

    let id = contract.toHexString();
    assert.entityCount("RiskProfile", 1);
    assert.fieldEquals("RiskProfile", id, "tags", "[0x6572633230000000000000000000000000000000000000000000000000000000, verified]");
  });

  test("ProtocolStats counter increments correctly on sanction", () => {
    clearStore();
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event = createRiskProfileUpdatedEvent(account, 90, 3, true);
    handleRiskProfileUpdated(event);

    assert.entityCount("ProtocolStats", 1);
    assert.fieldEquals("ProtocolStats", "stats", "totalSanctioned", "1");
  });

  test("ProtocolStats counter decrements correctly on unsanction", () => {
    clearStore();
    let account = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");
    let event1 = createRiskProfileUpdatedEvent(account, 90, 3, true);
    handleRiskProfileUpdated(event1);

    let event2 = createRiskProfileUpdatedEvent(account, 50, 1, false);
    handleRiskProfileUpdated(event2);

    assert.fieldEquals("ProtocolStats", "stats", "totalSanctioned", "0");
  });
});
