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

// ── HTML-Analyse-Helfer ──────────────────────────────────────────────────────
function dumpTables(document) {
  const tables = Array.from(document.querySelectorAll('table'));
  return {
    title: document.title,
    url: location.href,
    tableCount: tables.length,
    tables: tables.map((t, i) => ({
      index: i,
      id: t.id,
      classes: t.className,
      rowCount: t.rows.length,
      colCount: t.rows[0] ? t.rows[0].cells.length : 0,
      headerRow: Array.from((t.querySelector('thead tr') || t.rows[0])?.cells || [])
        .map(c => c.textContent.trim().replace(/\s+/g, ' ').substring(0, 30)),
      row1: Array.from(t.rows[1]?.cells || [])
        .map(c => c.textContent.trim().replace(/\s+/g, ' ').substring(0, 25)),
      row2: Array.from(t.rows[2]?.cells || [])
        .map(c => c.textContent.trim().replace(/\s+/g, ' ').substring(0, 25)),
    })),
  };
}

// ── Standings aus Ranglisten-Tabelle ────────────────────────────────────────
function parseStandingsTable(table) {
  const standings = [];
  const rows = Array.from(table.rows);
  const headerRow = table.querySelector('thead tr') || rows[0];
  const headers = Array.from(headerRow.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));

  let posIdx = headers.findIndex(h => /^(pos|rang|#|platz)$/.test(h));
  let nameIdx = headers.findIndex(h => /^(name|teilnehmer|spieler)$/.test(h));
  let ptsIdx = headers.findIndex(h => /^(g|gesamt|pkt|punkte)$/.test(h));
  let exactIdx = headers.findIndex(h => /^(p|exakt|richtig)$/.test(h));
  let tendIdx = headers.findIndex(h => /^(b|tendenz|bonus)$/.test(h));
  let wrongIdx = headers.findIndex(h => /^(s|falsch|schlecht)$/.test(h));

  if (posIdx === -1) posIdx = 0;
  if (nameIdx === -1) nameIdx = 2;
  if (ptsIdx === -1) ptsIdx = headers.length - 1;

  const bodyRows = Array.from(table.tBodies[0]?.rows || rows.slice(1));
  for (const row of bodyRows) {
    const cells = Array.from(row.cells);
    if (cells.length < 3) continue;

    const posText = cells[posIdx]?.textContent.trim().replace(/\D/g, '');
    const pos = parseInt(posText);
    if (!pos || pos > 200) continue;

    const name = cells[nameIdx]?.textContent.trim().split('\n')[0].trim();
    if (!name || name.length < 1 || name.length > 50) continue;

    const pts = parseInt(cells[ptsIdx]?.textContent.trim()) || 0;
    const exact = exactIdx >= 0 ? (parseInt(cells[exactIdx]?.textContent.trim()) || 0) : 0;
    const tendency = tendIdx >= 0 ? (parseInt(cells[tendIdx]?.textContent.trim()) || 0) : 0;
    const wrong = wrongIdx >= 0 ? (parseInt(cells[wrongIdx]?.textContent.trim()) || 0) : 0;

    let trend = 0;
    const trendCell = cells[posIdx + 1];
    if (trendCell) {
      const cls = (trendCell.className || '') + ' ' + (trendCell.innerHTML || '');
      if (/up|plus|positiv|steig|arrow-up/i.test(cls)) trend = 1;
      else if (/down|minus|negativ|fall|arrow-down/i.test(cls)) trend = -1;
    }

    standings.push({ pos, trend, name, points: pts, exact, tendency, wrong });
  }
  return standings;
}

// ── Predictions aus Tipp-Übersicht-Tabelle (Spiele als Zeilen) ─────────────
function parseTippuebersichtTable(table) {
  const matches = [];
  const predictions = {};
  const rows = Array.from(table.rows);

  // Headerzeile analysieren
  const headerRow = table.querySelector('thead tr') || rows[0];
  const headers = Array.from(headerRow.cells).map(c =>
    c.textContent.trim().replace(/\s+/g, ' ')
  );

  // Finde Spalten für: Heim, Gast, Gruppe, Ergebnis
  let heimIdx = headers.findIndex(h => /^(heim|home)$/i.test(h));
  let gastIdx = headers.findIndex(h => /^(gast|away)$/i.test(h));
  let gruppeIdx = headers.findIndex(h => /^(gruppe|group)$/i.test(h));
  let ergebnisIdx = headers.findIndex(h => /^(ergebnis|result|erg)$/i.test(h));
  let datumIdx = headers.findIndex(h => /^(datum|date|zeit|time)$/i.test(h));

  if (gastIdx === -1) gastIdx = 1;
  if (ergebnisIdx === -1) ergebnisIdx = 3;

  // Spieler-Spalten = alles nach den Match-Infospalten
  const fixedCols = new Set([heimIdx, gastIdx, gruppeIdx, ergebnisIdx, datumIdx, 0].filter(i => i >= 0));
  const playerCols = [];
  for (let i = 0; i < headers.length; i++) {
    if (!fixedCols.has(i) && headers[i]) {
      playerCols.push({ idx: i, name: headers[i] });
    }
  }

  // Spieler-Namen initialisieren
  playerCols.forEach(pc => { predictions[pc.name] = []; });

  // Spielzeilen parsen
  const bodyRows = Array.from(table.tBodies[0]?.rows || rows.slice(1));
  for (const row of bodyRows) {
    const cells = Array.from(row.cells);
    if (cells.length < 3) continue;

    const heimText = cells[heimIdx >= 0 ? heimIdx : 0]?.textContent.trim();
    const gastText = cells[gastIdx]?.textContent.trim();
    if (!heimText && !gastText) continue;
    if (heimText.toLowerCase() === 'heim') continue;

    const ergebnis = cells[ergebnisIdx >= 0 ? ergebnisIdx : ergebnisIdx]?.textContent.trim();
    const datum = datumIdx >= 0 ? cells[datumIdx]?.textContent.trim() : null;
    const played = ergebnis && ergebnis !== '-:-' && ergebnis !== '' && /\d/.test(ergebnis);

    const matchId = `${heimText}_${gastText}`.replace(/\s+/g, '').toLowerCase();
    const matchLabel = heimText && gastText ? `${heimText} – ${gastText}` : (heimText || gastText);

    if (matchLabel) {
      matches.push({
        id: matchId,
        label: matchLabel,
        homeTeam: heimText,
        awayTeam: gastText,
        result: played ? ergebnis : null,
        played: !!played,
        date: datum,
      });

      for (const pc of playerCols) {
        const cell = cells[pc.idx];
        if (!cell) continue;
        const tip = cell.textContent.trim();
        const tipClean = tip.replace(/\s+/g, '');
        if (!predictions[pc.name]) predictions[pc.name] = [];
        predictions[pc.name].push({
          matchId,
          tip: tipClean || null,
          correct: cell.className.includes('correct') || cell.className.includes('richtig'),
          exact: cell.className.includes('exact') || cell.className.includes('exakt'),
        });
      }
    }
  }

  return { matches, predictions, playerNames: playerCols.map(pc => pc.name) };
}

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
    throw new Error('Login fehlgeschlagen – falsches Passwort?');
  }
  console.log('✅ Login erfolgreich');

  // ── Tipp-Übersicht laden ─────────────────────────────────────────────────
  console.log('📊 Lade tippuebersicht...');
  await page.goto(`${BASE}/tippuebersicht`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'tabelle-debug.png', fullPage: true });

  const tippStructure = await page.evaluate(dumpTables);
  console.log('📄 tippuebersicht Struktur:', JSON.stringify(tippStructure, null, 2));

  // Finde die beste Tabelle für Tipps und für Standings
  const tippResult = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const result = { matches: [], predictions: {}, playerNames: [], standings: [] };

    for (const table of tables) {
      const rows = Array.from(table.rows);
      if (rows.length < 3) continue;
      const hRow = table.querySelector('thead tr') || rows[0];
      const headers = Array.from(hRow.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));

      // ── Ranglisten-Tabelle: hat pos + name + punkte ──────────────────────
      const hasPos = headers.some(h => /^(pos|rang|platz|#)$/.test(h));
      const hasPts = headers.some(h => /^(g|gesamt|pkt|punkte)$/.test(h));
      const hasName = headers.some(h => /^(name|teilnehmer|spieler)$/.test(h));
      if (hasPos && hasPts) {
        console.log('Standings-Tabelle gefunden:', table.id, table.className, 'Headers:', headers.join('|'));
        let posIdx = headers.findIndex(h => /^(pos|rang|platz|#)$/.test(h));
        let nameIdx = headers.findIndex(h => /^(name|teilnehmer|spieler)$/.test(h));
        let ptsIdx = headers.findIndex(h => /^(g|gesamt|pkt|punkte)$/.test(h));
        let exactIdx = headers.findIndex(h => /^(p|exakt)$/.test(h));
        let tendIdx = headers.findIndex(h => /^(b|tendenz|bonus)$/.test(h));
        let wrongIdx = headers.findIndex(h => /^(s|falsch|schlecht)$/.test(h));

        if (posIdx === -1) posIdx = 0;
        if (nameIdx === -1) nameIdx = 2;

        const bodyRows = Array.from(table.tBodies[0]?.rows || rows.slice(1));
        for (const row of bodyRows) {
          const cells = Array.from(row.cells);
          if (cells.length < 3) continue;
          const posText = cells[posIdx]?.textContent.trim().replace(/\D/g, '');
          const pos = parseInt(posText);
          if (!pos || pos > 200) continue;
          const name = cells[nameIdx]?.textContent.trim().split('\n')[0].trim();
          if (!name || name.length > 60) continue;
          const pts = parseInt(cells[ptsIdx >= 0 ? ptsIdx : cells.length - 1]?.textContent.trim()) || 0;
          const exact = exactIdx >= 0 ? parseInt(cells[exactIdx]?.textContent.trim()) || 0 : 0;
          const tendency = tendIdx >= 0 ? parseInt(cells[tendIdx]?.textContent.trim()) || 0 : 0;
          const wrong = wrongIdx >= 0 ? parseInt(cells[wrongIdx]?.textContent.trim()) || 0 : 0;
          let trend = 0;
          const tc = cells[posIdx + 1];
          if (tc) {
            const cls = (tc.className || '') + ' ' + (tc.innerHTML || '');
            if (/up|plus|positiv|steig|arrow-up/i.test(cls)) trend = 1;
            else if (/down|minus|negativ|fall|arrow-down/i.test(cls)) trend = -1;
          }
          result.standings.push({ pos, trend, name, points: pts, exact, tendency, wrong });
        }
        if (result.standings.length > 0) console.log('  → ', result.standings.length, 'Standings gefunden');
      }

      // ── Tipp-Übersicht-Tabelle: hat Heim + Gast + Ergebnis ──────────────
      const hasGast = headers.some(h => /^(gast|away)$/.test(h));
      const hasErg = headers.some(h => /^(ergebnis|result|erg)$/.test(h));
      if (hasGast && hasErg && rows.length >= 3) {
        console.log('Tipp-Tabelle gefunden:', table.id, table.className, 'Headers:', headers.join('|'));
        let heimIdx = headers.findIndex(h => /^(heim|home)$/.test(h));
        let gastIdx = headers.findIndex(h => /^(gast|away)$/.test(h));
        let ergIdx = headers.findIndex(h => /^(ergebnis|result|erg)$/.test(h));
        let gruppeIdx = headers.findIndex(h => /^(gruppe|group)$/.test(h));
        let datumIdx = headers.findIndex(h => /^(datum|date|zeit|time)$/.test(h));
        if (heimIdx === -1) heimIdx = 0;
        if (gastIdx === -1) gastIdx = 1;
        if (ergIdx === -1) ergIdx = 3;

        const fixedCols = new Set([heimIdx, gastIdx, ergIdx, gruppeIdx, datumIdx].filter(i => i >= 0));
        // Vollständige Header (nicht lowercase) für Spielernamen
        const fullHeaders = Array.from(hRow.cells).map(c => c.textContent.trim().replace(/\s+/g, ' '));
        const playerCols = [];
        for (let i = 0; i < fullHeaders.length; i++) {
          if (!fixedCols.has(i) && fullHeaders[i] && fullHeaders[i].length > 0 && fullHeaders[i].length < 60) {
            playerCols.push({ idx: i, name: fullHeaders[i] });
          }
        }

        result.playerNames = playerCols.map(pc => pc.name);
        console.log('  Spieler aus Tipptabelle:', result.playerNames.join(', '));

        const bodyRows2 = Array.from(table.tBodies[0]?.rows || rows.slice(1));
        for (const row of bodyRows2) {
          const cells2 = Array.from(row.cells);
          if (cells2.length < 3) continue;
          const heimText = cells2[heimIdx]?.textContent.trim();
          const gastText = cells2[gastIdx]?.textContent.trim();
          if (!heimText && !gastText) continue;
          const ergebnis = cells2[ergIdx]?.textContent.trim();
          const datum = datumIdx >= 0 ? cells2[datumIdx]?.textContent.trim() : null;
          const played = ergebnis && ergebnis !== '-:-' && ergebnis !== '' && /\d.*:.*\d/.test(ergebnis);
          const matchId = `${heimText}_${gastText}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          const matchLabel = [heimText, gastText].filter(Boolean).join(' – ');
          if (!matchLabel) continue;

          result.matches.push({
            id: matchId,
            label: matchLabel,
            homeTeam: heimText || '',
            awayTeam: gastText || '',
            result: played ? ergebnis : null,
            played: !!played,
            date: datum || null,
          });

          for (const pc of playerCols) {
            const cell = cells2[pc.idx];
            if (!cell) continue;
            if (!result.predictions[pc.name]) result.predictions[pc.name] = [];
            const tip = cell.textContent.trim().replace(/\s+/g, '');
            const cls = cell.className || '';
            result.predictions[pc.name].push({
              matchId,
              tip: tip || null,
              exact: /exakt|correct.*exact|tiprichtig.*exakt/i.test(cls),
              correct: /richtig|correct|tendenz/i.test(cls) && !/falsch|wrong/i.test(cls),
            });
          }
        }
        if (result.matches.length > 0) console.log('  → ', result.matches.length, 'Spiele aus Tipptabelle');
      }
    }
    return result;
  });

  console.log(`  tippuebersicht: ${tippResult.standings.length} Standings, ${tippResult.matches.length} Spiele, ${tippResult.playerNames.length} Spieler`);

  // ── Rangliste laden (falls Standings noch fehlen) ────────────────────────
  let rangliste = [];
  if (tippResult.standings.length === 0) {
    console.log('📋 Lade rangliste...');
    try {
      const resp = await page.goto(`${BASE}/rangliste`, { waitUntil: 'networkidle', timeout: 15000 });
      if (resp && resp.ok()) {
        await page.screenshot({ path: 'rangliste-debug.png', fullPage: true });
        const ranglisteStructure = await page.evaluate(dumpTables);
        console.log('📄 rangliste Struktur:', JSON.stringify(ranglisteStructure, null, 2));

        rangliste = await page.evaluate(() => {
          const tables = Array.from(document.querySelectorAll('table'));
          for (const table of tables) {
            const rows = Array.from(table.rows);
            if (rows.length < 3) continue;
            const hRow = table.querySelector('thead tr') || rows[0];
            const headers = Array.from(hRow.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
            const hasPos = headers.some(h => /^(pos|rang|#|platz)$/.test(h));
            if (!hasPos) continue;

            const standings = [];
            let posIdx = headers.findIndex(h => /^(pos|rang|platz|#)$/.test(h));
            let nameIdx = headers.findIndex(h => /^(name|teilnehmer|spieler)$/.test(h));
            let ptsIdx = headers.findIndex(h => /^(g|gesamt|pkt|punkte)$/.test(h));
            let exactIdx = headers.findIndex(h => /^(p|exakt)$/.test(h));
            let tendIdx = headers.findIndex(h => /^(b|tendenz|bonus)$/.test(h));
            let wrongIdx = headers.findIndex(h => /^(s|falsch|schlecht)$/.test(h));

            if (posIdx === -1) posIdx = 0;
            if (nameIdx === -1) nameIdx = 2;
            if (ptsIdx === -1) ptsIdx = rows[0].cells.length - 1;

            const bodyRows = Array.from(table.tBodies[0]?.rows || rows.slice(1));
            for (const row of bodyRows) {
              const cells = Array.from(row.cells);
              if (cells.length < 3) continue;
              const pos = parseInt(cells[posIdx]?.textContent.trim().replace(/\D/g, ''));
              if (!pos || pos > 200) continue;
              const name = cells[nameIdx]?.textContent.trim().split('\n')[0].trim();
              if (!name || name.length > 60) continue;
              const pts = parseInt(cells[ptsIdx]?.textContent.trim()) || 0;
              const exact = exactIdx >= 0 ? parseInt(cells[exactIdx]?.textContent.trim()) || 0 : 0;
              const tendency = tendIdx >= 0 ? parseInt(cells[tendIdx]?.textContent.trim()) || 0 : 0;
              const wrong = wrongIdx >= 0 ? parseInt(cells[wrongIdx]?.textContent.trim()) || 0 : 0;
              let trend = 0;
              const tc = cells[posIdx + 1];
              if (tc) {
                const cls = (tc.className || '') + tc.innerHTML;
                if (/up|plus|positiv|steig/i.test(cls)) trend = 1;
                else if (/down|minus|negativ|fall/i.test(cls)) trend = -1;
              }
              standings.push({ pos, trend, name, points: pts, exact, tendency, wrong });
            }
            if (standings.length > 0) return standings;
          }
          return [];
        });
        console.log(`  rangliste: ${rangliste.length} Teilnehmer`);
      } else {
        console.log('  /rangliste nicht gefunden (kein 200), OK.');
      }
    } catch (e) {
      console.log('  /rangliste Fehler:', e.message);
    }
  }

  // ── Daten zusammenführen ─────────────────────────────────────────────────
  let finalStandings = tippResult.standings.length > 0 ? tippResult.standings : rangliste;

  // Falls noch immer keine Standings: Spielernamen aus Tipptabelle + leere Stats
  if (finalStandings.length === 0 && tippResult.playerNames.length > 0) {
    console.log('⚠️  Keine Standings gefunden, baue aus Spielernamen auf...');
    finalStandings = tippResult.playerNames.map((name, i) => ({
      pos: i + 1, trend: 0, name, points: 0, exact: 0, tendency: 0, wrong: 0,
    }));
  }

  console.log(`  → ${finalStandings.length} Teilnehmer, ${tippResult.matches.length} Spiele`);

  // ── Merge mit vorherigem JSON (Punkteverlauf erhalten) ───────────────────
  let prev = { standings: [], matches: [] };
  if (fs.existsSync(OUT_PATH)) {
    try { prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); }
    catch (_) {}
  }
  const prevMap = Object.fromEntries((prev.standings || []).map(s => [s.name, s]));

  const mergedStandings = finalStandings.map(s => {
    const old = prevMap[s.name] || {};
    const history = [...(old.pointsHistory || [])];
    if (history[history.length - 1] !== s.points) history.push(s.points);
    return {
      ...s,
      posPrev: old.pos ?? s.pos,
      pointsHistory: history,
      isHighlighted: s.name === 'TippJungle',
      predictions: tippResult.predictions[s.name] || old.predictions || [],
    };
  });

  const output = {
    lastUpdated: new Date().toISOString(),
    communityName: COMMUNITY,
    standings: mergedStandings,
    matches: tippResult.matches.length > 0 ? tippResult.matches : (prev.matches || []),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✅ Gespeichert: ${mergedStandings.length} Teilnehmer, ${output.matches.length} Spiele → ${OUT_PATH}`);

  await browser.close();
}

run().catch(err => {
  console.error('❌ Fehler:', err.message, err.stack);
  process.exit(1);
});
