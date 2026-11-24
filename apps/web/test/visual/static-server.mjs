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
  // 可选的生产同源代理：默认仅转发只读 /api/v1/ 请求。
  // 只有显式设置 VISUAL_ALLOW_CONTACT_POST=true 才放行精确的预约 POST，
  // 不转发客户端凭证，不开放其他写操作。
  const pathname = new URL(req.url || '/', 'http://visual.local').pathname;
  if (pathname.startsWith('/api/v1/') && process.env.VISUAL_API_ORIGIN) {
    const contactPost = pathname === '/api/v1/contact' && req.method === 'POST' &&
      process.env.VISUAL_ALLOW_CONTACT_POST === 'true';
    if (!['GET', 'HEAD'].includes(req.method || 'GET') && !contactPost) {
      res.writeHead(405).end('method not allowed');
      return;
    }
    try {
      let requestBody;
      if (contactPost) {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) {
            res.writeHead(413).end('request too large');
            return;
          }
          chunks.push(chunk);
        }
        requestBody = Buffer.concat(chunks);
      }
      const gatewayRoute = pathname === '/api/v1/public/risk-check' || pathname === '/api/v1/contact';
      const upstream = gatewayRoute && process.env.VISUAL_GATEWAY_ORIGIN
        ? process.env.VISUAL_GATEWAY_ORIGIN
        : process.env.VISUAL_API_ORIGIN;
      const target = new URL(req.url, upstream);
      const response = await fetch(target, {
        method: req.method,
        headers: { Accept: 'application/json', ...(contactPost ? { 'Content-Type': 'application/json' } : {}) },
        body: requestBody,
        signal: AbortSignal.timeout(60000),
      });
      const body = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/json' });
      res.end(body);
    } catch (error) {
      console.error(`[visual-proxy] ${pathname}: ${error.message}`, error.cause?.code || '');
      res.writeHead(502).end('upstream unavailable');
    }
    return;
  }
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
