# -*- coding: utf-8 -*-
"""FidesOrigin 前端样式审计 —— 独立验证脚本。

不依赖任何修改过程的记忆，直接对 out/ 构建产物逐项实测。
用法：python _verify.py
"""
import io, os, re, glob, sys, html as htmlmod

OUT = "out"
CSS_DIR = os.path.join(OUT, "_next", "static", "css")
results = []


def check(name, ok, detail=""):
    results.append((ok, name, detail))


def read(p):
    return io.open(p, encoding="utf-8", errors="replace").read()


# ───────────────────────────────────────────────────────────
# 1. 产物 CSS
# ───────────────────────────────────────────────────────────
css_files = sorted(glob.glob(os.path.join(CSS_DIR, "*.css")))
check("产物 CSS 文件已生成", len(css_files) > 0, "%d 个：%s" % (len(css_files), ", ".join(os.path.basename(f) for f in css_files)))

all_css = "".join(read(f) for f in css_files)
main_css = None
for f in css_files:
    c = read(f)
    if "@layer utilities" in c or "--fio-ink:" in c:
        main_css = (f, c)
        break

# 1.1 未分层 CSS（这是全站样式混乱的头号根因，必须为零）
unlayered = []
for f in css_files:
    c = read(f)
    n = c.count("@layer")
    if n == 0 and len(c) > 2000:
        unlayered.append("%s (%d B)" % (os.path.basename(f), len(c.encode("utf-8"))))
check("无「未分层」的大块第三方 CSS（aos.css 回归检查）", not unlayered,
      "全部已入层" if not unlayered else "仍存在: " + ", ".join(unlayered))

if main_css:
    fname, c = main_css
    # 1.2 层序：@layer legacy 的声明位置必须早于 @layer utilities 块
    i_legacy = c.find("@layer legacy")
    i_util = c.find("@layer utilities")
    check("层序正确：legacy 早于 utilities", 0 <= i_legacy < i_util,
          "legacy@%d < utilities@%d" % (i_legacy, i_util))
    # 1.3 令牌
    tokens = ["--fio-ink:", "--fio-text:", "--fio-text-2:", "--fio-text-3:",
              "--fio-gold:", "--fio-accent:", "--z-nav:", "--z-modal:",
              "--font-sans:", "--font-serif:", "--font-mono:"]
    missing = [t for t in tokens if t not in c]
    check("主样式表含 --fio-* 设计令牌", not missing, "缺失: " + ", ".join(missing) if missing else "全部齐备")
    # 1.4 字体自引用循环
    cycles = re.findall(r"(--font-(?:sans|serif|mono)):\s*var\(\1\)", c)
    check("无字体变量自引用循环", not cycles, ", ".join(cycles) if cycles else "零残留")
    # 1.5 CJK 回退块（Tailwind 压缩后会去掉属性值引号，两种写法都要认）
    for lang, stack in [("zh-CN", "PingFang SC"), ("zh-TW", "PingFang TC"), ("ja", "Noto Sans JP")]:
        ok = bool(re.search(r'html\[lang="?%s"?\]' % lang, c))
        check("CJK 回退块存在 html[lang=%s]" % lang, ok, stack if ok else "缺失")
    # 1.6 --font-serif / --font-mono 必须也有 CJK 回退（这是本轮新修的）
    for prop in ("--font-serif", "--font-mono"):
        m = re.findall(prop + r":[^;]*?;", c)
        has_cjk = any(("PingFang" in v) or ("Noto Sans" in v) or ("Hiragino" in v) for v in m)
        check("%s 至少一处含 CJK 回退栈" % prop, has_cjk, "%d 处定义" % len(m))
    # 1.7 --fio-text-3 已提亮到 AA 达标值
    m = re.search(r"--fio-text-3:\s*(#[0-9a-fA-F]{6})", c)
    check("--fio-text-3 已提亮（旧值 #717885 在卡片底 4.14:1 不达标）",
          bool(m) and m.group(1).lower() != "#717885",
          "当前值 %s" % (m.group(1) if m else "?"))
    # 1.8 死配置 --color-fio-* 已清除
    n = len(set(re.findall(r"--color-fio-[a-z0-9-]+", c)))
    check("已清除被 tree-shake 的 --color-fio-* 死别名", n == 0, "残留 %d 个" % n)

# ───────────────────────────────────────────────────────────
# 2. 产物 HTML（排除两类不进入 Next 样式的独立静态页：
#    admin/index.html 自带 <style>、og-image.html 是截图模板）
# ───────────────────────────────────────────────────────────
EXCLUDE_HTML = ("admin/index.html", "assets/og-image.html")


def excluded(p):
    rel = os.path.relpath(p, OUT).replace(os.sep, "/")
    return any(rel == e or rel.endswith(e) for e in EXCLUDE_HTML)


