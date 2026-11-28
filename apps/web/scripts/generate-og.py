# -*- coding: utf-8 -*-
"""Generate FidesOrigin editorial-verification OG cards in four locales."""
from pathlib import Path
import math
import random
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = Path(r"C:\Users\wesleyyang\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\python\fonts")
S = 2
W, H = 1200 * S, 630 * S
SAGE = "#dddec9"
SUN = "#ffe600"
SKY = "#aae2ff"
BLACK = "#000000"
WHITE = "#ffffff"
MUTED = "#3f413a"


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_DIR / ("NotoSansSC-Bold.ttf" if bold else "NotoSansSC-Regular.ttf")), size * S)


def current_records():
    path = ROOT / "i18n" / "metrics.generated.ts"
    try:
        match = re.search(r'riskAddresses: "([^"]+)"', path.read_text(encoding="utf-8"))
        return match.group(1) if match else None
    except FileNotFoundError:
        return None


RECORDS = current_records()
VARIANTS = {
    "en": {"title": ["Compliance, executed at", "block speed"], "outputs": ["brand/og-image.png", "public/brand/og-image.png"]},
    "cn": {"title": ["合规，以区块速度", "实时执行"], "outputs": ["public/brand/og-image-cn.png"]},
    "tw": {"title": ["合規，以區塊速度", "即時執行"], "outputs": ["public/brand/og-image-tw.png"]},
    "jp": {"title": ["コンプライアンスを、", "ブロックスピードで実行"], "outputs": ["public/brand/og-image-jp.png"]},
}


def fit_font(text, max_width, start, bold=True):
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    for size in range(start, 24, -2):
        candidate = font(size, bold)
        if probe.textlength(text, font=candidate) <= max_width:
            return candidate
    return font(24, bold)


def draw_mark(image, box):
    draw = ImageDraw.Draw(image)
    x0, y0, x1, y1 = box
    size = x1 - x0
    draw.rectangle(box, fill=SUN, outline=BLACK, width=max(2, S))
    stroke = max(2, round(size * .065))
    draw.line([(x0 + size * .28, y0 + size * .72), (x0 + size * .28, y0 + size * .28), (x0 + size * .69, y0 + size * .28)], fill=BLACK, width=stroke)
    draw.line([(x0 + size * .28, y0 + size * .50), (x0 + size * .56, y0 + size * .50)], fill=BLACK, width=stroke)
    radius = size * .078
    cx, cy = x0 + size * .70, y0 + size * .70
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=BLACK)


def bezier(a, b, lift, steps=48):
    points = []
    control = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - lift)
    for index in range(steps + 1):
        t = index / steps
        x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * control[0] + t ** 2 * b[0]
        y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * control[1] + t ** 2 * b[1]
        points.append((x, y))
    return points


def network_nodes():
    rng = random.Random(20261128)
    nodes = []
    for index in range(42):
        angle = index * math.pi * (3 - math.sqrt(5))
        radius = math.sqrt(rng.random())
        nodes.append((890 * S + math.cos(angle) * radius * 190 * S, 330 * S + math.sin(angle) * radius * 220 * S))
    return nodes


def render(lines):
    image = Image.new("RGB", (W, H), SAGE)
    draw = ImageDraw.Draw(image)
    draw.rectangle((820 * S, 0, W, H), fill=BLACK)
    draw_mark(image, (56 * S, 52 * S, 124 * S, 120 * S))
    draw.text((148 * S, 68 * S), "FidesOrigin", font=font(30, True), fill=BLACK)
    draw.line((56 * S, 156 * S, 760 * S, 156 * S), fill=BLACK, width=S)

    y = 208 * S
    for line in lines:
        face = fit_font(line, 700 * S, 62)
        draw.text((56 * S, y), line, font=face, fill=BLACK)
        y += 92 * S

    metric = f"{RECORDS} RISK INTELLIGENCE RECORDS" if RECORDS else "LIVE VERIFIED METRICS"
    draw.text((56 * S, 486 * S), metric, font=font(17, True), fill=MUTED)
    draw.text((56 * S, 536 * S), "SEPOLIA  ·  FINAL-STATE READBACK  ·  fidesorigin.com", font=font(14), fill=BLACK)

    nodes = network_nodes()
    for index, a in enumerate(nodes):
        for b in nodes[index + 1:]:
            if math.hypot(a[0] - b[0], a[1] - b[1]) < 92 * S:
                draw.line((a, b), fill="#333333", width=S)
    for index in (4, 17, 29):
        a, b = nodes[index], nodes[(index + 11) % len(nodes)]
        draw.line(bezier(a, b, 100 * S), fill=SUN if index % 2 == 0 else SKY, width=2 * S)
    for index, (x, y) in enumerate(nodes):
        radius = (3 if index % 7 == 0 else 1.7) * S
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=SUN if index % 7 == 0 else WHITE)
    draw.text((852 * S, 46 * S), "VERIFIED / SEPOLIA", font=font(13, True), fill=SUN)
    draw.text((852 * S, 566 * S), "CHAIN ID 11155111", font=font(12), fill=SKY)
    return image.resize((1200, 630), Image.LANCZOS)


def render_svg():
    nodes = network_nodes()
    circles = "".join(f'<circle cx="{x / S:.1f}" cy="{y / S:.1f}" r="{2.2 if i % 7 else 3.5}" fill="{SUN if i % 7 == 0 else WHITE}"/>' for i, (x, y) in enumerate(nodes))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="{SAGE}"/><rect x="820" width="380" height="630" fill="{BLACK}"/>
<rect x="56" y="52" width="68" height="68" fill="{SUN}" stroke="{BLACK}"/><path d="M75 101V71h26M75 86h18" stroke="{BLACK}" stroke-width="4"/><circle cx="104" cy="100" r="5" fill="{BLACK}"/>
<text x="148" y="100" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700" fill="{BLACK}">FidesOrigin</text>
<path d="M56 156H760" stroke="{BLACK}"/><text x="56" y="254" font-family="Inter,Arial,sans-serif" font-size="60" font-weight="700" fill="{BLACK}">Compliance, executed at</text><text x="56" y="334" font-family="Inter,Arial,sans-serif" font-size="60" font-weight="700" fill="{BLACK}">block speed</text>
<text x="56" y="504" font-family="monospace" font-size="18" fill="{MUTED}">{RECORDS or 'LIVE'} RISK INTELLIGENCE RECORDS</text><text x="56" y="550" font-family="monospace" font-size="14" fill="{BLACK}">SEPOLIA · FINAL-STATE READBACK · fidesorigin.com</text>
{circles}<text x="852" y="64" font-family="monospace" font-size="14" fill="{SUN}">VERIFIED / SEPOLIA</text><text x="852" y="580" font-family="monospace" font-size="13" fill="{SKY}">CHAIN ID 11155111</text></svg>'''


def main():
    for locale, variant in VARIANTS.items():
        image = render(variant["title"])
        for relative in variant["outputs"]:
            target = ROOT / relative
            image.save(target, optimize=True)
            print(f"written [{locale}]:", target)
    svg = render_svg()
    (ROOT / "public/brand/og-image.svg").write_text(svg, encoding="utf-8")
    if (ROOT / "brand").exists():
        (ROOT / "brand/og-image.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
