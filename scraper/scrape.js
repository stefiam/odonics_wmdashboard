#!/usr/bin/env node
/**
 * Kicktipp Scraper für WM 2026 Dashboard
 *
 * Umgebungsvariablen:
 *   KICKTIPP_USER      - Kicktipp E-Mail
 *   KICKTIPP_PASS      - Kicktipp Passwort
 *   KICKTIPP_COMMUNITY - z.B. "wm-2026-odonics"
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const USER = process.env.KICKTIPP_USER;
const PASS = process.env.KICKTIPP_PASS;
const COMMUNITY = process.env.KICKTIPP_COMMUNITY;
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'kicktipp.json');

if (!USER || !PASS || !COMMUNITY) {
  console.error('ERROR: KICKTIPP_USER, KICKTIPP_PASS und KICKTIPP_COMMUNITY müssen gesetzt sein.');
  process.exit(1);
}

const BASE = `https://www.kicktipp.de/${COMMUNITY}`;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  // ── Login ────────────────────────────────────────────────────────────────
  console.log('🔐 Logging in...');
  await page.goto('https://www.kicktipp.de/info/profil/login', { waitUntil: 'networkidle' });
  await page.fill('#kennung', USER);
  await page.fill('#passwort', PASS);
  await page.click('[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  const loginTitle = await page.title();
  console.log('  Page title after login:', loginTitle);
  if (loginTitle.toLowerCase().includes('login') || loginTitle.toLowerCase().includes('anmeld')) {
    await page.screenshot({ path: 'login-failed.png' });
    throw new Error('Login fehlgeschlagen');
  }
  console.log('✅ Login erfolgreich');

  // ── Tipp-Übersicht laden ─────────────────────────────────────────────────
  console.log('📊 Lade tippuebersicht...');
  await page.goto(`${BASE}/tippuebersicht`, { waitUntil: 'networkidle' });

  // Cookie/DSGVO-Dialog wegklicken falls vorhanden
  try {
    const cookieBtn = page.locator('button:has-text("AKZEPTIEREN"), button:has-text("Akzeptieren"), button:has-text("akzeptieren"), a:has-text("AKZEPTIEREN")').first();
    if (await cookieBtn.isVisible({ timeout: 3000 })) {
      console.log('🍪 Cookie-Dialog gefunden, akzeptiere...');
      await cookieBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    }
  } catch (_) {}

  await page.screenshot({ path: 'tabelle-debug.png', fullPage: true });

  // ── Tabelle parsen ───────────────────────────────────────────────────────
  // Die tippuebersicht zeigt: Spieler als Zeilen, Spiele als Spalten
  // Header-Zeile 1: [leer] [leer] [leer] MEX/SAFR SKOR/CZE ... [leer] [leer] [leer] [leer]
  // Header-Zeile 2: Pos   +/-   Name    [Tipps...]              P      B      S      G
  const result = await page.evaluate(() => {
    const standings = [];
    const matches = [];

    // Alle Tabellen durchsuchen
    const tables = Array.from(document.querySelectorAll('table'));
    console.log('Anzahl Tabellen:', tables.length);

    for (const table of tables) {
      const allRows = Array.from(table.rows);
      if (allRows.length < 3) continue;

      // Alle Header-Zeilen (thead) sammeln
      const theadRows = Array.from(table.querySelectorAll('thead tr'));
      const tbodyRows = Array.from(table.querySelectorAll('tbody tr'));

      if (theadRows.length === 0 && allRows.length > 0) continue;

      // Finde die Header-Zeile die "Pos" enthält
      let statHeaderRow = null;
      let matchHeaderRow = null;
      for (const tr of theadRows) {
        const texts = Array.from(tr.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
        if (texts.some(t => /^(pos|#|rang)$/.test(t))) {
          statHeaderRow = tr;
        } else if (tr.cells.length > 5) {
          matchHeaderRow = tr;
        }
      }

      // Falls keine thead-Zeile mit Pos, schaue in alle Zeilen
      if (!statHeaderRow) {
        for (const tr of allRows.slice(0, 5)) {
          const texts = Array.from(tr.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
          if (texts.some(t => /^(pos|#|rang)$/.test(t))) {
            statHeaderRow = tr;
            break;
          }
        }
      }

      if (!statHeaderRow) continue;

      const statHeaders = Array.from(statHeaderRow.cells).map(c =>
        c.textContent.trim().toLowerCase().replace(/\s+/g, '')
      );
      console.log('Stats-Header gefunden:', statHeaders.join(' | '));

      // Spalten-Indizes aus Stats-Header
      const posIdx = statHeaders.findIndex(h => /^(pos|#|rang)$/.test(h));
      const nameIdx = statHeaders.findIndex(h => /^(name|teilnehmer)$/.test(h));
      // P=exakt, B=tendenz, S=falsch, G=gesamt — letzte 4 Spalten
      const totalCols = statHeaderRow.cells.length;
      const gIdx = totalCols - 1;  // Gesamt
      const sIdx = totalCols - 2;  // Schlecht/Falsch
      const bIdx = totalCols - 3;  // Bonus/Tendenz
      const pIdx = totalCols - 4;  // Exakt

      const effectivePosIdx = posIdx >= 0 ? posIdx : 0;
      const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 2;

      console.log(`Spalten: pos=${effectivePosIdx}, name=${effectiveNameIdx}, P=${pIdx}, B=${bIdx}, S=${sIdx}, G=${gIdx}`);

      // Match-Spalten aus matchHeaderRow (falls vorhanden)
      const matchCols = [];
      if (matchHeaderRow) {
        const matchTexts = Array.from(matchHeaderRow.cells).map((c, i) => ({
          idx: i,
          label: c.textContent.trim().replace(/\s+/g, ' '),
        }));
        for (const mc of matchTexts) {
          // Match-Spalten haben 2 Teamnamen (z.B. "MEX SAFR")
          if (mc.label && mc.idx > effectiveNameIdx && mc.idx < pIdx && mc.label.trim() !== '') {
            matchCols.push(mc);
          }
        }
        console.log('Match-Spalten:', matchCols.map(m => m.label).join(', '));

        // Matches aufbauen
        for (const mc of matchCols) {
          matches.push({
            id: `match_col_${mc.idx}`,
            label: mc.label,
            homeTeam: mc.label.split(' ')[0] || '',
            awayTeam: mc.label.split(' ')[1] || '',
            result: null,
            played: false,
            date: null,
          });
        }
      }

      // Spieler-Zeilen aus tbody
      const dataRows = tbodyRows.length > 0 ? tbodyRows : allRows.slice(theadRows.length);
      for (const row of dataRows) {
        const cells = Array.from(row.cells);
        if (cells.length < 4) continue;

        const posText = cells[effectivePosIdx]?.textContent.trim().replace(/\D/g, '');
        const pos = parseInt(posText);
        if (!pos || pos > 200) continue;

        const name = cells[effectiveNameIdx]?.textContent.trim().split('\n')[0].trim();
        if (!name || name.length < 1 || name.length > 60) continue;

        const pts = parseInt(cells[gIdx]?.textContent.trim()) || 0;
        const exact = parseInt(cells[pIdx]?.textContent.trim()) || 0;
        const tendency = parseInt(cells[bIdx]?.textContent.trim()) || 0;
        const wrong = parseInt(cells[sIdx]?.textContent.trim()) || 0;

        // Trend aus +/- Spalte (direkt nach Pos)
        let trend = 0;
        const trendCell = cells[effectivePosIdx + 1];
        if (trendCell) {
          const cls = (trendCell.className || '') + ' ' + (trendCell.innerHTML || '');
          if (/up|plus|positiv|steig|pfeil-oben/i.test(cls)) trend = 1;
          else if (/down|minus|negativ|fall|pfeil-unten/i.test(cls)) trend = -1;
          const trendText = trendCell.textContent.trim();
          if (trendText === '▲' || trendText === '+') trend = 1;
          else if (trendText === '▼' || trendText === '-') trend = -1;
        }

        // Tipps aus Match-Spalten
        const playerPredictions = {};
        for (const mc of matchCols) {
          const cell = cells[mc.idx];
          if (!cell) continue;
          const tip = cell.textContent.trim();
          if (tip && tip !== '-:-' && tip !== '' && tip !== '-') {
            const cls = cell.className || '';
            playerPredictions[`match_col_${mc.idx}`] = {
              tip,
              exact: /exakt/i.test(cls),
              correct: /richtig|tendenz/i.test(cls) && !/falsch/i.test(cls),
            };
          }
        }

        standings.push({ pos, trend, name, points: pts, exact, tendency, wrong, predictions: playerPredictions });
      }

      if (standings.length > 0) {
        console.log(`Gefunden: ${standings.length} Spieler, ${matches.length} Spiele`);
        break;
      }
    }

    return { standings, matches };
  });

  console.log(`  → ${result.standings.length} Teilnehmer, ${result.matches.length} Spiele`);

  if (result.standings.length === 0) {
    console.log('⚠️  Keine Daten gefunden! Prüfe tabelle-debug.png Screenshot.');
  }

  // ── Merge mit vorherigem JSON (Punkteverlauf erhalten) ───────────────────
  let prev = { standings: [], matches: [] };
  if (fs.existsSync(OUT_PATH)) {
    try { prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); }
    catch (_) {}
  }
  const prevMap = Object.fromEntries((prev.standings || []).map(s => [s.name, s]));

  const mergedStandings = result.standings.map(s => {
    const old = prevMap[s.name] || {};
    const history = [...(old.pointsHistory || [])];
    if (history[history.length - 1] !== s.points) history.push(s.points);
    return {
      ...s,
      posPrev: old.pos ?? s.pos,
      pointsHistory: history,
      isHighlighted: s.name === 'TippJungle',
    };
  });

  const output = {
    lastUpdated: new Date().toISOString(),
    communityName: COMMUNITY,
    standings: mergedStandings,
    matches: result.matches.length > 0 ? result.matches : (prev.matches || []),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✅ Gespeichert: ${mergedStandings.length} Teilnehmer, ${output.matches.length} Spiele`);

  await browser.close();
}

run().catch(err => {
  console.error('❌ Fehler:', err.message, '\n', err.stack);
  process.exit(1);
});
