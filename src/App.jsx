import { useState, useEffect } from 'react';
import useLiveMatch from './hooks/useLiveMatch';
import Leaderboard from './components/Leaderboard';
import PointsChart from './components/PointsChart';
import RecentForm from './components/RecentForm';
import MatchBreakdown from './components/MatchBreakdown';
import HeadToHead from './components/HeadToHead';
import WhatIf from './components/WhatIf';

const BASE = import.meta.env.BASE_URL;

function formatDate(isoString) {
  if (!isoString) return '–';
  return new Date(isoString).toLocaleString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatMatchTime(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return d.toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

function Countdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) { setTimeLeft('Turnier läuft!'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${d}T ${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return <span className="font-mono text-[#f7b32b] font-bold">{timeLeft}</span>;
}

function LiveTicker({ match }) {
  const label = match.status === 'PAUSED' ? 'Pause' : `${match.minute ?? '–'}'`;
  return (
    <div className="border-2 border-red-400 rounded-xl px-3 py-2 text-sm">
      <div className="flex items-center gap-1.5 text-xs text-red-500 mb-0.5 font-semibold">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
        LIVE · {label}
      </div>
      <div className="font-bold text-[#1e4745]">
        {match.homeTeam} <span className="text-[#f7b32b] font-mono">{match.homeScore} : {match.awayScore}</span> {match.awayTeam}
      </div>
    </div>
  );
}

function NextMatch({ matches }) {
  if (!matches?.length) return null;

  // Filtere echte Spiele (keine Spaltenheader-Artefakte)
  const invalidLabels = new Set(['gast', 'gruppe', 'ergebnis', 'heim', 'datum', 'termin']);
  const real = matches.filter(m => m.label && !invalidLabels.has(m.label.toLowerCase()));
  if (!real.length) return null;

  // Läuft gerade ein Spiel?
  const now = new Date();
  const live = real.find(m => {
    if (!m.date || !m.played) return false;
    const start = new Date(m.date);
    const end = new Date(start.getTime() + 110 * 60000);
    return now >= start && now <= end;
  });
  if (live) {
    return (
      <div className="text-right text-sm">
        <div className="text-[#2d6460] text-xs mb-0.5">Läuft gerade</div>
        <span className="font-semibold text-[#1e4745]">{live.label}</span>
        {live.result && <span className="ml-2 text-[#f7b32b] font-bold font-mono">{live.result}</span>}
      </div>
    );
  }

  const next = real.find(m => !m.played);
  if (!next) return null;
  const timeStr = formatMatchTime(next.date);
  return (
    <div className="text-right text-sm">
      <div className="text-[#2d6460] text-xs mb-0.5">Nächstes Spiel</div>
      <span className="font-semibold text-[#1e4745]">{next.label}</span>
      {timeStr && <span className="ml-2 text-xs text-[#7aadaa]">{timeStr}</span>}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tabelle');
  const liveMatch = useLiveMatch();

  useEffect(() => {
    fetch(`${BASE}data/kicktipp.json`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  const tabs = [
    { id: 'tabelle', label: '🏆 Tabelle' },
    { id: 'verlauf', label: '📈 Verlauf' },
    { id: 'form', label: '🔥 Form' },
    { id: 'spiele', label: '⚽ Spiele' },
    { id: 'h2h', label: '⚔️ H2H' },
    { id: 'whatif', label: '🔮 Wenn…?' },
  ];

  return (
    <div className="min-h-screen bg-[#f6fbfb]">
      <header className="bg-white shadow-sm border-b border-[#d9e8e5]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <img
              src={`${BASE}logo.png`}
              alt="WM 2026 Tippspiel"
              className="h-16 w-16 object-contain"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div>
              <h1 className="text-xl font-bold text-[#1e4745] leading-tight">WM 2026 Tippspiel</h1>
              <p className="text-xs text-[#2d6460]">Odonics · FIFA World Cup · USA / Kanada / Mexiko</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {liveMatch ? (
              <LiveTicker match={liveMatch} />
            ) : data && (
              <div className="border-2 border-[#2d6b68] rounded-xl px-3 py-2">
                <NextMatch matches={data.matches} />
              </div>
            )}
            <div className="border-2 border-[#2d6b68] rounded-xl px-3 py-2 text-right text-sm">
              <div className="text-[#2d6460] text-xs mb-0.5">Finale in</div>
              <Countdown targetDate="2026-07-19T21:00:00Z" />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <nav className="grid grid-cols-3 sm:flex sm:flex-row gap-0 -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-2 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap text-center ${
                  activeTab === t.id
                    ? 'border-[#f7b32b] text-[#f7b32b]'
                    : 'border-transparent text-[#2d6460] hover:text-[#1e4745]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
            ⚠️ Daten konnten nicht geladen werden: {error}
          </div>
        )}
        {!data && !error && (
          <div className="flex items-center justify-center h-48 text-[#5a9490]">
            <span className="animate-pulse">Lade Daten…</span>
          </div>
        )}
        {data && (
          <>
            {activeTab === 'tabelle' && <Leaderboard standings={data.standings} />}
            {activeTab === 'verlauf' && <PointsChart standings={data.standings} />}
            {activeTab === 'form' && <RecentForm standings={data.standings} matches={data.matches} />}
            {activeTab === 'spiele' && <MatchBreakdown matches={data.matches} standings={data.standings} />}
            {activeTab === 'h2h' && <HeadToHead standings={data.standings} matches={data.matches} />}
            {activeTab === 'whatif' && <WhatIf standings={data.standings} matches={data.matches} />}
          </>
        )}
      </main>

      <footer className="border-t border-[#d9e8e5] mt-8 py-4 px-4 text-center text-xs text-[#7aadaa]">
        {data && <>Zuletzt aktualisiert: {formatDate(data.lastUpdated)} · </>}
        Daten via Kicktipp.de
      </footer>
    </div>
  );
}
