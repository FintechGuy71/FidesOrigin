'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

function assertUrl(value, allowHttp = false) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw new Error(`Unsupported download protocol: ${url.protocol}`);
  }
  return url;
}

function request(url, options, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': 'FidesOrigin-Sync/3.1', ...(options.headers || {}) },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 5) return reject(new Error('Too many download redirects'));
        if (!response.headers.location) return reject(new Error('Redirect without Location'));
        const next = assertUrl(new URL(response.headers.location, url).toString(), options.allowHttp);
        return resolve(request(next, options, redirects + 1));
      }
      resolve(response);
    });
    req.setTimeout(options.inactivityMs || 60000, () => req.destroy(new Error('Download socket inactivity timeout')));
    req.on('error', reject);
    req.end();
  });
}

function digestFromHeader(value) {
  if (!value) return null;
  const text = String(value);
  // Standards-compliant Digest uses Base64. OFAC currently also emits sha-256<hex>.
  const base64 = text.match(/sha-256=([A-Za-z0-9+/]+={0,2})/i);
  if (base64) return Buffer.from(base64[1], 'base64').toString('hex');
  const hexadecimal = text.match(/sha-256:?([a-f0-9]{64})/i);
  return hexadecimal ? hexadecimal[1].toLowerCase() : null;
}

async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    fs.createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', resolve).on('error', reject);
  });
  return hash.digest('hex');
}

async function downloadWithResume(sourceUrl, destination, options = {}) {
  const allowHttp = options.allowHttp === true;
  let url = assertUrl(sourceUrl, allowHttp);
  const part = `${destination}.part`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  let expectedDigest = options.expectedSha256 ? String(options.expectedSha256).toLowerCase() : null;

  if (!expectedDigest && options.verifyDigest !== false) {
    try {
      const head = await request(url, { method: 'HEAD', allowHttp, inactivityMs: options.inactivityMs });
      head.resume();
      expectedDigest = digestFromHeader(head.headers.digest);
    } catch { /* GET Digest remains an optional verification source */ }
  }

  // Never append bytes to an unknown or different source's partial file.
  const partMeta = `${part}.json`;
  if (fs.existsSync(part)) {
    let reusable = false;
    try {
      const meta = JSON.parse(fs.readFileSync(partMeta, 'utf8'));
      reusable = meta.sourceUrl === sourceUrl
        && (!expectedDigest || meta.expectedDigest === expectedDigest);
    } catch { /* legacy/invalid partial files are discarded */ }
    if (!reusable) {
      fs.unlinkSync(part);
      fs.rmSync(partMeta, { force: true });
    }
  }

  let lastError;
  for (let attempt = 1; attempt <= (options.attempts || 3); attempt++) {
    const offset = fs.existsSync(part) ? fs.statSync(part).size : 0;
    try {
      const headers = offset > 0 ? { Range: `bytes=${offset}-` } : {};
      const response = await request(url, { method: 'GET', headers, allowHttp, inactivityMs: options.inactivityMs });
      if (response.statusCode === 416 && offset > 0) {
        response.resume();
        fs.unlinkSync(part);
        throw new Error('Server rejected resume range; retrying from zero');
      }
      if (![200, 206].includes(response.statusCode)) {
        response.resume();
        throw new Error(`Download failed with HTTP ${response.statusCode}`);
      }
      const append = response.statusCode === 206 && offset > 0;
      const responseDigest = digestFromHeader(response.headers.digest);
      if (options.requireDigest && !responseDigest && !expectedDigest) {
        response.resume();
        throw new Error(`SHA-256 Digest is required for ${path.basename(destination)}`);
      }
      if (responseDigest && expectedDigest && responseDigest.toLowerCase() !== expectedDigest.toLowerCase()) {
        response.resume();
        throw new Error(`Digest changed between HEAD and GET for ${path.basename(destination)}`);
      }
      const timer = setTimeout(() => response.destroy(new Error('Download total duration timeout')), options.maxDurationMs || 15 * 60 * 1000);
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(part, { flags: append ? 'a' : 'w' });
        response.on('error', reject);
        output.on('error', reject);
        output.on('finish', resolve);
        response.pipe(output);
      }).finally(() => clearTimeout(timer));

      const sha256 = await sha256File(part);
      const authoritativeDigest = responseDigest || expectedDigest;
      if (authoritativeDigest && sha256.toLowerCase() !== authoritativeDigest.toLowerCase()) {
        throw new Error(`SHA-256 mismatch for ${path.basename(destination)}`);
      }
      fs.renameSync(part, destination);
      const metadata = {
        sourceUrl,
        destination,
        size: fs.statSync(destination).size,
        sha256,
        digestVerified: Boolean(authoritativeDigest),
        resumed: offset > 0,
        fetchedAt: new Date().toISOString(),
      };
      fs.writeFileSync(`${destination}.meta.json`, JSON.stringify(metadata, null, 2));
      return metadata;
    } catch (error) {
      lastError = error;
      if (fs.existsSync(part)) {
        fs.writeFileSync(partMeta, JSON.stringify({
          sourceUrl,
          expectedDigest,
          updatedAt: new Date().toISOString(),
        }));
      }
      if (attempt < (options.attempts || 3)) {
        await new Promise(resolve => setTimeout(resolve, Math.min(5000, attempt * 1000)));
      }
    }
  }
  throw lastError;
}

async function downloadTextWithResume(sourceUrl, destination, options = {}) {
  const metadata = await downloadWithResume(sourceUrl, destination, options);
  return { text: fs.readFileSync(destination, 'utf8'), metadata };
}

module.exports = { downloadWithResume, downloadTextWithResume, sha256File, digestFromHeader };
