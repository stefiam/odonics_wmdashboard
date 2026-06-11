#!/usr/bin/env node
/**
 * Kicktipp Scraper für WM 2026 Dashboard
 *
 * Umgebungsvariablen:
 *   KICKTIPP_USER      - Kicktipp E-Mail
 *   KICKTIPP_PASS      - Kicktipp Passwort
 *   KICKTIPP_COMMUNITY - z.B. "wm-2026-odonics"
 *
 * Datenquellen:
 *   /tippuebersicht  → Rangliste (Pos, Name, Gesamtpunkte) + Tipps pro Spieler
 *                      (Spalten = Spiele des aktuellen Spieltags) + Spiel-Liste oben
 *   /spielplan       → vollständiger Spielplan mit Datum/Uhrzeit/Ergebnis
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const USER = process.env.KICKTIPP_USER;
const PASS = process.env.KICKTIPP_PASS;
const COMMUNITY = process.env.KICKTIPP_COMMUNITY;
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'kicktipp.json');

// Kicktipp WM-Wertung: exakter Treffer = 4 Punkte (alles darunter mit Tipp = Tendenz)
const EXACT_POINTS = 4;
const HIGHLIGHT_NAME = 'TippJungle';

if (!USER || !PASS || !COMMUNITY) {
  console.error('ERROR: KICKTIPP_USER, KICKTIPP_PASS und KICKTIPP_COMMUNITY müssen gesetzt sein.');
  process.exit(1);
}

const BASE = `https://www.kicktipp.de/${COMMUNITY}`;

// Einheitliches ID-Schema, identisch für tippuebersicht-Spielliste UND spielplan
function matchId(heim, gast) {
  return `${heim}_${gast}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
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
  await page.click('#submitbutton, button[type="submit"], input[type="submit"]');
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

  // Cookie/DSGVO-Dialog wegklicken
  try {
    const cookieBtn = page.locator('button:has-text("AKZEPTIEREN"), button:has-text("Akzeptieren"), a:has-text("AKZEPTIEREN")').first();
    if (await cookieBtn.isVisible({ timeout: 3000 })) {
      console.log('🍪 Cookie-Dialog gefunden, akzeptiere...');
      await cookieBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    }
  } catch (_) {}

  await page.screenshot({ path: 'tabelle-debug.png', fullPage: true });

  const tipp = await page.evaluate(() => {
    const log = [];

    // Tipp-Zelle parsen: "1:04" → { tip: "1:0", points: 4 }; "-:-" → null
    // (Fußball-Ergebnisse sind einstellig; angehängte Ziffern = Punkte-Badge)
    function parseTipCell(cell) {
      const txt = cell.textContent.trim().replace(/\s+/g, '');
      if (!txt || txt === '-:-' || txt === '-' || txt === ':') return { tip: null, points: null };

      // Bevorzugt: separates Punkte-Element im Zelleninhalt
      let badge = null;
      for (const el of cell.querySelectorAll('*')) {
        const t = el.textContent.trim();
        if (/^\d{1,2}$/.test(t) && el.children.length === 0) badge = t;
      }
      if (badge) {
        const tip = txt.slice(0, txt.length - badge.length);
        if (/^\d{1,2}:\d{1,2}$/.test(tip)) return { tip, points: parseInt(badge) };
      }

      // Fallback: einstellige Scores, Rest = Punkte
      const m = txt.match(/^(\d):(\d)(\d*)$/);
      if (m) return { tip: `${m[1]}:${m[2]}`, points: m[3] ? parseInt(m[3]) : null };

      // Letzter Fallback: nur Tipp ohne Punkte
      const t2 = txt.match(/^(\d{1,2}):(\d{1,2})$/);
      if (t2) return { tip: `${t2[1]}:${t2[2]}`, points: null };
      return { tip: null, points: null };
    }

    const tables = Array.from(document.querySelectorAll('table'));
    log.push(`Anzahl Tabellen: ${tables.length}`);

    let standings = [];
    let currentGames = [];   // Spiele des aktuellen Spieltags, in Spalten-Reihenfolge

    // ── 1) Spiel-Liste oben (Termin/Heim/Gast/Gruppe/Ergebnis) ──────────────
    for (const table of tables) {
      const rows = Array.from(table.rows);
      if (rows.length < 2) continue;
      const hRow = table.querySelector('thead tr') || rows[0];
      const headers = Array.from(hRow.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
      const heimIdx = headers.findIndex(h => /^(heim|home)$/.test(h));
      const gastIdx = headers.findIndex(h => /^(gast|away)$/.test(h));
      if (heimIdx === -1 || gastIdx === -1) continue;

      const ergIdx = headers.findIndex(h => /^(ergebnis|result|erg)$/.test(h));
      const terminIdx = headers.findIndex(h => /^(termin|datum|anpfiff|date)$/.test(h));
      const gruppeIdx = headers.findIndex(h => /^(gruppe|group)$/.test(h));
      const body = Array.from(table.tBodies[0]?.rows || rows.slice(1));
      for (const row of body) {
        const cells = Array.from(row.cells);
        const heim = cells[heimIdx]?.textContent.trim();
        const gast = cells[gastIdx]?.textContent.trim();
        if (!heim || !gast) continue;
        currentGames.push({
          heim, gast,
          gruppe: gruppeIdx >= 0 ? cells[gruppeIdx]?.textContent.trim() : null,
          ergebnis: ergIdx >= 0 ? cells[ergIdx]?.textContent.trim() : null,
          termin: terminIdx >= 0 ? cells[terminIdx]?.textContent.trim() : null,
        });
      }
      if (currentGames.length > 0) {
        log.push(`Spiel-Liste: ${currentGames.length} Spiele → ${currentGames.map(g => g.heim + '-' + g.gast).join(', ')}`);
        break;
      }
    }

    // ── 2) Rangliste + Tipps (Pos | +/- | Name | [Spiele] | P | B | S | G) ──
    for (const table of tables) {
      const allRows = Array.from(table.rows);
      if (allRows.length < 3) continue;
      const theadRows = Array.from(table.querySelectorAll('thead tr'));
      const tbodyRows = Array.from(table.querySelectorAll('tbody tr'));

      // Header-Zeile mit "Pos"
      let statHeaderRow = null;
      for (const tr of [...theadRows, ...allRows.slice(0, 5)]) {
        const texts = Array.from(tr.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
        if (texts.some(t => /^(pos|#|rang)$/.test(t))) { statHeaderRow = tr; break; }
      }
      if (!statHeaderRow) continue;

      const statHeaders = Array.from(statHeaderRow.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
      log.push(`Stats-Header: ${statHeaders.join(' | ')}`);

      const posIdx = Math.max(0, statHeaders.findIndex(h => /^(pos|#|rang)$/.test(h)));
      let nameIdx = statHeaders.findIndex(h => /^(name|teilnehmer)$/.test(h));
      if (nameIdx === -1) nameIdx = 2;
      const totalCols = statHeaderRow.cells.length;
      const gIdx = totalCols - 1;            // Gesamtpunkte (zuverlässig)

      // Match-Spalten = zwischen Name und dem 4er-Statistikblock (P B S G)
      const matchStart = nameIdx + 1;
      const matchEnd = totalCols - 4;        // exklusiv
      const matchColIdx = [];
      for (let i = matchStart; i < matchEnd; i++) matchColIdx.push(i);
      log.push(`Spalten: pos=${posIdx}, name=${nameIdx}, total=${totalCols}, G=${gIdx}, matchCols=[${matchColIdx.join(',')}]`);

      const dataRows = tbodyRows.length > 0 ? tbodyRows : allRows.slice(theadRows.length);
      let firstRowDebug = null;
      for (const row of dataRows) {
        const cells = Array.from(row.cells);
        if (cells.length < 4) continue;

        const pos = parseInt(cells[posIdx]?.textContent.trim().replace(/\D/g, ''));
        if (!pos || pos > 200) continue;
        const name = cells[nameIdx]?.textContent.trim().split('\n')[0].trim();
        if (!name || name.length > 60) continue;

        const points = parseInt(cells[gIdx]?.textContent.trim().replace(/[^\d-]/g, '')) || 0;

        // Trend aus +/- Spalte (direkt nach Pos)
        let trend = 0;
        const tc = cells[posIdx + 1];
        if (tc) {
          const sig = (tc.className || '') + (tc.innerHTML || '') + tc.textContent;
          if (/up|plus|positiv|steig|▲|\+/i.test(sig)) trend = 1;
          else if (/down|minus|negativ|fall|▼/i.test(sig)) trend = -1;
        }

        // Tipps pro Match-Spalte (Reihenfolge entspricht currentGames)
        const predRaw = matchColIdx.map(ci => cells[ci] ? parseTipCell(cells[ci]) : { tip: null, points: null });
        if (!firstRowDebug) {
          firstRowDebug = matchColIdx.map(ci => cells[ci]?.textContent.trim()).join(' | ');
        }

        standings.push({ pos, trend, name, points, predRaw });
      }

      if (standings.length > 0) {
        log.push(`Rangliste: ${standings.length} Spieler. Erste Tipp-Zeile roh: ${firstRowDebug}`);
        log.push(`Match-Spalten=${matchColIdx.length}, Spiel-Liste=${currentGames.length}`);
        break;
      }
    }

    return { standings, currentGames, log };
  });

  tipp.log.forEach(l => console.log('  ' + l));
  console.log(`  → ${tipp.standings.length} Teilnehmer (aus tippuebersicht)`);
  if (tipp.standings.length === 0) {
    console.log('⚠️  Keine Rangliste gefunden! Prüfe tabelle-debug.png');
  }

  // ── Spielplan laden (vollständig, mit Datum/Uhrzeit) ─────────────────────
  console.log('📅 Lade spielplan...');
  let spielplanMatches = [];
  try {
    await page.goto(`${BASE}/spielplan`, { waitUntil: 'networkidle', timeout: 20000 });
    spielplanMatches = await page.evaluate(() => {
      const out = [];
      for (const table of document.querySelectorAll('table')) {
        const rows = Array.from(table.rows);
        if (rows.length < 2) continue;
        const hRow = table.querySelector('thead tr') || rows[0];
        const headers = Array.from(hRow.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
        const heimIdx = headers.findIndex(h => /^(heim|home)$/.test(h));
        const gastIdx = headers.findIndex(h => /^(gast|away)$/.test(h));
        if (heimIdx === -1 || gastIdx === -1) continue;

        const ergIdx = headers.findIndex(h => /^(ergebnis|result|erg)$/.test(h));
        const terminIdx = headers.findIndex(h => /^(termin|datum|anpfiff|date)$/.test(h));
        const zeitIdx = headers.findIndex(h => /^(uhrzeit|zeit|time)$/.test(h));
        const gruppeIdx = headers.findIndex(h => /^(gruppe|group)$/.test(h));

        const body = Array.from(table.tBodies[0]?.rows || rows.slice(1));
        for (const row of body) {
          const cells = Array.from(row.cells);
          const heim = cells[heimIdx]?.textContent.trim();
          const gast = cells[gastIdx]?.textContent.trim();
          if (!heim || !gast) continue;

          const ergebnis = ergIdx >= 0 ? cells[ergIdx]?.textContent.trim() : '';
          const termin = terminIdx >= 0 ? cells[terminIdx]?.textContent.trim() : '';
          const zeit = zeitIdx >= 0 ? cells[zeitIdx]?.textContent.trim() : '';
          const gruppe = gruppeIdx >= 0 ? cells[gruppeIdx]?.textContent.trim() : null;
          const played = ergebnis && ergebnis !== '-:-' && /\d+\s*:\s*\d+/.test(ergebnis);

          let isoDate = null;
          const dm = termin.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
          if (dm) {
            const [, d, mo, y] = dm;
            const year = y.length === 2 ? `20${y}` : y;
            const tm = (zeit || termin).match(/(\d{1,2}):(\d{2})/);
            const hh = tm ? tm[1].padStart(2, '0') : '00';
            const mi = tm ? tm[2] : '00';
            isoDate = `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${hh}:${mi}:00`;
          }

          out.push({
            heim, gast, gruppe,
            result: played ? ergebnis.replace(/\s/g, '') : null,
            played: !!played,
            date: isoDate,
          });
        }
        if (out.length > 0) break;
      }
      return out;
    });
    console.log(`  → ${spielplanMatches.length} Spiele aus Spielplan`);
  } catch (e) {
    console.log('  Spielplan Fehler:', e.message);
  }

  // ── Matches zusammenbauen ────────────────────────────────────────────────
  let matches = spielplanMatches.map(m => ({
    id: matchId(m.heim, m.gast),
    label: `${m.heim} – ${m.gast}`,
    homeTeam: m.heim,
    awayTeam: m.gast,
    group: m.gruppe || null,
    result: m.result,
    played: m.played,
    date: m.date,
  }));

  // Fallback: Spiele aus tippuebersicht-Liste, falls Spielplan leer
  if (matches.length === 0 && tipp.currentGames.length > 0) {
    matches = tipp.currentGames.map(g => {
      const played = g.ergebnis && g.ergebnis !== '-:-' && /\d+\s*:\s*\d+/.test(g.ergebnis);
      let isoDate = null;
      const dm = (g.termin || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
      if (dm) {
        const [, d, mo, y] = dm;
        const year = y.length === 2 ? `20${y}` : y;
        const tm = (g.termin || '').match(/(\d{1,2}):(\d{2})/);
        isoDate = `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${tm ? tm[1].padStart(2, '0') : '00'}:${tm ? tm[2] : '00'}:00`;
      }
      return {
        id: matchId(g.heim, g.gast),
        label: `${g.heim} – ${g.gast}`,
        homeTeam: g.heim, awayTeam: g.gast, group: g.gruppe || null,
        result: played ? g.ergebnis.replace(/\s/g, '') : null,
        played: !!played, date: isoDate,
      };
    });
  }

  // ── Tipps mit Spielen verknüpfen (Spalte i ↔ currentGames[i]) ────────────
  const gameIds = tipp.currentGames.map(g => matchId(g.heim, g.gast));
  const colsAligned = gameIds.length > 0 &&
    tipp.standings.every(s => (s.predRaw || []).length === gameIds.length);
  if (!colsAligned && tipp.standings.length > 0) {
    console.log(`⚠️  Tipp-Spalten (${tipp.standings[0]?.predRaw?.length}) ≠ Spiel-Liste (${gameIds.length}) — Tipps werden nicht zugeordnet.`);
  }

  // ── Merge mit vorherigem JSON (Punkteverlauf erhalten) ───────────────────
  let prev = { standings: [], matches: [] };
  if (fs.existsSync(OUT_PATH)) {
    try { prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); } catch (_) {}
  }
  const prevMap = Object.fromEntries((prev.standings || []).map(s => [s.name, s]));

  const mergedStandings = tipp.standings.map(s => {
    const old = prevMap[s.name] || {};

    // Tipps zuordnen
    const predictions = {};
    if (colsAligned) {
      s.predRaw.forEach((p, i) => {
        if (p && p.tip) predictions[gameIds[i]] = { tip: p.tip, points: p.points };
      });
    }

    // exact/tendency/wrong aus echten (gewerteten) Tipps ableiten
    let exact = 0, tendency = 0, wrong = 0;
    Object.values(predictions).forEach(p => {
      if (p.points == null) return;          // Spiel noch nicht gewertet
      if (p.points >= EXACT_POINTS) exact++;
      else if (p.points >= 1) tendency++;
      else wrong++;
    });

    // Punkteverlauf nur bei Änderung verlängern
    const history = [...(old.pointsHistory || [])];
    if (history[history.length - 1] !== s.points) history.push(s.points);

    return {
      pos: s.pos,
      trend: s.trend,
      name: s.name,
      points: s.points,
      exact, tendency, wrong,
      posPrev: old.pos ?? s.pos,
      pointsHistory: history,
      isHighlighted: s.name === HIGHLIGHT_NAME,
      predictions,
    };
  });

  const output = {
    lastUpdated: new Date().toISOString(),
    communityName: COMMUNITY,
    standings: mergedStandings.length > 0 ? mergedStandings : (prev.standings || []),
    matches: matches.length > 0 ? matches : (prev.matches || []),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  const withTips = output.standings.filter(s => Object.keys(s.predictions || {}).length > 0).length;
  console.log(`✅ Gespeichert: ${output.standings.length} Teilnehmer (${withTips} mit Tipps), ${output.matches.length} Spiele`);

  await browser.close();
}

run().catch(err => {
  console.error('❌ Fehler:', err.message, '\n', err.stack);
  process.exit(1);
});
