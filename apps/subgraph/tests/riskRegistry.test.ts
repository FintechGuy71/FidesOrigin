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
import { newMockEvent, createMockedFunction } from "matchstick-as";

// [AUDIT-FIX] 随合约事件签名对齐：
//  1. riskScore 为 uint256 → mock 用 fromUnsignedBigInt（原 fromI32）
//  2. 移除 SanctionAdded / SanctionRemoved / ContractRegistered 相关用例
//     （v3.1.0 合约无这些事件，handler 已删）

// handler 回读链上档案所用的合约地址（必须与 mockEvent.address 一致）
const REGISTRY = Address.fromString("0x953f985f38f94d6159c0600d1f15D543895cE896");

// 本文件多数旧用例共用的账户（只断言 score/tier/isSanctioned，不断言 tags）。
// tags 专项用例另用独立地址，避免与全局 mock 冲突。
const SHARED_ACCOUNT = Address.fromString("0x742d35cc6634c0532925a3b844bc9e7595f0bebc");

/**
 * mock 合约 getRiskProfile —— handleRiskProfileUpdated 会回读链上 tags 全量替换。
 * 不 mock 则 try_ 调用 revert，handler 走"保留原 tags"兜底分支，新增逻辑得不到覆盖。
 */
function mockGetRiskProfile(
  account: Address,
  riskScore: i32,
  tier: i32,
  tags: Array<Bytes>,
  isSanctioned: boolean
): void {
  createMockedFunction(
    REGISTRY,
    "getRiskProfile",
    "getRiskProfile(address):((uint8,uint8,bytes32[],uint256,bool))"
  )
    .withArgs([ethereum.Value.fromAddress(account)])
    // returns() 接受 ethereum.Value[]（数组）—— 单返回值也必须包成数组
    .returns([
      ethereum.Value.fromTuple(
        changetype<ethereum.Tuple>([
          ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(riskScore)),
          ethereum.Value.fromI32(tier),
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

// Helper to create mock event
function createRiskProfileUpdatedEvent(
  account: Address,
  riskScore: i32,
  tier: i32,
  isSanctioned: boolean
): RiskProfileUpdated {
  let mockEvent = changetype<RiskProfileUpdated>(newMockEvent());
  mockEvent.address = REGISTRY;
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
  mockEvent.address = REGISTRY;
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
    // matchstick 对【未 mock】的合约调用会直接中止测试（报 "Could not find a mocked
    // function"），并不会返回 reverted —— 所以凡是调用 handleRiskProfileUpdated 的
    // 用例，其 account 都必须有 getRiskProfile 的 mock。
    // mock 是全局的且【不随 clearStore 清除】，故在此为本文件共用的账户一次性建立
    // 默认 mock（空 tags）：这些用例只断言 riskScore/tier/isSanctioned/统计计数，
    // 不断言 tags，空 tags 不影响它们。
    // 注：下面新增的 tags 专项用例各自使用【唯一】account 并自带 mock，不受此默认值影响。
    mockGetRiskProfile(SHARED_ACCOUNT, 0, 0, [], false);
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
    // 0x65786368616e6765 = "exchange" 的 bytes32 短字符串编码（ethers.encodeBytes32String）
    let tag = Bytes.fromHexString("0x65786368616e6765000000000000000000000000000000000000000000000000") as Bytes;
    let event = createAddressTaggedEvent(account, tag);
    handleAddressTagged(event);

    let id = account.toHexString();
    // [FIX] tags 必须解码为可读字符串，而非原始十六进制。
    // 链上 tags 是 encodeBytes32String 编码的短字符串（如 "OFAC_SDN_ADVANCED"），
    // 存 hex 会让前端 tags.join() 显示乱码，且与后端库 tags 口径不一致。
    assert.fieldEquals("RiskProfile", id, "tags", "[exchange]");
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

  // ============ tags 回读链上全量替换（修复只增不减漂移）============

  test("handleRiskProfileUpdated 以链上 tags 为准（解码可读 + 排序）", () => {
    clearStore();
    // 每个用 mock 的用例必须使用【唯一】account：matchstick 的 mockFunction 是全局的，
    // 且没有清理 API（clearStore 只清实体不清 mock），同址复用会互相干扰。
    let account = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    let tags: Array<Bytes> = [encodeTag("sanctioned"), encodeTag("OFAC_SDN_ADVANCED")];
    mockGetRiskProfile(account, 100, 4, tags, true);

    handleRiskProfileUpdated(createRiskProfileUpdatedEvent(account, 100, 4, true));

    let id = account.toHexString();
    // decodeTagList 排序：大写字母 ASCII 小于小写，故 OFAC_SDN_ADVANCED 在前
    assert.fieldEquals("RiskProfile", id, "tags", "[OFAC_SDN_ADVANCED, sanctioned]");
  });

  test("AddressTagged 累积后，RiskProfileUpdated 以链上为准收敛（不只增不减）", () => {
    clearStore();
    // 唯一 account（理由同上：mock 全局且不可清理）
    let account = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    let id = account.toHexString();

    // 第一步：AddressTagged 事件按"只追加"语义累积标签
    handleAddressTagged(createAddressTaggedEvent(account, encodeTag("OPEN_SANCTIONS")));
    handleAddressTagged(createAddressTaggedEvent(account, encodeTag("exchange")));
    assert.fieldEquals("RiskProfile", id, "tags", "[OPEN_SANCTIONS, exchange]");

    // 第二步：链上权威 tags 只有另外两个（OPEN_SANCTIONS 已被移除）。
    // 原实现无回读 → subgraph 会永久残留 OPEN_SANCTIONS/exchange；
    // 现实现全量替换 → 结果必须与链上完全一致。
    // 注：此处只 mock 一次 getRiskProfile，避免依赖 mock 覆盖顺序的未定义行为。
    mockGetRiskProfile(
      account, 100, 4,
      [encodeTag("OFAC_SDN_ADVANCED"), encodeTag("sanctioned")],
      true
    );
    handleRiskProfileUpdated(createRiskProfileUpdatedEvent(account, 100, 4, true));
    assert.fieldEquals("RiskProfile", id, "tags", "[OFAC_SDN_ADVANCED, sanctioned]");
  });

  test("下架后 tags 清空 —— 不残留 sanctioned（安全性回归）", () => {
    clearStore();
    // 用另一个地址，避免与前面用例的 mock 相互影响
    let account = Address.fromString("0x1111111111111111111111111111111111111111");
    let id = account.toHexString();

    // 第一步：在册期间由 AddressTagged 打上 sanctioned 标签
    handleAddressTagged(createAddressTaggedEvent(account, encodeTag("OFAC_SDN_ADVANCED")));
    handleAddressTagged(createAddressTaggedEvent(account, encodeTag("sanctioned")));
    assert.fieldEquals("RiskProfile", id, "tags", "[OFAC_SDN_ADVANCED, sanctioned]");

    // 第二步：下架 —— data-sync 调 updateRiskProfile(addr,0,0,[],false)，链上 tags=[]
    // 原实现（只靠 AddressTagged 追加）会永久残留 "sanctioned"，
    // 使一个已解除制裁的地址在索引里看起来仍被制裁（安全性错误）。
    mockGetRiskProfile(account, 0, 0, [], false);
    handleRiskProfileUpdated(createRiskProfileUpdatedEvent(account, 0, 0, false));

    assert.fieldEquals("RiskProfile", id, "tags", "[]");
    assert.fieldEquals("RiskProfile", id, "isSanctioned", "false");
  });

  test("全零 bytes32 槽位被跳过，不产生空标签", () => {
    clearStore();
    // 唯一 account（理由同上：mock 全局且不可清理）
    let account = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc");
    let zero = Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000") as Bytes;
    mockGetRiskProfile(account, 100, 4, [encodeTag("sanctioned"), zero], true);

    handleRiskProfileUpdated(createRiskProfileUpdatedEvent(account, 100, 4, true));

    assert.fieldEquals("RiskProfile", account.toHexString(), "tags", "[sanctioned]");
  });
});
