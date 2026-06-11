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

  // Debug-Screenshot immer speichern
  await page.screenshot({ path: 'tabelle-debug.png', fullPage: true });

  // HTML-Struktur ausgeben um Selektoren zu debuggen
  const pageInfo = await page.evaluate(() => {
    const allTables = Array.from(document.querySelectorAll('table'));
    const tableInfo = allTables.map(t => ({
      id: t.id,
      classes: t.className,
      rows: t.querySelectorAll('tr').length,
      firstRow: t.querySelector('tr')?.textContent?.trim().substring(0, 100),
    }));
    return {
      url: window.location.href,
      title: document.title,
      tables: tableInfo,
      bodySnippet: document.body.innerHTML.substring(0, 500),
    };
  });
  console.log('📄 Seiten-Info:', JSON.stringify(pageInfo, null, 2));

  const standings = await page.evaluate(() => {
    // Alle Tabellen-Zeilen versuchen
    const allRows = Array.from(document.querySelectorAll('table tr'));
    const results = [];

    for (const row of allRows) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 3) continue;
      const text = cells.map(c => c.textContent.trim().replace(/\s+/g, ' '));

      // Erste Spalte muss eine Zahl (Rang) sein
      const pos = parseInt(text[0]);
      if (!pos || pos > 100) continue;

      // Name-Spalte: nimm die längste nicht-numerische Zelle
      let name = '';
      let nameIdx = -1;
      for (let i = 1; i < cells.length; i++) {
        const t = text[i];
        if (t && isNaN(t) && t.length > name.length && t.length < 40 && !t.includes('\n')) {
          name = t;
          nameIdx = i;
        }
      }
      if (!name) continue;

      // Zahlen nach dem Namen = Statistiken
      const nums = text.slice(nameIdx + 1).map(t => parseInt(t)).filter(n => !isNaN(n));

      results.push({
        pos,
        trend: 0,
        name,
        points: nums[nums.length - 1] || 0,
        exact: nums[0] || 0,
        tendency: nums[1] || 0,
        wrong: nums[2] || 0,
      });
    }
    return results;
  });

  console.log(`  → ${standings.length} Teilnehmer gefunden`);

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
