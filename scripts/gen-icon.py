#!/usr/bin/env python3
# 生成托盘/窗口图标（猫脸），纯标准库，无外部依赖。
import zlib
import struct
import os

SIZE = 256
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")


def make_png(size, draw, path):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0
        for x in range(size):
            r, g, b, a = draw(x, y)
            raw += bytes((r, g, b, a))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)

    def chunk(typ, data):
        return (
            struct.pack(">I", len(data))
            + typ
            + data
            + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


def point_in_triangle(px, py, t):
    (ax, ay), (bx, by), (cx, cy) = t
    d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if d == 0:
        return False
    a = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d
    b = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d
    c = 1 - a - b
    return 0 <= a <= 1 and 0 <= b <= 1 and 0 <= c <= 1


def draw_cat(x, y):
    cx = cy = SIZE / 2.0
    R = SIZE * 0.42
    # 透明背景
    col = (0, 0, 0, 0)
    # 蓝圆头
    if (x - cx) ** 2 + (y - cy) ** 2 < R * R:
        col = (55, 138, 221, 255)
    # 耳朵（白三角）
    ears = [
        ((cx - R * 0.75, cy - R * 0.35), (cx - R * 1.15, cy - R * 0.05), (cx - R * 0.15, cy - R * 0.45)),
        ((cx + R * 0.75, cy - R * 0.35), (cx + R * 1.15, cy - R * 0.05), (cx + R * 0.15, cy - R * 0.45)),
    ]
    for t in ears:
        if point_in_triangle(x, y, t):
            col = (245, 245, 250, 255)
    # 白脸
    rf = R * 0.72
    if (x - cx) ** 2 + (y - cy) ** 2 < rf * rf:
        col = (245, 245, 250, 255)
    # 眼睛
    for ex in (-1, 1):
        exx = cx + ex * R * 0.28
        eyy = cy - R * 0.02
        if (x - exx) ** 2 + (y - eyy) ** 2 < (R * 0.09) ** 2:
            col = (55, 138, 221, 255)
    # 鼻子
    nx, ny = cx, cy + R * 0.18
    if (x - nx) ** 2 + (y - ny) ** 2 < (R * 0.06) ** 2:
        col = (242, 128, 159, 255)
    return col


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    make_png(SIZE, draw_cat, os.path.join(OUT_DIR, "icon.png"))
    make_png(32, draw_cat, os.path.join(OUT_DIR, "tray.png"))
    print("icons generated:", os.path.join(OUT_DIR, "icon.png"), os.path.join(OUT_DIR, "tray.png"))
