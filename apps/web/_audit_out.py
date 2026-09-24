# -*- coding: utf-8 -*-
# Round-2 blind audit: build artifact reconciliation
import re, io, sys, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
WEB = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(WEB, "out")

html_files = glob.glob(os.path.join(OUT, "**/*.html"), recursive=True)
print(f"out html files: {len(html_files)}")

# 1) external resource URLs referenced in artifacts
ext = {}
for f in html_files:
    src = open(f, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r'(?:src|href)\s*=\s*"(https?://[^"]+)"', src):
        ext.setdefault(m.group(1), set()).add(os.path.relpath(f, OUT))
print("\n== external URLs in out/*.html ==")
for u, fs in sorted(ext.items()):
    print(f"  {u}  ({len(fs)} files, e.g. {sorted(fs)[0]})")

# 2) inline scripts (non-JSON-LD)
inline = 0
jsonld = 0
for f in html_files:
    src = open(f, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r"<script(?![^>]*src)[^>]*>", src):
        if "application/ld+json" in m.group(0):
            jsonld += 1
        else:
            inline += 1
print(f"\ninline <script> (non-ld+json): {inline}, ld+json: {jsonld}")

# 3) sensitive strings
pat = re.compile(r"(sk_live|sk_test|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]|passwd|secret[_-]?key|api[_-]?key\s*[:=]\s*['\"][^'\"]{8,}|Bearer\s+[A-Za-z0-9._-]{20,}|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|localhost:\d{2,5}|127\.0\.0\.1:\d{2,5})", re.I)
hits = []
for f in glob.glob(os.path.join(OUT, "**/*.*"), recursive=True):
    if f.endswith((".png", ".ico", ".woff2", ".woff", ".ttf")):
        continue
    try:
        src = open(f, encoding="utf-8", errors="replace").read()
    except Exception:
        continue
    for m in pat.finditer(src):
        hits.append((os.path.relpath(f, OUT), m.group(0)[:80]))
print(f"\n== sensitive-string hits ({len(hits)}) ==")
for f, h in hits[:40]:
    print(f"  {f}: {h!r}")

# 4) sitemap vs out files
sm = os.path.join(OUT, "sitemap.xml")
if os.path.exists(sm):
    xml = open(sm, encoding="utf-8").read()
    urls = re.findall(r"<loc>([^<]+)</loc>", xml)
    print(f"\nsitemap urls: {len(urls)}")
    missing = []
    for u in urls:
        p = u.replace("https://fidesorigin.com", "").strip("/")
        cand = os.path.join(OUT, p + ".html") if p else os.path.join(OUT, "index.html")
        if not os.path.exists(cand):
            missing.append(u)
    print("sitemap urls with NO artifact:", len(missing))
    for u in missing:
        print("  MISSING", u)
else:
    print("\nNO sitemap.xml in out/")

# 5) robots.txt
rob = os.path.join(OUT, "robots.txt")
print("\nrobots.txt:", open(rob, encoding="utf-8").read() if os.path.exists(rob) else "MISSING")

# 6) orphan artifacts: html files not reachable from sitemap (except 404/admin)
if os.path.exists(sm):
    urlset = set(u.replace("https://fidesorigin.com", "") for u in urls)
    for f in html_files:
        rel = "/" + os.path.relpath(f, OUT).replace("\\", "/")
        rel = rel[:-5] if rel.endswith(".html") else rel
        if rel.endswith("/index"):
            rel = rel[:-6]
        if rel in ("", "/"):
            rel = "/"
        if rel not in urlset and not rel.startswith("/admin") and rel != "/404":
            print("  ORPHAN artifact:", rel)
