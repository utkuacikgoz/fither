"""Movement figures: one line-figure per movement, drawn from pose data.

Placeholder art with real intent (ADR-0013). Figures render as solid
white silhouettes on transparency so React Native can tintColor them to
the theme's accent — one asset set, correct in light and dark.

Brief 6's commissioned animation replaces the RENDERING; the pose data
here is the reference it works from.

Run: python3 scripts/generate-movement-figures.py
"""
from PIL import Image, ImageDraw
import json, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "assets", "movements")
PX, S = 320, 3          # output px, supersample
W, H = PX * S, PX * S
INK = (255, 255, 255, 255)   # tinted at runtime

# ---------- drawing primitives (same variable-width stroke as the logo)

def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

def limb(d, a, b, w0, w1, bend=0.0):
    """Tapered limb from a to b; bend bows it perpendicular (0 = straight)."""
    mid = lerp(a, b, 0.5)
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L, dx / L
    ctrl = (mid[0] + nx * bend * L, mid[1] + ny * bend * L)
    pts, ws = [], []
    n = 24
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        pts.append((mt * mt * a[0] + 2 * mt * t * ctrl[0] + t * t * b[0],
                    mt * mt * a[1] + 2 * mt * t * ctrl[1] + t * t * b[1]))
        f = t * t * (3 - 2 * t)
        ws.append(w0 + (w1 - w0) * f)
    left, right = [], []
    for i, p in enumerate(pts):
        if i == 0: dxx, dyy = pts[1][0]-pts[0][0], pts[1][1]-pts[0][1]
        elif i == n: dxx, dyy = pts[-1][0]-pts[-2][0], pts[-1][1]-pts[-2][1]
        else: dxx, dyy = pts[i+1][0]-pts[i-1][0], pts[i+1][1]-pts[i-1][1]
        ll = math.hypot(dxx, dyy) or 1.0
        ox, oy = -dyy/ll*ws[i], dxx/ll*ws[i]
        left.append((p[0]+ox, p[1]+oy)); right.append((p[0]-ox, p[1]-oy))
    d.polygon(left + right[::-1], fill=INK)
    for p, w in ((pts[0], ws[0]), (pts[-1], ws[-1])):
        d.ellipse([p[0]-w, p[1]-w, p[0]+w, p[1]+w], fill=INK)

def dot(d, c, r):
    d.ellipse([c[0]-r, c[1]-r, c[0]+r, c[1]+r], fill=INK)

PROP = (255, 255, 255, 110)   # props sit behind her, at ~40% weight

def prop_wall(d, x=0.90):
    d.rectangle([x*W, 0.06*W, x*W + 0.022*W, 0.94*W], fill=PROP)

def prop_wall_left(d, x=0.10):
    d.rectangle([x*W - 0.022*W, 0.06*W, x*W, 0.94*W], fill=PROP)

def prop_floor(d, y=0.90):
    d.rectangle([0.06*W, y*W, 0.94*W, y*W + 0.016*W], fill=PROP)

def prop_chair(d, x=0.62, top=0.62):
    """Seat + legs + back — a chair read from the side."""
    d.rectangle([x*W, top*W, (x+0.30)*W, (top+0.030)*W], fill=PROP)
    d.rectangle([(x+0.255)*W, (top-0.28)*W, (x+0.285)*W, top*W], fill=PROP)
    d.rectangle([(x+0.015)*W, (top+0.03)*W, (x+0.045)*W, 0.90*W], fill=PROP)
    d.rectangle([(x+0.255)*W, (top+0.03)*W, (x+0.285)*W, 0.90*W], fill=PROP)

def prop_step(d, x=0.06, top=0.72):
    """A low box — the elevated foot / hand support."""
    d.rectangle([x*W, top*W, (x+0.26)*W, 0.90*W], fill=PROP)

PROPS = {}

# ---------- the figure: joints in a 0..1 box, y down

U = 0.030   # base limb half-width

