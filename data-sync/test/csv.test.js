// data-sync CSV 解析与制裁源抓取的回归测试（node:test）
// 覆盖 qwen3.8 独立校验沉淀的 17 个断言 + PR #53 的 HMT 接入。
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  parseCSV,
  parseCSVLine,
  findHeaderLine,
  HMT_KNOWN_COLUMNS,
  extractCryptoAddresses,
} = require('../sanctions-sync');

// ============ findHeaderLine ============

test('findHeaderLine: OFSI 真表头定位（元数据行在第 0 行）', () => {
  const lines = [
    'Last Updated,"03/06/2026"',
    'Name 6,Name 1,Name 2,Name 3,Name 4,Name 5,Other Information,Group ID,Address 1',
    'd,d,d,d,d,d,d,d,d',
  ];
  assert.strictEqual(findHeaderLine(lines, HMT_KNOWN_COLUMNS), 1);
});

test('findHeaderLine: 正常 CSV（首行即表头）返回 0', () => {
  const lines = ['GroupID,Name', '1,x'];
  assert.strictEqual(findHeaderLine(lines, ['GroupID']), 0);
});

test('findHeaderLine: 找不到已知列名时回退 0（不抛错）', () => {
  const lines = ['foo,bar', 'baz,qux'];
  assert.strictEqual(findHeaderLine(lines, ['NOT_A_COLUMN']), 0);
});

test('findHeaderLine: 空输入返回 0', () => {
  assert.strictEqual(findHeaderLine([], HMT_KNOWN_COLUMNS), 0);
});

test('findHeaderLine: null 输入返回 0', () => {
  assert.strictEqual(findHeaderLine(null, HMT_KNOWN_COLUMNS), 0);
});

test('findHeaderLine: 前置空行不影响定位（索引基于过滤后行）', () => {
  const lines = ['', 'Last Updated,"03/06/2026"', 'Name 6,Name 1,Other Information,Group ID'];
  assert.strictEqual(findHeaderLine(lines, HMT_KNOWN_COLUMNS), 1);
});

test('findHeaderLine: 单列命中不算数（数据行恰好含列名不致误判）', () => {
  // 数据行里某单元格恰好叫 "Group ID"，但整行没有第二个已知列 → 不能认作表头
  const lines = [
    'Last Updated,"03/06/2026"',
    'value,Group ID-ish,foo', // 含 Group ID-ish，不应命中严格匹配
    'Name 6,Name 1,Other Information,Group ID', // 真表头
  ];
  assert.strictEqual(findHeaderLine(lines, HMT_KNOWN_COLUMNS), 2);
});

test('findHeaderLine: maxScan 默认 10，表头在很后面不误选也不溢出', () => {
  const lines = Array(12).fill('junk,junk');
  lines.push('Name 6,Name 1,Other Information,Group ID');
  // 表头在索引 12 > maxScan(10)，找不到 → 回退 0
  assert.strictEqual(findHeaderLine(lines, HMT_KNOWN_COLUMNS), 0);
});

// ============ parseCSV ============

test('parseCSV: 默认 headerLine=0 行为不变', () => {
  const recs = parseCSV('a,b\n1,2\n3,4');
  assert.strictEqual(recs.length, 2);
  assert.strictEqual(recs[0].a, '1');
  assert.strictEqual(recs[1].b, '4');
});

test('parseCSV: 显式 headerLine=1 跳过元数据行', () => {
  const recs = parseCSV('meta,date\na,b\n1,2', { headerLine: 1 });
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].a, '1');
});

test('parseCSV: headerLine 越界钳到末行（返回空）', () => {
  const recs = parseCSV('a,b', { headerLine: 99 });
  assert.deepStrictEqual(recs, []);
});

test('parseCSV: 负数 headerLine 钳到 0', () => {
  const recs = parseCSV('a,b\n1,2', { headerLine: -5 });
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].a, '1');
});

test('parseCSV: 带引号字段解析不变（回归）', () => {
  const recs = parseCSV('a,b\n"x,y","z""q"');
  assert.strictEqual(recs[0].a, 'x,y');
  assert.strictEqual(recs[0].b, 'z"q');
});

test('parseCSV: 空 CSV 返回 []', () => {
  assert.deepStrictEqual(parseCSV(''), []);
});

// ============ parseCSVLine ============

test('parseCSVLine: 双引号转义', () => {
  assert.deepStrictEqual(parseCSVLine('a,"he said ""hi""",c'), ['a', 'he said "hi"', 'c']);
});

// ============ 空行语义一致性（P1-1 回归）============

test('P1-1 回归：findHeaderLine 与 parseCSV 空行过滤语义一致', () => {
  // 表头前有 1 个空行 —— 修复前 findHeaderLine 在未过滤行上返回 2，
  // parseCSV 内部过滤后按索引 2 解析会错位到数据行，返回 0 条。
  const csv = '\nLast Updated,03/06/2026\nName 1,Other Information\nx,y\n';
  const hl = findHeaderLine(csv.split('\n'), HMT_KNOWN_COLUMNS);
  const recs = parseCSV(csv, { headerLine: hl });
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0]['Name 1'], 'x');
});

// ============ HMT 集成（真实 OFSI 列结构）============

test('HMT 集成：OFSI 结构 + 别名重复行 → 去重后提取 EVM 地址', () => {
  // 复刻 OFSI 真实列结构（首行元数据 + 真表头 + 别名重复行）
  const header = 'Name 6,Name 1,Name 2,Other Information,Address 1,Country,Group ID';
  const row1 = 'AYASH,MUSTAFA,,wallets 0x175d44451403Edf28469dF03A9280c1197ADb92c here,,Palestine,16459';
  const row2 = 'AYYASH,Mustafa,,wallets 0x175d44451403Edf28469dF03A9280c1197ADb92c here,,Palestine,16459'; // 别名重复
  const csv = ['Last Updated,"03/06/2026"', header, row1, row2].join('\n');

  const hl = findHeaderLine(csv.split('\n'), HMT_KNOWN_COLUMNS);
  const records = parseCSV(csv, { headerLine: hl });
  assert.strictEqual(records.length, 2);

  // 提取 + 去重（复刻 fetchHMT 的 seen 逻辑）
  const seen = new Set();
  const out = [];
  for (const r of records) {
    const remarks = r['Other Information'] || '';
    const fullAddress = [r['Address 1'], r['Country']].filter(Boolean).join(', ');
    const crypto = extractCryptoAddresses(`${remarks} ${fullAddress}`);
    for (const raw of (crypto.ethereum || [])) {
      const addr = raw.toLowerCase();
      if (seen.has(addr)) continue;
      seen.add(addr);
      out.push(addr);
    }
  }
  assert.deepStrictEqual(out, ['0x175d44451403edf28469df03a9280c1197adb92c']);
});
