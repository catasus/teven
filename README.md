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

## 3. Installera appen på TV:n (en gång)
1. TV:n: öppna **Appar**, tryck `1 2 3 4 5` på fjärrkontrollen och slå på **Developer mode**. Ange datorns IP och starta om TV:n.
2. Installera [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) (CLI räcker) och skapa ett Samsung-certifikat i Certificate Manager.
3. Bygg och installera:
   ```
   tizen build-web -- tizen
   tizen package -t wgt -s <din-certifikatprofil> -- tizen/.buildResult
   sdb connect <TV-ens-IP>
   tizen install -n Teven.wgt -t <TV-namn från "sdb devices">
   ```
4. På TV:n: **Inställningar → Allmänt → Smart-funktioner → Starta senaste appen automatiskt** (namnet varierar mellan modeller). Öppna Teven en gång.

Efter det behövs datorn inte mer. Utvecklarläget kan dock stängas av efter en TV-uppdatering, och då måste steg 1 och 3 göras om.
