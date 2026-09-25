// R7 系统性排查：样式与展示冲突动态探针
// 覆盖：溢出 / 元素重叠 / 内简写覆盖类背景 / SVG var() 解析 / 页脚中宽度 / sticky 兼容 / 双主题 legacy
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = process.env.R7_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.resolve(__dirname, '_r7_shots');
fs.mkdirSync(SHOTS, { recursive: true });

function findChromium() {
  const b = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(b)) return undefined;
  for (const d of fs.readdirSync(b).filter(d => d.startsWith('chromium-')).sort().reverse()) {
    const exe = path.join(b, d, 'chrome-win', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
    const exe64 = path.join(b, d, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe64)) return exe64;
  }
  return undefined;
}

const PAGES = [
  '/', '/cn', '/tw', '/jp', '/pricing', '/docs', '/blog', '/case-studies',
  '/brand', '/address-check', '/demo', '404.html', 'admin/dashboard.html',
];

const VIEWPORTS = [
  { w: 320, h: 700 }, { w: 375, h: 812 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1440, h: 900 },
];

const findings = [];
function F(sev, cat, loc, msg) { findings.push({ sev, cat, loc, msg }); console.log(`[${sev}] ${cat} @ ${loc}: ${msg}`); }

async function probePage(page, url, vw, label) {
  // 1) 横向溢出
  const overflow = await page.evaluate(() => {
    const out = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1) out.push({ el: 'document', w: doc.scrollWidth });
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 2) {
        out.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), right: +r.right.toFixed(0) });
        if (out.length >= 6) break;
      }
    }
    return out;
  });
  if (overflow.length) F('P1', '横向溢出', `${label}@${vw.w}`, JSON.stringify(overflow.slice(0, 4)));

  // 2) 兄弟元素视觉重叠（排除有意 absolute 装饰/父子关系）
  const overlaps = await page.evaluate(() => {
    const out = [];
    const all = Array.from(document.querySelectorAll('body *')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && getComputedStyle(el).visibility !== 'hidden';
    });
    for (let i = 0; i < all.length && out.length < 5; i++) {
      for (let j = i + 1; j < all.length && out.length < 5; j++) {
        const a = all[i], b = all[j];
        if (a.contains(b) || b.contains(a)) continue;
        // [R7 修正] fixed 祖先内的元素（导航）与流内容相交是设计行为——沿祖先链查 fixed；
        // pointer-events:none 的装饰层（canvas/光晕）有意铺在内容下，排除。
        const inFixed = (el) => { for (let p = el; p; p = p.parentElement) { if (getComputedStyle(p).position === 'fixed') return true; } return false; };
        if (inFixed(a) || inFixed(b)) continue;
        if (getComputedStyle(a).pointerEvents === 'none' || getComputedStyle(b).pointerEvents === 'none') continue;
        // 同一 SVG 内部元素（同心圆/雷达线等）天然相交，非布局缺陷
        const sa = a.closest('svg'), sb = b.closest('svg');
        if (sa && sa === sb) continue;
        // absolute 标注完全压在宿主上（图注/角标设计）——相交覆盖小元素 ≥85% 视为标注
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 12 && oy > 12) {
          // 设计性重叠白名单：
          // a) aria-hidden 装饰印章/光斑压角（seal 印窗口角，文字已避让）
          // b) absolute 图注压宿主图形（Features radar caption，-bottom-2 有意压图）
          const isDecor = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) { if (p.getAttribute && p.getAttribute('aria-hidden') === 'true' && getComputedStyle(p).position === 'absolute') return true; } return false; };
          if (isDecor(a) || isDecor(b)) continue;
          const smallH = Math.min(ra.height, rb.height);
          const isAbs = getComputedStyle(a).position === 'absolute' || getComputedStyle(b).position === 'absolute';
          if (isAbs && oy >= smallH - 10) continue;
          const txt = (el) => ((el.textContent || '').trim().slice(0, 16));
          out.push({ a: a.tagName + '.' + txt(a), b: b.tagName + '.' + txt(b), ox: +ox.toFixed(0), oy: +oy.toFixed(0) });
        }
      }
    }
    return out;
  });
  if (overlaps.length) F('P2', '元素重叠', `${label}@${vw.w}`, JSON.stringify(overlaps.slice(0, 3)));

  // 3) fio-ticks 角标是否渲染（R7-1 后图案在 ::before 上）
  const ticks = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.fio-ticks')) {
      const cs = getComputedStyle(el, '::before');
      out.push({ nImages: (cs.backgroundImage || '').split('linear-gradient').length - 1 });
    }
    return out;
  });
  for (const t of ticks) if (t.nImages < 8) { F('P1', '角标未渲染', label, `::before 渐变数=${t.nImages}（应为 8）`); break; }

  // 4) SVG presentation attribute 中 var() 是否解析
  const svgVar = await page.evaluate(() => {
    const t = document.querySelector('svg text[font-family]');
    if (!t) return null;
    const ff = getComputedStyle(t).fontFamily;
    const raw = t.getAttribute('font-family');
    return { raw: raw && raw.slice(0, 30), computed: ff.slice(0, 40), resolved: !/var\(/.test(ff) };
  });
  if (svgVar && !svgVar.resolved) F('P2', 'SVG var 未解析', label, `attr=${svgVar.raw} → computed=${svgVar.computed}`);

  return { overflow, overlaps, ticks };
}

