#!/usr/bin/env node
/**
 * Kicktipp Scraper für WM 2026 Dashboard
 *
 * Umgebungsvariablen:
 *   KICKTIPP_USER      - Kicktipp E-Mail
 *   KICKTIPP_PASS      - Kicktipp Passwort
 *   KICKTIPP_COMMUNITY - z.B. "wm-2026-odonics"
 *
 * Quelle: /tippuebersicht — pro Spieltag (spieltagIndex) durchlaufen.
 *   Untere Tabelle  = Rangliste (Pos, Name, Gesamtpunkte G) + Tipps je Spalte
 *   Obere Tabelle   = Spiele des Spieltags (Termin, Heim, Gast, Gruppe, Ergebnis)
 *   Spalte i der Tipps ↔ Spiel i der oberen Liste (gleiche Reihenfolge)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const USER = process.env.KICKTIPP_USER;
const PASS = process.env.KICKTIPP_PASS;
const COMMUNITY = process.env.KICKTIPP_COMMUNITY;
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'kicktipp.json');

const EXACT_POINTS = 4;           // Kicktipp WM: exakter Treffer = 4 Punkte
const MAX_SPIELTAGE = 30;         // Obergrenze für den Durchlauf

if (!USER || !PASS || !COMMUNITY) {
  console.error('ERROR: KICKTIPP_USER, KICKTIPP_PASS und KICKTIPP_COMMUNITY müssen gesetzt sein.');
  process.exit(1);
}

const BASE = `https://www.kicktipp.de/${COMMUNITY}`;

function matchId(heim, gast) {
  return `${heim}_${gast}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function parseDate(termin, zeit) {
  const text = termin || '';
  const dm = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!dm) return null;
  const [, d, mo, y] = dm;
  const year = y.length === 2 ? `20${y}` : y;
  const tm = (zeit || text).match(/(\d{1,2}):(\d{2})/);
  const hh = tm ? tm[1].padStart(2, '0') : '00';
  const mi = tm ? tm[2] : '00';
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${hh}:${mi}:00+02:00`;
}

// Eine Spieltags-Ansicht im Browser parsen
function scrapeView() {
  const log = [];

  function parseTipCell(cell) {
    const txt = cell.textContent.trim().replace(/\s+/g, '');
    if (!txt || txt === '-:-' || txt === '-' || txt === ':') return { tip: null, points: null };
    // Punkte-Badge als separates Element?
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
    const t2 = txt.match(/^(\d{1,2}):(\d{1,2})$/);
    if (t2) return { tip: `${t2[1]}:${t2[2]}`, points: null };
    return { tip: null, points: null };
  }

  const tables = Array.from(document.querySelectorAll('table'));
  let standings = [];
  let currentGames = [];

  // Spiel-Liste (Termin/Heim/Gast/Gruppe/Ergebnis)
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
    if (currentGames.length > 0) break;
  }

  // Rangliste + Tipps
  for (const table of tables) {
    const allRows = Array.from(table.rows);
    if (allRows.length < 3) continue;
    const theadRows = Array.from(table.querySelectorAll('thead tr'));
    const tbodyRows = Array.from(table.querySelectorAll('tbody tr'));

    let statHeaderRow = null;
    for (const tr of [...theadRows, ...allRows.slice(0, 5)]) {
      const texts = Array.from(tr.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
      if (texts.some(t => /^(pos|#|rang)$/.test(t))) { statHeaderRow = tr; break; }
    }
    if (!statHeaderRow) continue;

    const statHeaders = Array.from(statHeaderRow.cells).map(c => c.textContent.trim().toLowerCase().replace(/\s+/g, ''));
    const posIdx = Math.max(0, statHeaders.findIndex(h => /^(pos|#|rang)$/.test(h)));
    let nameIdx = statHeaders.findIndex(h => /^(name|teilnehmer)$/.test(h));
    if (nameIdx === -1) nameIdx = 2;
    const totalCols = statHeaderRow.cells.length;
    const gIdx = totalCols - 1;
    const matchColIdx = [];
    for (let i = nameIdx + 1; i < totalCols - 4; i++) matchColIdx.push(i);

    const dataRows = tbodyRows.length > 0 ? tbodyRows : allRows.slice(theadRows.length);
    for (const row of dataRows) {
      const cells = Array.from(row.cells);
      if (cells.length < 4) continue;
      const pos = parseInt(cells[posIdx]?.textContent.trim().replace(/\D/g, ''));
      if (!pos || pos > 200) continue;
      const name = cells[nameIdx]?.textContent.trim().split('\n')[0].trim();
      if (!name || name.length > 60) continue;
      const points = parseInt(cells[gIdx]?.textContent.trim().replace(/[^\d-]/g, '')) || 0;

      let trend = 0;
      let trendVal = 0;
      const tc = cells[posIdx + 1];
      if (tc) {
        const sig = (tc.className || '') + (tc.innerHTML || '') + tc.textContent;
        const numMatch = tc.textContent.trim().replace(/[^\d]/g, '').match(/\d+/);
        const n = numMatch ? parseInt(numMatch[0]) : 0;
        if (/up|plus|positiv|steig|▲/i.test(sig)) { trend = 1; trendVal = n; }
        else if (/down|minus|negativ|fall|▼/i.test(sig)) { trend = -1; trendVal = n; }
      }

      const predRaw = matchColIdx.map(ci => cells[ci] ? parseTipCell(cells[ci]) : { tip: null, points: null });
      standings.push({ pos, trend, trendVal, name, points, predRaw });
    }
    if (standings.length > 0) {
      log.push(`Header: ${statHeaders.join('|')} → ${standings.length} Spieler, ${matchColIdx.length} Match-Spalten, ${currentGames.length} Spiele`);
      break;
    }
  }

  // Spieltag-Navigations-Links (zur Diagnose)
  const navHrefs = Array.from(document.querySelectorAll('a'))
    .map(a => a.getAttribute('href') || '')
    .filter(h => /spieltag/i.test(h));

  return { standings, currentGames, navHrefs, log };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    timezoneId: 'Europe/Vienna', // Anstoßzeiten in Wiener Zeit (wie auf kicktipp)
    locale: 'de-AT',
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

  // ── Cookie akzeptieren (einmalig) ────────────────────────────────────────
  await page.goto(`${BASE}/tippuebersicht`, { waitUntil: 'networkidle' });
  try {
    const cookieBtn = page.locator('button:has-text("AKZEPTIEREN"), button:has-text("Akzeptieren"), a:has-text("AKZEPTIEREN")').first();
    if (await cookieBtn.isVisible({ timeout: 3000 })) {
      console.log('🍪 Cookie-Dialog akzeptiert');
      await cookieBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    }
  } catch (_) {}
  await page.screenshot({ path: 'tabelle-debug.png', fullPage: true });

  // ── Alle Spieltage durchlaufen ───────────────────────────────────────────
  console.log('📊 Durchlaufe Spieltage...');
  let baseStandings = null;                 // Rangliste (cumulative, einmalig)
  const playerPred = {};                    // name → { gameId: {tip, points} }
  const allGames = new Map();               // id → match
  let emptyStreak = 0;

  for (let i = 0; i < MAX_SPIELTAGE; i++) {
    await page.goto(`${BASE}/tippuebersicht?&spieltagIndex=${i}`, { waitUntil: 'networkidle' });
    const view = await page.evaluate(scrapeView);
    if (i === 0) view.log.forEach(l => console.log('  ' + l));

    if (view.standings.length === 0) {
      if (i === 0) console.log('⚠️  Keine Rangliste gefunden! Prüfe tabelle-debug.png');
      break;
    }
    if (!baseStandings) {
      baseStandings = view.standings.map(s => ({ pos: s.pos, trend: s.trend, trendVal: s.trendVal, name: s.name, points: s.points }));
      if (view.navHrefs.length) console.log(`  Nav-Links (Spieltag): ${[...new Set(view.navHrefs)].slice(0, 4).join(' , ')}`);
    }

    const gids = view.currentGames.map(g => matchId(g.heim, g.gast));
    const aligned = gids.length > 0 && view.standings.every(s => (s.predRaw || []).length === gids.length);

    // Spiele sammeln — beim ersten Auftreten eintragen, bei späteren Aufrufen
    // nur dann updaten wenn das Ergebnis jetzt vorhanden ist (played: false → true).
    let newGames = 0;
    view.currentGames.forEach((g, idx) => {
      const id = gids[idx];
      const played = g.ergebnis && g.ergebnis !== '-:-' && /\d+\s*:\s*\d+/.test(g.ergebnis);
      if (!allGames.has(id)) {
        allGames.set(id, {
          id, label: `${g.heim} – ${g.gast}`,
          homeTeam: g.heim, awayTeam: g.gast, group: g.gruppe || null,
          result: played ? g.ergebnis.replace(/\s/g, '') : null,
          played: !!played, date: parseDate(g.termin, g.termin),
        });
        newGames++;
      } else if (played && !allGames.get(id).played) {
        // Ergebnis ist jetzt bekannt — bestehenden Eintrag aktualisieren
        const existing = allGames.get(id);
        allGames.set(id, { ...existing, result: g.ergebnis.replace(/\s/g, ''), played: true });
      }
    });

    // Tipps sammeln
    if (aligned) {
      view.standings.forEach(s => {
        playerPred[s.name] = playerPred[s.name] || {};
        s.predRaw.forEach((p, idx) => {
          if (p && p.tip) playerPred[s.name][gids[idx]] = { tip: p.tip, points: p.points };
        });
      });
    }

    console.log(`  Spieltag-Index ${i}: ${view.currentGames.length} Spiele (${newGames} neu)${aligned ? '' : ' [Tipps nicht zugeordnet]'}`);

    // Abbruch: keine neuen Spiele mehr (Parameter ignoriert oder Ende erreicht)
    emptyStreak = newGames === 0 ? emptyStreak + 1 : 0;
    if (emptyStreak >= 2) break;
  }

  const matches = [...allGames.values()].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
  console.log(`  → ${baseStandings?.length || 0} Teilnehmer, ${matches.length} Spiele gesamt`);

  // ── Merge mit vorherigem JSON (Punkteverlauf erhalten) ───────────────────
  let prev = { standings: [], matches: [] };
  if (fs.existsSync(OUT_PATH)) {
    try { prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); } catch (_) {}
  }
  const prevMap = Object.fromEntries((prev.standings || []).map(s => [s.name, s]));

  const mergedStandings = (baseStandings || []).map(s => {
    const old = prevMap[s.name] || {};
    // Kicktipp zeigt kein "0"-Badge bei Falsch-Tipps → points bleibt null.
    // Bei gespielten Matches mit Tipp aber ohne Punkte → 0 Punkte (falsch) ableiten.
    const rawPreds = playerPred[s.name] || {};
    const predictions = {};
    Object.entries(rawPreds).forEach(([id, p]) => {
      if (!p.tip) return;
      const matchPlayed = allGames.get(id)?.played;
      const pts = (p.points == null && matchPlayed) ? 0 : p.points;
      predictions[id] = { tip: p.tip, points: pts };
    });

    let exact = 0, diff = 0, tendency = 0, wrong = 0;
    Object.values(predictions).forEach(p => {
      if (p.points == null) return;
      if (p.points >= EXACT_POINTS) exact++;
      else if (p.points === 3) diff++;
      else if (p.points >= 1) tendency++;
      else wrong++;
    });

    const history = [...(old.pointsHistory || [])];
    const pointsChanged = history[history.length - 1] !== s.points;
    if (pointsChanged) history.push(s.points);

    // posPrev direkt aus Kicktipps eigenem +/- berechnen (verhindert Gleiten im Match Day Loop).
    // Wenn trendVal > 0: Kicktipp hat eine echte Zahl → posPrev = pos ± trendVal.
    // Sonst Fallback auf inkrementelles Tracking.
    let posPrev;
    if (s.trendVal > 0) {
      posPrev = s.pos + (s.trend > 0 ? s.trendVal : -s.trendVal);
    } else {
      posPrev = pointsChanged ? (old.pos ?? s.pos) : (old.posPrev ?? old.pos ?? s.pos);
    }

    return {
      pos: s.pos, trend: s.trend, name: s.name, points: s.points,
      exact, diff, tendency, wrong,
      posPrev,
      pointsHistory: history,
      isHighlighted: false,
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
