# WM 2026 Tippspiel Dashboard

Modernes Dashboard für ein Kicktipp-Tippspiel. Scrapt automatisch täglich die Daten und deployt auf GitHub Pages.

## Setup (einmalig, ~10 Minuten)

### 1. GitHub Repo anlegen
Neues Repo erstellen: `wm2026-dashboard` (öffentlich oder privat, beides funktioniert).

```bash
git init
git remote add origin https://github.com/DEIN-USERNAME/wm2026-dashboard.git
git add .
git commit -m "initial commit"
git push -u origin main
```

### 2. GitHub Secrets setzen
Im GitHub Repo → Settings → Secrets and variables → Actions → New repository secret:

| Name | Wert |
|------|------|
| `KICKTIPP_USER` | Deine Kicktipp E-Mail |
| `KICKTIPP_PASS` | Dein Kicktipp Passwort |
| `KICKTIPP_COMMUNITY` | Community-Name aus der URL (z.B. `mein-tippspiel`) |

Den Community-Namen findest du in der Kicktipp-URL: `https://www.kicktipp.de/COMMUNITY-NAME/tabelle`

### 3. GitHub Pages aktivieren
Repo → Settings → Pages → Source: **Deploy from a branch** → Branch: `gh-pages` → Save

### 4. Ersten Run starten
Repo → Actions → "Kicktipp Scraper + Deploy" → Run workflow

Nach ~2 Minuten ist das Dashboard live unter:
`https://DEIN-USERNAME.github.io/wm2026-dashboard/`

### 5. vite.config.js anpassen (falls Repo anders heißt)
```js
base: '/DEIN-REPO-NAME/',
```

---

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Scraper lokal testen:
```bash
cd scraper
KICKTIPP_USER=xxx KICKTIPP_PASS=yyy KICKTIPP_COMMUNITY=zzz node scrape.js
```

---

## Automatische Updates

GitHub Actions läuft täglich um **10:00 und 22:00 Uhr CEST** (8:00 / 20:00 UTC).
Manueller Start jederzeit via Actions → Run workflow.

---

## Scraper-Selektoren anpassen

Falls der Scraper keine Daten findet, erscheint ein Screenshot `tabelle-debug.png` im Scraper-Ordner.
Die CSS-Selektoren in `scraper/scrape.js` müssen dann an die aktuelle Kicktipp-HTML-Struktur angepasst werden.