def figure(d, j, flip=False):
    """j: dict of joint positions in unit space."""
    def P(name):
        x, y = j[name]
        if flip: x = 1 - x
        return (x * W, y * W)
    def w(k): return U * W * k

    # legs (far leg first so the near one reads in front)
    for side, k in (("far", 0.85), ("near", 1.0)):
        hip, knee, ank = P(f"hip_{side}"), P(f"knee_{side}"), P(f"ankle_{side}")
        limb(d, hip, knee, w(1.5*k), w(1.15*k))
        limb(d, knee, ank, w(1.15*k), w(0.62*k))
        toe = P(f"toe_{side}")
        limb(d, ank, toe, w(0.62*k), w(0.30*k))
    # torso: hips -> shoulders, slightly waisted
    hipc, shc = P("hip_near"), P("shoulder")
    limb(d, hipc, shc, w(1.75), w(1.30), bend=j.get("spine_bend", 0.0))
    # arms
    for side, k in (("far", 0.85), ("near", 1.0)):
        sh, el, wr = P("shoulder"), P(f"elbow_{side}"), P(f"wrist_{side}")
        limb(d, sh, el, w(0.95*k), w(0.78*k))
        limb(d, el, wr, w(0.78*k), w(0.46*k))
        dot(d, wr, w(0.46*k))
    # neck + head + ponytail
    neck, head = P("neck"), P("head")
    limb(d, shc, neck, w(0.70), w(0.60))
    hr = w(1.42)
    d.ellipse([head[0]-hr*0.94, head[1]-hr, head[0]+hr*0.94, head[1]+hr], fill=INK)
    tail = P("tail")
    limb(d, lerp(head, tail, 0.25), tail, w(0.60), w(0.16))

# ---------- poses (unit space; ~20 shapes cover the 60 movements)

def pose(**kw):
    base = dict(spine_bend=0.0)
    base.update(kw)
    return base

def standing(lean=0.0, arm=("fwd", 0.0)):
    """Upright figure; lean tips the whole body from the ankles."""
    def sx(y, x):  # shift by lean proportional to height above ground
        return x + lean * (0.86 - y)
    j = {
        "hip_near": (sx(0.55, 0.44), 0.55), "hip_far": (sx(0.55, 0.44), 0.55),
        "knee_near": (sx(0.71, 0.44), 0.71), "knee_far": (sx(0.71, 0.43), 0.71),
        "ankle_near": (sx(0.86, 0.44), 0.86), "ankle_far": (sx(0.86, 0.43), 0.86),
        "toe_near": (sx(0.88, 0.50), 0.88), "toe_far": (sx(0.88, 0.49), 0.88),
        "shoulder": (sx(0.30, 0.45), 0.30),
        "neck": (sx(0.25, 0.46), 0.25), "head": (sx(0.19, 0.47), 0.19),
        "tail": (sx(0.24, 0.39), 0.24),
    }
    kind, amt = arm
    if kind == "fwd":     # arms reaching forward
        j.update(elbow_near=(sx(0.33, 0.58), 0.33), wrist_near=(sx(0.32, 0.70), 0.32),
                 elbow_far=(sx(0.34, 0.57), 0.34), wrist_far=(sx(0.33, 0.69), 0.33))
    elif kind == "up":    # arms overhead
        j.update(elbow_near=(sx(0.22, 0.53), 0.22), wrist_near=(sx(0.11, 0.55), 0.11),
                 elbow_far=(sx(0.22, 0.52), 0.22), wrist_far=(sx(0.11, 0.54), 0.11))
    elif kind == "down":  # arms at sides
        j.update(elbow_near=(sx(0.42, 0.47), 0.42), wrist_near=(sx(0.53, 0.48), 0.53),
                 elbow_far=(sx(0.42, 0.46), 0.42), wrist_far=(sx(0.53, 0.47), 0.53))
    elif kind == "wall":  # hands on the wall, elbows bent and out
        j.update(elbow_near=(sx(0.38, 0.60), 0.38), wrist_near=(sx(0.31, 0.78), 0.31),
                 elbow_far=(sx(0.39, 0.59), 0.39), wrist_far=(sx(0.32, 0.77), 0.32))
    elif kind == "hold":  # gripping a frame, arms straight ahead
        j.update(elbow_near=(sx(0.34, 0.62), 0.34), wrist_near=(sx(0.33, 0.80), 0.33),
                 elbow_far=(sx(0.35, 0.61), 0.35), wrist_far=(sx(0.34, 0.79), 0.34))
    elif kind == "row":   # elbows drawn back
        j.update(elbow_near=(sx(0.36, 0.34), 0.36), wrist_near=(sx(0.30, 0.52), 0.30),
                 elbow_far=(sx(0.37, 0.33), 0.37), wrist_far=(sx(0.31, 0.51), 0.31))
    return pose(**j)

