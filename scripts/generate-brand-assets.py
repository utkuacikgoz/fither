"""FITHER brand export: the pose-1 stretching-figure F.

Emits a real vector SVG (outlines computed from the same variable-width
bezier maths the PNGs use) plus the full raster set.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import math, os

OUT = os.environ.get("BRAND_OUT", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "brand"))
# ADR-0017: green, black and white. The names below are kept for the
# file paths the brand set has always used; the values are the product's:
# SAGE is the green, BONE the black ground, GOLD the white.
SAGE, BONE, GOLD = (61, 190, 122), (11, 15, 12), (245, 247, 245)
HEX = {"sage": "#3DBE7A", "bone": "#0B0F0C", "gold": "#F5F7F5", "ink": "#F5F7F5"}


def cubic(p0, p1, p2, p3, n=64):
    pts = []
    for i in range(n + 1):
        t = i / n; mt = 1 - t
        pts.append((mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0],
                    mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1]))
    return pts


def wprofile(n, stops):
    out = []
    for i in range(n + 1):
        t = i / n
        for j in range(len(stops) - 1):
            t0, w0 = stops[j]; t1, w1 = stops[j + 1]
            if t0 <= t <= t1:
                f = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                f = f * f * (3 - 2 * f)
                out.append(w0 + (w1 - w0) * f); break
        else:
            out.append(stops[-1][1])
    return out


def outline(pts, ws):
    """The stroke's polygon outline — shared by raster fill and SVG path."""
    n = len(pts); left = []; right = []
    for i in range(n):
        if i == 0: dx, dy = pts[1][0]-pts[0][0], pts[1][1]-pts[0][1]
        elif i == n-1: dx, dy = pts[-1][0]-pts[-2][0], pts[-1][1]-pts[-2][1]
        else: dx, dy = pts[i+1][0]-pts[i-1][0], pts[i+1][1]-pts[i-1][1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy/L, dx/L
        left.append((pts[i][0]+nx*ws[i], pts[i][1]+ny*ws[i]))
        right.append((pts[i][0]-nx*ws[i], pts[i][1]-ny*ws[i]))
    return left + right[::-1]


def shapes(s, scale=1.0, ox=0.0, oy=0.0):
    """Every piece of the figure as (kind, data) in a unit-ish space.

    Each stroke emits its outline polygon plus round end-caps — the caps
    are what give limb ends their soft finish, so they are part of the
    shape, not decoration."""
    def U(x, y):
        return (((x-0.5)*scale + 0.5 + ox)*s, ((y-0.5)*scale + 0.5 + oy)*s)
    def W(w): return w*s*scale
    out = []

    def stroke(pts, ws, cap0=True, cap1=True):
        out.append(("poly", outline(pts, ws)))
        if cap0:
            out.append(("ellipse", (pts[0][0], pts[0][1], ws[0], ws[0])))
        if cap1:
            out.append(("ellipse", (pts[-1][0], pts[-1][1], ws[-1], ws[-1])))

    hip = U(0.415, 0.545); shoulder = U(0.432, 0.312)
    hr = W(0.054)
    out.append(("ellipse", (hip[0]-W(0.006), hip[1], hr, hr)))
    leg = cubic(hip, U(0.398,0.66), U(0.418,0.76), U(0.432,0.862))
    stroke(leg, wprofile(64, [(0,W(0.048)),(0.42,W(0.030)),(0.62,W(0.026)),(0.78,W(0.020)),(1,W(0.0125))]))
    foot = cubic(U(0.432,0.868), U(0.452,0.882), U(0.468,0.885), U(0.483,0.882), 20)
    stroke(foot, wprofile(20, [(0,W(0.0125)),(1,W(0.005))]))
    hx0, hy0 = U(0.417,0.862); hx1, hy1 = U(0.437,0.884)
    out.append(("ellipse", ((hx0+hx1)/2, (hy0+hy1)/2, (hx1-hx0)/2, (hy1-hy0)/2)))
    torso = cubic(hip, U(0.388,0.47), U(0.402,0.375), shoulder)
    stroke(torso, wprofile(64, [(0,W(0.056)),(0.42,W(0.0335)),(0.75,W(0.040)),(1,W(0.034))]))
    ankle = U(0.652,0.502)
    rl = cubic(hip, U(0.50,0.545), U(0.585,0.522), ankle)
    stroke(rl, wprofile(64, [(0,W(0.048)),(0.4,W(0.028)),(0.75,W(0.018)),(1,W(0.013))]))
    out.append(("ellipse", (ankle[0]+W(0.004), ankle[1]+W(0.012), W(0.011), W(0.011))))
    ft = cubic(ankle, U(0.672,0.494), U(0.688,0.487), U(0.702,0.481), 16)
    stroke(ft, wprofile(16, [(0,W(0.013)),(0.6,W(0.008)),(1,W(0.004))]))
    sx, sy = U(0.432,0.318)
    arm = cubic((sx,sy), U(0.52,0.334), U(0.62,0.315), U(0.70,0.288))
    stroke(arm, wprofile(64, [(0,W(0.026)),(0.5,W(0.016)),(0.85,W(0.0115)),(1,W(0.010))]))
    cx, cy = U(0.696,0.286); out.append(("ellipse", (cx, cy, W(0.011), W(0.011))))
    neck = cubic(U(0.435,0.315), U(0.442,0.29), U(0.447,0.275), U(0.452,0.258), 20)
    stroke(neck, wprofile(20, [(0,W(0.022)),(1,W(0.017))]))
    hx, hy = U(0.456,0.212); hr2 = W(0.0455)
    out.append(("ellipse", (hx, hy, hr2*0.94, hr2)))
    t1 = cubic(U(0.419,0.203), U(0.388,0.190), U(0.372,0.208), U(0.368,0.238))
    stroke(t1, wprofile(64, [(0,W(0.013)),(0.55,W(0.021)),(1,W(0.019))]), cap1=False)
    t2 = cubic(U(0.368,0.238), U(0.363,0.272), U(0.368,0.305), U(0.388,0.336))
    stroke(t2, wprofile(64, [(0,W(0.019)),(0.55,W(0.012)),(1,W(0.0045))]), cap0=False)
    return out


def draw_raster(d, s, color, scale=1.0, ox=0.0, oy=0.0):
    for kind, data in shapes(s, scale, ox, oy):
        if kind == "poly":
            d.polygon(data, fill=color)
        else:
            cx, cy, rx, ry = data
            d.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=color)


