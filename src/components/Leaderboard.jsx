function TrendIcon({ trend }) {
  if (trend > 0) return <span className="text-emerald-400 text-xs font-bold">▲{trend}</span>;
  if (trend < 0) return <span className="text-red-400 text-xs font-bold">▼{Math.abs(trend)}</span>;
  return <span className="text-gray-600 text-xs">–</span>;
}

function PodiumBadge({ pos }) {
  if (pos === 1) return <span className="text-[#d9e8e5] text-lg">🥇</span>;
  if (pos === 2) return <span className="text-gray-300 text-lg">🥈</span>;
  if (pos === 3) return <span className="text-amber-600 text-lg">🥉</span>;
  return <span className="text-gray-500 text-sm font-mono w-6 text-center">{pos}.</span>;
}

function AccuracyBar({ exact, tendency, wrong }) {
  const total = exact + tendency + wrong;
  if (total === 0) return <div className="h-1.5 bg-[#1e4745] rounded-full w-20" />;
  const exactPct = (exact / total) * 100;
  const tendPct = (tendency / total) * 100;
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-[#1e4745] w-20 flex">
      <div className="bg-emerald-500 h-full" style={{ width: `${exactPct}%` }} title={`Exakt: ${exact}`} />
      <div className="bg-[#d9e8e5] h-full" style={{ width: `${tendPct}%` }} title={`Tendenz: ${tendency}`} />
    </div>
  );
}

export default function Leaderboard({ standings }) {
  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);

  return (
    <div>
      {/* Podium */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[top3[1], top3[0], top3[2]].map((p, i) => {
          if (!p) return <div key={i} />;
          const visualPos = [2, 1, 3][i];
          const height = ['h-24', 'h-32', 'h-20'][i];
          return (
            <div
              key={p.name}
              className={`relative flex flex-col items-center justify-end pb-3 rounded-xl border ${
                p.isHighlighted
                  ? 'bg-[#d9e8e5]/10 border-[#d9e8e5]/50'
                  : 'bg-[#255552] border-[#2d6460]'
              } ${height}`}
            >
              {visualPos === 1 && (
                <span className="absolute -top-3 text-xl">👑</span>
              )}
              <div className="text-2xl font-bold text-white">{p.points}</div>
              <div className="text-xs text-gray-400 mb-1">Punkte</div>
              <div className={`text-sm font-semibold ${p.isHighlighted ? 'text-[#d9e8e5]' : 'text-gray-200'}`}>
                {p.name}
              </div>
              <div className="text-xs text-gray-500">#{visualPos}</div>
            </div>
          );
        })}
      </div>

      {/* Vollständige Tabelle */}
      <div className="bg-[#111827] rounded-xl border border-[#2d6460] overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-0 text-xs text-gray-500 uppercase tracking-wider px-4 py-2 border-b border-[#2d6460]">
          <span className="w-8">Pos</span>
          <span>Name</span>
          <span className="w-8 text-right">Tr.</span>
          <span className="w-10 text-right">P</span>
          <span className="w-10 text-right">B</span>
          <span className="w-12 text-right">Pkt</span>
        </div>

        {standings.map((p, idx) => (
          <div
            key={p.name}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-0 px-4 py-2.5 border-b border-[#2d6460] last:border-0 transition-colors hover:bg-white/5 ${
              p.isHighlighted ? 'bg-[#d9e8e5]/5' : ''
            }`}
          >
            <div className="w-8 flex items-center">
              <PodiumBadge pos={p.pos} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className={`font-semibold text-sm truncate ${p.isHighlighted ? 'text-[#d9e8e5]' : 'text-gray-100'}`}>
                {p.name}
              </span>
              <AccuracyBar exact={p.exact} tendency={p.tendency} wrong={p.wrong} />
            </div>

            <div className="w-8 text-right">
              <TrendIcon trend={p.pos < p.posPrev ? p.posPrev - p.pos : p.posPrev > p.pos ? -(p.pos - p.posPrev) : 0} />
            </div>

            <div className="w-10 text-right text-xs text-emerald-400">{p.exact}</div>
            <div className="w-10 text-right text-xs text-[#d9e8e5]">{p.tendency}</div>
            <div className={`w-12 text-right font-bold text-sm ${p.isHighlighted ? 'text-[#d9e8e5]' : 'text-gray-200'}`}>
              {p.points}
            </div>
          </div>
        ))}
      </div>

      {/* Legende */}
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> P = Exakt getippt</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#d9e8e5] inline-block" /> B = Tendenz richtig</span>
        <span>Pkt = Gesamtpunkte</span>
      </div>
    </div>
  );
}
