// R6 第一轮：视觉体检走查脚本（Playwright）
// 覆盖：首页全状态（默认/悬停/聚焦/加载/空数据/错误）、导航、表单、页脚
// 输出：截图 + 量化检查（对比度/尺寸/间距异常）
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// 优先使用本机已缓存的 chromium（版本目录可能与 playwright 期望不一致，
// 显式指定 executablePath 避免触发浏览器下载）。
function findChromium() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium-')).sort().reverse();
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-win', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  const shells = fs.readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of shells) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const OUT = path.resolve(__dirname, 'out');
const SHOTS = path.resolve(__dirname, '_r6_shots');
// 静态导出资源为绝对路径（/_next/...），file:// 下无法加载 → 必须经 HTTP 服务
const BASE = process.env.R6_BASE || 'http://127.0.0.1:8765';

const findings = [];
function f(sev, area, msg) { findings.push({ sev, area, msg }); }

async function main() {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const url = (p) => BASE + '/' + p;

  await page.goto(url('index.html'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '01-home-top.png') });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, '02-home-workflows.png') });
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, '03-home-features.png') });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, '04-home-footer.png'), fullPage: false });
  await page.screenshot({ path: path.join(SHOTS, '05-home-full.png'), fullPage: true });

  // ---- 量化检查：对比度（WCAG 相对亮度）----
  const contrastReport = await page.evaluate(() => {
    function lum(rgb) {
      const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function parse(s) {
      const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
    }
    const bad = [];
    const els = document.querySelectorAll('body *');
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (!txt || el.children.length > 0) continue; // 只看叶子文本节点
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const fg = parse(cs.color); const bg = parse(cs.backgroundColor);
      if (!fg) continue;
      let bgc = bg && bg[3] > 0.9 ? bg : null;
      if (!bgc) { // 向上找不透明背景
        let p = el.parentElement;
        while (p && !bgc) {
          const pcs = getComputedStyle(p);
          const pb = parse(pcs.backgroundColor);
          if (pb && pb[3] > 0.9) bgc = pb;
          p = p.parentElement;
        }
      }
      if (!bgc) bgc = [10, 20, 31, 1]; // --fio-ink 默认底
      const l1 = lum(fg.slice(0, 3)), l2 = lum(bgc.slice(0, 3));
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const fs = parseFloat(cs.fontSize);
      const fw = parseInt(cs.fontWeight) || 400;
      const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need - 0.05) {
        bad.push({ text: txt.slice(0, 40), ratio: +ratio.toFixed(2), need, color: cs.color, fs });
      }
    }
    return bad;
  });
  if (contrastReport.length) f('P1', '对比度', JSON.stringify(contrastReport.slice(0, 12)));

  // ---- 量化检查：焦点可见性（跳过隐藏元素：display:none 无法聚焦）----
  const focusReport = await page.evaluate(() => {
    const out = [];
    const els = document.querySelectorAll('a[href], button, input, select, textarea');
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // 隐藏（如 md:hidden 的移动端按钮）
      el.focus();
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const ring = cs.boxShadow && cs.boxShadow !== 'none';
      if (!outline && !ring) out.push((el.tagName + '.' + (el.className || '').toString().slice(0, 40)));
      el.blur();
    }
    return out;
  });
  if (focusReport.length) f('P1', '焦点可见性', JSON.stringify(focusReport.slice(0, 10)));

  // ---- 触控目标尺寸 ----
  const tapReport = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 40 && r.width < 40) out.push({ tag: el.tagName, text: (el.textContent||'').trim().slice(0,20), w: +r.width.toFixed(0), h: +r.height.toFixed(0) });
    }
    return out;
  });
  if (tapReport.length) f('P2', '触控目标<40px', JSON.stringify(tapReport.slice(0, 10)));

  // ---- HeroScreen 状态走查：invalid / checking / error ----
  const screenInput = page.locator('input[aria-label]').first();
  await screenInput.fill('0x123');
  await screenInput.press('Enter');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, '06-screen-invalid.png') });
  const invalidVisible = await page.locator('[role="status"]').textContent().then(t => /valid 0x|42 chars/.test(t || '')).catch(() => false);
  if (!invalidVisible) f('P2', 'HeroScreen', 'invalid 状态无可见提示');

  // error 状态（file:// 下 fetch 必失败 → 应显示 error 文案）
  await screenInput.fill('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  await screenInput.press('Enter');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOTS, '07-screen-error.png') });

  // ---- 悬停态 ----
  const cta = page.locator('.fio-btn-primary').first();
  await cta.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, '08-cta-hover.png') });
  const hoverBg = await cta.evaluate(el => getComputedStyle(el).backgroundColor);

  // ---- 键盘导航 Tab 走查 ----
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press('Tab'); // skip link
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, '09-skip-link-focus.png') });
  const skipVisible = await page.evaluate(() => {
    const a = document.querySelector('a[href="#main-content"]');
    if (!a) return false;
    a.focus();
    const r = a.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!skipVisible) f('P1', '无障碍', 'skip-link 聚焦后不可见');

  // ---- 移动端 375 ----
  const mob = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mob.newPage();
  await mp.goto(url('index.html'), { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: path.join(SHOTS, '10-mobile-top.png') });
  // 横向溢出检查
  const overflow = await mp.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 2 && r.width > 0) {
        out.push({ tag: el.tagName, cls: (el.className||'').toString().slice(0,50), right: +r.right.toFixed(0) });
      }
    }
    return out.slice(0, 8);
  });
  if (overflow.length) f('P1', '移动端横向溢出', JSON.stringify(overflow));
  // 移动菜单
  await mp.locator('button[aria-controls="mobile-menu"]').click();
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: path.join(SHOTS, '11-mobile-menu.png') });
  await mp.screenshot({ path: path.join(SHOTS, '12-mobile-full.png'), fullPage: true });

  // ---- 平板 768 ----
  const tab = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tp = await tab.newPage();
  await tp.goto(url('index.html'), { waitUntil: 'networkidle' });
  await tp.waitForTimeout(1000);
  await tp.screenshot({ path: path.join(SHOTS, '13-tablet-top.png') });
  await tp.screenshot({ path: path.join(SHOTS, '14-tablet-full.png'), fullPage: true });

  // ---- 中文首页 ----
  await page.goto(url('cn.html'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, '15-cn-home.png'), fullPage: true });

  // ---- 404 ----
  await page.goto(url('404.html'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, '16-404.png') });

  // ---- 经典站（legacy）抽查 ----
  for (const p of ['docs.html', 'pricing.html', 'address-check.html', 'demo.html']) {
    try {
      await page.goto(url(p), { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SHOTS, 'legacy-' + p.replace('.html', '') + '.png'), fullPage: true });
    } catch (e) { /* 页面可能不存在 */ }
  }

  // ---- admin dashboard（无登录态 → 应显示登录/未授权态而非破版）----
  await page.goto(url('admin/dashboard.html'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '20-admin-dashboard.png'), fullPage: false });

  await browser.close();

  console.log('\n=== FINDINGS (' + findings.length + ') ===');
  for (const x of findings) console.log(`[${x.sev}] ${x.area}: ${x.msg}`);
  console.log('\nScreenshots saved to', SHOTS);
}

