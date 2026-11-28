import { test, expect } from "@playwright/test";

test("documentation copy control copies real code and confirms the result", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:8310" });
  await page.goto("/docs", { waitUntil: "networkidle" });
  const copy = page.locator(".docs-code-copy").first();
  await copy.click();
  await expect(copy).toHaveText("Copied");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("curl");
});

test("demo tabs are keyboard operable and both queries render API results", async ({ page }) => {
  await page.route("**/v1/public/risk-check*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ risk_score: 100, risk_level: "critical", tags: ["OFAC_SDN_ADVANCED"], risk_factors: [{ name: "OFAC SDN" }], transactions_count: 4, last_updated_at: "2026-11-28" }),
  }));
  await page.goto("/demo", { waitUntil: "networkidle" });
  const screenTab = page.getByRole("tab", { name: "Address Screening" });
  await expect(screenTab).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Screen Address" }).click();
  await expect(page.locator("#demo-panel-screen")).toContainText("HIGH RISK");
  await expect(page.locator("#demo-panel-screen")).toContainText("OFAC_SDN_ADVANCED");
  await screenTab.focus();
  await page.keyboard.press("ArrowRight");
  const riskTab = page.getByRole("tab", { name: "Risk Score", exact: true });
  await expect(riskTab).toBeFocused();
  await expect(riskTab).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Check Risk", exact: true }).click();
  await expect(page.locator("#demo-panel-risk")).toContainText("100/100");
  await expect(page.locator("#demo-panel-risk")).toContainText("OFAC SDN");
});

test("address check rejects invalid input and renders a low-risk API response", async ({ page }) => {
  let requests = 0;
  await page.route("https://api.studio.thegraph.com/**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { protocolStats: { totalComplianceChecks: 12, totalBlocked: 1, totalFlagged: 2, totalHeld: 0, totalSanctioned: 3 } } }),
  }));
  await page.route("**/v1/public/risk-check*", route => {
    requests += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ risk_score: 0, risk_level: "low", tags: [], risk_factors: [] }) });
  });
  await page.goto("/address-check", { waitUntil: "networkidle" });
  const input = page.locator(".ac-search input");
  await input.fill("invalid");
  await page.getByRole("button", { name: "Check Risk Level" }).click();
  await expect(page.locator(".ac-result")).toContainText("Invalid Address");
  expect(requests).toBe(0);
  await input.fill(`0x${"0".repeat(40)}`);
  await input.press("Enter");
  await expect(page.locator(".ac-result")).toContainText("Low Risk");
  await expect(page.locator(".ac-result")).toContainText("FidesOrigin Backend");
  expect(requests).toBe(1);
});

test("primary navigation reaches pricing, documentation and the contact form", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator(".site-nav").getByRole("link", { name: "Pricing", exact: true }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { name: "Simple, transparent pricing" })).toBeVisible();
  await page.locator(".site-nav").getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole("heading", { name: /Documentation/ })).toBeVisible();
  await page.locator(".site-brand").first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "Request Demo", exact: true }).first().click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("button", { name: "Send Message" })).toBeVisible();
});

test("mobile scroll regions are keyboard focusable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing", { waitUntil: "networkidle" });
  const table = page.locator(".compare-table-wrap");
  await expect(table).toHaveAttribute("tabindex", "0");
  await table.focus();
  await expect(table).toBeFocused();
  await page.goto("/cn", { waitUntil: "networkidle" });
  const journey = page.locator(".journey-track");
  await expect(journey).toHaveAttribute("tabindex", "0");
  await journey.focus();
  await expect(journey).toBeFocused();
});
