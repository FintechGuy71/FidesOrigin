# -*- coding: utf-8 -*-
"""FidesOrigin OG 社交分享卡生成器 —— v4「Ledger Precision」设计语言。

1200×630（内部 2x 渲染后降采样抗锯齿）。
深海军蓝底 + 青铜金刻线 + 合规网络网格 + 封印徽章。

用法：python scripts/generate-og.py
产物：brand/og-image.png 与 public/brand/og-image.png（og-image.svg 为手写同源文件）
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = Path(r"C:\Users\wesleyyang\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\python\fonts")

# v4 设计令牌
INK = (10, 20, 31)         # --fio-ink
SURFACE2 = (22, 38, 56)    # --fio-surface-2
BORDER_L = (36, 56, 77)    # --fio-border-light
TEXT = (244, 241, 233)     # --fio-text
TEXT3 = (152, 145, 127)    # --fio-text-3
GOLD = (175, 145, 95)      # --fio-gold
CREAM = (252, 225, 182)    # --fio-cream
ACCENT = (227, 200, 146)   # --fio-accent
STEEL = (122, 148, 171)    # --fio-steel

S = 2  # 2x supersampling
W, H = 1200 * S, 630 * S

def font(size, bold=False):
    name = "NotoSansSC-Bold.ttf" if bold else "NotoSansSC-Regular.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size * S)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def draw_tracked(draw, xy, text, f, fill, tracking):
    """逐字绘制带字距的文本。tracking 单位为 px（1x 坐标系）。"""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking * S
    return x

def main():
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)

    # ── 背景：对角渐变 + 顶部青铜光晕 ──
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(INK, SURFACE2, y / H * 0.85))
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.25, -H * 0.55, W * 0.75, H * 0.35], fill=26)
    glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(120 * S))
    bronze = Image.new("RGB", (W, H), ACCENT)
    img.paste(bronze, (0, 0), glow)
    d = ImageDraw.Draw(img)

    # ── 合规网络网格（右下区域，确定性种子）──
    rng = random.Random(20260913)
    nodes = []
    for _ in range(16):
        x = rng.uniform(W * 0.55, W * 0.94)
        y = rng.uniform(H * 0.42, H * 0.9)
        hot = rng.random() < 0.25
        nodes.append((x, y, hot))
    link = 150 * S
    for i, (x1, y1, h1) in enumerate(nodes):
        for x2, y2, h2 in nodes[i + 1:]:
            dist = math.hypot(x1 - x2, y1 - y2)
            if dist < link:
                a = 1 - dist / link
                col = lerp(BORDER_L, GOLD if (h1 or h2) else BORDER_L, 0.9 if (h1 or h2) else 0.0)
                d.line([(x1, y1), (x2, y2)], fill=col, width=max(1, int(1.2 * S * a)))
    for x, y, hot in nodes:
        r = (3.4 if hot else 2.2) * S
        if hot:
            d.ellipse([x - r * 3, y - r * 3, x + r * 3, y + r * 3], fill=(GOLD[0], GOLD[1], GOLD[2]))
            # 覆盖为半透明光晕感：外圈重画暗化
        d.ellipse([x - r, y - r, x + r, y + r], fill=GOLD if hot else STEEL)

    # ── 外框 hairline + 四角刻线 ──
    m = 30 * S
    d.rectangle([m, m, W - m, H - m], outline=BORDER_L, width=S)
    tick = 14 * S
    off = m - 7 * S
    for cx, cy in [(off, off), (W - off, off), (off, H - off), (W - off, H - off)]:
        d.line([(cx - tick, cy), (cx + tick, cy)], fill=GOLD, width=2 * S)
        d.line([(cx, cy - tick), (cx, cy + tick)], fill=GOLD, width=2 * S)

    # ── 封印徽章（右上）──
    bx, by, br = W * 0.862, H * 0.24, 56 * S
    d.ellipse([bx - br, by - br, bx + br, by + br], outline=GOLD, width=int(1.4 * S))
    d.ellipse([bx - br * 0.68, by - br * 0.68, bx + br * 0.68, by + br * 0.68], outline=BORDER_L, width=S)
    # 盾 + 对勾
    sw, sh = 24 * S, 28 * S
    pts = [
        (bx, by - sh), (bx + sw, by - sh * 0.55), (bx + sw, by + sh * 0.25),
        (bx, by + sh), (bx - sw, by + sh * 0.25), (bx - sw, by - sh * 0.55),
    ]
    d.line(pts + [pts[0]], fill=GOLD, width=int(1.6 * S), joint="curve")
    d.line([(bx - 9 * S, by), (bx - 2.5 * S, by + 7 * S), (bx + 10 * S, by - 8 * S)],
           fill=CREAM, width=int(2.4 * S), joint="curve")

    # ── 文案（左对齐）──
    x0 = 84 * S
    # eyebrow
    draw_tracked(d, (x0 + 30 * S, 118 * S), "PROGRAMMABLE ON-CHAIN COMPLIANCE",
                 font(17, bold=True), GOLD, tracking=3.2)
    d.line([(x0, 118 * S + 12 * S), (x0 + 22 * S, 118 * S + 12 * S)], fill=GOLD, width=S)

    # 主标题
    d.text((x0, 168 * S), "FidesOrigin", font=font(96, bold=True), fill=TEXT)
    # 副标题两行
    d.text((x0, 300 * S), "Compliance, executed at", font=font(44), fill=lerp(TEXT, TEXT3, 0.25))
    d.text((x0, 362 * S), "block speed.", font=font(44, bold=True), fill=CREAM)

    # 底部指标行（mono 风，字符级字距）
    metrics = "20,645+ RISK ADDRESSES   ·   <50MS SCREENING   ·   6 NETWORKS   ·   24/7 ENFORCEMENT"
    draw_tracked(d, (x0, 500 * S), metrics, font(15, bold=True), TEXT3, tracking=1.6)

    # 右下角域名
    dom = "fidesorigin.com"
    fdom = font(17, bold=True)
    dw = d.textlength(dom, font=fdom)
    d.text((W - 84 * S - dw, 560 * S), dom, font=fdom, fill=GOLD)

    # ── 降采样输出 ──
    img = img.resize((1200, 630), Image.LANCZOS)
    for out in (ROOT / "brand" / "og-image.png", ROOT / "public" / "brand" / "og-image.png"):
        img.save(out, optimize=True)
        print("written:", out)

if __name__ == "__main__":
    main()
