/* 移动端审计：逐页 375px 视口检查横向溢出 + 关键页全页截图 */
import { test, expect } from "@playwright/test";

const PAGES = [
  "/", "/cn", "/tw", "/jp",
  "/pricing", "/docs", "/docs/api", "/docs/sdk", "/blog",
  "/blog/travel-rule-on-chain", "/blog/why-on-chain-compliance",
  "/case-studies", "/brand", "/about", "/security", "/privacy", "/terms",
  "/changelog", "/contact", "/demo", "/address-check",
  "/use-cases/stablecoin-compliance", "/use-cases/rwa-tokenization", "/use-cases/smart-wallet",
  "/cn/pricing", "/cn/docs", "/jp/blog", "/tw/brand",
];

for (const path of PAGES) {
  test(`mobile-overflow: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      const over = el.scrollWidth - el.clientWidth;
      let culprit = "";
      if (over > 1) {
        /* 找最宽的越界元素 */
        const vw = document.documentElement.clientWidth;
        for (const node of document.querySelectorAll("body *")) {
          const r = node.getBoundingClientRect();
          if (r.width > vw + 1 || r.right > vw + 1 || r.left < -1) {
            culprit = `${node.tagName}.${(node.className || "").toString().slice(0, 60)} w=${Math.round(r.width)} left=${Math.round(r.left)}`;
            break;
          }
        }
      }
      return { over, culprit };
    });
    expect(overflow.over, `横向溢出 ${overflow.over}px @ ${path} 元凶: ${overflow.culprit}`).toBeLessThanOrEqual(1);
  });
}