def plank(hip_y=0.62, knees=False, hands=True, hand_x=0.20, incline=0.0):
    """Horizontal support: hands (or forearms) forward, body a line."""
    sh_y = hip_y - 0.10 - incline
    j = {
        "hip_near": (0.55, hip_y), "hip_far": (0.55, hip_y + 0.005),
        "knee_near": (0.70, hip_y + 0.07 if knees else hip_y + 0.05),
        "knee_far": (0.70, hip_y + 0.075 if knees else hip_y + 0.055),
        "ankle_near": (0.86, hip_y + 0.16 if knees else hip_y + 0.10),
        "ankle_far": (0.86, hip_y + 0.165 if knees else hip_y + 0.105),
        "toe_near": (0.90, hip_y + 0.20 if knees else hip_y + 0.15),
        "toe_far": (0.90, hip_y + 0.205 if knees else hip_y + 0.155),
        "shoulder": (0.32, sh_y), "neck": (0.26, sh_y - 0.02),
        "head": (0.20, sh_y - 0.04), "tail": (0.27, sh_y - 0.10),
        "elbow_near": (0.28, sh_y + 0.09), "wrist_near": (hand_x + 0.06, sh_y + 0.18),
        "elbow_far": (0.29, sh_y + 0.095), "wrist_far": (hand_x + 0.07, sh_y + 0.185),
    }
    if knees:
        j["ankle_near"] = (0.88, hip_y + 0.02); j["ankle_far"] = (0.88, hip_y + 0.025)
        j["toe_near"] = (0.93, hip_y + 0.01); j["toe_far"] = (0.93, hip_y + 0.015)
        j["knee_near"] = (0.72, hip_y + 0.16); j["knee_far"] = (0.72, hip_y + 0.165)
    return pose(**j)

def squat(depth=0.5):
    """depth 0 = standing, 1 = deep. Hips travel back and down."""
    hy = 0.55 + 0.14 * depth
    hx = 0.44 - 0.10 * depth
    return pose(
        hip_near=(hx, hy), hip_far=(hx, hy + 0.005),
        knee_near=(0.50 + 0.04 * depth, 0.72), knee_far=(0.49 + 0.04 * depth, 0.722),
        ankle_near=(0.46, 0.87), ankle_far=(0.45, 0.872),
        toe_near=(0.53, 0.885), toe_far=(0.52, 0.887),
        shoulder=(hx + 0.02 + 0.03 * depth, hy - 0.26),
        neck=(hx + 0.04 + 0.03 * depth, hy - 0.31),
        head=(hx + 0.06 + 0.03 * depth, hy - 0.37),
        tail=(hx - 0.02 + 0.03 * depth, hy - 0.32),
        elbow_near=(hx + 0.16, hy - 0.22), wrist_near=(hx + 0.30, hy - 0.24),
        elbow_far=(hx + 0.15, hy - 0.215), wrist_far=(hx + 0.29, hy - 0.235),
        spine_bend=0.03 * depth,
    )

def bridge(single=False, elevated=False):
    """On her back, hips lifted."""
    fy = 0.86
    hy = 0.60 if not elevated else 0.56
    j = dict(
        hip_near=(0.50, hy), hip_far=(0.50, hy + 0.005),
        knee_near=(0.68, 0.66), knee_far=(0.67, 0.665),
        ankle_near=(0.72, fy), ankle_far=(0.71, fy + 0.005),
        toe_near=(0.79, fy), toe_far=(0.78, fy + 0.005),
        shoulder=(0.28, 0.78), neck=(0.23, 0.79), head=(0.17, 0.80),
        tail=(0.20, 0.86),
        elbow_near=(0.26, 0.84), wrist_near=(0.34, fy),
        elbow_far=(0.27, 0.845), wrist_far=(0.35, fy + 0.005),
    )
    if single:  # one leg extended toward the ceiling
        j.update(knee_far=(0.66, 0.52), ankle_far=(0.74, 0.40), toe_far=(0.80, 0.36))
    return pose(**j)

