# -*- coding: utf-8 -*-
# Round-2 blind audit: 4-locale dictionary key-set diff + English residue detection
import re, io, sys, json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

FILES = {"en": "i18n/dictionaries/en.ts", "cn": "i18n/dictionaries/cn.ts",
         "tw": "i18n/dictionaries/tw.ts", "jp": "i18n/dictionaries/jp.ts"}

def parse(path):
    src = open(path, encoding="utf-8").read()
    # strip comments
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"//[^\n]*", "", src)
    keys = {}   # path -> raw value
    stack = []
    i, n = 0, len(src)
    # token scan: identifiers/strings followed by ':' => key; string/number => value
    token_re = re.compile(r"""
        (?P<str>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)
      | (?P<key>[A-Za-z_$][\w$]*)
      | (?P<punct>[{}:,\[\]])
      | (?P<num>-?\d[\d.]*)
      | (?P<ws>\s+)
    """, re.X)
    pending_key = None
    for m in token_re.finditer(src):
        kind = m.lastgroup
        tok = m.group()
        if kind == "ws":
            continue
        if kind == "key":
            pending_key = tok
        elif kind == "punct":
            if tok == ":" and pending_key is not None:
                stack.append(pending_key)  # key pushed; value or { follows
                pending_key = None
            elif tok == "{":
                pass  # nested object; key already on stack
            elif tok == "}":
                if stack: stack.pop()
            elif tok == ",":
                # if top of stack is a value-key (leaf), pop it
                if stack and stack[-1] in ("__leaf__",):
                    stack.pop()
            else:
                pass
        elif kind in ("str", "num"):
            if stack:
                path_key = ".".join(stack)
                keys[path_key] = tok if kind == "str" else tok
                # replace top key marker with leaf so ',' pops it
                stack[-1] = "__leaf__" if False else stack[-1]
                # mark leaf: we emulate by pushing a sentinel handled at ','
                stack.append("__leaf__")
    # cleanup: keys contain '__leaf__' artifacts? no—leaf appended as separate level
    return {k.replace(".__leaf__", ""): v for k, v in keys.items()}

# The simple scanner above is fragile; use a robust recursive parser instead.
def parse2(path):
    src = open(path, encoding="utf-8").read()
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"//[^\n]*", "", src)
    out = {}
    token_re = re.compile(r"""
        (?P<str>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)
      | (?P<key>[A-Za-z_$][\w$]*)
      | (?P<brace>[{}:\[\]])
      | (?P<comma>,)
      | (?P<num>-?\d[\d.]*|true|false|null)
      | (?P<ws>\s+)
    """, re.X)
    toks = [(m.lastgroup, m.group()) for m in token_re.finditer(src) if m.lastgroup != "ws"]
    pos = 0
    def parse_obj(prefix):
        nonlocal pos
        assert toks[pos][1] == "{"
        pos += 1
        while pos < len(toks) and toks[pos][1] != "}":
            if toks[pos][0] == "comma":
                pos += 1
                continue
            kkind, key = toks[pos]
            if kkind == "str":
                key = key[1:-1]
            pos += 1
            if toks[pos][1] != ":":
                print("DEBUG context:", toks[max(0,pos-8):pos+4])
                raise AssertionError(f"expected : after {key} at {pos} got {toks[pos]}")
            pos += 1
            vkind, val = toks[pos]
            if val == "{":
                parse_obj(prefix + key + ".")
            elif val == "[":
                pos += 1
                idx = 0
                items = []
                while pos < len(toks) and toks[pos][1] != "]":
                    if toks[pos][1] == "{":
                        parse_obj(f"{prefix}{key}[{idx}].")
                        idx += 1
                    elif toks[pos][0] in ("str", "num"):
                        items.append(toks[pos][1])
                        pos += 1
                    else:
                        pos += 1
                    if pos < len(toks) and toks[pos][0] == "comma":
                        pos += 1
                pos += 1  # consume ]
                if items:
                    out[prefix + key + "[]"] = ("arr", "|".join(items))
            else:
                out[prefix + key] = (vkind, val)
                pos += 1
            if pos < len(toks) and toks[pos][0] == "comma":
                pos += 1
        pos += 1  # consume }
    # find first '{' after the top-level `const <name> =`
    const_i = next(i for i, t in enumerate(toks) if t == ("key", "const"))
    start = next(i for i in range(const_i, len(toks)) if toks[i][1] == "{")
    pos = start
    parse_obj("")
    return out

dicts = {loc: parse2(p) for loc, p in FILES.items()}
en_keys = set(dicts["en"])
print("== key counts ==", {l: len(d) for l, d in dicts.items()})
for loc in ("cn", "tw", "jp"):
    ks = set(dicts[loc])
    missing = en_keys - ks
    extra = ks - en_keys
    print(f"\n== {loc}: missing {len(missing)}, extra {len(extra)} ==")
    for k in sorted(missing): print("  MISSING", k)
    for k in sorted(extra): print("  EXTRA", k)

# English residue: cn/tw/jp values identical to en OR pure-ASCII long strings
def stripq(v):
    return v[1:-1] if v and v[0] in "\"'`" else v
print("\n== possible English residue (value == en, len>=12, non-allowlist) ==")
ALLOW = re.compile(r"^(FidesOrigin|Sepolia|API|SDK|ENS|MetaMask|WalletConnect|©|https?://|0x|ERC|DeFi|KYC|AML|OFAC|MiCA|FATF|RWA|VASP|Travel Rule|Guard|Blog|Docs|EN|CN|TW|JP)")
for loc in ("cn", "tw", "jp"):
    for k in sorted(en_keys & set(dicts[loc])):
        ev = stripq(dicts["en"][k][1]); lv = stripq(dicts[loc][k][1])
        if ev == lv and len(ev) >= 12 and re.search(r"[A-Za-z]{4,}", ev):
            if ALLOW.match(ev):
                continue
            print(f"  {loc} {k}: {ev[:90]!r}")
print("\nDONE")
