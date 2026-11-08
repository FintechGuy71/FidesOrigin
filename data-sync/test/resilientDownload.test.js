'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { downloadWithResume } = require('../src/services/resilientDownload');

function startServer(content, digest) {
  const server = http.createServer((req, res) => {
    res.setHeader('Digest', `sha-256=${digest}`);
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

test('download: 从 .part 断点续传并校验官方 SHA-256 Digest', async () => {
  const content = 'abcdef';
  const digest = crypto.createHash('sha256').update(content).digest('base64');
  const server = await startServer(content, digest);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fides-download-'));
  const destination = path.join(dir, 'source.txt');
  fs.writeFileSync(`${destination}.part`, 'abc');
  try {
    const port = server.address().port;
    const result = await downloadWithResume(`http://127.0.0.1:${port}/source`, destination, { allowHttp: true, attempts: 1 });
    assert.strictEqual(result.resumed, true);
    assert.strictEqual(result.digestVerified, true);
    assert.strictEqual(fs.readFileSync(destination, 'utf8'), content);
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
      downloadWithResume(`http://127.0.0.1:${port}/source`, destination, { allowHttp: true, attempts: 1, expectedSha256: '00' }),
      /SHA-256 mismatch/
    );
    assert.strictEqual(fs.existsSync(destination), false);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
