# -*- coding: utf-8 -*-
# Round-2 blind audit: dead-link scan.
# 1) Build route set from i18n/registry.ts pageDefs + static app routes
# 2) Extract all internal href targets from tsx/html
# 3) Report targets with no matching route
import re, io, sys, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

WEB = os.path.dirname(os.path.abspath(__file__))

# --- routes ---
reg = open(os.path.join(WEB, "i18n/registry.ts"), encoding="utf-8").read()
pages = re.findall(r'^\s*"([^"]+)":\s*\{\s*\n\s*available:\s*\[([^\]]*)\]', reg, re.M)
LOCALES = ["en", "cn", "tw", "jp"]
routes = set()
for slug, avail in pages:
    locs = re.findall(r'"(\w+)"', avail)
    for l in locs:
        p = f"/{slug}" if l == "en" else f"/{l}/{slug}"
        routes.add(p)
# home pages
routes |= {"/", "/cn", "/tw", "/jp"}
# static app routes
routes |= {"/404", "/admin/dashboard"}
# public files
for f in glob.glob(os.path.join(WEB, "public/**/*.*"), recursive=True):
    rel = os.path.relpath(f, os.path.join(WEB, "public")).replace("\\", "/")
    routes.add("/" + rel)

def normalize(h):
    h = h.strip()
    h = h.split("#")[0].split("?")[0]
    if h != "/":
        h = h.rstrip("/")
    return h

# --- extract hrefs ---
files = []
for pat in ("components/**/*.tsx", "app/**/*.tsx", "public/**/*.html", "i18n/**/*.tsx"):
    files += glob.glob(os.path.join(WEB, pat), recursive=True)

hrefs = []  # (file, lineno, raw)
href_re = re.compile(r'href\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|\{\s*"([^"]*)"\s*\}|\{\s*\'([^\']*)\'\s*\})')
for f in files:
    src = open(f, encoding="utf-8").read()
    for i, line in enumerate(src.splitlines(), 1):
        for m in href_re.finditer(line):
            raw = next(g for g in m.groups() if g is not None)
            hrefs.append((os.path.relpath(f, WEB).replace("\\", "/"), i, raw))

# template-literal localize("/x", ...) calls
loc_re = re.compile(r'localize\(\s*["\']([^"\']+)["\']')
for f in files:
    src = open(f, encoding="utf-8").read()
    for m in loc_re.finditer(src):
        raw = m.group(1)
        for l in LOCALES:
            p = raw if l == "en" else f"/{l}{raw if raw.startswith('/') else '/' + raw}"
            hrefs.append((os.path.relpath(f, WEB).replace("\\", "/"), 0, p + " [localize]"))

print(f"routes: {len(routes)}, hrefs: {len(hrefs)}")
bad = 0
seen = set()
for f, i, raw in hrefs:
    if raw.startswith(("http://", "https://", "mailto:", "tel:", "data:", "javascript:")):
        continue
    if raw.startswith("#"):
        continue
    h = normalize(raw.replace(" [localize]", ""))
    if not h.startswith("/"):
        continue  # relative or anchor
    if h in seen:
        continue
    seen.add(h)
    if h not in routes:
        print(f"DEAD {f}:{i} -> {raw!r}")
        bad += 1
print(f"dead internal links: {bad}")

# external links inventory (for CSP/domain review)
print("\n== external domains referenced in hrefs ==")
doms = {}
for f, i, raw in hrefs:
    m = re.match(r'https?://([^/]+)', raw)
    if m:
        doms.setdefault(m.group(1), set()).add(f)
for d, fs in sorted(doms.items()):
    print(f"  {d}  ({len(fs)} files)")
