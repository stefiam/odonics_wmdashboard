import { useState } from 'react';

function TrendIcon({ trend }) {
  if (trend > 0) return <span className="text-emerald-600 text-xs font-bold">▲{trend}</span>;
  if (trend < 0) return <span className="text-red-500 text-xs font-bold">▼{Math.abs(trend)}</span>;
  return <span className="text-gray-300 text-xs">–</span>;
}

function PodiumBadge({ pos }) {
  if (pos === 1) return <span className="text-lg">🥇</span>;
  if (pos === 2) return <span className="text-lg">🥈</span>;
  if (pos === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-[#1e4745]/40 text-sm font-mono w-6 text-center">{pos}.</span>;
}

function AccuracyBar({ exact, diff = 0, tendency, wrong }) {
  const total = exact + diff + tendency + wrong;
  if (total === 0) return <div className="h-1.5 bg-[#e5f0ef] rounded-full w-20" />;
  const exactPct  = (exact   / total) * 100;
  const diffPct   = (diff    / total) * 100;
  const tendPct   = (tendency / total) * 100;
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-[#e5f0ef] w-20 flex">
      <div className="bg-emerald-500 h-full" style={{ width: `${exactPct}%` }} title={`Exakt (4P): ${exact}`} />
      <div className="bg-sky-400 h-full" style={{ width: `${diffPct}%` }}  title={`+Tordiff. (3P): ${diff}`} />
      <div className="bg-[#f7b32b] h-full" style={{ width: `${tendPct}%` }}   title={`Tendenz (2P): ${tendency}`} />
    </div>
  );
}

function PlayerModal({ player, onClose }) {
  const diff = player.diff || 0;
  const total = player.exact + diff + player.tendency + player.wrong;
  const exactPct = total > 0 ? Math.round((player.exact    / total) * 100) : 0;
  const diffPct  = total > 0 ? Math.round((diff            / total) * 100) : 0;
  const tendPct  = total > 0 ? Math.round((player.tendency / total) * 100) : 0;
  const wrongPct = total > 0 ? Math.round((player.wrong    / total) * 100) : 0;
  const history = player.pointsHistory || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-[#d9e8e5] shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <PodiumBadge pos={player.pos} />
              <h2 className="text-lg font-bold text-[#1e4745]">{player.name}</h2>
            </div>
            <div className="text-xs text-[#7aadaa] mt-0.5">Rang {player.pos} · {player.points} Punkte gesamt</div>
          </div>
          <button onClick={onClose} className="text-[#a8d0cc] hover:text-[#1e4745] text-xl leading-none">×</button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            { label: 'Punkte', val: player.points, color: 'text-[#1e4745]' },
            { label: 'Exakt',  val: player.exact,     color: 'text-emerald-600' },
            { label: '+Tordiff.', val: diff,           color: 'text-emerald-400' },
            { label: 'Tendenz', val: player.tendency,  color: 'text-[#f7b32b]' },
            { label: 'Falsch',  val: player.wrong,     color: 'text-red-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-[#f6fbfb] rounded-xl p-3 text-center border border-[#e5f0ef]">
              <div className={`text-xl font-bold ${color}`}>{val}</div>
              <div className="text-[10px] text-[#7aadaa] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Trefferquoten */}
        {total > 0 && (
          <div className="mb-4">
            <div className="text-xs text-[#7aadaa] mb-2">Trefferquote ({total} Spiele)</div>
            <div className="flex gap-1 h-4 rounded-full overflow-hidden">
              {exactPct > 0 && <div className="bg-emerald-500 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${exactPct}%` }}>{exactPct}%</div>}
              {diffPct  > 0 && <div className="bg-sky-400 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${diffPct}%`  }}>{diffPct}%</div>}
              {tendPct  > 0 && <div className="bg-[#f7b32b] flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${tendPct}%`  }}>{tendPct}%</div>}
              {wrongPct > 0 && <div className="bg-red-300 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${wrongPct}%` }}>{wrongPct}%</div>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#7aadaa] mt-1">
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Exakt {exactPct}%</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> +Tordiff. {diffPct}%</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#f7b32b] inline-block" /> Tendenz {tendPct}%</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" /> Falsch {wrongPct}%</span>
            </div>
          </div>
        )}

        {/* Punkteverlauf */}
        {history.length >= 2 && (
          <div>
            <div className="text-xs text-[#7aadaa] mb-2">Punkteverlauf</div>
            <div className="flex items-end gap-1 h-12">
              {history.map((pts, i) => {
                const maxPts = Math.max(...history);
                const h = maxPts > 0 ? Math.max(4, Math.round((pts / maxPts) * 100)) : 4;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full rounded-t bg-[#1e4745]"
                      style={{ height: `${h}%` }}
                      title={`${pts} Pkt`}
                    />
                    <div className="text-[9px] text-[#a8d0cc]">{i + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PRIZES = { 1: 220, 2: 140, 3: 90, 4: 50, 5: 30 };

// Bei Gleichstand: betroffene Preise aufaddieren und gleichmäßig aufteilen
function computePrizes(standings) {
  const groups = {};
  standings.forEach(p => {
    if (!groups[p.pos]) groups[p.pos] = [];
    groups[p.pos].push(p.name);
  });
  const result = {};
  Object.entries(groups).forEach(([pos, names]) => {
    const p = parseInt(pos);
    let total = 0;
    for (let i = 0; i < names.length; i++) total += (PRIZES[p + i] ?? 0);
    const split = names.length > 0 ? Math.round(total / names.length) : 0;
    names.forEach(name => { result[name] = split; });
  });
  return result;
}

export default function Leaderboard({ standings }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const top3 = standings.slice(0, 3);
  const prizes = computePrizes(standings);

  return (
    <div>
      {/* Spieler-Profil Modal */}
      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}

      {/* Podium */}
      <div className="grid grid-cols-3 gap-3 mb-6 items-end">
        {[top3[1], top3[0], top3[2]].map((p, i) => {
          if (!p) return <div key={i} />;
          const visualPos = [2, 1, 3][i];
          const minH = ['min-h-24', 'min-h-32', 'min-h-20'][i];
          return (
            <button
              key={p.name}
              onClick={() => setSelectedPlayer(p)}
              className={`relative flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 ${minH} w-full transition-shadow hover:shadow-md cursor-pointer bg-white border-[#2d6b68] shadow-sm`}
            >
              {visualPos === 1 && <span className="absolute -top-3 text-xl">👑</span>}
              <div className="text-2xl font-bold text-[#1e4745]">{p.points}</div>
              <div className="text-xs text-[#7aadaa] mb-1">Punkte</div>
              <div className="text-sm font-semibold text-[#1e4745] text-center leading-tight">{p.name}</div>
              <div className="text-xs text-[#7aadaa] mt-0.5">#{visualPos}</div>
            </button>
          );
        })}
      </div>

      {/* Vollständige Tabelle */}
      <div className="bg-white rounded-xl border-2 border-[#2d6b68] overflow-hidden shadow-sm">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-0 text-xs text-[#7aadaa] uppercase tracking-wider px-4 py-2 border-b border-[#e5f0ef] bg-[#f6fbfb]">
          <span className="w-8">Pos</span>
          <span>Name</span>
          <span className="w-8 text-right" title="Trend: Plätze seit letztem Update">+/−</span>
          <span className="w-10 text-right" title="Exakte Treffer">P</span>
          <span className="w-10 text-right" title="Tendenz richtig">B</span>
          <span className="w-12 text-right">Pkt</span>
          <span className="w-14 text-right" title="Aktueller Gewinn bei diesem Stand">€</span>
        </div>

        {standings.map((p) => {
          const prize = prizes[p.name] ?? 0;
          return (
            <div
              key={p.name}
              onClick={() => setSelectedPlayer(p)}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-0 px-4 py-2.5 border-b border-[#e5f0ef] last:border-0 transition-colors hover:bg-[#f6fbfb] cursor-pointer"
            >
              <div className="w-8 flex items-center"><PodiumBadge pos={p.pos} /></div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm truncate text-[#1e4745]">
                  {p.name}
                </span>
                <AccuracyBar exact={p.exact} diff={p.diff} tendency={p.tendency} wrong={p.wrong} />
              </div>
              <div className="w-8 text-right">
                <TrendIcon trend={p.posPrev - p.pos} />
              </div>
              <div className="w-10 text-right text-xs text-emerald-600 font-medium">{p.exact}</div>
              <div className="w-10 text-right text-xs text-[#f7b32b] font-medium">{p.tendency}</div>
              <div className="w-12 text-right font-bold text-sm text-[#1e4745]">{p.points}</div>
              <div className="w-14 text-right text-xs font-semibold">
                {prize > 0
                  ? <span className="text-[#f7b32b]">{prize} €</span>
                  : <span className="text-[#d9e8e5]">–</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 px-3 py-2 rounded-lg bg-[#2d6b68] text-xs text-white">
        <span><span className="font-bold">+/−</span> = Plätze seit letztem Update</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ring-2 ring-white" /> P = Exakt (4P)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block ring-2 ring-white" /> +Tordiff. (3P)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f7b32b] inline-block ring-2 ring-white" /> B = Tendenz (2P)
        </span>
        <span>Pkt = Gesamt · € = Aktueller Gewinn (1.–5. Platz) · Klick auf Zeile = Profil</span>
      </div>
    </div>
  );
}
