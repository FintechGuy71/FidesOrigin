import { test, expect, type Page } from "@playwright/test";

/* 视觉回归使用真实页面内容，不遮罩 canvas。
   固定随机种子、reduced-motion 和公开指标响应，消除外部网络漂移；
   生产验收由 verify-release-ui.mjs 另行访问真实接口。 */
async function stabilize(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    let state = 0x5f3759df;
    Math.random = () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.route("**/api/v1/public/stats*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      risk_addresses_total: 5348,
      risk_addresses_high: 132,
      monitored_transactions: 0,
      blocked_today: 0,
      generated_at: "2026-11-23T22:45:08+00:00",
    }),
  }));
  await page.route("https://api.studio.thegraph.com/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      data: {
        riskProfiles: Array.from({ length: 145 }, (_, index) => ({
          id: `0x${index.toString(16).padStart(40, "0")}`,
        })),
      },
    }),
  }));
}

const PAGES: { path: string; name: string }[] = [
  { path: "/", name: "home-en" },
  { path: "/cn", name: "home-cn" },
  { path: "/tw", name: "home-tw" },
  { path: "/jp", name: "home-jp" },
  { path: "/pricing", name: "pricing" },
  { path: "/docs", name: "docs" },
  { path: "/blog", name: "blog" },
  { path: "/case-studies", name: "case-studies" },
  { path: "/brand", name: "brand" },
  { path: "/verification", name: "verification-en" },
  { path: "/cn/verification", name: "verification-cn" },
  { path: "/tw/verification", name: "verification-tw" },
  { path: "/jp/verification", name: "verification-jp" },
  { path: "/contact", name: "contact-en" },
];

async function shoot(page: Page, path: string, name: string) {
  await stabilize(page);
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.locator('[data-metrics-status="live"]')).toHaveCount(
    path.includes("verification") || PAGES.slice(0, 4).some(item => item.path === path) ? 1 : 0,
  );
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false });
}

for (const { path, name } of PAGES) {
  test(`visual: ${name}`, async ({ page }) => {
    await shoot(page, path, name);
  });
}

const MOBILE_PAGES: { path: string; name: string }[] = [
  { path: "/", name: "mobile-home-en" },
  { path: "/cn", name: "mobile-home-cn" },
  { path: "/verification", name: "mobile-verification-en" },
  { path: "/cn/verification", name: "mobile-verification-cn" },
  { path: "/contact", name: "mobile-contact-en" },
];

for (const { path, name } of MOBILE_PAGES) {
  test(`visual: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await shoot(page, path, name);
  });
}

test("visual: footer-en", async ({ page }) => {
  await stabilize(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-metrics-status="live"]')).toHaveCount(1);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("footer-en.png");
});

test("behavior: metrics retain an honest cached snapshot on API failure", async ({ page }) => {
  await stabilize(page);
  await page.unroute("**/api/v1/public/stats*");
  await page.route("**/api/v1/public/stats*", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "intentional test failure" }),
  }));
  await page.goto("/verification", { waitUntil: "networkidle" });
  await expect(page.locator('[data-metrics-status="cached"]')).toHaveCount(1);
  await expect(page.getByText("Cached snapshot", { exact: true })).toBeVisible();
  await expect(page.getByText("5,348", { exact: true })).toBeVisible();
  await expect(page.getByText("145", { exact: true })).toBeVisible();
});

test("behavior: contact validates and submits exactly once", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/v1/contact", async route => {
    posts += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "accepted" }),
    });
  });
  await page.goto("/contact", { waitUntil: "networkidle" });
  await expect(page.locator("#message")).toHaveAttribute("required", "");
  await page.getByLabel("Full Name").fill("Automated UI Test");
  await page.getByLabel("Work Email").fill("release-acceptance@fidesorigin.com");
  await page.getByLabel("Message", { exact: true }).fill("Mocked browser acceptance; no production write.");
  await page.getByRole("button", { name: "Send Message", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Message sent!");
  await page.waitForTimeout(300);
  expect(posts).toBe(1);
});
