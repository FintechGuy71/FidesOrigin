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

async function openHome(browser, name, locale, viewport, expected, screenshot) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  observe(page, name);
  await page.goto(`${base}${locale}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  for (const text of expected) {
    await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
  }
  for (const text of ['<50ms', '6 Networks', '6 条网络', '6 ネットワーク', 'RiskRegistryV2']) {
    assert.strictEqual(await page.getByText(text, { exact: false }).count(), 0, `${name} contains retired claim ${text}`);
  }
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert.ok(dimensions.documentWidth <= dimensions.viewport && dimensions.bodyWidth <= dimensions.viewport, `${name} has horizontal overflow: ${JSON.stringify(dimensions)}`);
  const anchors = await page.locator('a').evaluateAll(items => items.map(item => ({ text: item.textContent?.trim(), href: item.getAttribute('href') })));
  assert.ok(anchors.every(item => item.href && item.href !== '#'), `${name} has a placeholder link`);
  if (screenshot) {
    const target = path.join(evidence, screenshot);
    await page.screenshot({ path: target, type: 'jpeg', quality: 85, fullPage: false });
    result.screenshots.push(target);
  }
  result.performance[name] = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    return {
      requests: resources.length,
      encodedBytes: resources.reduce((sum, item) => sum + (item.encodedBodySize || 0), 0),
      domContentLoadedMs: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0),
    };
  });
  result.checks[name] = { visibleText: expected, dimensions, placeholderLinks: 0 };
  await context.close();
}

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  await openHome(browser, 'desktop-en', '/', { width: 1440, height: 1000 }, ['5,348', '145', 'Risk intelligence records', 'On-chain profiles · Sepolia', 'Daily'], 'desktop-en.jpg');
  await openHome(browser, 'mobile-cn', '/cn', { width: 375, height: 812 }, ['5,348', '145', '风险情报记录', '链上档案 · Sepolia', '每日自动验证'], 'mobile-cn.jpg');
  await openHome(browser, 'desktop-tw', '/tw', { width: 1280, height: 900 }, ['5,348', '145', '風險情報記錄', '鏈上檔案 · Sepolia', '每日自動驗證']);
  await openHome(browser, 'desktop-jp', '/jp', { width: 1280, height: 900 }, ['5,348', '145', 'リスク情報レコード', 'オンチェーンプロファイル · Sepolia', '日次自動検証']);

  if (process.env.UI_TEST_LIVE_QUERY === 'true') {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    observe(page, 'live-query');
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
    const input = page.locator('input[placeholder*="0x"]').first();
    await input.fill('0x101ce0cedd142f199c9ef61739ae59b6611a0fc0');
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/v1/public/risk-check'), { timeout: 60000 });
    await page.getByRole('button', { name: 'Screen', exact: true }).click();
    const response = await responsePromise;
    assert.strictEqual(response.status(), 200);
    const payload = await response.json();
    assert.strictEqual(payload.risk_score, 75);
    assert.ok(payload.tags.includes('SCAM_SNIFFER'));
    await page.screenshot({ path: path.join(evidence, 'live-query.jpg'), type: 'jpeg', quality: 85 });
    result.screenshots.push(path.join(evidence, 'live-query.jpg'));
    result.checks.liveQuery = { http: response.status(), riskScore: payload.risk_score, tags: payload.tags };
    await context.close();
  }
} catch (error) {
  result.failure = { message: error.message, stack: error.stack };
} finally {
  await browser.close();
}

result.pass = !result.failure && result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.httpErrors.length === 0 && result.requestFailures.length === 0;
fs.writeFileSync(path.join(evidence, 'ui-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exit(1);
