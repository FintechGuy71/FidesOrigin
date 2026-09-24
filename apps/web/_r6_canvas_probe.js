const { chromium } = require('@playwright/test');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe') });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const cs = getComputedStyle(c);
    // 找出所有命中 canvas 的 position/inset 规则
    const hits = [];
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      const walk = (rs, layer) => {
        for (const r of rs) {
          if (r.cssRules) { walk(r.cssRules, r.name || layer); continue; }
          if (!r.selectorText) continue;
          try { if (!c.matches(r.selectorText)) continue; } catch { continue; }
          if (/position|inset|width|height/.test(r.style.cssText)) {
            hits.push({ layer: layer || 'unlayered', sel: r.selectorText, css: r.style.cssText });
          }
        }
      };
      walk(rules, null);
    }
    return { position: cs.position, top: cs.top, left: cs.left, width: cs.width, height: cs.height, hits };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
