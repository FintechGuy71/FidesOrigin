# -*- coding: utf-8 -*-
# Round-2 blind audit: CSS class cross-check (used vs defined, both directions)
import re, io, sys, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
WEB = os.path.dirname(os.path.abspath(__file__))

# defined classes from css files
defined = {}  # class -> file
for css in glob.glob(os.path.join(WEB, "css/*.css")):
    src = open(css, encoding="utf-8").read()
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    for m in re.finditer(r"\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)", src):
        defined.setdefault(m.group(1), os.path.basename(css))

# also JS-injected classes? collect classes used in tsx + public html/js
used = {}  # class -> set(files)
def add_file(f, exts):
    src = open(f, encoding="utf-8").read()
    # className="..." / class="..." / classList.add / querySelector('.x')
    for m in re.finditer(r'class(?:Name)?\s*=\s*"([^"]+)"', src):
        for c in m.group(1).split():
            used.setdefault(c, set()).add(os.path.basename(f))
    for m in re.finditer(r"className\s*=\s*\{`([^`]+)`\}", src):
        # template literal classnames: take static words
        for c in re.findall(r'(?<![\w${])(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)', m.group(1)):
            used.setdefault(c, set()).add(os.path.basename(f))
    for m in re.finditer(r'classList\.(?:add|toggle|remove)\(\s*"([^"]+)"', src):
        for c in m.group(1).split(","):
            used.setdefault(c.strip().strip("'\""), set()).add(os.path.basename(f))
    for m in re.finditer(r'querySelector(?:All)?\(\s*[\'"]\.([-_a-zA-Z0-9]+)', src):
        used.setdefault(m.group(1), set()).add(os.path.basename(f))

files = glob.glob(os.path.join(WEB, "components/**/*.tsx"), recursive=True) \
      + glob.glob(os.path.join(WEB, "app/**/*.tsx"), recursive=True) \
      + glob.glob(os.path.join(WEB, "public/**/*.html"), recursive=True) \
      + glob.glob(os.path.join(WEB, "public/**/*.js"), recursive=True)
for f in files:
    add_file(f, None)

# classes defined in embedded styles:
#  - PAGE_CSS = `...` template literals (legacy pages)
#  - <style>...</style> blocks (html)
for f in files:
    src = open(f, encoding="utf-8").read()
    for m in re.finditer(r"PAGE_CSS\s*=\s*`([^`]*)`", src, re.S):
        for c in re.finditer(r"\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)", m.group(1)):
            defined.setdefault(c.group(1), os.path.basename(f) + " PAGE_CSS")
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", src, re.S):
        for c in re.finditer(r"\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)", m.group(1)):
            defined.setdefault(c.group(1), os.path.basename(f) + " <style>")

# filter out tailwind-ish utilities and CSS vars etc.
UTILITY = re.compile(r"^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|grow|shrink|items-|justify-|content-|self-|text-|bg-|border|rounded|shadow|p[trblxy]?-?|m[trblxy]?-?|w-|h-|min-|max-|gap-|space-|font-|leading-|tracking-|opacity-|z-|top-|left-|right-|bottom-|inset-|overflow-|object-|transition|duration-|ease-|hover:|focus:|sm:|md:|lg:|xl:|dark:|group-|peer-|aria-|data-|aspect-|col-|row-|order-|select-|cursor-|pointer-|whitespace-|break-|truncate|uppercase|lowercase|capitalize|italic|underline|antialiased|sr-only|not-sr-only|container|mx-auto|my-auto|list-|placeholder-|ring-|outline-|divide-|from-|via-|to-|gradient|backdrop-|blur|brightness|contrast|saturate|drop-shadow|fill-|stroke-|strokeWidth|transform|scale-|rotate-|translate-|animate-|scroll-|snap-|touch-|appearance-|align-|float-|clear-|static|visible|invisible|collapse)")

def is_utility(c):
    return bool(UTILITY.match(c)) or c.startswith(("var(", "--"))

missing = {c: fs for c, fs in used.items() if c not in defined and not is_utility(c)}
dead = {c: f for c, f in defined.items() if c not in used}

print(f"defined: {len(defined)}, used: {len(used)}")
print(f"\n== used but NOT defined in css/ ({len(missing)}) ==")
for c, fs in sorted(missing.items()):
    print(f"  {c}  <- {sorted(fs)[:4]}")
print(f"\n== defined but never used ({len(dead)}) ==")
for c, f in sorted(dead.items()):
    print(f"  {c}  ({f})")
