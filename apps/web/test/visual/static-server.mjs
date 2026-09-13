/* 极简静态服务器 —— 供 Playwright webServer 托管 out/ 产物。
   零依赖（node 内置 http），避免 CI 再装 serve/python。 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..", "out");
const PORT = Number(process.env.VISUAL_PORT || 8310);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
};

/* 静态导出无尾斜杠：/cn -> /cn.html；/ -> /index.html */
function resolvePath(url) {
  let p = decodeURIComponent(url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  else if (!extname(p)) p += ".html";
  const full = normalize(join(ROOT, p));
  if (!full.startsWith(normalize(ROOT))) return null; // 防目录穿越
  return full;
}

createServer(async (req, res) => {
  const file = resolvePath(req.url || "/");
  if (!file) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(PORT, () => console.log(`visual static server on :${PORT}`));
