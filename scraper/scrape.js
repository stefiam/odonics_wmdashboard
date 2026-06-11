#!/usr/bin/env node
/**
 * Kicktipp Scraper für WM 2026 Dashboard
 *
 * Umgebungsvariablen (required):
 *   KICKTIPP_USER      - Kicktipp E-Mail/Username
 *   KICKTIPP_PASS      - Kicktipp Passwort
 *   KICKTIPP_COMMUNITY - Community-Name in der URL (z.B. "mein-tippspiel")
 *
 * Output: ../public/data/kicktipp.json
 *
 * Usage:
 *   KICKTIPP_USER=x KICKTIPP_PASS=y KICKTIPP_COMMUNITY=z node scrape.js
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

  const title = await page.title();
  if (title.toLowerCase().includes('login') || title.toLowerCase().includes('anmelden')) {
    await page.screenshot({ path: 'login-failed.png' });
    throw new Error('Login fehlgeschlagen – Screenshot: login-failed.png');
  }
  console.log('✅ Login erfolgreich');

  // ── Standings (Tabelle) ──────────────────────────────────────────────────
  console.log('📊 Lade Tabelle...');
  await page.goto(`${BASE}/tabelle`, { waitUntil: 'networkidle' });

  const standings = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table.tabelle tr, table.ranking tr, #ranking tr, .tabelle tbody tr'));
    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 4) return null;

      // Kicktipp-Tabellenstruktur: Pos | +/- | Name | P | B | S | G
      const text = cells.map(c => c.textContent.trim());
      const nameCell = cells[2] || cells[1];
      const name = nameCell ? nameCell.textContent.trim() : '';

      // +/- Spalte: positiv/negativ Icon oder Zahl
      const trendCell = cells[1];
      let trend = 0;
      if (trendCell) {
        const trendText = trendCell.textContent.trim();
        if (trendText.match(/^\d+$/)) trend = parseInt(trendText);
        else if (trendCell.querySelector('.arrow-up, .positiv')) trend = 1;
        else if (trendCell.querySelector('.arrow-down, .negativ')) trend = -1;
      }

      return {
        pos: parseInt(text[0]) || 0,
        trend,
        name,
        points: parseInt(text[3]) || parseInt(text[text.length - 1]) || 0,
        exact: parseInt(text[4]) || 0,
        tendency: parseInt(text[5]) || 0,
        wrong: parseInt(text[6]) || 0,
      };
    }).filter(r => r && r.name && r.pos > 0);
  });

  console.log(`  → ${standings.length} Teilnehmer gefunden`);

  if (standings.length === 0) {
    await page.screenshot({ path: 'tabelle-debug.png' });
    console.warn('⚠️  Keine Tabellendaten gefunden – Screenshot: tabelle-debug.png');
    console.warn('   Bitte CSS-Selektoren in scrape.js anpassen.');
  }

  // ── Matches + Tipp-Details ──────────────────────────────────────────────
  console.log('🎯 Lade Tipp-Übersicht...');
  await page.goto(`${BASE}/tippuebersicht`, { waitUntil: 'networkidle' });

  const { matches, predictions } = await page.evaluate(() => {
    const matches = [];
    const predictions = {}; // { matchId: { playerName: { tip, points } } }

    // Spieltage-Tabs oder direkte Tabelle
    const matchHeaders = document.querySelectorAll('.spiel, .spieltag-spiel, [data-matchid], .tippuebersicht-spiel');
    const tableRows = document.querySelectorAll('.tippuebersicht table tr, table.tippTabelle tr');

    // Approach: Kopfzeilen extrahieren (Spiele), dann Tipps pro Spieler
    const headerRow = document.querySelector('.tippuebersicht thead tr, table thead tr');
    if (headerRow) {
      const cols = Array.from(headerRow.querySelectorAll('th'));
      // erste Spalten sind Spieler-Infos, dann kommen Spiele
      cols.forEach((col, i) => {
        const text = col.textContent.trim();
        const tooltip = col.title || col.getAttribute('data-title') || text;
        if (i > 1 && text && !text.match(/^(Name|Pos|Pkt|G)$/i)) {
          matches.push({
            id: `match_${i}`,
            label: tooltip || text,
            colIndex: i,
          });
        }
      });
    }

    // Tipp-Zeilen
    const bodyRows = document.querySelectorAll('.tippuebersicht tbody tr, table.tippTabelle tbody tr');
    bodyRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 3) return;
      const playerName = (cells[1] || cells[0]).textContent.trim();
      if (!playerName) return;

      predictions[playerName] = {};
      matches.forEach(m => {
        const cell = cells[m.colIndex];
        if (!cell) return;
        const tip = cell.textContent.trim();
        const points = parseInt(cell.getAttribute('data-points') || cell.title || '0') || 0;
        if (tip && tip !== '-:-' && tip !== '---') {
          predictions[playerName][m.id] = { tip, points };
        }
      });
    });

    return {
      matches: matches.map(({ id, label }) => ({
        id,
        label,
        played: false,
        result: null,
        date: null,
      })),
      predictions,
    };
  });

  console.log(`  → ${matches.length} Spiele, ${Object.keys(predictions).length} Tipp-Sets`);

  // ── Merge mit vorherigem JSON (Punkteverlauf erhalten) ───────────────────
  let prev = { standings: [], matches: [], lastUpdated: null };
  if (fs.existsSync(OUT_PATH)) {
    try { prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); }
    catch (_) { /* ignore */ }
  }

  const prevMap = Object.fromEntries((prev.standings || []).map(s => [s.name, s]));

  const mergedStandings = standings.map(s => {
    const old = prevMap[s.name] || {};
    const history = old.pointsHistory || [];
    // Neuen Punkt nur anhängen wenn er sich geändert hat
    const lastPts = history[history.length - 1];
    if (lastPts !== s.points) history.push(s.points);
    return {
      ...s,
      posPrev: old.pos ?? s.pos,
      pointsHistory: history,
      isHighlighted: s.name === 'TippJungle',
      predictions: predictions[s.name] || old.predictions || {},
    };
  });

  const output = {
    lastUpdated: new Date().toISOString(),
    communityName: COMMUNITY,
    standings: mergedStandings,
    matches: matches.length > 0 ? matches : (prev.matches || []),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✅ Daten gespeichert: ${OUT_PATH}`);
  console.log(`   ${mergedStandings.length} Teilnehmer, ${output.matches.length} Spiele`);

  await browser.close();
}

run().catch(err => {
  console.error('❌ Scraper Fehler:', err.message);
  process.exit(1);
});
