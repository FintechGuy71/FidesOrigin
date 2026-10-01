import { test, expect, type Page } from "@playwright/test";

/* 视觉回归：关键页面截图对比。
   动态元素处理：
   - reducedMotion=reduce 使 canvas 网格/count-up/滚动叙事静止
   - 仍对 canvas 与实时筛查组件遮罩（网络结果不可控） */

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
  /* reducedMotion：全站动效遵循 prefers-reduced-motion，
     截图时粒子网格/count-up/滚动叙事全部静止，结果确定 */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path, { waitUntil: "networkidle" });
  /* 等首屏入场动画（fade-up 0.6s）全部落定 */
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: false,
    mask: [page.locator("canvas"), page.locator('[role="status"]')],
  });
}

for (const { path, name } of PAGES) {
  test(`visual: ${name}`, async ({ page }) => {
    await shoot(page, path, name);
  });
}

/* [v5] 移动端视觉基线：首页 390px 首屏（移动排版回归的最低保障） */
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

/* [v5] 页脚法律行回归：滚到页底截屏（多栏页脚 + 许可行是机构级基线要素） */
test("visual: footer-en", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("footer-en.png");
});
