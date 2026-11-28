import { test, expect } from "@playwright/test";

const stats = {
  today_blocked: { value: 12, change: 4 },
  risk_addresses: { value: 5348, change: -2 },
  compliance_rate: { value: 98.7, change: 1.2 },
  monitored_transactions: { value: 1200, change: 8 },
  risk_trend: [{ time: "10:00", score: 18 }, { time: "11:00", score: 42 }],
};

test("admin dashboard requires a session and completes the real login state transition", async ({ page }) => {
  await page.route("**/api/v1/auth/me", route => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.route("**/api/v1/auth/login", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/v1/dashboard/stats", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stats }) }));
  await page.route("**/api/v1/dashboard/events", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ events: [] }) }));
  await page.goto("/admin/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "管理员登录" })).toBeVisible();
  await expect(page.getByLabel("管理员用户名")).toHaveAttribute("required", "");
  await expect(page.getByLabel("管理员密码")).toHaveAttribute("required", "");
  await page.getByLabel("管理员用户名").fill("release-check");
  await page.getByLabel("管理员密码").fill("not-a-real-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "运营仪表盘" })).toBeVisible();
  await expect(page.getByText("12", { exact: true })).toBeVisible();
  await expect(page.getByText("98.7%", { exact: true })).toBeVisible();
  await expect(page.getByText("暂无风险事件", { exact: true })).toBeVisible();
});

test("admin login and mocked dashboard stay within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.route("**/api/v1/auth/me", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/v1/dashboard/stats", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stats }) }));
  await page.route("**/api/v1/dashboard/events", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ events: [] }) }));
  await page.goto("/admin/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "运营仪表盘" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("contract console navigation and modal close paths remain operational", async ({ page }) => {
  await page.route("**/api/v1/auth/me", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/admin/", { waitUntil: "networkidle" });
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
  await page.locator('.nav-item[data-page="tags"]').click();
  await expect(page.locator("#tags")).toHaveClass(/active/);
  await page.locator('[data-action="openTagModal"]').click();
  await expect(page.locator("#tagModal")).toHaveClass(/active/);
  await page.locator('#tagModal [data-action="closeModal"]').click();
  await expect(page.locator("#tagModal")).not.toHaveClass(/active/);
});
