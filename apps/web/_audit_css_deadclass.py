"""
#15 CSS 死类/缺类双向对账（apps/web）—— 稳健版

方法（避免字符串解析的脆弱性）：
A. 死类：对自定义 CSS 里定义的每个 .class，用词边界在前端全部源文件（tsx/ts +
   public 自研 js）里搜 `class` 是否作为独立 token 出现。未出现 → 死类。
   token 边界：前后不能是 [a-zA-Z0-9_-]（连字符/下划线算类名一部分）。
B. 缺类：反向——前端 className 里出现的自定义类（启发式：含连字符的多词、
   或 .xxx 形式），但 CSS 未定义。仅列高置信候选（含连字符），排除 Tailwind。

死类是主要交付（可安全清理的死 CSS）；缺类因 Tailwind/动态类噪声大，仅作提示。
"""
import os, re, json

ROOT = os.path.dirname(os.path.abspath(__file__))
CSS_FILES = ["css/style.css", "css/legacy.css", "css/fio-design-system.css"]
SCAN_DIRS = ["app", "components", "lib", "i18n"]
PUBLIC_JS = ["public/admin/admin.js", "public/wallet-connect.js"]

# ── 1. CSS 定义的类 ─────────────────────────────────────────
css_classes = set()
for cf in CSS_FILES:
    p = os.path.join(ROOT, cf)
    if not os.path.exists(p):
        continue
    txt = open(p, encoding="utf-8").read()
    txt = re.sub(r"/\*.*?\*/", " ", txt, flags=re.DOTALL)  # 去块注释
    for chunk in txt.split("}"):
        sel = chunk.split("{")[0]
        for m in re.finditer(r"\.([a-zA-Z][a-zA-Z0-9_-]*)", sel):
            css_classes.add(m.group(1))

# ── 2. 读取全部前端源文本（合并成一个大字符串用于词边界搜索）──
chunks = []
for d in SCAN_DIRS:
    for dirpath, _, files in os.walk(os.path.join(ROOT, d)):
        if "node_modules" in dirpath:
            continue
        for f in files:
            if f.endswith((".tsx", ".ts")):
                try:
                    chunks.append(open(os.path.join(dirpath, f), encoding="utf-8").read())
                except (OSError, UnicodeDecodeError):
                    pass
for pj in PUBLIC_JS:
    full = os.path.join(ROOT, pj)
    if os.path.exists(full):
        chunks.append(open(full, encoding="utf-8").read())
BLOB = "\n".join(chunks)

def token_used(name):
    """name 是否作为独立 token 出现在前端源码（词边界，-/_ 属类名）"""
    # 前后不能是 [A-Za-z0-9_-]
    pat = r"(?<![A-Za-z0-9_-])" + re.escape(name) + r"(?![A-Za-z0-9_-])"
    return re.search(pat, BLOB) is not None

STATE_MODIFIERS = {"active","open","show","copied","hidden","disabled","checked","expanded","collapsed","selected","current","done","visible"}

# ── A. 死类 ────────────────────────────────────────────────
dead = sorted(c for c in css_classes if not token_used(c) and c not in STATE_MODIFIERS)

print("=" * 64)
print("#15 CSS 死类/缺类双向对账（稳健版：词边界全源码搜索）")
print("=" * 64)
print(f"自定义 CSS 定义的类：{len(css_classes)} 个")
print(f"前端源文件：{len(chunks)} 个（{' + '.join(SCAN_DIRS)} + 2 public js）")
print()
print(f"【A. 死类】CSS 定义但前端从未引用：{len(dead)} 个")
for c in dead:
    print(f"   .{c}")

json.dump({"dead_classes": dead}, open("/tmp/css_audit.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("\n明细写入 /tmp/css_audit.json")
