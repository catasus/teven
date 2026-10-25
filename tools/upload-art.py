"""Laddar upp en bild till Art Mode på Samsung The Frame, i full skärm (3840x2160, ingen ram).

Installera en gång:   python -m pip install pillow "samsungtvws[async,encrypted]"
Kör:                  python tools/upload-art.py C:\\sökväg\\bild.jpg
Valfritt:             python tools/upload-art.py bild.jpg --fokus 0.5 0.3
TV:n ska vara på i vanligt läge och på samma wifi. Godkänn anslutningen på TV:n första gången.
"""
import argparse
from io import BytesIO

from PIL import Image, ImageOps
from samsungtvws import SamsungTVWS

TV_IP = "192.168.68.50"

p = argparse.ArgumentParser()
p.add_argument("bild")
p.add_argument("--fokus", nargs=2, type=float, default=[0.5, 0.4], metavar=("X", "Y"),
               help="vilken del som behålls när bilden beskärs, 0-1 (standard 0.5 0.4)")
a = p.parse_args()

img = ImageOps.exif_transpose(Image.open(a.bild)).convert("RGB")
img = ImageOps.fit(img, (3840, 2160), Image.LANCZOS, centering=tuple(a.fokus))
buf = BytesIO()
img.save(buf, "JPEG", quality=92)

tv = SamsungTVWS(host=TV_IP, port=8002, token_file="tv-token.txt")
art = tv.art()
content_id = art.upload(buf.getvalue(), matte="none", portrait_matte="none", file_type="JPEG")
try:
    art.change_matte(content_id, "none")
except Exception as e:
    print("Kunde inte stänga av ramen:", e)
art.select_image(content_id)
art.set_artmode(True)
print("Klart, id:", content_id)
