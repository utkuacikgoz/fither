#!/usr/bin/env python3
"""Copy the self-hosted fonts and pre-tint the figures for the recipient page.

Sources live in app/assets (the app's own files); this script never edits
them. Figures are alpha shapes; the tint keeps the alpha and paints the
shape in the accent (#3DBE7A) so the page needs no CSS mask support.

    python3 web/scripts/build-assets.py
"""
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app" / "assets"
WEB = ROOT / "web" / "assets"
ACCENT = (0x3D, 0xBE, 0x7A)

# Figures the page uses, by movement id. Keep in sync with web/src/content.mjs.
FIGURES = [
    "sit-to-stand", "wall-push-up", "glute-bridge", "air-squat",
    "kneeling-push-up", "split-squat", "standing-hip-hinge",
]
FIGURE_PX = 360  # 180 CSS px at 2x
MARK_PX = 64     # 22 CSS px at 2x, with room


def tint(src: Path, dst: Path, size: int) -> None:
    im = Image.open(src).convert("RGBA")
    alpha = im.split()[3]
    out = Image.new("RGBA", im.size, ACCENT + (0,))
    out.putalpha(alpha)
    out = out.resize((size, size), Image.LANCZOS)
    out.save(dst, optimize=True)


def main() -> int:
    (WEB / "fonts").mkdir(parents=True, exist_ok=True)
    (WEB / "figures").mkdir(parents=True, exist_ok=True)
    for f in ["Manrope_400Regular.ttf", "Manrope_500Medium.ttf",
              "Manrope_600SemiBold.ttf", "Manrope_700Bold.ttf", "LICENSE.txt"]:
        shutil.copyfile(APP / "fonts" / "manrope" / f, WEB / "fonts" / f)
    for name in FIGURES:
        tint(APP / "movements" / f"{name}.png", WEB / "figures" / f"{name}.png", FIGURE_PX)
    tint(APP / "brand" / "mark.png", WEB / "mark.png", MARK_PX)
    print(f"fonts: 4, figures: {len(FIGURES)}, mark: 1 -> {WEB}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
