"""Generate a PLACEHOLDER icon master for StoreShot.

The real icon comes from a user-supplied 1024x1024 `build/icon-master.png`
(see tasks/plan-electron.md). Until then this script creates a simple
stand-in so icon generation and dmg builds can be verified end to end.
DO NOT SHIP the placeholder: replace icon-master.png before signing.
"""
import os

from PIL import Image, ImageDraw

SIZE = 1024
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icon-master.png")

# Dark rounded-square background with a subtle vertical gradient.
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
px = img.load()
radius = 230
for y in range(SIZE):
    t = y / SIZE
    r = int(24 + t * 16)
    g = int(24 + t * 16)
    b = int(30 + t * 20)
    for x in range(SIZE):
        # Rounded-rect mask.
        cx = min(x, SIZE - 1 - x)
        cy = min(y, SIZE - 1 - y)
        if cx < radius and cy < radius:
            dx, dy = radius - cx, radius - cy
            if dx * dx + dy * dy > radius * radius:
                continue
        px[x, y] = (r, g, b, 255)

d = ImageDraw.Draw(img)
# Simple white "screenshot frame" glyph: outer rect + inner mountain/sun.
margin = 250
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin], radius=60,
                    outline=(255, 255, 255, 255), width=44)
d.ellipse([margin + 90, margin + 90, margin + 190, margin + 190],
          fill=(255, 255, 255, 255))
d.polygon([(margin + 60, SIZE - margin - 60),
           (margin + 260, margin + 300),
           (margin + 400, SIZE - margin - 200),
           (margin + 470, SIZE - margin - 120),
           (SIZE - margin - 60, SIZE - margin - 60)],
          fill=(255, 255, 255, 255))

img.save(OUT)
print(f"wrote {OUT}")