def lying(knees_up=True, reach=False):
    """On her back on the floor."""
    j = dict(
        hip_near=(0.52, 0.76), hip_far=(0.52, 0.765),
        knee_near=(0.68, 0.66), knee_far=(0.67, 0.665),
        ankle_near=(0.74, 0.85), ankle_far=(0.73, 0.855),
        toe_near=(0.81, 0.86), toe_far=(0.80, 0.865),
        shoulder=(0.30, 0.80), neck=(0.25, 0.805), head=(0.19, 0.81),
        tail=(0.22, 0.87),
        elbow_near=(0.31, 0.86), wrist_near=(0.40, 0.87),
        elbow_far=(0.32, 0.865), wrist_far=(0.41, 0.875),
    )
    if not knees_up:  # one heel slid out long
        j.update(knee_far=(0.72, 0.79), ankle_far=(0.88, 0.83), toe_far=(0.93, 0.84))
    return pose(**j)

def sidelying():
    """Side plank: propped on one forearm, body a diagonal."""
    return pose(
        hip_near=(0.56, 0.62), hip_far=(0.56, 0.625),
        knee_near=(0.72, 0.72), knee_far=(0.715, 0.725),
        ankle_near=(0.87, 0.82), ankle_far=(0.865, 0.825),
        toe_near=(0.92, 0.84), toe_far=(0.915, 0.845),
        shoulder=(0.34, 0.46), neck=(0.31, 0.40), head=(0.29, 0.34),
        tail=(0.23, 0.36),
        elbow_near=(0.30, 0.60), wrist_near=(0.24, 0.72),
        elbow_far=(0.38, 0.32), wrist_far=(0.40, 0.18),
    )

def seated():
    """On a chair, one knee lifted."""
    return pose(
        hip_near=(0.44, 0.62), hip_far=(0.44, 0.625),
        knee_near=(0.62, 0.62), knee_far=(0.60, 0.56),
        ankle_near=(0.64, 0.84), ankle_far=(0.70, 0.60),
        toe_near=(0.71, 0.86), toe_far=(0.76, 0.585),
        shoulder=(0.42, 0.36), neck=(0.43, 0.31), head=(0.44, 0.25),
        tail=(0.36, 0.30),
        elbow_near=(0.52, 0.46), wrist_near=(0.58, 0.56),
        elbow_far=(0.51, 0.455), wrist_far=(0.57, 0.555),
    )

def hinge(depth=0.7, single=False):
    """Hips back, flat back, chest toward the floor."""
    j = dict(
        hip_near=(0.46, 0.54), hip_far=(0.46, 0.545),
        knee_near=(0.50, 0.71), knee_far=(0.49, 0.712),
        ankle_near=(0.48, 0.87), ankle_far=(0.47, 0.872),
        toe_near=(0.55, 0.885), toe_far=(0.54, 0.887),
        shoulder=(0.46 + 0.22 * depth, 0.42), neck=(0.46 + 0.28 * depth, 0.40),
        head=(0.46 + 0.34 * depth, 0.38), tail=(0.46 + 0.30 * depth, 0.31),
        elbow_near=(0.46 + 0.26 * depth, 0.52), wrist_near=(0.46 + 0.28 * depth, 0.62),
        elbow_far=(0.46 + 0.25 * depth, 0.525), wrist_far=(0.46 + 0.27 * depth, 0.625),
    )
    if single:
        j.update(knee_far=(0.30, 0.62), ankle_far=(0.16, 0.56), toe_far=(0.10, 0.54))
    return pose(**j)

def split(depth=0.6, elevated=False):
    """Split squat / lunge: one leg forward, back knee down."""
    return pose(
        hip_near=(0.48, 0.56 + 0.06 * depth), hip_far=(0.48, 0.565 + 0.06 * depth),
        knee_near=(0.66, 0.70), knee_far=(0.32, 0.76 + 0.06 * depth),
        ankle_near=(0.68, 0.87), ankle_far=(0.22, 0.87 if not elevated else 0.78),
        toe_near=(0.75, 0.885), toe_far=(0.16, 0.885 if not elevated else 0.79),
        shoulder=(0.47, 0.31 + 0.06 * depth), neck=(0.48, 0.26 + 0.06 * depth),
        head=(0.49, 0.20 + 0.06 * depth), tail=(0.41, 0.25 + 0.06 * depth),
        elbow_near=(0.53, 0.42), wrist_near=(0.55, 0.53),
        elbow_far=(0.52, 0.425), wrist_far=(0.54, 0.535),
    )

