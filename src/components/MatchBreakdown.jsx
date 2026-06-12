import { useState } from 'react';

function TipBadge({ tip, points, result }) {
  if (!tip) return <span className="text-gray-300 text-xs">–</span>;

  let style = 'bg-[#f0f8f7] text-[#5a8a86] border border-[#d9e8e5]';
  if (result) {
    if (points >= 3) style = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    else if (points >= 1) style = 'bg-[#fff8e6] text-[#c8890a] border border-[#f7b32b]/50';
    else style = 'bg-red-50 text-red-500 border border-red-100';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-bold ${style}`}>
      {tip}
      {points > 0 && <span className="ml-1 opacity-60 font-normal">+{points}</span>}
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
              outcome === 'Heim' ? 'bg-blue-400' : outcome === 'Auswärts' ? 'bg-red-400' : 'bg-gray-300'
            }`}
            style={{ width: `${Math.max(12, (count / total) * 60)}px` }}
          />
          <span className="text-[#7aadaa]">{outcome}: <span className="text-[#1e4745] font-medium">{count}</span></span>
        </div>
      ))}
    </div>
  );
}

function isMatchLive(match) {
  if (!match.date) return false;
  const start = new Date(match.date).getTime();
  const now = Date.now();
  return now >= start && now <= start + 120 * 60 * 1000;
}

export default function MatchBreakdown({ matches, standings }) {
  const [expanded, setExpanded] = useState(null);

  const live    = matches.filter(m => isMatchLive(m));
  const played  = matches.filter(m => m.played && !isMatchLive(m));
  const upcoming = matches.filter(m => !m.played && !isMatchLive(m));

  const MatchCard = ({ match }) => {
    const isOpen = expanded === match.id;
    const live = isMatchLive(match);
    return (
      <div className={`border rounded-xl overflow-hidden transition-all shadow-sm ${
        live ? 'bg-white border-red-200' : match.played ? 'bg-white border-[#d9e8e5]' : 'bg-[#f6fbfb] border-[#e5f0ef] opacity-80'
      }`}>
        <button
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#f6fbfb] transition-colors"
          onClick={() => setExpanded(isOpen ? null : match.id)}
        >
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              live
                ? 'bg-red-50 text-red-500 border border-red-200'
                : match.played
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-[#e5f0ef] text-[#7aadaa]'
            }`}>
              {live
                ? <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />Live</span>
                : match.played ? 'Abgepfiffen' : 'Ausstehend'
              }
            </span>
            <span className="font-semibold text-[#1e4745] text-sm">{match.label}</span>
            {match.result && (
              <span className="text-[#f7b32b] font-bold font-mono text-sm bg-[#fff8e6] px-2 py-0.5 rounded">
                {match.result}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[#a8d0cc]">
            {match.date && <span className="text-xs">{new Date(match.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })}</span>}
            <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-[#e5f0ef] px-4 pb-4 pt-3">
            <TipDistribution match={match} standings={standings} />
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {standings.map(p => {
                const pred = p.predictions?.[match.id];
                return (
                  <div
                    key={p.name}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-colors bg-[#f6fbfb] border-[#e5f0ef]"
                  >
                    <span className="text-xs truncate mr-2 text-[#1e4745]">
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
      {live.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            Live ({live.length})
          </h2>
          <div className="space-y-2">
            {live.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {played.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#5a8a86] uppercase tracking-wider mb-3">
            ⚽ Gespielte Partien ({played.length})
          </h2>
          <div className="space-y-2">
            {[...played].reverse().map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#5a8a86] uppercase tracking-wider mb-3">
            🕐 Nächste Partien ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center text-[#a8d0cc] py-12">
          Noch keine Spieldaten vorhanden.
        </div>
      )}
    </div>
  );
}
