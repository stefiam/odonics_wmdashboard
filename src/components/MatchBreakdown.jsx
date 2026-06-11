import { useState } from 'react';

function TipBadge({ tip, points, result }) {
  if (!tip) return <span className="text-gray-700 text-xs">–</span>;

  let bg = 'bg-gray-800 text-gray-400';
  if (result) {
    if (points >= 3) bg = 'bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-500/50';
    else if (points >= 1) bg = 'bg-[#255552] text-[#d9e8e5] ring-1 ring-[#d9e8e5]/40';
    else bg = 'bg-red-900/40 text-red-400';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-bold ${bg}`}>
      {tip}
      {points > 0 && <span className="ml-1 opacity-70 font-normal">+{points}</span>}
    </span>
  );
}

function TipDistribution({ match, standings }) {
  const tips = standings
    .map(p => p.predictions?.[match.id]?.tip)
    .filter(Boolean);

  if (tips.length === 0) return null;

  const counts = tips.reduce((acc, t) => {
    const [h, a] = t.split(':').map(Number);
    let outcome = h > a ? 'Heim' : h < a ? 'Auswärts' : 'Unentschieden';
    acc[outcome] = (acc[outcome] || 0) + 1;
    return acc;
  }, {});

  const total = tips.length;
  return (
    <div className="flex gap-3 text-xs mt-2">
      {Object.entries(counts).map(([outcome, count]) => (
        <div key={outcome} className="flex items-center gap-1">
          <div
            className={`h-1.5 rounded-full ${
              outcome === 'Heim' ? 'bg-blue-400' : outcome === 'Auswärts' ? 'bg-red-400' : 'bg-gray-500'
            }`}
            style={{ width: `${Math.max(12, (count / total) * 60)}px` }}
          />
          <span className="text-gray-500">{outcome}: <span className="text-gray-300">{count}</span></span>
        </div>
      ))}
    </div>
  );
}

export default function MatchBreakdown({ matches, standings }) {
  const [expanded, setExpanded] = useState(null);

  const played = matches.filter(m => m.played);
  const upcoming = matches.filter(m => !m.played);

  const MatchCard = ({ match }) => {
    const isOpen = expanded === match.id;
    return (
      <div className={`border border-[#2d6460] rounded-xl overflow-hidden transition-all ${
        match.played ? 'bg-[#255552]' : 'bg-[#183d3b] opacity-80'
      }`}>
        <button
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          onClick={() => setExpanded(isOpen ? null : match.id)}
        >
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${match.played ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
              {match.played ? 'Abgepfiffen' : 'Ausstehend'}
            </span>
            <span className="font-semibold text-gray-200 text-sm">{match.label}</span>
            {match.result && (
              <span className="text-[#d9e8e5] font-bold font-mono text-sm">{match.result}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            {match.date && <span className="text-xs">{new Date(match.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })}</span>}
            <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-[#2d6460] px-4 pb-4 pt-3">
            <TipDistribution match={match} standings={standings} />

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {standings.map(p => {
                const pred = p.predictions?.[match.id];
                return (
                  <div
                    key={p.name}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#1e4745] border border-[#2d6460] ${
                      p.isHighlighted ? 'ring-1 ring-[#d9e8e5]/40' : ''
                    }`}
                  >
                    <span className={`text-xs truncate mr-2 ${p.isHighlighted ? 'text-[#d9e8e5]' : 'text-gray-300'}`}>
                      {p.name}
                    </span>
                    <TipBadge tip={pred?.tip} points={pred?.points || 0} result={match.result} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {played.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ⚽ Gespielte Partien ({played.length})
          </h2>
          <div className="space-y-2">
            {[...played].reverse().map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            🕐 Nächste Partien ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          Noch keine Spieldaten vorhanden.
        </div>
      )}
    </div>
  );
}
