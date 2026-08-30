import { assert, describe, test, beforeAll, afterEach, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  handleRiskProfileUpdated,
  handleAddressTagged,
} from "../src/mappings/riskRegistry";
import {
  RiskProfileUpdated,
  AddressTagged,
} from "../generated/RiskRegistry/RiskRegistry";
import { newMockEvent } from "matchstick-as";

// [AUDIT-FIX] 随合约事件签名对齐：
//  1. riskScore 为 uint256 → mock 用 fromUnsignedBigInt（原 fromI32）
//  2. 移除 SanctionAdded / SanctionRemoved / ContractRegistered 相关用例
//     （v3.1.0 合约无这些事件，handler 已删）

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
    new ethereum.EventParam("riskScore", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(riskScore))),
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
