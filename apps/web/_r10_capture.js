// R10：多语言多主题视觉素材采集
const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const SHOTS = path.resolve(__dirname, "_r10_shots");
fs.mkdirSync(SHOTS, { recursive: true });
const exe = "C:/Users/wesleyyang/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

// [lang, route(文件式), 名称]
const PAGES = [
  ["en", "index.html", "en-home"],
  ["en", "pricing.html", "en-pricing"],
  ["en", "docs.html", "en-docs"],
  ["en", "blog/why-on-chain-compliance.html", "en-blog-article"],
  ["en", "use-cases/smart-wallet.html", "en-usecase"],
  ["en", "address-check.html", "en-addresscheck"],
  ["en", "brand.html", "en-brand"],
  ["cn", "cn.html", "cn-home"],
  ["cn", "cn/pricing.html", "cn-pricing"],
  ["cn", "cn/docs.html", "cn-docs"],
  ["cn", "cn/blog/why-on-chain-compliance.html", "cn-blog-article"],
  ["cn", "cn/use-cases/smart-wallet.html", "cn-usecase"],
  ["cn", "cn/address-check.html", "cn-addresscheck"],
  ["cn", "cn/brand.html", "cn-brand"],
  ["tw", "tw.html", "tw-home"],
  ["tw", "tw/pricing.html", "tw-pricing"],
  ["tw", "tw/use-cases/smart-wallet.html", "tw-usecase"],
  ["jp", "jp.html", "jp-home"],
  ["jp", "jp/pricing.html", "jp-pricing"],
  ["jp", "jp/use-cases/smart-wallet.html", "jp-usecase"],
];

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  for (const [lang, route, name] of PAGES) {
    for (const scheme of ["dark", "light"]) {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: scheme,
      });
      const page = await ctx.newPage();
      try {
        await page.goto(`http://127.0.0.1:8765/${route}`, { waitUntil: "networkidle", timeout: 30000 });
        // 滚动触发 reveal 与懒加载
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 700) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 100));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(1100);
        await page.screenshot({ path: path.join(SHOTS, `${name}-${scheme}.png`), fullPage: true });
        console.log("ok", name, scheme);
      } catch (e) {
        console.log("ERR", name, scheme, e.message.split("\n")[0]);
      }
      await ctx.close();
    }
    // 移动端（仅首页与 pricing，深浅各一，抽 dark）
    if (["en-home", "cn-home", "en-pricing", "cn-pricing"].includes(name)) {
      const ctx = await browser.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark",
      });
      const page = await ctx.newPage();
      try {
        await page.goto(`http://127.0.0.1:8765/${route}`, { waitUntil: "networkidle", timeout: 30000 });
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 90));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SHOTS, `${name}-mobile-dark.png`), fullPage: true });
        console.log("ok", name, "mobile-dark");
      } catch (e) {
        console.log("ERR mobile", name, e.message.split("\n")[0]);
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log("R10 capture complete");
})();
