#!/usr/bin/env python3
"""Render the recipient page for every scenario to web/preview/<scenario>.png.

Serves web/ on a local port with the same `/s/*` rewrite a static host
applies, so each preview goes through the real path parsing in app.js,
then screenshots with the pinned headless Chromium at 390 CSS px, 2x.
The flags mirror docs/design/mockups/render.sh: the 500 px window is the
narrowest headless Chromium allows, the page centres its 390 px column,
and the crop keeps that column (780 device px).

    python3 web/scripts/preview.py
"""
import http.server
import subprocess
import sys
import threading
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
OUT = WEB / "preview"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
SCENARIOS = [
    "friends_week", "between_meetings", "away_from_home", "quiet_house",
    "session", "week",
]
WINDOW = (500, 931)
COLUMN = 390
SCALE = 2


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/s/"):
            clean = "/s/index.html"
        return super().translate_path(clean)

    def log_message(self, *args):
        pass


def shoot(base, route, name):
    raw = OUT / f"{name}.raw.png"
    subprocess.run(
        [
            CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
            "--hide-scrollbars", f"--force-device-scale-factor={SCALE}",
            f"--window-size={WINDOW[0]},{WINDOW[1]}",
            "--proxy-server=direct://", "--proxy-bypass-list=*",
            "--virtual-time-budget=5000",
            f"--screenshot={raw}", f"{base}{route}",
        ],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    im = Image.open(raw)
    left = (WINDOW[0] - COLUMN) // 2 * SCALE
    im.crop((left, 0, left + COLUMN * SCALE, im.height)).save(OUT / f"{name}.png", optimize=True)
    raw.unlink()
    return OUT / f"{name}.png"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"
    try:
        for name in SCENARIOS:
            print(shoot(base, f"/s/{name}", name))
        print(shoot(base, "/", "generic"))
    finally:
        server.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
