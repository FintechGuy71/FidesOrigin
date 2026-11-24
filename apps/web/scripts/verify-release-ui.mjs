import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:7100';
const evidence = path.resolve(process.env.UI_EVIDENCE_DIR || path.join(__dirname, '../test-results/release'));
fs.mkdirSync(evidence, { recursive: true });
const result = {
  generatedAt: new Date().toISOString(),
  base,
  checks: {},
  consoleErrors: [],
  pageErrors: [],
  httpErrors: [],
  requestFailures: [],
  screenshots: [],
  performance: {},
};

const deployments = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../packages/config/deployments.json'), 'utf8'));
const CONTRACTS = Object.fromEntries(
  ['RiskRegistry', 'MerkleRiskRegistry', 'PolicyEngine', 'ComplianceEngine'].map(name => [name, deployments.networks.sepolia.current[name]]),
);
const EVIDENCE_HREF = 'https://github.com/FintechGuy71/FidesOrigin/releases/latest/download/fidesorigin-verification-evidence.zip';

function observe(page, name) {
  page.on('console', message => {
    if (message.type() === 'error') result.consoleErrors.push({ page: name, text: message.text() });
  });
  page.on('pageerror', error => result.pageErrors.push({ page: name, error: error.message }));
  page.on('response', response => {
    if (response.status() >= 400) result.httpErrors.push({ page: name, url: response.url(), status: response.status() });
  });
  page.on('requestfailed', request => {
    result.requestFailures.push({ page: name, url: request.url(), error: request.failure()?.errorText });
  });
}

async function assertNoOverflow(page, name) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert.ok(dimensions.documentWidth <= dimensions.viewport && dimensions.bodyWidth <= dimensions.viewport, `${name} has horizontal overflow: ${JSON.stringify(dimensions)}`);
  return dimensions;
}

async function screenshot(page, filename, fullPage = false) {
  if (fullPage) {
    // 真实触发 LegacyFx 的滚动显现，避免全页截图把尚未进入视口误判为空白。
    await page.evaluate(async () => {
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await pause(250);
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);
  }
  const target = path.join(evidence, filename);
  await page.screenshot({ path: target, type: 'jpeg', quality: 85, fullPage });
  result.screenshots.push(target);
}

async function openHome(browser, name, locale, viewport, expected, image) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  observe(page, name);
  await page.goto(`${base}${locale}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  for (const text of expected) {
    await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
  }
  await page.locator('[data-metrics-status="live"]').waitFor({ state: 'visible', timeout: 60000 });
  for (const text of ['<50ms', '6 Networks', '6 条网络', '6 ネットワーク', 'RiskRegistryV2', '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3']) {
    assert.strictEqual(await page.getByText(text, { exact: false }).count(), 0, `${name} contains retired claim ${text}`);
  }
  const dimensions = await assertNoOverflow(page, name);
  const anchors = await page.locator('a').evaluateAll(items => items.map(item => ({ text: item.textContent?.trim(), href: item.getAttribute('href') })));
  assert.ok(anchors.every(item => item.href && item.href !== '#'), `${name} has a placeholder link`);
  assert.ok(anchors.some(item => item.href === '/contact'), `${name} does not expose the real contact form`);
  assert.ok(anchors.some(item => item.href === `https://sepolia.etherscan.io/address/${CONTRACTS.RiskRegistry}`), `${name} has a stale RiskRegistry link`);
  if (image) await screenshot(page, image);
  result.performance[name] = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    return {
      requests: resources.length,
      encodedBytes: resources.reduce((sum, item) => sum + (item.encodedBodySize || 0), 0),
      domContentLoadedMs: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0),
    };
  });
  result.checks[name] = { visibleText: expected, liveMetrics: true, dimensions, placeholderLinks: 0 };
  await context.close();
}

async function openVerification(browser, name, locale, viewport, expected, image) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  observe(page, name);
  await page.goto(`${base}${locale}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  for (const text of expected) {
    await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
  }
  await page.locator('[data-metrics-status="live"]').waitFor({ state: 'visible', timeout: 60000 });
  for (const address of Object.values(CONTRACTS)) {
    const href = `https://sepolia.etherscan.io/address/${address}`;
    assert.strictEqual(await page.locator(`a[href="${href}"]`).count(), 1, `${name} missing current contract ${address}`);
  }
  assert.strictEqual(await page.locator(`a[href="${EVIDENCE_HREF}"]`).count(), 1, `${name} missing evidence download`);
  const dimensions = await assertNoOverflow(page, name);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  assert.ok(canonical?.endsWith(locale), `${name} has incorrect canonical ${canonical}`);
  await screenshot(page, image, name === 'verification-en');
  result.checks[name] = { visibleText: expected, liveMetrics: true, currentContracts: 4, canonical, dimensions };
  await context.close();
}

