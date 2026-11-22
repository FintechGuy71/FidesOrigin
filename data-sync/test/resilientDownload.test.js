'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { downloadWithResume, digestFromHeader } = require('../src/services/resilientDownload');

function startServer(content, digest) {
  const server = http.createServer((req, res) => {
    if (digest) res.setHeader('Digest', `sha-256=${digest}`);
    if (req.method === 'HEAD') { res.end(); return; }
    const range = req.headers.range;
    if (range) {
      const offset = Number(range.match(/bytes=(\d+)-/)[1]);
      res.writeHead(206, { 'Content-Range': `bytes ${offset}-${content.length - 1}/${content.length}` });
      res.end(content.slice(offset));
      return;
    }
    res.writeHead(200);
    res.end(content);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('download: 从已绑定来源的 .part 断点续传并校验 Digest', async () => {
  const content = 'abcdef';
  const digest = crypto.createHash('sha256').update(content).digest('base64');
  const expectedDigest = crypto.createHash('sha256').update(content).digest('hex');
  const server = await startServer(content, digest);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fides-download-'));
  const destination = path.join(dir, 'source.txt');
  const port = server.address().port;
  const sourceUrl = `http://127.0.0.1:${port}/source`;
  fs.writeFileSync(`${destination}.part`, 'abc');
  fs.writeFileSync(`${destination}.part.json`, JSON.stringify({ sourceUrl, expectedDigest }));
  try {
    const result = await downloadWithResume(sourceUrl, destination, { allowHttp: true, attempts: 1 });
    assert.strictEqual(result.resumed, true);
    assert.strictEqual(result.digestVerified, true);
    assert.strictEqual(fs.readFileSync(destination, 'utf8'), content);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('download: 来源不同的旧 .part 不得拼接', async () => {
  const content = 'abcdef';
  const server = await startServer(content, null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fides-download-'));
  const destination = path.join(dir, 'source.txt');
  fs.writeFileSync(`${destination}.part`, 'old-bytes');
  fs.writeFileSync(`${destination}.part.json`, JSON.stringify({ sourceUrl: 'https://old.example/source' }));
  try {
    const port = server.address().port;
    const result = await downloadWithResume(`http://127.0.0.1:${port}/source`, destination, { allowHttp: true, attempts: 1 });
    assert.strictEqual(result.resumed, false);
    assert.strictEqual(fs.readFileSync(destination, 'utf8'), content);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('download: requireDigest 时缺失摘要不得替换正式缓存', async () => {
  const server = await startServer('abcdef', null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fides-download-'));
  const destination = path.join(dir, 'source.txt');
  try {
    const port = server.address().port;
    await assert.rejects(
      downloadWithResume(`http://127.0.0.1:${port}/source`, destination, { allowHttp: true, attempts: 1, requireDigest: true }),
      /Digest is required/
    );
    assert.strictEqual(fs.existsSync(destination), false);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('download: 哈希不匹配时拒绝替换正式缓存', async () => {
  const server = await startServer('abcdef', 'AAAA');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fides-download-'));
  const destination = path.join(dir, 'source.txt');
  try {
    const port = server.address().port;
    await assert.rejects(
      downloadWithResume(`http://127.0.0.1:${port}/source`, destination, { allowHttp: true, attempts: 1, expectedSha256: '000000' }),
      /SHA-256 mismatch/
    );
    assert.strictEqual(fs.existsSync(destination), false);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('download: 同时支持标准 Base64 与 OFAC 非标准十六进制 Digest', () => {
  const hex = '60698e6e3edd49ac9398576aae7e98e06f2c0bf44cc41e485bca4732ac56805f';
  assert.strictEqual(digestFromHeader(`sha-256${hex}`), hex);
  const base64 = Buffer.from(hex, 'hex').toString('base64');
  assert.strictEqual(digestFromHeader(`sha-256=${base64}`), hex);
});
