"""Startar TV:ns webbläsare och skriver in lösenordet åt dig.

Ställ först in https://bajen.land/ som startsida i TV:ns Internet-app (en gång). Då öppnas sidan av sig själv.

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
import urllib3

urllib3.disable_warnings()  # TV:ns REST-gränssnitt har ett självsignerat certifikat; varningen är irrelevant här

# Vissa Samsung-TV:ar (bl.a. Frame 2020) skickar flera extra meddelanden (touchDisable, touchEnable m.fl.)
# före själva anslutningsbeskedet. Biblioteket tolkar det som ett fel, så vi säger åt det att ignorera dem i starten.
# Anslutningsbeskedet, "ej godkänd" och fel släpps igenom som vanligt.
class _IgnoreAtStartup:
    def __init__(self, original):
        self.original = tuple(original)

    def __contains__(self, event):
        e = str(event)
        return e in self.original or e.startswith(("ms.remote.", "ms.channel.client", "ms.channel.ready"))


_conn.IGNORE_EVENTS_AT_STARTUP = _IgnoreAtStartup(_conn.IGNORE_EVENTS_AT_STARTUP)

VERSION = 7
TV_IP = "192.168.68.50"
URL = "https://bajen.land/"
TOKEN_FILE = "tv-token.txt"

p = argparse.ArgumentParser()
p.add_argument("--test", action="store_true", help="öppna bara sidan, skriv inget")
p.add_argument("--vantan", type=float, default=10, help="sekunder att vänta på att sidan laddar (standard 10)")
p.add_argument("--utan-enter", action="store_true", help="skriv lösenordet men tryck inte Enter")
p.add_argument("--url", default=URL)
p.add_argument("--metod", type=int, default=5, choices=[1, 2, 3, 4, 5], help="hur sidan öppnas (se --metoder)")
p.add_argument("--metoder", action="store_true", help="prova de olika sätten att öppna sidan och se vilket som fungerar")
p.add_argument("--diagnos", action="store_true", help="prova stegen ett i taget och skriv ut vad TV:n svarar")
a = p.parse_args()
print(f"bajen.py version {VERSION}")

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


def oppna_sida(metod, url):
    """Fyra sätt att få TV:ns webbläsare att öppna en adress."""
    if metod == 5:
        # Startar bara webbläsaren (så som det funkade i --diagnos). Sidan som visas är webbläsarens startsida,
        # så ställ in https://bajen.land/ som startsida i TV:ns Internet-app.
        r = tv.rest_app_run("org.tizen.browser")
        print("  TV:n svarade:", r)
        return
    if metod in (3, 4):  # börja om från startmenyn så att webbläsaren startar från noll
        tv.send_key("KEY_HOME")
        time.sleep(3)
    typ = "NATIVE_LAUNCH" if metod in (1, 3) else "DEEP_LINK"
    tv.run_app("org.tizen.browser", typ, url)


if a.metoder:
    print("Jag provar fyra sätt att öppna", a.url, "på TV:n. Titta på TV:n efter varje.")
    for m in (1, 2, 3, 4):
        input(f"\nMetod {m}: tryck Enter för att prova … ")
        forsok(f"metod {m}", lambda m=m: oppna_sida(m, a.url))
        time.sleep(8)
        if input("Öppnades bajen.land? (j/n): ").strip().lower().startswith("j"):
            print(f"\nBra! Använd: python bajen.py --metod {m}")
            break
    else:
        print("\nIngen av metoderna öppnade sidan. Berätta det för Claude.")
    tv.close()
    raise SystemExit(0)

if a.diagnos:
    def tv_handelse(event, response):
        print("   TV säger:", event, str(response)[:160])

    print("1) Frågar TV:n om den själv (utan fjärrkontroll):")
    try:
        info = tv.rest_device_info().get("device", {})
        for k in ("modelName", "PowerState", "FrameTVSupport", "TokenAuthSupport", "OS", "WifiMac"):
            if k in info:
                print(f"   {k}: {info[k]}")
    except Exception as e:  # noqa: BLE001
        print("   Fick inget svar:", type(e).__name__, e)
    print("2) Skickar knapptryck HOME. Titta på TV:n: kommer startmenyn upp?")
    tv.start_listening(callback=tv_handelse)
    time.sleep(1)
    tv.send_key("KEY_HOME")
    time.sleep(4)
    print("3) Startar webbläsaren (via REST). Titta på TV:n: öppnas Internet-appen?")
    try:
        print("   Svar:", tv.rest_app_run("org.tizen.browser"))
    except Exception as e:  # noqa: BLE001
        print("   Misslyckades:", type(e).__name__, e)
    time.sleep(5)
    print(f"4) Öppnar {a.url} i webbläsaren (via anslutningen). Titta på TV:n.")
    tv.open_browser(a.url)
    time.sleep(6)
    try:
        print("5) Webbläsarens status:", tv.rest_app_status("org.tizen.browser"))
    except Exception as e:  # noqa: BLE001
        print("5) Kunde inte läsa webbläsarens status:", type(e).__name__, e)
    tv.close()
    print("Klart. Berätta för Claude vad du såg på TV:n vid steg 2, 3 och 4, och klistra in texten ovan.")
    raise SystemExit(0)

password = ""
if not a.test:
    password = getpass.getpass("Lösenord för bajen.land (syns inte när du skriver): ")

print("Öppnar", a.url, "på TV:n …")
forsok("öppna webbläsaren", lambda: oppna_sida(a.metod, a.url))

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