def wallsit(depth=1.0):
    """Back to the wall, thighs toward parallel."""
    hy = 0.56 + 0.08 * depth
    return pose(
        hip_near=(0.36, hy), hip_far=(0.36, hy + 0.005),
        knee_near=(0.62, hy + 0.02), knee_far=(0.61, hy + 0.025),
        ankle_near=(0.63, 0.87), ankle_far=(0.62, 0.872),
        toe_near=(0.70, 0.885), toe_far=(0.69, 0.887),
        shoulder=(0.35, hy - 0.26), neck=(0.36, hy - 0.31), head=(0.37, hy - 0.37),
        tail=(0.30, hy - 0.32),
        elbow_near=(0.45, hy - 0.16), wrist_near=(0.52, hy - 0.04),
        elbow_far=(0.44, hy - 0.165), wrist_far=(0.51, hy - 0.045),
    )

def prone(arms="w"):
    """Face down on the floor, arms in W / Y / T."""
    j = dict(
        hip_near=(0.58, 0.72), hip_far=(0.58, 0.725),
        knee_near=(0.74, 0.74), knee_far=(0.735, 0.745),
        ankle_near=(0.89, 0.76), ankle_far=(0.885, 0.765),
        toe_near=(0.93, 0.79), toe_far=(0.925, 0.795),
        shoulder=(0.34, 0.68), neck=(0.28, 0.66), head=(0.22, 0.63),
        tail=(0.27, 0.58),
    )
    if arms == "y":
        j.update(elbow_near=(0.24, 0.58), wrist_near=(0.13, 0.44),
                 elbow_far=(0.25, 0.585), wrist_far=(0.14, 0.445))
    elif arms == "t":
        j.update(elbow_near=(0.30, 0.56), wrist_near=(0.28, 0.44),
                 elbow_far=(0.31, 0.565), wrist_far=(0.29, 0.445))
    else:  # w
        j.update(elbow_near=(0.24, 0.63), wrist_near=(0.22, 0.52),
                 elbow_far=(0.25, 0.635), wrist_far=(0.23, 0.525))
    return pose(**j)

def pike():
    """Hips high, inverted V."""
    return pose(
        hip_near=(0.56, 0.36), hip_far=(0.56, 0.365),
        knee_near=(0.70, 0.60), knee_far=(0.695, 0.605),
        ankle_near=(0.80, 0.85), ankle_far=(0.795, 0.855),
        toe_near=(0.86, 0.87), toe_far=(0.855, 0.875),
        shoulder=(0.38, 0.56), neck=(0.34, 0.62), head=(0.30, 0.68),
        tail=(0.28, 0.60),
        elbow_near=(0.32, 0.70), wrist_near=(0.28, 0.84),
        elbow_far=(0.33, 0.705), wrist_far=(0.29, 0.845),
    )

# ---------- movement → pose