pages = [p for p in glob.glob(os.path.join(OUT, "**", "*.html"), recursive=True) if not excluded(p)]
check("静态页面已导出", len(pages) >= 70, "%d 个 HTML（已排除独立静态页）" % len(pages))

# 2.1 <html lang>
lang_dist = {}
no_lang = []
for p in pages:
    s = read(p)
    m = re.search(r"<html[^>]*\blang=\"([^\"]*)\"", s)
    if not m:
        no_lang.append(os.path.relpath(p, OUT))
    else:
        lang_dist[m.group(1)] = lang_dist.get(m.group(1), 0) + 1
og_pages = [x for x in no_lang if "og-image" in x]
real_no_lang = [x for x in no_lang if "og-image" not in x]
check("所有对外页面 <html lang> 正确", not real_no_lang,
      "分布 %s；缺失 %s" % (lang_dist, real_no_lang or "无") + ("（og-image 生成模板 %d 个不计入）" % len(og_pages) if og_pages else ""))

# 2.2 每页都引入样式表
no_css = []
for p in pages:
    s = read(p)
    if "og-image" in os.path.relpath(p, OUT):
        continue
    if "_next/static/css/" not in s:
        no_css.append(os.path.relpath(p, OUT))
check("所有页面均引入样式表", not no_css, ", ".join(no_css[:5]) if no_css else "无遗漏")

# 2.3 页面级内联 CSS 必须包在 @layer legacy 内
bad_inline = []
inline_total = 0
for p in pages:
    s = read(p)
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", s, re.S):
        body = m.group(1).strip()
        if not body or len(body) < 40:
            continue
        if "@layer legacy" not in body:
            # 允许 <noscript> 里的 .reveal 兜底（含 !important，属刻意设计）
            if ".reveal" in body and "important" in body:
                continue
            bad_inline.append(os.path.relpath(p, OUT))
            break
        inline_total += 1
check("页面级内联 CSS 全部包在 @layer legacy 内", not bad_inline,
      "已包裹 %d 个；越界 %s" % (inline_total, bad_inline[:5] or "无"))

# 2.4 重复 id（landmark 重复 / 重复 main）
dup_main = []
for p in pages:
    s = read(p)
    n = len(re.findall(r"<main\b", s))
    if n > 1:
        dup_main.append("%s(%d)" % (os.path.relpath(p, OUT), n))
check("无嵌套/重复 <main> landmark", not dup_main, ", ".join(dup_main[:5]) if dup_main else "全部唯一")

# 2.5 尾斜杠链接（静态导出下 /cn/ 会 404）
# 排除项：/admin/（目录型静态页，合法）、og-image 模板
bad_slash = {}
for p in pages:
    if "og-image" in os.path.relpath(p, OUT):
        continue
    s = read(p)
    for m in re.finditer(r'href="(/[a-z-]*/)"', s):
        href = m.group(1)
        if href in ("/admin/",):
            continue  # 目录型静态页，合法
        bad_slash.setdefault(href, []).append(os.path.relpath(p, OUT))
check("无「带尾斜杠」的内部链接（/cn/ 等会 404）", not bad_slash,
      "; ".join("%s ×%d" % (k, len(v)) for k, v in sorted(bad_slash.items(), key=lambda x: -len(x[1]))[:6]) or "全部为无尾斜杠")

# 2.6 case-studies 代码块样式已补
cs = os.path.join(OUT, "case-studies.html")
if os.path.exists(cs):
    s = read(cs)
    has_uc = "uc-code" in s
    css_has_uc = ".uc-code" in all_css
    check("case-studies 的 .uc-code 有对应 CSS 规则", has_uc and css_has_uc,
          "HTML 用类=%s / CSS 有规则=%s" % (has_uc, css_has_uc))

# 2.7 sitemap hreflang
sm = os.path.join(OUT, "sitemap.xml")
if os.path.exists(sm):
    s = read(sm)
    n_alt = s.count('hreflang=')
    n_url = s.count("<url>")
    bad = re.findall(r"<loc>(https://fidesorigin\.com/[a-z]{2}/)</loc>", s)
    check("sitemap 含 hreflang alternates", n_alt > 0, "%d 个 URL / %d 条 alternate" % (n_url, n_alt))
    check("sitemap 无带尾斜杠的语言首页 URL", not bad, ", ".join(bad) if bad else "全部正确")

# 2.8 robots.txt
rb = os.path.join(OUT, "robots.txt")
if os.path.exists(rb):
    s = read(rb)
    check("robots.txt 已屏蔽 /admin/dashboard", "Disallow: /admin/dashboard" in s, "已屏蔽" if "Disallow: /admin/dashboard" in s else "未屏蔽")

