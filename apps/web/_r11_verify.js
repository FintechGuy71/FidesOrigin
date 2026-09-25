const { chromium } = require("@playwright/test");
(async () => {
  const exe = "C:/Users/wesleyyang/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  // M7: 文章页 BlogNav
  await page.goto("http://127.0.0.1:8765/blog/travel-rule-on-chain.html", { waitUntil: "networkidle" });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } });
  await page.waitForTimeout(800);
  const nav = await page.evaluate(() => {
    const nav = document.querySelector(".blog-nav");
    const meta = document.querySelector(".micro");
    return { navExists: !!nav, navText: nav ? nav.textContent.slice(0, 80) : null, meta: meta ? meta.textContent.slice(0, 80) : null };
  });
  console.log("M7:", JSON.stringify(nav));
  // M1: 雷达扫描线元素
  await page.goto("http://127.0.0.1:8765/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, 2400));
  await page.waitForTimeout(600);
  const radar = await page.evaluate(() => {
    const sweep = document.querySelector(".fio-radar-sweep");
    const labels = Array.from(document.querySelectorAll("svg text")).filter(t => /SANCTIONS|FLAGS|MIXER/.test(t.textContent));
    return { sweep: !!sweep, sweepAnimating: sweep ? getComputedStyle(sweep).animationName : null, labels: labels.length };
  });
  console.log("M1:", JSON.stringify(radar));
  // M2: workflow 光点
  const dot = await page.evaluate(() => {
    const d = document.querySelector(".fio-flow-dot");
    return { exists: !!d, anim: d ? getComputedStyle(d).animationName : null };
  });
  console.log("M2:", JSON.stringify(dot));
  // M6: copyable
  await page.goto("http://127.0.0.1:8765/docs.html", { waitUntil: "networkidle" });
  const cp = await page.evaluate(() => {
    const el = document.querySelector("[data-copy]");
    return { count: document.querySelectorAll("[data-copy]").length };
  });
  console.log("M6:", JSON.stringify(cp));
  // M9: 背书带
  await page.goto("http://127.0.0.1:8765/address-check.html", { waitUntil: "networkidle" });
  const src = await page.evaluate(() => {
    const el = document.querySelector(".ac-sources");
    return { exists: !!el, text: el ? el.textContent.slice(0, 60) : null };
  });
  console.log("M9:", JSON.stringify(src));
  await browser.close();
})();
