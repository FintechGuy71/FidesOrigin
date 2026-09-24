# -*- coding: utf-8 -*-
# Heuristic: simplified chars in TW dict, traditional chars in CN dict, JP strings w/o kana
import re, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SIMP = set("们这个为于与台风规链数资产线块现钱银证账发审合约应诉让权责见买卖读书车错门问闻开关")
TRAD = set("們這個為於與風規鏈數資產線塊現錢銀證賬發審合約應訴讓權責見買賣讀書車錯門問聞開關")

for loc in ("cn", "tw", "jp"):
    src = open(f"i18n/dictionaries/{loc}.ts", encoding="utf-8").read()
    vals = re.findall(r'"((?:[^"\\]|\\.)*)"', src)
    for v in vals:
        if len(v) < 2:
            continue
        s = sum(1 for c in v if c in SIMP)
        t = sum(1 for c in v if c in TRAD)
        if loc == "tw" and s >= 3 and s > t:
            print("TW-simplified?", v[:70])
        if loc == "cn" and t >= 3 and t > s:
            print("CN-traditional?", v[:70])
        if loc == "jp" and (s + t) >= 6 and not re.search(r"[\u3040-\u30ff]", v):
            print("JP-no-kana?", v[:70])
print("SCAN DONE")
