# -*- coding: utf-8 -*-
"""FidesOrigin 博客封面生成器 —— v4「Ledger Precision」。

5 篇文章各一张 1200×630 PNG：深海军蓝底 + 青铜/奶油金几何母题，
无文字标题（四语言共享），仅保留 FIDESORIGIN / INSIGHTS eyebrow。
同时供博客卡片缩略图与文章 og:image 使用。

用法：python scripts/generate-blog-covers.py
产物：public/brand/covers/<slug>.png
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "brand" / "covers"
FONT_DIR = Path(r"C:\Users\wesleyyang\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\python\fonts")

INK = (10, 20, 31)
SURFACE2 = (22, 38, 56)
BORDER_L = (36, 56, 77)
TEXT3 = (152, 145, 127)
GOLD = (175, 145, 95)
CREAM = (252, 225, 182)
ACCENT = (227, 200, 146)
STEEL = (122, 148, 171)
DANGER = (217, 106, 95)

S = 2
W, H = 1200 * S, 630 * S


def font(size, bold=False):
    name = "NotoSansSC-Bold.ttf" if bold else "NotoSansSC-Regular.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size * S)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def base():
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(INK, SURFACE2, y / H * 0.8))
    # hairline 外框 + 四角刻线
    m = 26 * S
    d.rectangle([m, m, W - m, H - m], outline=BORDER_L, width=S)
    tick = 12 * S
    off = m - 6 * S
    for cx, cy in [(off, off), (W - off, off), (off, H - off), (W - off, H - off)]:
        d.line([(cx - tick, cy), (cx + tick, cy)], fill=GOLD, width=2 * S)
        d.line([(cx, cy - tick), (cx, cy + tick)], fill=GOLD, width=2 * S)
    # eyebrow
    f = font(15, bold=True)
    x = 60 * S
    d.line([(x, 74 * S), (x + 20 * S, 74 * S)], fill=GOLD, width=S)
    x += 26 * S
    for ch in "FIDESORIGIN · INSIGHTS":
        d.text((x, 64 * S), ch, font=f, fill=GOLD)
        x += d.textlength(ch, font=f) + 3 * S
    return img, d


def glow_dot(img, x, y, r, color):
    g = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(g)
    gd.ellipse([x - r * 3, y - r * 3, x + r * 3, y + r * 3], fill=70)
    g = g.filter(ImageFilter.GaussianBlur(r * 1.5))
    img.paste(Image.new("RGB", (W, H), color), (0, 0), g)


def cover_travel_rule():
    """Travel Rule：虚线路径穿越节点。"""
    img, d = base()
    pts = [(180, 470), (420, 300), (660, 420), (900, 260), (1080, 360)]
    pts = [(x * S, y * S) for x, y in pts]
    # 虚线路径
    for i in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]
        seg = math.hypot(x2 - x1, y2 - y1)
        steps = int(seg / (16 * S))
        for k in range(0, steps, 2):
            t1, t2 = k / steps, (k + 1) / steps
            d.line([(x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1),
                    (x1 + (x2 - x1) * t2, y1 + (y2 - y1) * t2)], fill=ACCENT, width=2 * S)
    # 终点箭头
    (xa, ya), (xb, yb) = pts[-2], pts[-1]
    ang = math.atan2(yb - ya, xb - xa)
    for da in (2.6, -2.6):
        d.line([(xb, yb), (xb - 26 * S * math.cos(ang + da * 0.3), yb - 26 * S * math.sin(ang + da * 0.3))],
               fill=CREAM, width=3 * S)
    for i, (x, y) in enumerate(pts):
        hot = i in (0, len(pts) - 1)
        r = (9 if hot else 5) * S
        d.ellipse([x - r, y - r, x + r, y + r], outline=GOLD if hot else STEEL, width=2 * S,
                  fill=INK)
        if hot:
            d.ellipse([x - 3 * S, y - 3 * S, x + 3 * S, y + 3 * S], fill=CREAM)
    return img


def cover_why_onchain():
    """API vs On-chain：左侧断链，右侧完整区块链。"""
    img, d = base()
    mid = W // 2
    d.line([(mid, 130 * S), (mid, 540 * S)], fill=BORDER_L, width=S)
    # 左：断裂的 API 链
    y = 300 * S
    d.line([(150 * S, y), (330 * S, y)], fill=STEEL, width=3 * S)
    d.line([(420 * S, y), (510 * S, y)], fill=STEEL, width=3 * S)
    # 断裂叉号
    bx = 375 * S
    d.line([(bx - 16 * S, y - 16 * S), (bx + 16 * S, y + 16 * S)], fill=DANGER, width=4 * S)
    d.line([(bx + 16 * S, y - 16 * S), (bx - 16 * S, y + 16 * S)], fill=DANGER, width=4 * S)
    for x in (150, 510):
        d.ellipse([(x * S - 8 * S, y - 8 * S), (x * S + 8 * S, y + 8 * S)], outline=STEEL, width=2 * S)
    # 右：区块链
    bw, bh, gap = 90 * S, 64 * S, 36 * S
    x = mid + 70 * S
    for i in range(4):
        d.rectangle([x, y - bh // 2, x + bw, y + bh // 2], outline=GOLD, width=2 * S, fill=SURFACE2)
        d.text((x + bw / 2 - 10 * S, y - 12 * S), f"{i+1}", font=font(20, bold=True), fill=CREAM)
        if i < 3:
            d.line([(x + bw, y), (x + bw + gap, y)], fill=GOLD, width=2 * S)
        x += bw + gap
    return img


def cover_hk_license():
    """HK 牌照：封印 + 盾。"""
    img, d = base()
    cx, cy, r = 600 * S, 330 * S, 170 * S
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=GOLD, width=3 * S)
    d.ellipse([cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82], outline=BORDER_L, width=S)
    # 环形刻度
    for i in range(36):
        a = i * math.pi / 18
        r1, r2 = r * 0.9, r * 0.96
        d.line([(cx + r1 * math.cos(a), cy + r1 * math.sin(a)),
                (cx + r2 * math.cos(a), cy + r2 * math.sin(a))], fill=GOLD, width=S)
    # 盾 + 对勾
    sw, sh = 72 * S, 84 * S
    pts = [(cx, cy - sh), (cx + sw, cy - sh * 0.55), (cx + sw, cy + sh * 0.25),
           (cx, cy + sh), (cx - sw, cy + sh * 0.25), (cx - sw, cy - sh * 0.55)]
    d.line(pts + [pts[0]], fill=CREAM, width=3 * S, joint="curve")
    d.line([(cx - 26 * S, cy), (cx - 8 * S, cy + 20 * S), (cx + 30 * S, cy - 24 * S)],
           fill=GOLD, width=5 * S, joint="curve")
    glow_dot(img, cx, cy, 40 * S, GOLD)
    return img


def cover_mica():
    """MiCA：12 刻线环 + 中心币。"""
    img, d = base()
    cx, cy = 600 * S, 330 * S
    r = 180 * S
    for i in range(12):
        a = i * math.pi / 6 - math.pi / 2
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        rr = 9 * S
        d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=ACCENT, width=2 * S, fill=INK)
        if i % 3 == 0:
            d.line([(cx + (r * 0.62) * math.cos(a), cy + (r * 0.62) * math.sin(a)), (x, y)],
                   fill=BORDER_L, width=S)
    cr = 78 * S
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], outline=GOLD, width=3 * S, fill=SURFACE2)
    d.ellipse([cx - cr * 0.7, cy - cr * 0.7, cx + cr * 0.7, cy + cr * 0.7], outline=GOLD, width=S)
    d.text((cx - 15 * S, cy - 24 * S), "€", font=font(44, bold=True), fill=CREAM)
    return img


def cover_ofac_screening():
    """OFAC 筛查：雷达环 + 被拦截的高危节点。"""
    img, d = base()
    cx, cy = 600 * S, 330 * S
    for r in (60, 110, 160, 210):
        d.ellipse([cx - r * S, cy - r * S, cx + r * S, cy + r * S], outline=BORDER_L, width=S)
    # 扫描扇形
    wedge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wedge)
    wd.pieslice([cx - 210 * S, cy - 210 * S, cx + 210 * S, cy + 210 * S], -90, -30,
                fill=(227, 200, 146, 26))
    img.paste(Image.new("RGB", (W, H), ACCENT), (0, 0),
              wedge.split()[3].point(lambda v: v * 0.35))
    img = img.convert("RGB")
    d = ImageDraw.Draw(img)
    d.line([(cx, cy), (cx + 210 * S * math.cos(-math.pi / 6), cy + 210 * S * math.sin(-math.pi / 6))],
           fill=ACCENT, width=2 * S)
    # 常规节点
    import random
    rng = random.Random(7)
    for _ in range(10):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(40, 200) * S
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        r0 = 4 * S
        d.ellipse([x - r0, y - r0, x + r0, y + r0], fill=STEEL)
    # 高危节点：红圈锁定
    hx, hy = cx + 120 * S, cy - 90 * S
    d.ellipse([hx - 7 * S, hy - 7 * S, hx + 7 * S, hy + 7 * S], fill=DANGER)
    d.ellipse([hx - 18 * S, hy - 18 * S, hx + 18 * S, hy + 18 * S], outline=DANGER, width=2 * S)
    d.line([(hx - 26 * S, hy), (hx - 18 * S, hy)], fill=DANGER, width=2 * S)
    d.line([(hx + 18 * S, hy), (hx + 26 * S, hy)], fill=DANGER, width=2 * S)
    d.line([(hx, hy - 26 * S), (hx, hy - 18 * S)], fill=DANGER, width=2 * S)
    d.line([(hx, hy + 18 * S), (hx, hy + 26 * S)], fill=DANGER, width=2 * S)
    return img


COVERS = {
    "travel-rule-on-chain": cover_travel_rule,
    "why-on-chain-compliance": cover_why_onchain,
    "hong-kong-stablecoin-license": cover_hk_license,
    "mica-stablecoin-compliance": cover_mica,
    "ofac-sanctions-screening-blockchain": cover_ofac_screening,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, fn in COVERS.items():
        img = fn().resize((1200, 630), Image.LANCZOS)
        out = OUT / f"{slug}.png"
        img.save(out, optimize=True)
        print("written:", out)


if __name__ == "__main__":
    main()
