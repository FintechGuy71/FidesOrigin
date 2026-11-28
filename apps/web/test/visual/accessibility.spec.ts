import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  "/", "/cn", "/tw", "/jp", "/pricing", "/docs", "/docs/api", "/docs/sdk",
  "/blog", "/blog/travel-rule-on-chain", "/case-studies", "/brand", "/verification",
  "/contact", "/demo", "/address-check", "/about", "/security", "/privacy", "/terms", "/404",
];

async function mockData(page: Page) {
  await page.route("**/api/v1/public/stats*", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ risk_addresses_total: 5348, risk_addresses_high: 132, monitored_transactions: 0, blocked_today: 0, generated_at: "2026-11-28T10:00:00+00:00" }),
  }));
  await page.route("https://api.studio.thegraph.com/**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { riskProfiles: [{ id: `0x${"1".repeat(40)}` }], protocolStats: { totalComplianceChecks: 12, totalBlocked: 1, totalFlagged: 2, totalHeld: 0, totalSanctioned: 3 } } }),
  }));
  await page.route("https://plausible.io/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
}

for (const path of PAGES) {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    test(`a11y ${viewport.name}: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockData(page);
      await page.goto(path, { waitUntil: "networkidle" });
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const violations = result.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
      }));
      await test.info().attach("axe-violations", { body: JSON.stringify(violations, null, 2), contentType: "application/json" });
      expect(violations).toEqual([]);
    });
  }
}

test("a11y desktop: authenticated admin dashboard", async ({ page }) => {
  await mockData(page);
  await page.route("**/api/v1/auth/me", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/v1/dashboard/stats", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stats: { today_blocked: 12, risk_addresses: 5348, compliance_rate: 98.7, monitored_transactions: 1200, risk_trend: [] } }) }));
  await page.route("**/api/v1/dashboard/events", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ events: [] }) }));
  await page.goto("/admin/dashboard", { waitUntil: "networkidle" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
});

test("a11y desktop: contract console", async ({ page }) => {
  await mockData(page);
  await page.route("**/api/v1/auth/me", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/admin/", { waitUntil: "networkidle" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
});
