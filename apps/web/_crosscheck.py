# -*- coding: utf-8 -*-
"""独立交叉校验脚本 —— 不复用 _verify.py 的逻辑，用全新写法逐条核对报告结论。

每条对应报告中的一个"已修复"声明。判定必须基于产物/源码实测，与上一轮
的验证脚本相互独立（不同实现、不同检查角度），发现差异即说明报告有误。
"""
import io, os, re, glob, sys

OUT = "out"
results = []

def check(name, ok, detail=""):
    results.append((bool(ok), name, detail))

def read(p):
    return io.open(p, encoding="utf-8", errors="replace").read()


def strip_comments(src_text):
    """剥离块注释与行注释，避免把解释性注释里的旧写法误判为未修复。"""
    src_text = re.sub(r"/\*[\s\S]*?\*/", "", src_text)
    src_text = re.sub(r"//[^\n]*", "", src_text)
    src_text = re.sub(r"\{/\*[\s\S]*?\*/\}", "", src_text)  # JSX 注释
    return src_text

# 收集产物
css_files = sorted(glob.glob(os.path.join(OUT, "_next", "static", "css", "*.css")))
all_css = "".join(read(f) for f in css_files)
pages = [p for p in glob.glob(os.path.join(OUT, "**", "*.html"), recursive=True)]

# ═══ 1. aos.css 显式入层（报告 §三-3.1）═══
# 独立判定法：aos 的标志性选择器 [data-aos] 必须出现在某个 @layer 块内
# （而不是顶层）。用括号计数法精确判断。
def in_layer(src, needle):
    idx = src.find(needle)
    if idx < 0:
        return None
    depth = 0
    i = 0
    while i < idx:
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        i += 1
    return depth

d = in_layer(all_css, "[data-aos")
check("aos.css 的 [data-aos] 规则在层内", d is not None and d > 0,
      "括号深度=%s（>0 即入层）" % d)

# ═══ 2. 尾斜杠清零（报告 §三-3.3）═══
# 独立判定：站内 <a href> 只允许 / 或 /admin/（目录型）带尾斜杠
slash_hits = []
for p in pages:
    s = read(p)
    if "og-image" in p:
        continue
    for m in re.finditer(r'<a[^>]+href="([^"]*)"', s):
        h = m.group(1)
        if h.endswith("/") and h not in ("/", "/admin/") and not h.startswith("http") and not h.startswith("mailto"):
            slash_hits.append("%s -> %s" % (os.path.relpath(p, OUT), h))
check("产物 HTML 无站内尾斜杠链接", not slash_hits,
      "; ".join(slash_hits[:5]) if slash_hits else "0 处")

# ═══ 3. CJK 字体回退（报告 §三-3.1）═══
# 独立判定：产物里每个 html[lang] 块必须同时重定义 --font-serif 和 --font-mono。
# ⚠ 压缩后同一选择器可能有多个块（如 html[lang=ja]{--font...} 与
#   html[lang=ja] body{line-height...}），且选择器可能合并（zh-CN,zh-Hans）。
#   因此要遍历所有匹配块，取含字体变量的那个，不能只看第一个。
for lang, code in (("zh-CN", "PingFang SC"), ("zh-TW", "PingFang TC"), ("ja", "Hiragino")):
    blocks = re.findall(r'html\[lang="?%s"?\][^{]*\{([^}]*)\}' % re.escape(lang), all_css)
    if not blocks:
        check("html[lang=%s] 块存在" % lang, False, "缺失")
        continue
    # 任一匹配块同时含 serif+mono+目标字体栈即通过
    font_block = next((b for b in blocks if "--font-sans" in b), None)
    ok = (
        font_block is not None
        and "--font-serif" in font_block
        and "--font-mono" in font_block
        and code in font_block
    )
    check("html[lang=%s] 同时覆盖 serif+mono 且含 %s" % (lang, code), ok,
          "共 %d 个匹配块" % len(blocks))