async function openContact(browser) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  observe(page, 'mobile-contact');
  await page.goto(`${base}/contact`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText("Let's build", { exact: false }).waitFor({ state: 'visible' });
  await page.locator('#message[required]').waitFor({ state: 'visible' });
  const dimensions = await assertNoOverflow(page, 'mobile-contact');
  await screenshot(page, 'mobile-contact.jpg', true);
  result.checks.mobileContact = { requiredMessage: true, dimensions };
  await context.close();
}

async function verifyLiveQuery(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  observe(page, 'live-query');
  await page.goto(`${base}/verification`, { waitUntil: 'networkidle', timeout: 60000 });
  const input = page.locator('input[placeholder*="0x"]').first();
  await input.fill('0x101ce0cedd142f199c9ef61739ae59b6611a0fc0');
  const responsePromise = page.waitForResponse(response => response.url().includes('/api/v1/public/risk-check'), { timeout: 60000 });
  await page.getByRole('button', { name: 'Screen', exact: true }).click();
  const response = await responsePromise;
  assert.strictEqual(response.status(), 200);
  const payload = await response.json();
  assert.strictEqual(payload.risk_score, 75);
  assert.ok(payload.tags.includes('SCAM_SNIFFER'));
  await page.getByText('75/100', { exact: false }).waitFor({ state: 'visible' });
  await screenshot(page, 'live-query.jpg');
  result.checks.liveQuery = { page: '/verification', http: response.status(), riskScore: payload.risk_score, tags: payload.tags };
  await context.close();
}

async function verifyContact(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  observe(page, 'contact-submit');
  const marker = `Automated production release acceptance ${new Date().toISOString()}`;
  let postCount = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/contact') postCount += 1;
  });
  await page.goto(`${base}/contact`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByLabel('Full Name').fill('FidesOrigin Automated Release Acceptance');
  await page.getByLabel('Work Email').fill('release-acceptance@fidesorigin.com');
  await page.getByLabel('Company').fill('FidesOrigin');
  await page.getByLabel('Use Case').selectOption('other');
  await page.getByLabel('Message', { exact: true }).fill(marker);
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/contact' && response.request().method() === 'POST', { timeout: 90000 });
  await page.getByRole('button', { name: 'Send Message', exact: true }).click();
  const response = await responsePromise;
  assert.strictEqual(response.status(), 200);
  const payload = await response.json();
  assert.strictEqual(payload.success, true);
  await page.getByRole('status').filter({ hasText: 'Message sent!' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  assert.strictEqual(postCount, 1, 'contact form retried a write request');
  await screenshot(page, 'contact-submit.jpg');
  result.checks.contactSubmit = { http: response.status(), success: payload.success, postCount, marker };
  await context.close();
}

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  await openHome(browser, 'desktop-en', '/', { width: 1440, height: 1000 }, ['5,348', '145', 'Risk intelligence records', 'On-chain profiles · Sepolia', 'Daily'], 'desktop-en.jpg');
  await openHome(browser, 'mobile-cn', '/cn', { width: 375, height: 812 }, ['5,348', '145', '风险情报记录', '链上档案 · Sepolia', '每日自动验证'], 'mobile-cn.jpg');
  await openHome(browser, 'desktop-tw', '/tw', { width: 1280, height: 900 }, ['5,348', '145', '風險情報記錄', '鏈上檔案 · Sepolia', '每日自動驗證']);
  await openHome(browser, 'desktop-jp', '/jp', { width: 1280, height: 900 }, ['5,348', '145', 'リスク情報レコード', 'オンチェーンプロファイル · Sepolia', '日次自動検証']);

  await openVerification(browser, 'verification-en', '/verification', { width: 1440, height: 1000 }, ['Public Verification', 'Current Sepolia deployments', 'Download evidence bundle'], 'verification-en.jpg');
  await openVerification(browser, 'verification-cn', '/cn/verification', { width: 1280, height: 900 }, ['公开验证中心', '当前 Sepolia 合约部署', '下载验证证据包'], 'verification-cn.jpg');
  await openVerification(browser, 'verification-tw', '/tw/verification', { width: 1280, height: 900 }, ['公開驗證中心', '當前 Sepolia 合約部署', '下載驗證證據包'], 'verification-tw.jpg');
  await openVerification(browser, 'verification-jp', '/jp/verification', { width: 1280, height: 900 }, ['公開検証センター', '現在の Sepolia デプロイ', '検証証拠をダウンロード'], 'verification-jp.jpg');
  await openVerification(browser, 'mobile-verification-cn', '/cn/verification', { width: 375, height: 812 }, ['公开验证中心', '当前 Sepolia 合约部署', '下载验证证据包'], 'mobile-verification-cn.jpg');
  await openContact(browser);

  if (process.env.UI_TEST_LIVE_QUERY === 'true') await verifyLiveQuery(browser);
  if (process.env.UI_TEST_CONTACT === 'true') await verifyContact(browser);
} catch (error) {
  result.failure = { message: error.message, stack: error.stack };
} finally {
  await browser.close();
}

result.pass = !result.failure && result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.httpErrors.length === 0 && result.requestFailures.length === 0;
fs.writeFileSync(path.join(evidence, 'ui-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exit(1);
