# -*- coding: utf-8 -*-
"""FidesOrigin 全量 DOM 审计 —— 95 页逐项排查小错误与样式冲突。"""
import io, os, re, glob, sys, html as htmlmod
from collections import defaultdict

OUT = "out"
issues = []

def report(sev, page, msg):
    issues.append((sev, page, msg))

def read(p):
    return io.open(p, encoding="utf-8", errors="replace").read()

pages = sorted(glob.glob(os.path.join(OUT, "**", "*.html"), recursive=True))
EXCLUDE = ("admin/index.html", "assets/og-image.html")
pages = [p for p in pages if not any(p.replace(os.sep, "/").endswith(e) for e in EXCLUDE)]

css_files = sorted(glob.glob(os.path.join(OUT, "_next", "static", "css", "*.css")))
all_css = "".join(read(f) for f in css_files)

# 收集产物中定义过的 class（用于死类检测：页面 class 无 CSS 规则）
defined_classes = set(re.findall(r"\.([a-zA-Z][\w-]*)", all_css))

for p in pages:
    rel = os.path.relpath(p, OUT).replace(os.sep, "/")
    s = read(p)
    body = s[s.find("<body"):]

    # 1. 中英混排检查：cn/tw 页面出现大段英文段落（未翻译漏网）
    if rel.startswith(("cn", "tw")):
        # 找 <p> 内纯英文长句（>60 字符且不含 CJK）
        for m in re.finditer(r"<p[^>]*>([^<>]{60,})</p>", body):
            txt = m.group(1)
            if not re.search(r"[一-鿿]", txt) and re.search(r"[a-zA-Z]{6}", txt):
                report("WARN", rel, "疑似未翻译英文段落: " + txt[:80])

    # 2. img 缺 alt 或空 src
    for m in re.finditer(r"<img\b[^>]*>", body):
        tag = m.group(0)
        if "alt=" not in tag:
            report("ERR", rel, "img 缺 alt: " + tag[:100])
        if re.search(r'src=""\s', tag) or 'src=""' in tag:
            report("ERR", rel, "img 空 src: " + tag[:100])

    # 3. 空链接 / 死锚点
    for m in re.finditer(r'href="([^"]*)"', body):
        h = m.group(1)
        if h == "" or h == "#":
            report("ERR", rel, "空 href")
        if h.startswith("#") and len(h) > 1:
            if f'id="{h[1:]}"' not in body:
                report("ERR", rel, f"死锚点 {h}")

    # 4. 内联 style 里的旧色值（旧体系残留）
    for m in re.finditer(r'style="([^"]*)"', body):
        st = m.group(1)
        for old in ("#070810", "#0c0e16", "#8b7ec8", "#c9a96e", "139,126,200", "201,169,110", "#12141d", "#181b26", "#1e2130", "#262a3a", "#e8eaf0", "#8a8f9e", "#7b8290"):
            if old in st:
                report("ERR", rel, f"内联旧色值 {old}: {st[:80]}")

    # 5. HTML 实体错误 / 双重转义
    if "&amp;amp;" in body or "&amp;lt;" in body or "&amp;gt;" in body:
        report("ERR", rel, "双重转义实体")

    # 6. title 重复或缺失
    t = re.search(r"<title>(.*?)</title>", s)
    if not t:
        report("ERR", rel, "缺 <title>")
    elif len(t.group(1)) < 10:
        report("WARN", rel, "title 过短: " + t.group(1))

    # 7. 空按钮/空 heading
    for tag in ("h1", "h2", "h3", "button"):
        for m in re.finditer(r"<%s[^>]*>\s*</%s>" % (tag, tag), body):
            report("ERR", rel, f"空 <{tag}>")

    # 8. 多个 h1
    n_h1 = len(re.findall(r"<h1\b", body))
    if n_h1 != 1 and "404" not in rel:
        report("WARN", rel, f"h1 数量异常: {n_h1}")

    # 9. lorem ipsum / TODO 残留
    if re.search(r"lorem ipsum|TODO|FIXME|placeholder text", body, re.I):
        report("WARN", rel, "占位文本残留")

    # 10. meta description 缺失
    if 'name="description"' not in s:
        report("WARN", rel, "缺 meta description")

    # 11. viewport 检查
    if 'name="viewport"' not in s:
        report("ERR", rel, "缺 viewport")

    # 12. 页面 class 引用但 CSS 无定义（死类 → 样式失效点）
    # 计入：CSS 包 + 本页内联 <style>（PAGE_CSS）
    inline_css = "".join(re.findall(r"<style[^>]*>(.*?)</style>", s, re.S))
    page_defined = defined_classes | set(re.findall(r"\.([a-zA-Z][\w-]*)", inline_css))
    used = set()
    for m in re.finditer(r'class="([^"]+)"', body):
        for c in m.group(1).split():
            used.add(c)
    # 只检查项目自定义类（fio-/品牌前缀类），排除 Tailwind 工具类
    for c in sorted(used):
        if c.startswith(("fio-", "blog-", "docs-", "uc-", "case-study", "footer-", "nav-", "brand-", "pricing-", "blog_", "glow", "hr-fade", "section-intro", "reveal", "micro", "display", "lead")) and c not in page_defined:
            # Tailwind 任意值类（含 [ ）与状态变体不在此列
            if "[" not in c:
                report("WARN", rel, f"无 CSS 定义的类: .{c}")

# 汇总
sev_rank = {"ERR": 0, "WARN": 1}
issues.sort(key=lambda x: (sev_rank[x[0]], x[1]))
by_page = defaultdict(list)
for sev, page, msg in issues:
    by_page[page].append((sev, msg))

n_err = sum(1 for i in issues if i[0] == "ERR")
n_warn = sum(1 for i in issues if i[0] == "WARN")
print("=" * 78)
print("全量 DOM 审计：%d 页 | ERR %d | WARN %d" % (len(pages), n_err, n_warn))
print("=" * 78)
for page, items in by_page.items():
    print("\n### %s" % page)
    seen = set()
    for sev, msg in items:
        if msg in seen:
            continue
        seen.add(msg)
        print("  [%s] %s" % (sev, msg))
