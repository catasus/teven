"""Öppnar bajen.land i TV:ns webbläsare och skriver in lösenordet åt dig.

Installera en gång:  python -m pip install "samsungtvws[async,encrypted]"
Kör:                 python tools/bajen.py
                     python tools/bajen.py --test     (bara öppnar sidan, skriver inget)

TV:n ska vara på i vanligt läge och på samma wifi som datorn.
Första gången frågar TV:n om du tillåter anslutningen: godkänn med fjärrkontrollen.
Lösenordet skrivs dolt, sparas inte och skickas bara till din TV på hemnätverket.
"""
import argparse
import base64
import getpass
import json
import time

from samsungtvws import SamsungTVWS
import samsungtvws.connection as _conn

# Vissa Samsung-TV:ar (bl.a. Frame 2020) skickar "touchDisable" före själva anslutningsbeskedet.
# Biblioteket tolkar det som ett fel, så vi säger åt det att ignorera det i starten.
_conn.IGNORE_EVENTS_AT_STARTUP = tuple(_conn.IGNORE_EVENTS_AT_STARTUP) + ("ms.remote.touchDisable",)

TV_IP = "192.168.68.50"
URL = "http://bajen.land"
TOKEN_FILE = "tv-token.txt"

p = argparse.ArgumentParser()
p.add_argument("--test", action="store_true", help="öppna bara sidan, skriv inget")
p.add_argument("--vantan", type=float, default=10, help="sekunder att vänta på att sidan laddar (standard 10)")
p.add_argument("--utan-enter", action="store_true", help="skriv lösenordet men tryck inte Enter")
p.add_argument("--url", default=URL)
a = p.parse_args()

tv = SamsungTVWS(host=TV_IP, port=8002, token_file=TOKEN_FILE)


def forsok(vad, fn, antal=3):
    """Kör fn och försöker igen några gånger om TV:n inte svarar direkt."""
    for i in range(1, antal + 1):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            print(f"  {vad}: försök {i}/{antal} misslyckades ({type(e).__name__}: {e})")
            try:
                tv.close()
            except Exception:  # noqa: BLE001
                pass
            if i == antal:
                raise
            time.sleep(2)


password = ""
if not a.test:
    password = getpass.getpass("Lösenord för bajen.land (syns inte när du skriver): ")

print("Öppnar", a.url, "på TV:n …")
forsok("öppna webbläsaren", lambda: tv.open_browser(a.url))

if a.test:
    print("Klart. Sidan ska nu öppnas på TV:n. Inget skrevs.")
    raise SystemExit(0)

print(f"Väntar {a.vantan:.0f} s på att sidan laddar …")
time.sleep(a.vantan)

# Skicka texten på samma sätt som Samsungs fjärrkontroll-app gör när du skriver med telefonens tangentbord
msg = {
    "method": "ms.remote.control",
    "params": {
        "Cmd": base64.b64encode(password.encode("utf-8")).decode("ascii"),
        "DataOfCmd": "base64",
        "Option": "false",
        "TypeOfRemote": "SendInputString",
    },
}


def skriv():
    if tv.connection is None:
        tv.open()
    tv.connection.send(json.dumps(msg))


forsok("skriva lösenordet", skriv)
time.sleep(1.5)
if not a.utan_enter:
    forsok("trycka Enter", lambda: tv.send_key("KEY_ENTER"))
print("Klart. Titta på TV:n.")