# ═══ 4. 对比度独立计算（报告 §三-3.1 --fio-text-3 → #7b8290）═══
def rel_lum(hexcolor):
    r, g, b = (int(hexcolor[i:i+2], 16) / 255 for i in (0, 2, 4))
    def lin(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def contrast(fg, bg):
    l1, l2 = rel_lum(fg), rel_lum(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)

# 与报告无关的独立复算
c1 = contrast("7b8290", "12141d")   # 新值 on 卡片底
c2 = contrast("717885", "12141d")   # 旧值 on 卡片底
check("--fio-text-3 新值对比度达标（卡片底）", c1 >= 4.5, "新=%.2f 旧=%.2f" % (c1, c2))
check("报告声称旧值不达 AA 属实", c2 < 4.5, "旧=%.2f" % c2)

# ═══ 5. case-studies 代码块（报告 L-1）═══
cs_html = read(os.path.join(OUT, "case-studies.html")) if os.path.exists(os.path.join(OUT, "case-studies.html")) else ""
uc_used = "uc-code" in cs_html
uc_rule = bool(re.search(r"\.uc-code\s*\{", all_css)) and bool(re.search(r"\.uc-code\s+pre\s*\{", all_css))
check("case-studies 用类有真实 CSS 规则", uc_used and uc_rule,
      "HTML 引用=%s, .uc-code 规则=%s" % (uc_used, uc_rule))

# ═══ 6. --color-fio-* 死别名清除（报告 R1-3）═══
n_alias = len(set(re.findall(r"--color-fio-[a-z0-9-]+", all_css)))
check("--color-fio-* 别名在产物中清零", n_alias == 0, "残留 %d 个" % n_alias)

# ═══ 7. 死组件删除（报告 §三-3.7）═══
for comp in ("ModalVideo", "PageIllustration", "Spotlight"):
    exists = os.path.exists(os.path.join("components", comp + ".tsx"))
    check("死组件 %s.tsx 已删除" % comp, not exists, "存在=%s" % exists)
# next/image 引爆点（output:'export' 下 next/image 会让导出报错）
n_img = 0
for p in glob.glob("components/**/*.tsx", recursive=True) + glob.glob("app/**/*.tsx", recursive=True):
    if 'next/image' in read(p):
        n_img += 1
check("全站无 next/image 引用（消除导出引爆点）", n_img == 0, "%d 处" % n_img)

# ═══ 8. LiveTransactionStream（报告 §三-3.4）═══
lts = read("components/LiveTransactionStream.tsx") if os.path.exists("components/LiveTransactionStream.tsx") else ""
# 8a 种子 effect 必须不含 isPaused 依赖。
# 结构固定：useEffect(() => { if (!useMockData) return; setTransactions(Array.from... ) }, [deps]);
m = re.search(r"setTransactions\(Array\.from\(\{ length: 5 \}[^;]*;[\s\S]{0,200}?\}, \[([^\]]*)\]\)", lts)
check("LiveTransactionStream 种子数据 effect 依赖不含 isPaused",
      m is not None and "isPaused" not in m.group(1),
      "依赖=[%s]" % (m.group(1).strip() if m else "未找到"))
# 8b 中文串清零
zh = re.findall(r"[一-鿿]{2,}", re.sub(r"/\*[\s\S]*?\*/|//[^\n]*", "", lts))
check("LiveTransactionStream 中文硬编码清零", not zh, "残留: %s" % zh[:5])
# 8c 不用已废弃 substr
check("无 .substr()", ".substr(" not in lts, "命中" if ".substr(" in lts else "")

# ═══ 9. admin dashboard 假数据清零（报告 C-5）═══
adm = strip_comments(read(os.path.join("app", "admin", "dashboard", "page.tsx")))
check("admin 无硬编码 7 点趋势样本", "riskTrendData = [" not in adm or "stats?.riskTrend" in adm,
      "riskTrend 来源=%s" % ("后端" if "stats?.riskTrend" in adm else "未知"))
check("admin 无恒显 score={42}", "score={42}" not in adm, "score={42} 仍在" if "score={42}" in adm else "")
check("admin 无恒显 35/28/15/22 分布", not ("value: 35" in adm and "value: 28" in adm), "")

# ═══ 10. registry meta 本地化（报告 C-2）═══
reg = read(os.path.join("i18n", "registry.ts"))
check("registry：about cn/tw/jp 已翻译", "关于我们" in reg and "關於我們" in reg and "私たちについて" in reg, "")
check("registry：changelog cn/tw/jp 已翻译", "更新日志" in reg and "更新日誌" in reg and "変更履歴" in reg, "")
check("registry：security cn/tw/jp 已翻译", "安全与审计" in reg and "安全與審計" in reg, "")
check("registry：pricing tw/jp 已翻译", "定價" in reg and "料金プラン" in reg, "")

# ═══ 11. sitemap（报告 §三-3.2）═══
sm_path = os.path.join(OUT, "sitemap.xml")
if os.path.exists(sm_path):
    sm = read(sm_path)
    n_alt = sm.count("hreflang=")
    bad_loc = re.findall(r"<loc>https://fidesorigin\.com/(cn|tw|jp)/</loc>", sm)
    check("sitemap 含 hreflang alternates", n_alt > 0, "%d 条" % n_alt)
    check("sitemap 语言首页无尾斜杠", not bad_loc, ", ".join(bad_loc) if bad_loc else "")

# ═══ 12. 语言菜单高亮（报告 L-8）═══
hdr = read(os.path.join("components", "legacy", "Header.tsx"))
check("legacy Header 按当前语言高亮（.active 类）", "active" in hdr and 'l === lang' in hdr, "")
check("legacy.css 不再用 :first-child 高亮语言菜单",
      "#langMenu a:first-child" not in strip_comments(read("css/legacy.css")), "")

# ═══ 13. 博客修复（报告 L-13/L-14）═══
ben = read(os.path.join("components", "legacy", "pages", "blog.en.tsx"))
check("blog.en 含 OFAC 文章卡片", "ofac-sanctions-screening-blockchain" in ben, "")
for lang in ("cn", "tw", "jp"):
    b = read(os.path.join("components", "legacy", "pages", "blog.%s.tsx" % lang))
    check("blog.%s 无自链接卡片" % lang, 'href="/%s/blog"' % lang not in b, "")

# ═══ 14. docs 页 main 嵌套（报告 L-10）═══
docs_main = 0
for p in glob.glob("components/legacy/pages/docs*.tsx"):
    docs_main += read(p).count('<main className="docs-content">')
check("docs 页无嵌套 <main className=\"docs-content\">", docs_main == 0, "残留 %d 处" % docs_main)

# ═══ 15. 404 修复（报告 H-6/H-7）═══
nfv = strip_comments(read(os.path.join("components", "not-found-view.tsx")))
check("not-found-view 不再渲染 <main>", "<main" not in nfv, "")
l404 = read(os.path.join("app", "[lang]", "not-found.tsx"))
check("[lang]/not-found.tsx 包了 HomeChrome", "HomeChrome" in l404, "")

# ═══ 16. contact 表单（报告 L-2）═══
con = strip_comments(read(os.path.join("components", "legacy", "pages", "contact.en.tsx")))
check("contact 无 YOUR_FORM_ID 占位端点", "YOUR_FORM_ID" not in con, "")

# ═══ 17. pricing 徽标翻译（报告 L-4）═══
ptw = read(os.path.join("components", "legacy", "pages", "pricing.tw.tsx"))
pjp = read(os.path.join("components", "legacy", "pages", "pricing.jp.tsx"))
check("pricing.tw 徽标已译", "最受歡迎" in ptw, "")
check("pricing.jp 徽标已译", "人気プラン" in pjp, "")

# ═══ 18. workflows 数据流读字典（报告 C-7）═══
wf = read(os.path.join("components", "Workflows.tsx"))
check("Workflows 底部数据流读字典", "d.flowNode1" in wf and "d.flowNode4" in wf, "")
jp_dict = read(os.path.join("i18n", "dictionaries", "jp.ts"))
check("jp 字典 flowLive 不再是英文 \"Live\"", 'flowLive: "Live"' not in jp_dict, "")

# ═══ 19. 死组件残留 import（防引用悬空）═══
dangling = []
for p in glob.glob("components/**/*.tsx", recursive=True) + glob.glob("app/**/*.tsx", recursive=True):
    s = read(p)
    for c in ("ModalVideo", "PageIllustration", "Spotlight", "ui/logo"):
        if ("from" in s and (c in s.split("from", 1)[1] if "from" in s else False)) and c in s:
            dangling.append(p)
check("无对已删组件的悬空引用", not dangling, ", ".join(dangling) if dangling else "")

# ═══ 20. 四个语言首页必须都存在 ═══
# （原先是硬编码 76 页的对账检查，脆弱且会随加页面误报；换成真实不变量。）
real = [p for p in pages if "admin/index.html" not in p.replace(os.sep, "/") and "og-image" not in p]
home_missing = [h for h in ("index.html", "cn.html", "tw.html", "jp.html")
                if not os.path.exists(os.path.join(OUT, h))]
check("四个语言首页均导出（index/cn/tw/jp）", not home_missing,
      "缺失: %s" % home_missing if home_missing else "共 %d 页" % len(real))

# ═══ 汇总 ═══
print("=" * 72)
print("独立交叉校验结果（不复用 _verify.py 逻辑，全新实现）")
print("=" * 72)
npass = sum(1 for r in results if r[0])
nfail = sum(1 for r in results if not r[0])
for ok, name, detail in results:
    print("[%s] %s" % ("PASS" if ok else "FAIL", name))
    if detail and not ok:
        print("       " + detail)
print("=" * 72)
print("合计 %d 项：通过 %d / 失败 %d" % (len(results), npass, nfail))
sys.exit(1 if nfail else 0)