POSES = {
    # push
    "wall-push-up": standing(lean=0.13, arm=("wall", 0)),
    "wide-wall-push-up": standing(lean=0.15, arm=("wall", 0)),
    "wall-push-up-hold": standing(lean=0.16, arm=("wall", 0)),
    "incline-push-up": plank(hip_y=0.60, incline=0.16),
    "wide-incline-push-up": plank(hip_y=0.60, incline=0.18),
    "incline-push-up-hold": plank(hip_y=0.60, incline=0.17),
    "kneeling-push-up": plank(hip_y=0.62, knees=True),
    "wide-kneeling-push-up": plank(hip_y=0.62, knees=True),
    "incline-pike-push-up": pike(),
    "full-push-up": plank(hip_y=0.64),
    "pike-push-up": pike(),
    "decline-push-up": plank(hip_y=0.58, incline=-0.10),
    "archer-push-up": plank(hip_y=0.64, hand_x=0.12),
    # pull
    "shoulder-blade-squeeze": standing(arm=("row", 0)),
    "wall-slide": standing(arm=("up", 0)),
    "prone-w-raise": prone("w"),
    "doorframe-lean-row": standing(lean=-0.12, arm=("hold", 0)),
    "prone-y-raise": prone("y"),
    "doorframe-row": standing(lean=-0.18, arm=("hold", 0)),
    "prone-y-t-w-raise": prone("t"),
    "deep-doorframe-row": standing(lean=-0.24, arm=("hold", 0)),
    "single-arm-doorframe-row": standing(lean=-0.22, arm=("row", 0)),
    "single-arm-doorframe-row-pause": standing(lean=-0.22, arm=("row", 0)),
    # squat
    "supported-sit-to-stand": squat(0.55),
    "high-wall-sit": wallsit(0.55),
    "partial-squat": squat(0.35),
    "sit-to-stand": squat(0.70),
    "wall-sit": wallsit(1.0),
    "half-squat": squat(0.55),
    "air-squat": squat(0.90),
    "sumo-squat": squat(0.85),
    "paused-squat": squat(0.95),
    "split-squat": split(0.6),
    "reverse-lunge": split(0.5),
    "elevated-split-squat": split(0.7, elevated=True),
    "single-leg-sit-to-stand": squat(0.75),
    # hinge
    "glute-bridge": bridge(),
    "glute-bridge-hold": bridge(),
    "standing-hip-hinge": hinge(0.7),
    "glute-bridge-march": bridge(single=True),
    "paused-glute-bridge": bridge(),
    "hinge-and-reach": hinge(0.85),
    "single-leg-glute-bridge": bridge(single=True),
    "feet-elevated-glute-bridge": bridge(elevated=True),
    "single-leg-hip-hinge": hinge(0.8, single=True),
    "hip-thrust": bridge(elevated=True),
    "single-leg-elevated-bridge": bridge(single=True, elevated=True),
    "single-leg-hip-thrust": bridge(single=True, elevated=True),
    # core
    "wall-plank": standing(lean=0.20, arm=("wall", 0)),
    "seated-knee-lift": seated(),
    "lying-heel-slide": lying(knees_up=False),
    "incline-plank": plank(hip_y=0.60, incline=0.14),
    "kneeling-balance-reach": plank(hip_y=0.60, knees=True),
    "lying-heel-tap": lying(knees_up=True),
    "knee-plank": plank(hip_y=0.62, knees=True),
    "knee-side-plank": sidelying(),
    "full-plank": plank(hip_y=0.64),
    "side-plank": sidelying(),
    "plank-shoulder-tap": plank(hip_y=0.64, hand_x=0.16),
    "plank-walkout": plank(hip_y=0.60, hand_x=0.10),
}

