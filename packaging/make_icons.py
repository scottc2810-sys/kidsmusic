"""Draw Melo's app icon (a purple owl) and write packaging/icons/melo.{png,ico,icns}.

Needs Pillow (build-time only): pip install pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "icons"
OUT.mkdir(exist_ok=True)
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((40, 40, S - 40, S - 40), radius=220, fill="#ffd23f")
d.polygon([(250, 330), (215, 150), (400, 265)], fill="#5236d1")  # ear tufts
d.polygon([(774, 330), (809, 150), (624, 265)], fill="#5236d1")
d.ellipse((190, 200, 834, 900), fill="#6c4cf1")  # body
d.ellipse((330, 500, 694, 880), fill="#ece7ff")  # tummy
for cx in (380, 644):  # eyes
    d.ellipse((cx - 125, 300, cx + 125, 550), fill="white")
    d.ellipse((cx - 62, 365, cx + 62, 489), fill="#2a1a0c")
    d.ellipse((cx - 5, 380, cx + 35, 420), fill="white")
d.polygon([(455, 520), (569, 520), (512, 610)], fill="#ff9f1c")  # beak
img.save(OUT / "melo.png")
img.save(OUT / "melo.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
try:
    img.save(OUT / "melo.icns")
except Exception as e:  # ICNS writing depends on the Pillow build
    print("icns skipped:", e)
print("icons written to", OUT)
