import { test, expect, type Page } from "@playwright/test";

async function mockMetrics(page: Page) {
  await page.route("**/api/v1/public/stats*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      risk_addresses_total: 5348,
      risk_addresses_high: 132,
      monitored_transactions: 0,
      blocked_today: 0,
      generated_at: "2026-11-28T10:00:00+00:00",
    }),
  }));
  await page.route("https://api.studio.thegraph.com/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { riskProfiles: [{ id: `0x${"1".repeat(40)}` }] } }),
  }));
}

test("hero canvas renders and the page has no runtime or local asset errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => {
    if (response.url().startsWith("http://127.0.0.1:8310") && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  await mockMetrics(page);
  await page.goto("/", { waitUntil: "networkidle" });
  const canvas = page.locator(".origin-field-canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => node.width)).toBeGreaterThan(300);
  const painted = canvas.evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext("2d");
    if (!context) return false;
    const pixels = context.getImageData(0, 0, node.width, node.height).data;
    for (let index = 3; index < pixels.length; index += 160) {
      if (pixels[index] > 0) return true;
    }
    return false;
  });
  expect(await painted).toBe(true);
  expect(errors).toEqual([]);
});

test("hero screening validates, submits once and renders a real result state", async ({ page }) => {
  await mockMetrics(page);
  let requests = 0;
  await page.route("**/v1/public/risk-check*", route => {
    requests += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ risk_score: 0, risk_level: "low", tags: [] }),
    });
  });
  await page.goto("/", { waitUntil: "networkidle" });
  const input = page.getByLabel("Live · Screen any address");
  await input.fill("not-an-address");
  await page.getByRole("button", { name: "Screen", exact: true }).click();
  await expect(page.getByText("Enter a valid 0x address (42 chars)")).toBeVisible();
  expect(requests).toBe(0);
  await input.fill(`0x${"0".repeat(40)}`);
  await input.press("Enter");
  await expect(page.locator("#hero-screen-result")).toContainText("LOW");
  await expect(page.locator("#hero-screen-result")).toContainText("Risk 0/100");
  await expect(page.getByRole("link", { name: "Full demo" })).toHaveAttribute("href", "/demo");
  expect(requests).toBe(1);
});

test("hero remains fully readable with reduced motion on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockMetrics(page);
  await page.goto("/cn", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#hero-address")).toBeVisible();
  await expect(page.locator(".origin-field-canvas")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
