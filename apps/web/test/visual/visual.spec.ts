import { test, expect, type Page } from "@playwright/test";

/* 视觉回归使用真实页面内容，不再遮罩全屏 canvas。
   固定 Math.random 种子使粒子与演示交易在测试间可复现；
   reducedMotion 停止动画，最终截图仍包含真实文字、布局和指标。 */
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
];

async function shoot(page: Page, path: string, name: string) {
  await stabilize(page);
  await page.goto(path, { waitUntil: "networkidle" });
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
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("footer-en.png");
});