async function main() {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  for (const vw of VIEWPORTS) {
    for (const scheme of ['dark']) { // 深色为主基线；浅色单独抽测
      const ctx = await browser.newContext({ viewport: { width: vw.w, height: vw.h }, colorScheme: scheme, deviceScaleFactor: vw.w === 375 ? 2 : 1 });
      const page = await ctx.newPage();
      for (const p of PAGES) {
        const label = p === '/' ? 'home-en' : p.replace(/^\//, '').replace(/\.html$/, '').replace('admin/dashboard', 'admin');
        const url = p.endsWith('.html') ? BASE + '/' + p : BASE + p;
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
          await page.waitForTimeout(700);
          await probePage(page, url, vw, label);
        } catch (e) { F('P2', '页面加载失败', `${label}@${vw.w}`, e.message.split('\n')[0]); }
      }
      await ctx.close();
    }
  }

  // 浅色主题抽测（320 秏点 + 桌面）——R6 只测了 4 个首页对比度，legacy 页未测浅色
  for (const vw of [{ w: 375, h: 812 }, { w: 1440, h: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vw.w, height: vw.h }, colorScheme: 'light' });
    const page = await ctx.newPage();
    for (const p of ['/pricing', '/docs', '/address-check', '/demo']) {
      try {
        await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 25000 });
        await page.waitForTimeout(600);
        await probePage(page, BASE + p, { w: vw.w + '(light)' }, p);
        if (vw.w === 1440) await page.screenshot({ path: path.join(SHOTS, `light${p.replace(/\//g, '_')}.png`), fullPage: false });
      } catch (e) { F('P2', '浅色加载失败', p, e.message.split('\n')[0]); }
    }
    await ctx.close();
  }

  // 页脚中档宽度专项（640-960 空间挤压）
  const ctx = await browser.newContext({ viewport: { width: 720, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const footer = await page.evaluate(() => {
    const f = document.querySelector('footer');
    const r = f.getBoundingClientRect();
    const kids = Array.from(f.querySelectorAll(':scope > div > div')).map(k => {
      const kr = k.getBoundingClientRect();
      return { cls: (k.className || '').slice(0, 30), w: +kr.width.toFixed(0), h: +kr.height.toFixed(0) };
    });
    return { w: +r.width.toFixed(0), kids, docW: document.documentElement.scrollWidth };
  });
  console.log('footer@720:', JSON.stringify(footer));
  if (footer.docW > 720) F('P1', '页脚中宽度溢出', '/', 'docW=' + footer.docW);
  await page.screenshot({ path: path.join(SHOTS, 'footer-720.png') });

  // 404 内容是否被 fixed header 遮挡（用真实标题 h1 实测，容器 div 无意义）
  const page404 = await ctx.newPage();
  await page404.goto(BASE + '/404.html', { waitUntil: 'networkidle' }).catch(() => {});
  await page404.waitForTimeout(500);
  const under = await page404.evaluate(() => {
    const h1 = document.querySelector('main h1');
    if (!h1) return null;
    const r = h1.getBoundingClientRect();
    return { h1Top: +r.top.toFixed(0), headerH: 57, hidden: r.top < 57 };
  });
  console.log('404 h1:', JSON.stringify(under));
  if (under && under.hidden) F('P1', '404 内容被 header 遮挡', '/404', JSON.stringify(under));
  await ctx.close();

  // 截图基线（桌面深色各页）
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  for (const p of ['/pricing', '/address-check', '/case-studies']) {
    await p2.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => {});
    await p2.waitForTimeout(600);
    await p2.screenshot({ path: path.join(SHOTS, `r7${p.replace(/\//g, '_')}.png`), fullPage: true });
  }
  await ctx2.close();
  await browser.close();

  console.log(`\n=== TOTAL FINDINGS: ${findings.length} ===`);
  fs.writeFileSync(path.join(SHOTS, 'findings.json'), JSON.stringify(findings, null, 1));
}

main().catch(e => { console.error(e); process.exit(1); });
