/* 移动端交互冒烟：移动菜单 / docs 侧栏 / 语言切换 / 表单蜜罐 */
import { test, expect } from "@playwright/test";

test("mobile menu opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/", { waitUntil: "networkidle" });
  const toggle = page.getByRole("button", { name: /toggle menu|打开菜单/i });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const menu = page.locator("#mobile-menu");
  await expect(menu).toBeVisible();
  /* 菜单内链接可点 */
  await expect(menu.getByRole("link").first()).toBeVisible();
  await toggle.click();
  await expect(menu).not.toBeVisible();
});

test("docs sidebar toggle on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/docs", { waitUntil: "networkidle" });
  const toggle = page.locator(".docs-sidebar-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator(".docs-sidebar.active")).toBeVisible();
});

test("language menu keyboard operable", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const langBtn = page.locator("button[aria-haspopup='menu']").first();
  await langBtn.click();
  const menu = page.locator("#lang-menu");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
});

test("contact honeypot is hidden from users", async ({ page }) => {
  await page.goto("/contact", { waitUntil: "networkidle" });
  /* 蜜罐用 absolute left:-9999px + opacity:0 隐藏（对读屏 aria-hidden），
     Playwright toBeVisible 只认 display/visibility，故改查几何与透明度。 */
  const hp = page.locator("input[name='website']");
  const box = await hp.boundingBox();
  expect(box === null || box.x + box.width < 0).toBeTruthy();
  await expect(hp).toHaveCSS("opacity", "0");
  await expect(hp).toHaveAttribute("aria-hidden", "true");
  /* 正常字段可见可填 */
  await page.locator("#name").fill("Audit Bot");
  await expect(page.locator("#name")).toHaveValue("Audit Bot");
});

/* [R13-I1] reveal 回归哨兵（关闭 CI 检测盲区）：
   visual.spec 全程 reducedMotion:reduce，会命中 legacy.css 尾部
   "强制可见"分支——R8-A1 型回归（隐身规则压过 .visible）在该模式下
   不可见。本用例在【正常动效】视口下滚动 legacy 页，断言所有 .reveal
   元素完成淡入（visible 类 + computed opacity）。功能断言、无像素
   基线依赖，不触碰 visual-regression 的基线机制。 */
test("reveal elements become visible on scroll (normal motion)", async ({ page }) => {
  await page.goto("/pricing", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  /* 等待 0.7s 淡入过渡落定 */
  await page.waitForTimeout(1000);
  const invis = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".reveal")).filter(
      (el) => parseFloat(getComputedStyle(el).opacity) < 0.9,
    ).map((el) => (el.textContent || "").trim().slice(0, 30)),
  );
  expect(invis, `未淡入的 reveal 元素: ${JSON.stringify(invis)}`).toHaveLength(0);
});
