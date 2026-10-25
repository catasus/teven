# Teven – egen startskärm till Samsung The Frame

Visar klocka, datum, vecka, väder och din Google-kalender i helskärm när TV:n startar, i stället för Samsungs startskärm.

```
docs/      Webbsidan (publiceras med GitHub Pages)
tizen/     Den lilla TV-appen som bara öppnar webbsidan
scripts/   Hämtar din kalender till docs/events.json
```

## 1. Publicera webbsidan
1. Repo → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, mapp `/docs`.
2. Adressen blir `https://catasus.github.io/teven/`. Stämmer inte den, ändra `URL_TO_OPEN` i `tizen/index.html`.
3. Ändra stad och koordinater i `docs/config.js`.

## 2. Koppla kalendern
1. Google Calendar → inställningar för din kalender → **Hemlig adress i iCal-format**, kopiera länken.
2. GitHub → repo → **Settings → Secrets and variables → Actions → New secret**: namn `CALENDAR_ICS_URL`, värde länken. Flera kalendrar: skilj länkarna med mellanslag.
3. Actions-fliken → *Uppdatera kalender* → **Run workflow**. Därefter uppdateras den var 15:e minut.

Länken ger läsåtkomst till hela kalendern, så lägg den aldrig i en fil i repot.

## 2b. Barnens matcher och träningar
Skapa ytterligare en secret, `KIDS_ICS_URLS`, med en länk per rad och barnets namn före `|`:
```
Otis|https://cal.laget.se/HogalidsIF-Innebandy-P13IB.ics
Melker|https://portalweb.sportadmin.se/webcal?id=<ditt-id>
```
`webcal://` fungerar också. Passen visas i en egen ruta under kalendern, för de kommande 7 dagarna. Länken från SportAdmin innehåller ett id som fungerar som lösenord, så lägg den bara i secreten.

## 2c. Läxor och prov (InfoMentor)
Skapa en tredje secret, `HOMEWORK_ICS_URLS`, med InfoMentors kalenderlänk för varje barn:
```
Otis|webcals://im2-api.infomentor.se/...
Melker|webcals://im2-api.infomentor.se/...
```
Allt som finns i kalendern (läxor, prov med mera) visas i rutan "Läxor & prov", med de närmaste 14 dagarna och eventuell beskrivning. Länkarna ger tillgång till barnens uppgifter, så lägg dem bara i secreten.

## 3. Installera appen på TV:n (en gång, från Mac)
1. **TV:n:** öppna **Appar**, tryck `1 2 3 4 5` på fjärrkontrollen, slå på **Developer mode** och skriv in Macens IP-adress (Systeminställningar → Nätverk). Starta om TV:n.
2. **Tizen Studio:** ladda ner till Mac från https://developer.tizen.org/development/tizen-studio/download och installera. Öppna **Package Manager** och installera *TV Extensions* under Extension SDK.
3. **Certifikat:** i Tizen Studio, *Tools → Certificate Manager → +*. Välj **Samsung**, **TV**, logga in med ett Samsung-konto, ange TV:ns DUID (ställs in när den är ansluten) och ge profilen ett namn, till exempel `TevenProfil`.
4. **Kör skriptet** i Terminal, från repots mapp:
   ```
   tools/install-tv.sh <TV-ens IP-adress> TevenProfil
   ```
5. På TV:n: **Inställningar → Allmänt → Smart-funktioner**, leta efter en inställning för att starta senaste appen automatiskt (namnet varierar mellan modeller).

Efter det behövs datorn inte mer. Utvecklarläget kan stängas av efter en TV-uppdatering, och då måste steg 1 och 4 göras om.

## Uppdatera sidan
Efter en ändring i `docs/` ska `build` bytas i både `docs/index.html` (meta-taggen) och `docs/build.json`. TV:n kollar var 15:e minut och laddar då om sidan själv, så du slipper starta om appen.
