#!/usr/bin/env node
/* ================================================================
   perf-budget.mjs — 静态产物的性能预算检查。
   对 out/index.html 引用的首屏资源（CSS/JS/字体/图片）计重，
   超过预算即非零退出，可挂 CI。
   ================================================================ */
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../out");

/* 预算（gzip 后字节 —— 网络传输口径；Next 构建报告的 First Load JS 同口径） */
const BUDGETS = {
  html: 25 * 1024,            // 首页 HTML
  css: 30 * 1024,             // 全部 CSS
  js: 240 * 1024,             // 首屏 JS chunk 合计（React19 + Next 基线 ~180KB）
  imageAboveFold: 60 * 1024,  // 首屏图片（logo 等）
};

const gz = (buf) => gzipSync(buf, { level: 9 }).length;

const htmlBuf = readFileSync(path.join(OUT, "index.html"));
const htmlSize = gz(htmlBuf);

/* 收集 HTML 引用的本地资源 */
const refs = new Set();
for (const m of htmlBuf.toString("utf8").matchAll(/(?:src|href)="(\/?_next\/[^"]+|\/brand\/[^"]+|\/favicon[^"]*)"/g)) {
  refs.add(m[1]);
}

let cssSize = 0, jsSize = 0, imgSize = 0;
const missing = [];
for (const ref of refs) {
  const fp = path.join(OUT, ref.replace(/^\//, ""));
  if (!existsSync(fp)) { missing.push(ref); continue; }
  const size = gz(readFileSync(fp));
  if (ref.endsWith(".css")) cssSize += size;
  else if (ref.endsWith(".js")) jsSize += size;
  else imgSize += size;
}

const rows = [
  ["HTML", htmlSize, BUDGETS.html],
  ["CSS (all)", cssSize, BUDGETS.css],
  ["JS (first load)", jsSize, BUDGETS.js],
  ["Images (above fold)", imgSize, BUDGETS.imageAboveFold],
];

let fail = 0;
console.log("FidesOrigin 性能预算检查（out/ 静态产物）\n");
for (const [name, size, budget] of rows) {
  const ok = size <= budget;
  if (!ok) fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} ${(size / 1024).toFixed(1).padStart(8)} KB / 预算 ${(budget / 1024).toFixed(0)} KB`
  );
}
if (missing.length) console.log("\n⚠ 引用缺失:", missing.join(", "));
console.log(fail ? `\n${fail} 项超预算` : "\n全部在预算内");
process.exit(fail ? 1 : 0);