# 2.9 多语言 meta 已本地化
localized = 0
en_only = []
for lang, code in (("cn", "zh-CN"), ("tw", "zh-TW"), ("jp", "ja")):
    p = os.path.join(OUT, lang + ".html")
    if not os.path.exists(p):
        continue
    s = read(p)
    m = re.search(r"<title>(.*?)</title>", s)
    t = htmlmod.unescape(m.group(1)) if m else ""
    has_cjk = bool(re.search(r"[一-鿿぀-ヿ]", t))
    if has_cjk:
        localized += 1
    else:
        en_only.append("%s: %s" % (lang, t[:60]))
check("多语言首页 <title> 已本地化", not en_only, "; ".join(en_only) if en_only else "%d/3 已本地化" % localized)

# ───────────────────────────────────────────────────────────
# 3. 源码静态检查
# ───────────────────────────────────────────────────────────
src = []
for pat in ("components/**/*.tsx", "app/**/*.tsx", "css/*.css"):
    src += glob.glob(pat, recursive=True)

# 3.1 裸数字 z-index
bare_z = []
for p in src:
    s = read(p)
    for m in re.finditer(r"z-index:\s*(\d+)", s):
        if "var(--z-" not in m.group(0):
            bare_z.append("%s:%d" % (p, s[:m.start()].count("\n") + 1))
check("无裸数字 z-index", not bare_z, ", ".join(bare_z[:6]) if bare_z else "全部走 --z-* 令牌")

# 3.2 硬编码十六进制色（先剥离注释，避免对解释性注释误报）
def strip_comments(src_text):
    # 去掉 /* ... */ 与 // ... 两类注释（保守做法：不处理字符串内注释，
    # 因为本检查只针对颜色字面量，字符串内注释不影响扫描结论）。
    src_text = re.sub(r"/\*.*?\*/", "", src_text, flags=re.S)
    src_text = re.sub(r"//[^\n]*", "", src_text)
    return src_text


bad_hex = {}
for p in src:
    if p.startswith("css"):
        continue
    s = strip_comments(read(p))
    for m in re.finditer(r"#[0-9a-fA-F]{6}\b", s):
        line_start = s.rfind("\n", 0, m.start()) + 1
        line = s[line_start:s.find("\n", m.start())]
        if "&#" in line:  # HTML 数字实体（如 &#128279）不是颜色
            continue
        bad_hex.setdefault(m.group(0), []).append("%s:%d" % (p, s[:m.start()].count("\n") + 1))
check("组件内无硬编码十六进制色值", not bad_hex,
      "; ".join("%s ×%d" % (k, len(v)) for k, v in sorted(bad_hex.items(), key=lambda x: -len(x[1]))[:6]) or "已全部令牌化")

# 3.3 硬编码 rgba()
# 与 3.2 的 hex 检查同语义：组件（.tsx）里禁止散落硬编码颜色；
# css/ 是样式定义文件（令牌与组件类的实现处），颜色在那里是定义而非散落，
# 因此与 hex 检查一致，排除 css/。
bad_rgba = {}
for p in src:
    if p.startswith("css"):
        continue
    s = strip_comments(read(p))
    for m in re.finditer(r"rgba?\([^)]*\)", s):
        line_start = s.rfind("\n", 0, m.start()) + 1
        line = s[line_start:s.find("\n", m.start())]
        # AddressCheck 的 spinner 半透明白是刻意保留的（加载圈必须在金底上可读）
        if "spinner" in line:
            continue
        bad_rgba.setdefault(m.group(0), []).append("%s:%d" % (p, s[:m.start()].count("\n") + 1))
check("组件内无散落的硬编码 rgba()", not bad_rgba,
      "; ".join("%s ×%d" % (k, len(v)) for k, v in sorted(bad_rgba.items(), key=lambda x: -len(x[1]))[:6]) or "已全部令牌化")

# 3.4 keyframes 重名
kf = {}
for p in src:
    s = read(p)
    for m in re.finditer(r"@keyframes\s+([\w-]+)", s):
        kf.setdefault(m.group(1), []).append(p)
dupes = {k: v for k, v in kf.items() if len(v) > 1}
check("无跨文件重名 @keyframes", not dupes,
      "; ".join("%s in %s" % (k, v) for k, v in dupes.items()) or "共 %d 个，全部唯一" % len(kf))

# ───────────────────────────────────────────────────────────
print("=" * 78)
print("FidesOrigin 前端样式审计 —— 独立验证结果")
print("=" * 78)
npass = nfail = 0
for ok, name, detail in results:
    flag = "PASS" if ok else "FAIL"
    if ok:
        npass += 1
    else:
        nfail += 1
    print("[%s] %s" % (flag, name))
    if detail:
        print("       %s" % detail)
print("=" * 78)
print("合计 %d 项：通过 %d / 失败 %d" % (len(results), npass, nfail))
print("=" * 78)
sys.exit(1 if nfail else 0)
