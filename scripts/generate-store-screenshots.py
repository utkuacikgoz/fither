"""App Store screenshots from the approved mockups (docs/store/listing.md §7).

Each shot: the brand ground, one overlay headline in Manrope, and the
mockup phone rendered by headless Chromium at 3.3x, scaled to fit below
the headline and bleeding off the bottom. Sizes: 6.9"/6.7" (1290x2796)
and 6.5" (1284x2778). Output: docs/store/screenshots/.

    python3 scripts/generate-store-screenshots.py
"""
import subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MOCK = ROOT / "docs/design/mockups"
OUT = ROOT / "docs/store/screenshots"
FONT = ROOT / "app/assets/fonts/manrope/Manrope_700Bold.ttf"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

BG = (11, 15, 12)
INK = (245, 247, 245)
ACCENT = (61, 190, 122)
LINE = (38, 48, 42)

# (mockup, overlay) — the five from listing.md §7, in order.
SHOTS = [
    ("sign-in", "Strength that fits your life."),
    ("preview", "10, 20 or 30 minutes. Your call, every day."),
    ("prompt-time", "Four taps. Then you move."),
    ("player-work", "Quiet enough for nap time."),
    ("unlock", "Your first full push-up. It counts."),
]
# App Store Connect accepts these exactly. The 6.9 inch slot takes
# 1290x2796; the 6.5 inch slot takes 1284x2778 or 1242x2688 and rejects
# anything else, so both of its sizes are produced.
SIZES = {"6.9": (1290, 2796), "6.5": (1284, 2778), "6.5-alt": (1242, 2688)}
SCALE = 3.3  # 390 css px * 3.3 = 1287 px wide phone render


def render_phone(name: str, tmp: Path) -> Image.Image:
    raw = tmp / f"{name}.png"
    subprocess.run(
        [CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
         f"--force-device-scale-factor={SCALE}", "--window-size=500,931",
         "--allow-file-access-from-files", f"--screenshot={raw}",
         f"file://{MOCK / name}.html"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    im = Image.open(raw).convert("RGB")
    return im.crop((0, 0, round(390 * SCALE), round(844 * SCALE)))


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def compose(phone: Image.Image, headline: str, size) -> Image.Image:
    W, H = size
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(FONT), int(W * 0.066))
    margin = int(W * 0.08)
    lines = wrap(draw, headline, font, W - 2 * margin)
    y = int(H * 0.055)
    # A short green rule above the headline: the brand's one flourish.
    draw.rounded_rectangle((margin, y, margin + int(W * 0.05), y + 6), 3, fill=ACCENT)
    y += int(W * 0.045)
    line_h = int(font.size * 1.18)
    for line in lines:
        draw.text((margin, y), line, font=font, fill=INK)
        y += line_h
    top = y + int(H * 0.035)
    # Phone: scaled to the width inside the margins, hairline, bleeding off.
    pw = W - 2 * margin
    ph = round(phone.height * pw / phone.width)
    ph_im = rounded(phone.resize((pw, ph), Image.LANCZOS), int(pw * 0.11))
    frame = Image.new("RGBA", (pw + 4, ph + 4), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, pw + 3, ph + 3), int(pw * 0.11) + 2, fill=LINE)
    frame.paste(ph_im, (2, 2), ph_im)
    canvas.paste(frame, (margin - 2, top), frame)
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for index, (name, headline) in enumerate(SHOTS, start=1):
            phone = render_phone(name, tmp)
            for label, size in SIZES.items():
                out = OUT / f"{index:02d}-{name}-{label}.png"
                compose(phone, headline, size).save(out, optimize=True)
                print(out.relative_to(ROOT), size)


if __name__ == "__main__":
    sys.exit(main())
