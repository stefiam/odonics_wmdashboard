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

function AccuracyBar({ exact, tendency, wrong }) {
  const total = exact + tendency + wrong;
  if (total === 0) return <div className="h-1.5 bg-[#e5f0ef] rounded-full w-20" />;
  const exactPct = (exact / total) * 100;
  const tendPct = (tendency / total) * 100;
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-[#e5f0ef] w-20 flex">
      <div className="bg-emerald-500 h-full" style={{ width: `${exactPct}%` }} title={`Exakt: ${exact}`} />
      <div className="bg-[#f7b32b] h-full" style={{ width: `${tendPct}%` }} title={`Tendenz: ${tendency}`} />
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
                  ? 'bg-[#fff8e6] border-[#f7b32b]/60 shadow-sm'
                  : 'bg-white border-[#d9e8e5] shadow-sm'
              } ${height}`}
            >
              {visualPos === 1 && (
                <span className="absolute -top-3 text-xl">👑</span>
              )}
              <div className="text-2xl font-bold text-[#1e4745]">{p.points}</div>
              <div className="text-xs text-[#7aadaa] mb-1">Punkte</div>
              <div className={`text-sm font-semibold ${p.isHighlighted ? 'text-[#1e4745]' : 'text-[#1e4745]'}`}>
                {p.name}
              </div>
              <div className="text-xs text-[#7aadaa]">#{visualPos}</div>
            </div>
          );
        })}
      </div>

      {/* Vollständige Tabelle */}
      <div className="bg-white rounded-xl border border-[#d9e8e5] overflow-hidden shadow-sm">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-0 text-xs text-[#7aadaa] uppercase tracking-wider px-4 py-2 border-b border-[#e5f0ef] bg-[#f6fbfb]">
          <span className="w-8">Pos</span>
          <span>Name</span>
          <span className="w-8 text-right">Tr.</span>
          <span className="w-10 text-right">P</span>
          <span className="w-10 text-right">B</span>
          <span className="w-12 text-right">Pkt</span>
        </div>

        {standings.map((p) => (
          <div
            key={p.name}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-0 px-4 py-2.5 border-b border-[#e5f0ef] last:border-0 transition-colors hover:bg-[#f6fbfb] ${
              p.isHighlighted ? 'bg-[#fff8e6]' : ''
            }`}
          >
            <div className="w-8 flex items-center">
              <PodiumBadge pos={p.pos} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className={`font-semibold text-sm truncate ${p.isHighlighted ? 'text-[#1e4745] font-bold' : 'text-[#1e4745]'}`}>
                {p.name}
                {p.isHighlighted && <span className="ml-1.5 text-[10px] bg-[#f7b32b] text-white px-1.5 py-0.5 rounded-full font-normal align-middle">Du</span>}
              </span>
              <AccuracyBar exact={p.exact} tendency={p.tendency} wrong={p.wrong} />
            </div>

            <div className="w-8 text-right">
              <TrendIcon trend={p.pos < p.posPrev ? p.posPrev - p.pos : p.posPrev > p.pos ? -(p.pos - p.posPrev) : 0} />
            </div>

            <div className="w-10 text-right text-xs text-emerald-600 font-medium">{p.exact}</div>
            <div className="w-10 text-right text-xs text-[#f7b32b] font-medium">{p.tendency}</div>
            <div className={`w-12 text-right font-bold text-sm ${p.isHighlighted ? 'text-[#1e4745]' : 'text-[#1e4745]'}`}>
              {p.points}
            </div>
          </div>
        ))}
      </div>

      {/* Legende */}
      <div className="flex gap-4 mt-3 text-xs text-[#7aadaa]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> P = Exakt</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f7b32b] inline-block" /> B = Tendenz</span>
        <span>Pkt = Gesamt</span>
      </div>
    </div>
  );
}
