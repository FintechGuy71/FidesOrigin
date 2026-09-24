# -*- coding: utf-8 -*-
# Round-2 blind audit: a11y static checks on SOURCE tsx/html
import re, io, sys, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
WEB = os.path.dirname(os.path.abspath(__file__))

files = glob.glob(os.path.join(WEB, "components/**/*.tsx"), recursive=True) \
      + glob.glob(os.path.join(WEB, "app/**/*.tsx"), recursive=True) \
      + glob.glob(os.path.join(WEB, "public/**/*.html"), recursive=True)

img_no_alt = []
btn_no_name = []
input_no_label = []
for f in files:
    rel = os.path.relpath(f, WEB).replace("\\", "/")
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        for m in re.finditer(r"<img\b[^>]*>", line):
            tag = m.group(0)
            if "alt=" not in tag:
                img_no_alt.append((rel, n, tag[:100]))
        for m in re.finditer(r"<button\b[^>]*>", line):
            tag = m.group(0)
            if not re.search(r'aria-label|aria-labelledby|title=', tag):
                btn_no_name.append((rel, n, tag[:110]))
        for m in re.finditer(r"<(input|select|textarea)\b[^>]*>", line):
            tag = m.group(0)
            if re.search(r'type="(hidden|submit|button)"', tag):
                continue
            if not re.search(r'aria-label|aria-labelledby|id=', tag):
                input_no_label.append((rel, n, tag[:110]))

print(f"== <img> without alt ({len(img_no_alt)}) ==")
for r in img_no_alt: print("  ", *r)
print(f"\n== <button> without accessible-name attrs ({len(btn_no_name)}) ==")
for r in btn_no_name: print("  ", *r)
print(f"\n== form controls without aria-label/id ({len(input_no_label)}) ==")
for r in input_no_label: print("  ", *r)

# placeholder scan
print("\n== TODO/FIXME/XXX/HACK/lorem in shipped source ==")
for f in files:
    rel = os.path.relpath(f, WEB).replace("\\", "/")
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        if re.search(r"\b(TODO|FIXME|XXX)\b|lorem ipsum", line, re.I):
            print(f"  {rel}:{n}: {line.strip()[:110]}")
print("DONE")
