# DropPilot

Persönlicher Ticket- und Produkt-Drop-Assistent. V1 ist ein UI- und Profil-Prototyp.

## Aktueller Stand

- Next.js App Router + TypeScript
- Ticket- und Produkt-Suchprofile
- Lokale Speicherung im Browser
- Noch kein Live-Monitoring, kein Push-Versand und keine Checkout-Automatisierung

## Lokal starten

Node.js 20.9 oder neuer:

```bash
npm install
npm run dev
```

## Sicherheit

Nur ausdrücklich erlaubte Shop-Zugriffe verwenden. Keine Umgehung von CAPTCHAs, Warteschlangen, Rate-Limits oder Bot-Schutz. Bei 403/429 pausieren. Keine Zugangsdaten, Cookies oder Zahlungsdaten committen. Zahlungsfreigaben bleiben beim Kontoinhaber.

## Roadmap

1. Supabase-Persistenz und Authentifizierung
2. PWA/Web-Push
3. Ticket-URL-Monitor und Produkt-Discovery über erlaubte Quellen
4. Anbieteradapter mit Capability-/Policy-Prüfung
5. Checkout-Übergabe und sichere Zahlungsfreigabe
