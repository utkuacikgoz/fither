"""FITHER tab-bar icons (ADR-0017): three line glyphs in the figures' stroke.

White strokes on transparent, drawn at 4x and downsampled, emitted at
@3x for a 28pt box. The app tints them with the theme (Image tintColor),
exactly like the brand mark — one asset, every colour.

    python3 scripts/generate-tab-icons.py
"""
import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "assets", "icons")
BOX = 28          # points
SCALE = 3         # @3x asset
SS = 4            # supersample
PX = BOX * SCALE * SS
STROKE = 1.9 * SCALE * SS
WHITE = (255, 255, 255, 255)


def canvas():
    return Image.new("RGBA", (PX, PX), (0, 0, 0, 0))


def u(v):
    """Unit square (0..1) → pixels."""
    return v * PX


def line(d, a, b, w=STROKE):
    d.line([(u(a[0]), u(a[1])), (u(b[0]), u(b[1]))], fill=WHITE, width=int(w))
    for p in (a, b):
        d.ellipse([u(p[0]) - w / 2, u(p[1]) - w / 2, u(p[0]) + w / 2, u(p[1]) + w / 2], fill=WHITE)


def ring(d, c, r, w=STROKE):
    d.ellipse([u(c[0] - r), u(c[1] - r), u(c[0] + r), u(c[1] + r)], outline=WHITE, width=int(w))


def dot(d, c, r):
    d.ellipse([u(c[0] - r), u(c[1] - r), u(c[0] + r), u(c[1] + r)], fill=WHITE)


def today():
    # The day: a ring with a horizon — the sun just up. One ring, one line.
    im = canvas(); d = ImageDraw.Draw(im)
    ring(d, (0.5, 0.46), 0.26)
    line(d, (0.16, 0.82), (0.84, 0.82))
    return im


def progress():
    # The ladder, rising: three steps left to right, the top one reached.
    im = canvas(); d = ImageDraw.Draw(im)
    line(d, (0.18, 0.78), (0.34, 0.78))
    line(d, (0.42, 0.56), (0.58, 0.56))
    line(d, (0.66, 0.34), (0.82, 0.34))
    dot(d, (0.74, 0.34), 0.075)
    return im


def settings():
    # Two sliders, the knobs off-centre: something you set, not a gear.
    im = canvas(); d = ImageDraw.Draw(im)
    line(d, (0.16, 0.36), (0.84, 0.36))
    line(d, (0.16, 0.66), (0.84, 0.66))
    dot(d, (0.62, 0.36), 0.085)
    dot(d, (0.36, 0.66), 0.085)
    return im


def save(im, name):
    size = BOX * SCALE
    im.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f"tab-{name}.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save(today(), "today")
    save(progress(), "progress")
    save(settings(), "settings")
    print(f"wrote 3 icons to {OUT} ({BOX * SCALE}px, @3x for {BOX}pt)")