main().catch(e => { console.error(e); process.exit(1); });
// 追加：双主题对照截图（第三轮复检）
async function themeShots() {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, `30-theme-${scheme}-top.png`) });
    await page.evaluate(() => window.scrollTo(0, 2600));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, `31-theme-${scheme}-mid.png`) });
    // 对比度复测（该主题下）
    const bad = await page.evaluate(() => {
      function lum(rgb){const[r,g,b]=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b}
      function parse(s){const m=s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null}
      const out=[];
      for(const el of document.querySelectorAll('body *')){
        const txt=(el.textContent||'').trim(); if(!txt||el.children.length>0)continue;
        const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)continue;
        const fg=parse(cs.color); if(!fg)continue;
        let bgc=null,p=el;
        while(p&&!bgc){const pb=parse(getComputedStyle(p).backgroundColor);if(pb&&pb[3]>0.9)bgc=pb;p=p.parentElement}
        if(!bgc)continue;
        const l1=lum(fg.slice(0,3)),l2=lum(bgc.slice(0,3));
        const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
        const fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight)||400;
        const need=(fs>=24||(fs>=18.66&&fw>=700))?3:4.5;
        if(ratio<need-0.05)out.push({t:txt.slice(0,30),ratio:+ratio.toFixed(2),need});
      }
      return out;
    });
    console.log(`[${scheme}] contrast violations:`, bad.length ? JSON.stringify(bad.slice(0,8)) : 'NONE');
    await ctx.close();
  }
  await browser.close();
}
themeShots().catch(e => { console.error(e); process.exit(1); });
// 追加：双主题对照截图（第三轮复检）
async function themeShots() {
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, `30-theme-${scheme}-top.png`) });
    await page.evaluate(() => window.scrollTo(0, 2600));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, `31-theme-${scheme}-mid.png`) });
    // 对比度复测（该主题下）
    const bad = await page.evaluate(() => {
      function lum(rgb){const[r,g,b]=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b}
      function parse(s){const m=s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null}
      const out=[];
      for(const el of document.querySelectorAll('body *')){
        const txt=(el.textContent||'').trim(); if(!txt||el.children.length>0)continue;
        const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)continue;
        const fg=parse(cs.color); if(!fg)continue;
        let bgc=null,p=el;
        while(p&&!bgc){const pb=parse(getComputedStyle(p).backgroundColor);if(pb&&pb[3]>0.9)bgc=pb;p=p.parentElement}
        if(!bgc)continue;
        const l1=lum(fg.slice(0,3)),l2=lum(bgc.slice(0,3));
        const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
        const fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight)||400;
        const need=(fs>=24||(fs>=18.66&&fw>=700))?3:4.5;
        if(ratio<need-0.05)out.push({t:txt.slice(0,30),ratio:+ratio.toFixed(2),need});
      }
      return out;
    });
    console.log(`[${scheme}] contrast violations:`, bad.length ? JSON.stringify(bad.slice(0,8)) : 'NONE');
    await ctx.close();
  }
  await browser.close();
}
themeShots().catch(e => { console.error(e); process.exit(1); });
