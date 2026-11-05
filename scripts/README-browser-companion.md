# DropPilot Browser Companion

Der Companion ist ein lokaler, sichtbarer Chromium-Browser für die Produktvorschau. Er läuft auf deinem eigenen Rechner, nicht in Vercel.

## Start

1. Im Repository:
   `npm install`
2. Einmalig Chromium installieren:
   `npx playwright install chromium`
3. Companion starten:
   `npm run companion`
4. DropPilot öffnen und bei einem Profil auf **Website analysieren** klicken.

Der Browser öffnet sich sichtbar und verwendet ein separates, dauerhaftes Profil im Ordner `.droppilot-browser`. Cookies und lokale Sitzungsdaten bleiben dort erhalten. Das normale Chrome-Profil wird ausdrücklich nicht verwendet.

## Verhalten

- Der Server lauscht ausschließlich auf `127.0.0.1:4317`.
- Die Website wird normal im sichtbaren Chromium geöffnet.
- Produktdaten werden aus strukturierten Produktdaten und normalen Seitenelementen gelesen.
- Bei HTTP 403 oder 429 wird die Sperre als solche gemeldet. Es gibt keine Tarnung, CAPTCHA-Umgehung, Queue-Umgehung oder automatischen Wiederholungen.
- Der Companion ist ein lokaler Fallback für die Vorschau. Er ist kein Hintergrund-Monitor und führt keine Käufe aus.

## Sicherheit

- Nur HTTPS-Ziele auf öffentlichen Hosts sind erlaubt.
- Der lokale HTTP-Endpunkt akzeptiert nur die bekannten DropPilot-Web-Ursprünge.
- Das Browserprofil enthält möglicherweise Shop-Cookies. Den Ordner `.droppilot-browser` nicht teilen oder committen.
- Beenden mit `Ctrl+C`.
