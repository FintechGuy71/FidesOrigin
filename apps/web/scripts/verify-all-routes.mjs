import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "out");
const base = process.env.UI_BASE_URL || "http://127.0.0.1:8310";
const fullPage = process.env.UI_FULL_PAGE === "true";
const checkA11y = process.env.UI_A11Y === "true";
const evidence = path.resolve(process.env.UI_EVIDENCE_DIR || path.join(root, "test-results/all-routes"));
fs.mkdirSync(evidence, { recursive: true });

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const htmlFiles = walk(out).filter(file => file.endsWith(".html"));
const routes = htmlFiles.map(file => {
  const relative = path.relative(out, file).replaceAll("\\", "/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative.slice(0, -".html".length)}`;
}).sort();

const stats = { risk_addresses_total: 5348, risk_addresses_high: 132, monitored_transactions: 0, blocked_today: 0, generated_at: "2026-11-28T10:00:00+00:00" };
const dashboardStats = {
  today_blocked: { value: 12, change: 4 }, risk_addresses: { value: 5348, change: -2 },
  compliance_rate: { value: 98.7, change: 1.2 }, monitored_transactions: { value: 1200, change: 8 },
  risk_trend: [{ time: "10:00", score: 18 }, { time: "11:00", score: 42 }],
};

async function mockNetwork(page) {
  await page.route("**/api/v1/public/stats*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stats) }));
  await page.route("**/api/v1/auth/me", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/v1/dashboard/stats", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stats: dashboardStats }) }));
  await page.route("**/api/v1/dashboard/events", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ events: [] }) }));
  await page.route("https://api.studio.thegraph.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { riskProfiles: [{ id: `0x${"1".repeat(40)}` }] } }) }));
  await page.route("https://plausible.io/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
}

function targetExists(href) {
  const url = new URL(href, "https://fidesorigin.local");
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") return fs.existsSync(path.join(out, "index.html"));
  // 品牌资产、下载文件与其他静态资源直接按文件存在性验证。
  if (fs.existsSync(path.join(out, pathname.slice(1)))) return true;
  const candidates = pathname.endsWith("/")
    ? [path.join(out, pathname.slice(1), "index.html")]
    : [path.join(out, `${pathname.slice(1)}.html`), path.join(out, pathname.slice(1), "index.html")];
  return candidates.some(candidate => fs.existsSync(candidate));
}

const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), base, routes: routes.length, viewports: 2, checks: [], failures: [] };

try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    for (const route of routes) {
      const name = `${viewport.name}-${route === "/" ? "home" : route.replaceAll("/", "_").replace(/^_/, "")}`;
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
      const page = await context.newPage();
      await mockNetwork(page);
      const errors = [];
      page.on("pageerror", error => errors.push(`page: ${error.message}`));
      page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
      page.on("response", response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });
      page.on("requestfailed", request => errors.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
      const check = { name, route, viewport: viewport.name, screenshot: "", errors: [], badLinks: [], a11y: [], overflow: 0, mainCount: 0, h1Visible: false };
      try {
        const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
        if (!response || response.status() !== 200) errors.push(`navigation: ${response?.status() ?? "no response"}`);
        await page.evaluate(() => document.fonts.ready);
        check.mainCount = await page.locator('main, [role="main"]').count();
        check.h1Visible = (await page.locator("h1:visible").count()) > 0;
        check.overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.body.scrollWidth - window.innerWidth));
        const links = await page.locator("a[href]").evaluateAll(items => items.map(item => item.getAttribute("href") || ""));
        for (const href of links) {
          if (!href || href === "#" || href.startsWith("javascript:")) check.badLinks.push(href || "empty");
          if (href.startsWith("#") && !(await page.locator(href).count())) check.badLinks.push(`missing anchor ${href}`);
          if ((href.startsWith("/") || href.startsWith("./")) && !targetExists(href)) check.badLinks.push(`missing target ${href}`);
        }
        if (checkA11y) {
          const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          check.a11y = result.violations.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
        }
        const screenshotPath = path.join(evidence, `${name}.jpg`);
        await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 65, fullPage });
        check.screenshot = screenshotPath;
      } catch (error) {
        errors.push(`exception: ${error.message}`);
      }
      check.errors = errors;
      if (check.mainCount !== 1) check.failures = [...(check.failures || []), `main count ${check.mainCount}`];
      if (!check.h1Visible) check.failures = [...(check.failures || []), "no visible h1"];
      if (check.overflow > 1) check.failures = [...(check.failures || []), `overflow ${check.overflow}`];
      if (check.badLinks.length) check.failures = [...(check.failures || []), `${check.badLinks.length} bad links`];
      if (check.a11y.length) check.failures = [...(check.failures || []), `${check.a11y.length} accessibility violations`];
      if (errors.length) check.failures = [...(check.failures || []), `${errors.length} runtime errors`];
      report.checks.push(check);
      if (check.failures?.length) report.failures.push({ name, failures: check.failures, errors, badLinks: check.badLinks, a11y: check.a11y });
      console.log(`${check.failures?.length ? "FAIL" : "PASS"} ${name}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(evidence, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.checks.length} route/view checks; ${report.failures.length} failures. Report: ${path.join(evidence, "report.json")}`);
if (report.failures.length) process.exit(1);
