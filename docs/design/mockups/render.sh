#!/bin/sh
# Render a mockup HTML to a 390×844 @2x PNG with the headless Chromium.
# Headless Chromium clamps the viewport to 500px wide and takes 87px for
# chrome, so the page is drawn in a 500×844 viewport and cropped to the
# phone (the .phone box sits at the top-left).
#   sh docs/design/mockups/render.sh sign-in
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
NAME=$1
OUT=${2:-$HERE/out}
mkdir -p "$OUT"
/opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless=new --no-sandbox --disable-gpu \
  --hide-scrollbars --force-device-scale-factor=2 --window-size=500,931 \
  --allow-file-access-from-files --screenshot="$OUT/$NAME.raw.png" "file://$HERE/$NAME.html" 2>/dev/null
python3 - "$OUT/$NAME.raw.png" "$OUT/$NAME.png" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]); im.crop((0, 0, 780, 1688)).save(sys.argv[2])
PY
rm -f "$OUT/$NAME.raw.png"
echo "$OUT/$NAME.png"
