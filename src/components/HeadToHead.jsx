import { useState } from 'react';

const EXACT_POINTS = 4;

// Farbe einer Tipp-Zelle nach erzielten Punkten
function tipClass(pred) {
  if (!pred || !pred.tip) return 'text-gray-300';
  if (pred.points == null) return 'bg-[#f0f8f7] text-[#5a8a86]';
  if (pred.points >= EXACT_POINTS) return 'bg-emerald-50 text-emerald-700';
  if (pred.points >= 1) return 'bg-[#fff8e6] text-[#c8890a]';
  return 'bg-red-50 text-red-500';
}

function StatBar({ label, val1, val2, name1, name2 }) {
  const total = val1 + val2;
  const pct1 = total === 0 ? 50 : Math.round((val1 / total) * 100);
  const pct2 = 100 - pct1;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-semibold text-[#1e4745] mb-1">
        <span>{val1}</span>
        <span className="text-[#7aadaa] font-normal">{label}</span>
        <span>{val2}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-[#e5f0ef]">
        <div className="bg-[#1e4745] h-full transition-all" style={{ width: `${pct1}%` }} />
        <div className="bg-[#f7b32b] h-full transition-all" style={{ width: `${pct2}%` }} />
      </div>
    </div>
  );
}

export default function HeadToHead({ standings, matches }) {
  const [p1Name, setP1Name] = useState(standings[0]?.name || '');
  const [p2Name, setP2Name] = useState(standings[1]?.name || '');

  const p1 = standings.find(s => s.name === p1Name);
  const p2 = standings.find(s => s.name === p2Name);

  // Gespielte Matches mit Tipp von beiden
  const playedMatches = matches.filter(m => m.played);

  // Head-to-Head pro Spiel
  const matchRows = playedMatches.map(m => {
    const pred1 = p1?.predictions?.[m.id];
    const pred2 = p2?.predictions?.[m.id];
    return { match: m, pred1, pred2 };
  }).filter(r => r.pred1 || r.pred2);

  // Punkte pro Spiel (aus pointsHistory-Differenzen schätzen)
  const pts1 = p1?.points ?? 0;
  const pts2 = p2?.points ?? 0;
  const exact1 = p1?.exact ?? 0;
  const exact2 = p2?.exact ?? 0;
  const tend1 = p1?.tendency ?? 0;
  const tend2 = p2?.tendency ?? 0;
  const wrong1 = p1?.wrong ?? 0;
  const wrong2 = p2?.wrong ?? 0;

  const winner = pts1 > pts2 ? p1Name : pts2 > pts1 ? p2Name : 'Gleichstand';

  return (
    <div className="space-y-4">
      {/* Spieler-Auswahl */}
      <div className="bg-white rounded-xl border border-[#d9e8e5] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e4745] mb-3">Direktvergleich</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { val: p1Name, set: setP1Name, color: '#1e4745', label: 'Spieler 1' },
            { val: p2Name, set: setP2Name, color: '#f7b32b', label: 'Spieler 2' },
          ].map(({ val, set, color, label }) => (
            <div key={label}>
              <label className="text-xs text-[#7aadaa] block mb-1">{label}</label>
              <select
                value={val}
                onChange={e => set(e.target.value)}
                className="w-full border border-[#d9e8e5] rounded-lg px-3 py-2 text-sm text-[#1e4745] bg-white focus:outline-none focus:border-[#f7b32b]"
              >
                {standings.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {p1 && p2 && (
        <>
          {/* Vergleichs-Header */}
          <div className="bg-white rounded-xl border border-[#d9e8e5] shadow-sm overflow-hidden">
            <div className="grid grid-cols-3 text-center">
              <div className="p-4 bg-[#f6fbfb]">
                <div className="text-2xl font-bold text-[#1e4745]">{pts1}</div>
                <div className="text-xs text-[#7aadaa]">Punkte</div>
                <div className="mt-1 text-sm font-semibold text-[#1e4745]">{p1Name}</div>
                <div className="text-xs mt-0.5">Rang {p1.pos}</div>
              </div>
              <div className="p-4 flex flex-col items-center justify-center border-x border-[#e5f0ef]">
                <div className="text-xs text-[#7aadaa] mb-1">Sieger</div>
                <div className={`text-sm font-bold ${winner === 'Gleichstand' ? 'text-[#7aadaa]' : 'text-[#f7b32b]'}`}>
                  {winner === 'Gleichstand' ? '🤝 Gleichstand' : `🏆 ${winner}`}
                </div>
              </div>
              <div className="p-4 bg-[#fff8e6]">
                <div className="text-2xl font-bold text-[#1e4745]">{pts2}</div>
                <div className="text-xs text-[#7aadaa]">Punkte</div>
                <div className="mt-1 text-sm font-semibold text-[#1e4745]">{p2Name}</div>
                <div className="text-xs mt-0.5">Rang {p2.pos}</div>
              </div>
            </div>
          </div>

          {/* Statistik-Bars */}
          <div className="bg-white rounded-xl border border-[#d9e8e5] p-4 shadow-sm">
            <div className="flex justify-between text-xs font-bold text-[#1e4745] mb-3">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#1e4745] inline-block" />{p1Name}</span>
              <span className="text-[#7aadaa]">Statistik</span>
              <span className="flex items-center gap-1">{p2Name}<span className="w-3 h-3 rounded-full bg-[#f7b32b] inline-block" /></span>
            </div>
            <StatBar label="Gesamtpunkte" val1={pts1} val2={pts2} name1={p1Name} name2={p2Name} />
            <StatBar label="Exakt getippt" val1={exact1} val2={exact2} name1={p1Name} name2={p2Name} />
            <StatBar label="Tendenz richtig" val1={tend1} val2={tend2} name1={p1Name} name2={p2Name} />
            <StatBar label="Falsch getippt" val1={wrong1} val2={wrong2} name1={p1Name} name2={p2Name} />
          </div>

          {/* Punkteverlauf Vergleich */}
          {(p1.pointsHistory?.length >= 2 || p2.pointsHistory?.length >= 2) && (
            <div className="bg-white rounded-xl border border-[#d9e8e5] p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-[#7aadaa] uppercase tracking-wider mb-3">Punkteverlauf</h3>
              <div className="flex gap-4 text-xs text-[#7aadaa] mb-2">
                {[{p: p1, c: '#1e4745', n: p1Name}, {p: p2, c: '#f7b32b', n: p2Name}].map(({p, c, n}) => (
                  <span key={n} className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded inline-block" style={{background: c}} />
                    {n}: {p.pointsHistory?.join(' → ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Spiel-für-Spiel Vergleich */}
          {matchRows.length > 0 && (
            <div className="bg-white rounded-xl border border-[#d9e8e5] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e5f0ef] bg-[#f6fbfb]">
                <h3 className="text-sm font-semibold text-[#1e4745]">Tipp-Vergleich pro Spiel</h3>
              </div>
              <div className="divide-y divide-[#e5f0ef]">
                {matchRows.map(({ match, pred1, pred2 }) => (
                  <div key={match.id} className="px-4 py-3 grid grid-cols-3 items-center text-sm">
                    <div className={`text-center px-2 py-1 rounded font-mono font-bold text-xs ${tipClass(pred1)}`}>
                      {pred1?.tip || '–'}
                      {pred1?.points != null && <span className="ml-1 opacity-60 font-normal">+{pred1.points}</span>}
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-semibold text-[#1e4745]">{match.label}</div>
                      {match.result && <div className="text-xs text-[#f7b32b] font-mono font-bold">{match.result}</div>}
                    </div>
                    <div className={`text-center px-2 py-1 rounded font-mono font-bold text-xs ${tipClass(pred2)}`}>
                      {pred2?.tip || '–'}
                      {pred2?.points != null && <span className="ml-1 opacity-60 font-normal">+{pred2.points}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchRows.length === 0 && playedMatches.length > 0 && (
            <div className="bg-white rounded-xl border border-[#d9e8e5] p-6 text-center text-[#a8d0cc] text-sm shadow-sm">
              Tipp-Details pro Spiel folgen nach dem nächsten Scraper-Update.
            </div>
          )}
        </>
      )}
    </div>
  );
}
