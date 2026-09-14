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
