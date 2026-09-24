# -*- coding: utf-8 -*-
# Round-2 blind audit: DOM id cross-check for public/admin (index.html + admin.js)
import re, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
WEB = os.path.dirname(os.path.abspath(__file__))

html = open(os.path.join(WEB, "public/admin/index.html"), encoding="utf-8").read()
js = open(os.path.join(WEB, "public/admin/admin.js"), encoding="utf-8").read()

# ids defined in static HTML markup (exclude inline <script> bodies for definition scan? include both, note source)
html_ids = set(re.findall(r'id="([^"]+)"', html))

# ids referenced by JS (admin.js + inline scripts in index.html)
inline_js = "\n".join(re.findall(r"<script(?![^>]*src)[^>]*>(.*?)</script>", html, re.S))
alljs = js + "\n" + inline_js
ref_ids = set()
for m in re.finditer(r'getElementById\(\s*[\'"]([^\'"]+)[\'"]', alljs):
    ref_ids.add(m.group(1))
for m in re.finditer(r'_el\(\s*[\'"]([^\'"]+)[\'"]', alljs):
    ref_ids.add(m.group(1))
for m in re.finditer(r'querySelector\(\s*[\'"]#([A-Za-z][\w-]*)', alljs):
    ref_ids.add(m.group(1))

# ids created dynamically in JS (createElement + .id =)
dyn_ids = set(re.findall(r'\.id\s*=\s*[\'"]([^\'"]+)[\'"]', alljs))

missing = ref_ids - html_ids - dyn_ids
unused = html_ids - ref_ids
print(f"html ids: {len(html_ids)}, js-referenced ids: {len(ref_ids)}, dynamic ids: {len(dyn_ids)}")
print("\n== referenced by JS but NOT present in HTML (and not created dynamically) ==")
for i in sorted(missing):
    # find referencing line
    for src_name, src in (("admin.js", js), ("index.html<script>", inline_js)):
        for n, line in enumerate(src.splitlines(), 1):
            if i in line and ("getElementById" in line or "querySelector" in line or "_el(" in line):
                print(f"  #{i}  <- {src_name}:{n}: {line.strip()[:100]}")
                break
        else:
            continue
        break
print("\n== HTML ids never referenced by JS (candidates: dead markup) ==")
for i in sorted(unused):
    print(f"  #{i}")
print("\nDONE")
