# -*- coding: utf-8 -*-
# Round-2 blind audit: language mixing inside per-locale page components.
# .en.tsx should not contain CJK user-visible text; .cn/.tw/.jp should not
# contain long English sentences (heuristic, reported for manual review).
import re, io, sys, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
WEB = os.path.dirname(os.path.abspath(__file__))

files = sorted(glob.glob(os.path.join(WEB, "components/legacy/pages/*.tsx")))
CJK = re.compile(r"[\u4e00-\u9fff\u3040-\u30ff]")

def strip_code(line):
    # remove comments
    line = re.sub(r"//.*$", "", line)
    return line

print("== CJK text inside *.en.tsx (user-visible candidates) ==")
for f in files:
    if not f.endswith(".en.tsx"):
        continue
    rel = os.path.relpath(f, WEB).replace("\\", "/")
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        l = strip_code(line)
        if CJK.search(l):
            # skip PAGE_CSS/style blocks heuristically: css rarely has CJK anyway
            print(f"  {rel}:{n}: {l.strip()[:120]}")

print("\n== long ASCII-only English-looking strings in cn/tw/jp pages (len>=40, in JSX text or attrs) ==")
ENG = re.compile(r">([^<>{]*[A-Za-z][^<>{}]*)<")
for f in files:
    m = re.search(r"\.(cn|tw|jp)\.tsx$", f)
    if not m:
        continue
    rel = os.path.relpath(f, WEB).replace("\\", "/")
    in_css = False
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        if "PAGE_CSS = `" in line or "_CSS = `" in line:
            in_css = True
        if in_css:
            if line.strip().startswith("`") or "`" in line and "const" not in line:
                # crude end detection: backtick line
                if re.search(r"`\s*;?\s*$", line):
                    in_css = False
            continue
        l = strip_code(line)
        for mm in ENG.finditer(l):
            txt = mm.group(1).strip()
            if len(txt) >= 40 and not CJK.search(txt) and re.search(r"[a-z] [a-z]", txt):
                print(f"  {rel}:{n}: {txt[:110]}")
print("DONE")
