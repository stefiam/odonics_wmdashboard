import { useState, useEffect } from 'react';
import Leaderboard from './components/Leaderboard';
import PointsChart from './components/PointsChart';
import RecentForm from './components/RecentForm';
import MatchBreakdown from './components/MatchBreakdown';

const BASE = import.meta.env.BASE_URL;

function formatDate(isoString) {
  if (!isoString) return '–';
  return new Date(isoString).toLocaleString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

  return <span className="font-mono text-[#d9e8e5]">{timeLeft}</span>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tabelle');

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
  ];

  return (
    <div className="min-h-screen bg-[#1e4745]">
      {/* Header */}
      <header className="border-b border-[#2d6460] bg-[#183d3b]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚽</span>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">WM 2026 Tippspiel</h1>
              <p className="text-xs text-gray-500">FIFA World Cup • USA / Kanada / Mexiko</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-gray-500 text-xs mb-0.5">Finale in</div>
            <Countdown targetDate="2026-07-19T21:00:00Z" />
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-[#d9e8e5] text-[#d9e8e5]'
                    : 'border-transparent text-[#7fb5b1] hover:text-[#d9e8e5]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-6 text-sm">
            ⚠️ Daten konnten nicht geladen werden: {error}
          </div>
        )}

        {!data && !error && (
          <div className="flex items-center justify-center h-48 text-gray-500">
            <span className="animate-pulse">Lade Daten…</span>
          </div>
        )}

        {data && (
          <>
            {activeTab === 'tabelle' && <Leaderboard standings={data.standings} />}
            {activeTab === 'verlauf' && <PointsChart standings={data.standings} />}
            {activeTab === 'form' && <RecentForm standings={data.standings} matches={data.matches} />}
            {activeTab === 'spiele' && <MatchBreakdown matches={data.matches} standings={data.standings} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2d6460] mt-8 py-4 px-4 text-center text-xs text-[#5a9490]">
        {data && <>Zuletzt aktualisiert: {formatDate(data.lastUpdated)} · </>}
        Daten via Kicktipp.de
      </footer>
    </div>
  );
}