def svg_figure(size, color, scale=1.0, ox=0.0, oy=0.0):
    parts = []
    for kind, data in shapes(size, scale, ox, oy):
        if kind == "poly":
            pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in data)
            parts.append(f'    <polygon points="{pts}"/>')
        else:
            cx, cy, rx, ry = data
            parts.append(f'    <ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}"/>')
    return f'  <g fill="{color}">\n' + "\n".join(parts) + "\n  </g>"


S = 4  # supersample
def raster_icon(px, bg=BONE, fg=SAGE, pad_scale=0.98, ox=-0.037, oy=-0.028):
    img = Image.new("RGB", (px*S, px*S), bg)
    draw_raster(ImageDraw.Draw(img), px*S, fg, pad_scale, ox, oy)
    return img.resize((px, px), Image.LANCZOS)

def raster_mark_transparent(px, fg=SAGE):
    img = Image.new("RGBA", (px*S, px*S), (0,0,0,0))
    draw_raster(ImageDraw.Draw(img), px*S, fg + (255,), 1.0, -0.037, -0.028)
    return img.resize((px, px), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)

# --- SVG: mark only (transparent), sage ---
with open(f"{OUT}/fither-mark.svg", "w") as f:
    f.write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <title>FITHER mark</title>
{svg_figure(1024, HEX["sage"], 0.98, -0.037, -0.028)}
</svg>
''')

# --- SVG: app icon (black ground, green figure — ADR-0017) ---
with open(f"{OUT}/fither-icon.svg", "w") as f:
    f.write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <title>FITHER icon</title>
  <rect width="1024" height="1024" fill="{HEX["bone"]}"/>
{svg_figure(1024, HEX["sage"], 0.98, -0.037, -0.028)}
</svg>
''')

# --- SVG: mark in bone (for dark/sage grounds) ---
with open(f"{OUT}/fither-mark-bone.svg", "w") as f:
    f.write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <title>FITHER mark, bone</title>
{svg_figure(1024, HEX["bone"], 0.98, -0.037, -0.028)}
</svg>
''')

# --- Rasters ---
raster_icon(1024).save(f"{OUT}/icon-1024.png")
raster_icon(512).save(f"{OUT}/icon-512.png")
raster_icon(180).save(f"{OUT}/icon-180.png")
raster_icon(120).save(f"{OUT}/icon-120.png")
raster_icon(64).save(f"{OUT}/icon-64.png")
raster_mark_transparent(1024).save(f"{OUT}/mark-sage-1024.png")
img = Image.new("RGBA", (1024*S, 1024*S), (0,0,0,0))
draw_raster(ImageDraw.Draw(img), 1024*S, BONE + (255,), 1.0, -0.037, -0.028)
img.resize((1024,1024), Image.LANCZOS).save(f"{OUT}/mark-bone-1024.png")

# The app's own copy of the mark: pure white on transparent, exactly like
# the movement figures, so one Image + tintColor mechanism draws it in the
# theme's accent in both light and dark. 640px covers a 200pt hero at 3x.
APP_BRAND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "assets", "brand")
os.makedirs(APP_BRAND, exist_ok=True)
raster_mark_transparent(640, fg=(255, 255, 255)).save(f"{APP_BRAND}/mark.png")

# --- Lockup: mark + wordmark (transparent) ---
W_, H_ = 900*S, 1100*S
sp = Image.new("RGBA", (W_, H_), (0,0,0,0))
fig_side = 620*S
fig = Image.new("RGBA", (fig_side, fig_side), (0,0,0,0))
draw_raster(ImageDraw.Draw(fig), fig_side, SAGE + (255,), 1.0, -0.037, -0.028)
sp.paste(fig, ((W_-fig_side)//2, 60*S), fig)
d = ImageDraw.Draw(sp)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 66*S)
word = "FITHER"; tracking = 34*S
widths = [font.getbbox(c)[2]-font.getbbox(c)[0] for c in word]
total = sum(widths) + tracking*(len(word)-1)
x = (W_-total)//2
for c, w in zip(word, widths):
    d.text((x, 700*S), c, fill=SAGE + (255,), font=font); x += w + tracking
sp.resize((900,1100), Image.LANCZOS).save(f"{OUT}/lockup-sage-900x1100.png")

print("\n".join(sorted(os.listdir(OUT))))