PROPS.update({
    # wall work — she faces a wall on her right
    "wall-push-up": [("wall", 0.88)], "wide-wall-push-up": [("wall", 0.88)],
    "wall-push-up-hold": [("wall", 0.88)], "wall-plank": [("wall", 0.90)],
    "wall-slide": [("wall_left", 0.16)],
    "high-wall-sit": [("wall_left", 0.22), ("floor", 0.90)],
    "wall-sit": [("wall_left", 0.22), ("floor", 0.90)],
    # chair / step supported
    "incline-push-up": [("step", (0.02, 0.70)), ("floor", 0.90)],
    "wide-incline-push-up": [("step", (0.02, 0.70)), ("floor", 0.90)],
    "incline-push-up-hold": [("step", (0.02, 0.70)), ("floor", 0.90)],
    "incline-pike-push-up": [("step", (0.02, 0.74)), ("floor", 0.90)],
    "incline-plank": [("step", (0.02, 0.70)), ("floor", 0.90)],
    "decline-push-up": [("step", (0.74, 0.74)), ("floor", 0.90)],
    "supported-sit-to-stand": [("chair", (0.60, 0.66)), ("floor", 0.90)],
    "sit-to-stand": [("chair", (0.60, 0.66)), ("floor", 0.90)],
    "single-leg-sit-to-stand": [("chair", (0.60, 0.66)), ("floor", 0.90)],
    "seated-knee-lift": [("chair", (0.34, 0.64)), ("floor", 0.90)],
    "elevated-split-squat": [("step", (0.06, 0.76)), ("floor", 0.90)],
    "feet-elevated-glute-bridge": [("step", (0.72, 0.72)), ("floor", 0.90)],
    "single-leg-elevated-bridge": [("step", (0.72, 0.72)), ("floor", 0.90)],
    "hip-thrust": [("step", (0.02, 0.72)), ("floor", 0.90)],
    "single-leg-hip-thrust": [("step", (0.02, 0.72)), ("floor", 0.90)],
    # doorframe rows — she leans back from a frame on her right
    "doorframe-lean-row": [("wall", 0.86)], "doorframe-row": [("wall", 0.86)],
    "deep-doorframe-row": [("wall", 0.86)],
    "single-arm-doorframe-row": [("wall", 0.86)],
    "single-arm-doorframe-row-pause": [("wall", 0.86)],
})
# Everything on the floor gets the floor line.
for _mid in ["full-push-up", "kneeling-push-up", "wide-kneeling-push-up",
             "archer-push-up", "pike-push-up", "full-plank", "knee-plank",
             "side-plank", "knee-side-plank", "plank-shoulder-tap",
             "plank-walkout", "kneeling-balance-reach", "glute-bridge",
             "glute-bridge-hold", "glute-bridge-march", "paused-glute-bridge",
             "single-leg-glute-bridge", "lying-heel-slide", "lying-heel-tap",
             "prone-w-raise", "prone-y-raise", "prone-y-t-w-raise",
             "air-squat", "sumo-squat", "paused-squat", "partial-squat",
             "half-squat", "split-squat", "reverse-lunge",
             "standing-hip-hinge", "hinge-and-reach", "single-leg-hip-hinge",
             "shoulder-blade-squeeze"]:
    PROPS.setdefault(_mid, []).append(("floor", 0.90))


def draw_props(d, mid):
    for kind, arg in PROPS.get(mid, []):
        if kind == "wall": prop_wall(d, arg)
        elif kind == "wall_left": prop_wall_left(d, arg)
        elif kind == "floor": prop_floor(d, arg)
        elif kind == "chair": prop_chair(d, arg[0], arg[1])
        elif kind == "step": prop_step(d, arg[0], arg[1])


def render(j, mid=None):
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if mid: draw_props(d, mid)
    figure(d, j)
    return img.resize((PX, PX), Image.LANCZOS)

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    lib = json.load(open(os.path.join(ROOT, "data", "movements.json")))
    ids = [m["id"] for m in lib["movements"]]
    missing = [i for i in ids if i not in POSES]
    extra = [k for k in POSES if k not in ids]
    for mid in ids:
        render(POSES[mid], mid).save(os.path.join(OUT, f"{mid}.png"))
    # React Native needs STATIC require() calls, so the map is generated
    # alongside the art — it can never drift from what exists on disk.
    lines = [
        "// GENERATED by scripts/generate-movement-figures.py — do not edit.",
        "// One line figure per movement (ADR-0013). Rendered as white",
        "// silhouettes so the UI tints them to the theme's accent.",
        "",
        "import type { ImageSourcePropType } from \"react-native\";",
        "",
        "export const movementFigures: Record<string, ImageSourcePropType> = {",
    ]
    for mid in ids:
        lines.append(f'  "{mid}": require("../../assets/movements/{mid}.png"),')
    lines += [
        "};",
        "",
        "/** The figure for a movement, or null when one is missing (a",
        " *  degraded build renders the name alone rather than a hole). */",
        "export function movementFigure(",
        "  movementId: string,",
        "): ImageSourcePropType | null {",
        "  return movementFigures[movementId] ?? null;",
        "}",
        "",
    ]
    map_path = os.path.join(ROOT, "app", "src", "session", "movement-figures.ts")
    with open(map_path, "w") as f:
        f.write("\n".join(lines))
    print(f"rendered {len(ids)} figures -> app/assets/movements/")
    print("wrote app/src/session/movement-figures.ts")
    if missing: print("MISSING POSES:", missing)
    if extra: print("STALE POSES:", extra)
