#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PHANTOM // 怪盗日志  ——  生成社交分享图与 PWA 图标（可选工具）

    python tools/make-images.py

产物（已提交进仓库，平时不需要重跑）：
    assets/img/og.png        1200×630  社交分享卡（og:image / twitter:image）
    assets/img/icon-192.png   192×192   PWA 图标
    assets/img/icon-512.png   512×512   PWA 图标

只依赖 Pillow。文字用的是系统里的 Impact（拉丁）和微软雅黑粗体（中文）。
想换成别的字体，改下面的 FONT_* 常量即可。
"""
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    sys.exit("需要 Pillow：pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")
os.makedirs(OUT, exist_ok=True)

WIN_FONTS = os.environ.get("WINDIR", r"C:\Windows") + r"\Fonts"
FONT_DISPLAY = os.path.join(WIN_FONTS, "impact.ttf")   # 拉丁标题（最接近 P5 的压缩黑体）
FONT_CJK     = os.path.join(WIN_FONTS, "msyhbd.ttc")   # 中文粗体
FONT_MONO    = os.path.join(WIN_FONTS, "consolab.ttc") # 等宽

BLACK = (11, 11, 13)
BLACK_2 = (20, 20, 23)
RED = (230, 0, 18)
RED_HOT = (255, 30, 86)
RED_DEEP = (158, 0, 12)
WHITE = (255, 255, 255)


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype(FONT_CJK if path != FONT_DISPLAY else FONT_DISPLAY, size)


def shear_x(layer, factor):
    """把一层图整体做水平斜切（x' = x + factor*y）。"""
    w, h = layer.size
    return layer.transform((w, h), Image.AFFINE,
                           (1, -factor, factor * h, 0, 1, 0),
                           resample=Image.BICUBIC)


def stripes(img, x0, y0, x1, y1, color, width, gap, alpha, skew=0.0):
    """斜条纹填充一块区域。"""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    span = int((x1 - x0) + (y1 - y0) + 400)
    x = x0 - span
    while x < x1 + span:
        d.polygon([
            (x, y0 + (x - x0) * skew),
            (x + width, y0 + (x + width - x0) * skew),
            (x + width, y1),
            (x, y1),
        ], fill=color + (alpha,))
        x += width + gap
    img.alpha_composite(layer)


def halftone(img, x0, y0, x1, y1, color, step, r, alpha):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            d.ellipse([x - r, y - r, x + r, y + r], fill=color + (alpha,))
            x += step
        y += step
    img.alpha_composite(layer)


# ---------------------------------------------------------------- OG 分享图
def make_og():
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), BLACK + (255,))

    # 左侧斜条纹
    stripes(img, -80, -200, 520, H + 200, RED, 18, 26, 26, skew=-0.34)
    # 右侧红色大斜块
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.polygon([(690, -80), (1260, -80), (1100, H + 80), (560, H + 80)], fill=RED + (235,))
    d.polygon([(1010, -80), (1260, -80), (1100, H + 80), (880, H + 80)], fill=RED_DEEP + (235,))
    img.alpha_composite(layer)

    halftone(img, 820, 40, 1200, 300, BLACK, 13, 2.2, 70)
    halftone(img, 60, 430, 480, 620, WHITE, 12, 1.6, 26)

    # 标题
    f_big = font(FONT_DISPLAY, 168)
    t1 = Image.new("RGBA", (W, 300), (0, 0, 0, 0))
    ImageDraw.Draw(t1).text((54, -18), "PHANTOM", font=f_big, fill=WHITE + (255,))
    t1 = shear_x(t1, 0.14)
    img.alpha_composite(t1, (0, 78))

    # THIEF LOG —— 描边空心
    f_mid = font(FONT_DISPLAY, 112)
    t2 = Image.new("RGBA", (W, 220), (0, 0, 0, 0))
    ImageDraw.Draw(t2).text((52, -14), "THIEF LOG", font=f_mid,
                            fill=(0, 0, 0, 0), stroke_width=3, stroke_fill=WHITE + (255,))
    t2 = shear_x(t2, 0.14)
    img.alpha_composite(t2, (0, 232))

    # 中文站点名
    f_cjk = font(FONT_CJK, 46)
    ImageDraw.Draw(img).text((58, 380), "怪盗日志", font=f_cjk, fill=WHITE + (255,))

    # 红色斜标签
    d = ImageDraw.Draw(img)
    d.polygon([(56, 452), (498, 452), (472, 500), (30, 500)], fill=RED + (255,))
    f_tag = font(FONT_DISPLAY, 30)
    ImageDraw.Draw(img).text((62, 458), "TAKE YOUR HEART", font=f_tag, fill=WHITE + (255,))

    # 底部说明
    f_small = font(FONT_CJK, 24)
    ImageDraw.Draw(img).text((58, 540), "CTF 复盘 · 渗透测试 · 靶场搭建 · 逆向笔记",
                             font=f_small, fill=(200, 200, 206, 255))

    # 右下角域名（放在红块上）
    f_dom = font(FONT_MONO, 22)
    ImageDraw.Draw(img).text((700, 566), "phantom726.github.io", font=f_dom, fill=WHITE + (235,))

    # 顶部红色细条
    ImageDraw.Draw(img).rectangle([0, 0, W, 10], fill=RED + (255,))

    img.convert("RGB").save(os.path.join(OUT, "og.png"), "PNG", optimize=True)
    print("  og.png        1200x630")


# ------------------------------------------------------------------- 图标
def make_icon(size):
    img = Image.new("RGBA", (size, size), BLACK + (255,))
    d = ImageDraw.Draw(img)
    s = size / 64.0
    # 红条纹
    stripes(img, int(-16 * s), 0, size, size, RED, max(1, int(9 * s)), max(1, int(7 * s)), 255, skew=-0.2)
    # 斜切块
    d.polygon([(int(41 * s), 0), (size, 0), (size, size), (int(28 * s), size)], fill=RED_DEEP + (200,))
    # P 的暗色偏移（海报错版感）
    f = font(FONT_DISPLAY, int(46 * s))
    bx = int(14 * s)
    by = int(6 * s)
    ImageDraw.Draw(img).text((bx + int(3 * s), by + int(3 * s)), "P", font=f, fill=BLACK + (230,))
    ImageDraw.Draw(img).text((bx, by), "P", font=f, fill=WHITE + (255,))
    img.convert("RGB").save(os.path.join(OUT, "icon-%d.png" % size), "PNG", optimize=True)
    print("  icon-%d.png   %dx%d" % (size, size, size))


if __name__ == "__main__":
    print("")
    print("  PHANTOM // 生成图片资源")
    print("")
    make_og()
    make_icon(192)
    make_icon(512)
    print("")
