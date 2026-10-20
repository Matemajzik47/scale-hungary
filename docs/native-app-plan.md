# Scale: natív mobilalkalmazás terv

Cél: Android és iOS alkalmazás, ugyanarra a kódra és adatbázisra építve, mint a webes Scale.

## 1. lépés: telepíthető webapp (kész, ezzel a csomaggal)
- A `/manifest.webmanifest`, az ikonok és a service worker (`public/sw.js`) már a repóban van.
- Androidon és asztali Chrome-ban a profilon megjelenő **Telepítés a telefonra** gombbal telepíthető.
- iPhone-on: Safari, Megosztás, Főképernyőhöz adás (a gomb leírja a lépéseket).
- A push értesítés fogadása a service workerben már előkészítve van, a küldő oldal még nincs meg.

## 2. lépés: bolti csomag (Capacitor)
A Capacitor a meglévő webes alkalmazást csomagolja be natív appba, és elérhetővé teszi a natív funkciókat (push, megosztás, rezgés).

Teendők sorrendben:
1. Capacitor telepítése a projektbe (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`).
2. `capacitor.config.ts`: az app azonosítója (pl. `hu.scale.app`), név, és a `server.url`, ami az élő oldalra mutat. Így a webes frissítések az app újabb beadása nélkül is megjelennek.
3. Natív push: `@capacitor/push-notifications`, Android oldalon Firebase Cloud Messaging (FCM), iOS oldalon Apple Push Notification service (APNs).
4. Ikon és betöltőképernyő (a branding elkészülte után véglegesítve).
5. Build és beadás.

## Költségek és feltételek
- **Google Play**: egyszeri regisztrációs díj (kb. 25 USD), Android Studio kell hozzá (Windowson is fut).
- **Apple App Store**: éves fejlesztői díj (kb. 99 USD). iOS build-hez Mac kell, vagy felhős build szolgáltatás (pl. Codemagic, Ionic Appflow).
- A pontos aktuális árakat a Google és az Apple oldalán érdemes ellenőrizni beadás előtt.

## Kockázat: Apple jóváhagyás
Az Apple elutasíthatja azokat az appokat, amelyek csak egy weboldalt jelenítenek meg (App Store Review Guidelines 4.2). Ezért az iOS beadás előtt legyen az appban legalább néhány valódi natív funkció: push értesítés, natív megosztás, rezgés visszajelzés a csúszkán. Ezért ajánlott az **Android-első** sorrend: gyorsabb, olcsóbb, kevesebb a kockázat.

## Javasolt sorrend
1. Webapp (kész) és push küldés szerveroldalon (VAPID, feliratkozások tárolása, ütemezett küldés).
2. Branding és saját domain.
3. Capacitor Android, zárt teszt a Google Playen.
4. iOS, miután az app már natív funkciókat használ.
