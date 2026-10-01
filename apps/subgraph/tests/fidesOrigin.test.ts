import { assert, describe, test, clearStore, beforeAll, afterEach } from "matchstick-as/assembly/index";
import { newMockEvent, createMockedFunction } from "matchstick-as";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { handleRiskProfileUpdated, handleAddressTagged } from "../src/mappings/riskRegistry";
import { handleComplianceCheckPerformed, handleTransactionBlocked, handleTransactionQuarantined, handleQuarantineReleased } from "../src/mappings/complianceEngine";
import { RiskProfileUpdated, AddressTagged } from "../generated/RiskRegistry/RiskRegistry";
import { ComplianceCheckPerformed, TransactionBlocked, TransactionQuarantined, QuarantineReleased } from "../generated/ComplianceEngine/ComplianceEngine";

// handler 回读链上档案所用的合约地址（与 createMockEvent 里的 event.address 一致）
const REGISTRY = Address.fromString("0x953f985f38f94d6159c0600d1f15D543895cE896");
// 本文件共用的被测账户
const ACCOUNT = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee");

/**
 * mock 合约 getRiskProfile。
 * handleRiskProfileUpdated 会回读链上 tags 做全量替换；matchstick 对未 mock 的合约
 * 调用【直接中止测试】（不会返回 reverted），故凡调用该 handler 的用例都必须有 mock。
 * mock 全局且不被 clearStore 清除，本文件各用例共用同一账户，故在 beforeAll 建一次。
 */
function mockGetRiskProfile(tags: Array<Bytes>, isSanctioned: boolean): void {
  createMockedFunction(
    REGISTRY,
    "getRiskProfile",
    "getRiskProfile(address):((uint8,uint8,bytes32[],uint256,bool))"
  )
    .withArgs([ethereum.Value.fromAddress(ACCOUNT)])
    .returns([
      ethereum.Value.fromTuple(
        changetype<ethereum.Tuple>([
          ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)),
          ethereum.Value.fromI32(0),
          ethereum.Value.fromBytesArray(tags),
          ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000)),
          ethereum.Value.fromBoolean(isSanctioned),
        ])
      ),
    ]);
}

/** 短字符串 → bytes32（等价 ethers.encodeBytes32String，尾部补 0） */
function encodeTag(s: string): Bytes {
  let bytes = new Uint8Array(32);
  for (let i = 0; i < s.length && i < 32; i++) {
    bytes[i] = s.charCodeAt(i) as u8;
  }
  return Bytes.fromUint8Array(bytes);
}

function createMockEvent<T>(): T {
  let event = changetype<T>(newMockEvent());
  event.address = REGISTRY;
  event.transaction.hash = Bytes.fromHexString("0x1234") as Bytes;
  event.logIndex = BigInt.fromI32(0);
  return event;
}

describe("RiskRegistry handlers", () => {
  afterEach(() => {
    clearStore();
  });

  beforeAll(() => {
    // 默认空 tags：本文件用例只断言 riskScore/tier/SanctionedAddress，
    // 唯一断言 tags 的用例在其前先由 handleAddressTagged 追加，故空 tags 不影响结果。
    mockGetRiskProfile([], false);
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

    // [FIX] tags 存解码后的可读字符串（"exchange"），不再是原始 bytes32 十六进制串。
    assert.fieldEquals("RiskProfile", "0x742d35cc6634c0532925a3b844bc9e7595f8deee", "tags", "[exchange]");
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
