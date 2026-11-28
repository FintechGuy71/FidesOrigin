# -*- coding: utf-8 -*-
"""Generate the current FidesOrigin logo and browser-icon suite with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"
BRAND = OUT / "brand"
FONT = Path(r"C:\Users\wesleyyang\AppData\Roaming\daimon-share\daimon\runtime\python\fonts\NotoSansSC-Bold.ttf")
if not FONT.exists():
    FONT = Path(r"C:\Users\wesleyyang\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\python\fonts\NotoSansSC-Bold.ttf")
SUN = "#ffe600"
BLACK = "#000000"
WHITE = "#ffffff"


def mark(image, box, fill=SUN, ink=BLACK):
    draw = ImageDraw.Draw(image)
    x0, y0, x1, y1 = box
    width = x1 - x0
    stroke = max(2, round(width * 0.065))
    draw.rectangle(box, fill=fill, outline=ink, width=max(1, round(width * 0.014)))
    # F / origin point geometry follows components/BrandMark.tsx.
    draw.line([(x0 + width * .28, y0 + width * .72), (x0 + width * .28, y0 + width * .28), (x0 + width * .69, y0 + width * .28)], fill=ink, width=stroke)
    draw.line([(x0 + width * .28, y0 + width * .50), (x0 + width * .56, y0 + width * .50)], fill=ink, width=stroke)
    radius = width * .078
    cx, cy = x0 + width * .70, y0 + width * .70
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=ink)


def fit_font(text, max_width, start, minimum=20):
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    for size in range(start, minimum - 1, -2):
        font = ImageFont.truetype(str(FONT), size)
        if probe.textlength(text, font=font) <= max_width:
            return font
    return ImageFont.truetype(str(FONT), minimum)


def save_png_webp(image, stem, webp=True):
    png = BRAND / f"{stem}.png"
    image.save(png, optimize=True)
    if webp:
        image.save(BRAND / f"{stem}.webp", quality=92, method=6)


def full_logo(light=False):
    image = Image.new("RGBA", (1600, 400), (0, 0, 0, 0))
    mark(image, (24, 24, 376, 376))
    draw = ImageDraw.Draw(image)
    text = "FidesOrigin"
    font = fit_font(text, 1140, 210)
    draw.text((420, 72), text, font=font, fill=WHITE if light else BLACK)
    save_png_webp(image, "logo-light-full" if light else "logo-dark-full")


def stacked_logo():
    image = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0))
    mark(image, (310, 90, 690, 470))
    draw = ImageDraw.Draw(image)
    text = "FidesOrigin"
    font = fit_font(text, 880, 140)
    width = draw.textlength(text, font=font)
    draw.text(((1000 - width) / 2, 570), text, font=font, fill=BLACK)
    save_png_webp(image, "logo-dark-stacked")


def main():
    for stem in ("logo-dark-icon", "logo-light-icon"):
        image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        mark(image, (8, 8, 504, 504))
        save_png_webp(image, stem, webp=stem == "logo-dark-icon")
    full_logo(light=False)
    full_logo(light=True)
    stacked_logo()
    icon = Image.new("RGBA", (56, 56), (0, 0, 0, 0))
    mark(icon, (1, 1, 55, 55))
    icon.save(BRAND / "logo-icon-56.png", optimize=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        image = Image.new("RGB", (size, size), SUN)
        mark(image, (0, 0, size, size))
        image.save(OUT / name, optimize=True)
    favicon = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    mark(favicon, (2, 2, 254, 254))
    favicon.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x=".5" y=".5" width="31" height="31" fill="#ffe600" stroke="#000"/><path d="M9 23V9h13M9 16h9" stroke="#000" stroke-width="2"/><circle cx="22.5" cy="22.5" r="2.5" fill="#000"/></svg>\n'
    (BRAND / "logo-dark-icon.svg").write_text(svg, encoding="utf-8")
    (BRAND / "brand-mark.svg").write_text(svg, encoding="utf-8")
    print("Generated current logo, icon and browser asset suite in", BRAND)


if __name__ == "__main__":
    main()
