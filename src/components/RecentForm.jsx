const EXACT_POINTS = 4;

function FormDot({ type, title }) {
  const styles = {
    exact:   'bg-emerald-500 ring-1 ring-emerald-400',
    good:    'bg-[#f7b32b] ring-1 ring-[#f7b32b]/70',
    wrong:   'bg-red-400 ring-1 ring-red-300',
    pending: 'bg-[#d9e8e5] ring-1 ring-[#c5dbd9]',
  };
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${styles[type] || styles.pending}`}
      title={title}
    />
  );
}

// Tipp-Typ aus Punkten ableiten
function tipType(pred) {
  if (!pred || pred.points == null) return 'pending';
  if (pred.points >= EXACT_POINTS) return 'exact';
  if (pred.points >= 1) return 'good';
  return 'wrong';
}

export default function RecentForm({ standings, matches }) {
  const playedMatches = matches.filter(m => m.played).slice(-8);

  // Streak: aufeinanderfolgende Treffer (>0 Punkte) von hinten
  const streakOf = (player) => {
    let streak = 0;
    for (let i = playedMatches.length - 1; i >= 0; i--) {
      const pred = player.predictions?.[playedMatches[i].id];
      if (pred && pred.points > 0) streak++;
      else break;
    }
    return streak;
  };

  // Punkte aus den letzten Spielen
  const recentPtsOf = (player) =>
    playedMatches.reduce((sum, m) => sum + (player.predictions?.[m.id]?.points || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#d9e8e5] overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-[#e5f0ef] bg-[#f6fbfb]">
          <h2 className="text-sm font-semibold text-[#1e4745]">Aktuelle Form</h2>
          <p className="text-xs text-[#7aadaa] mt-0.5">
            Letzte {playedMatches.length} Spiele — <span className="text-emerald-500">■</span> Exakt
            {' · '}<span className="text-[#f7b32b]">■</span> Tendenz
            {' · '}<span className="text-red-400">■</span> Falsch
          </p>
        </div>

        {playedMatches.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#a8d0cc]">
            Noch keine gespielten Partien.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[#e5f0ef]">
                  <th className="text-left px-4 py-2 text-xs text-[#7aadaa] font-medium w-36">Spieler</th>
                  <th className="text-right px-4 py-2 text-xs text-[#7aadaa] font-medium w-20">Punkte</th>
                  <th className="px-4 py-2 text-xs text-[#7aadaa] font-medium text-left">
                    <div className="flex gap-1">
                      {playedMatches.map(m => (
                        <span key={m.id} className="text-[10px] text-[#a8d0cc] w-6 text-center truncate" title={m.label}>
                          {m.label.split('–')[0].trim()}
                        </span>
                      ))}
                    </div>
                  </th>
                  <th className="text-right px-4 py-2 text-xs text-[#7aadaa] font-medium w-16">🔥</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(player => {
                  const streak = streakOf(player);
                  const recentPts = recentPtsOf(player);
                  return (
                    <tr
                      key={player.name}
                      className={`border-b border-[#e5f0ef] last:border-0 hover:bg-[#f6fbfb] transition-colors ${
                        player.isHighlighted ? 'bg-[#fff8e6]' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <span className={`text-xs text-[#1e4745] ${player.isHighlighted ? 'font-bold' : 'font-medium'}`}>
                          {player.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-bold text-emerald-600">+{recentPts}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          {playedMatches.map((match) => {
                            const pred = player.predictions?.[match.id];
                            const type = tipType(pred);
                            const title = pred?.tip
                              ? `${match.label}: ${pred.tip}${pred.points != null ? ` (${pred.points} Pkt)` : ''}`
                              : `${match.label}: kein Tipp`;
                            return <FormDot key={match.id} type={type} title={title} />;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-orange-500">
                        {streak > 1 ? `${streak}🔥` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Highlight-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Heißeste Form', icon: '🔥', pick: standings.reduce((a, b) => streakOf(b) > streakOf(a) ? b : a, standings[0]) },
          { label: 'Meiste Exakttreffer', icon: '🎯', pick: standings.reduce((a, b) => (b.exact || 0) > (a.exact || 0) ? b : a, standings[0]) },
          { label: 'Führender', icon: '🏆', pick: standings[0] },
        ].map(({ label, icon, pick }) => (
          <div key={label} className={`border rounded-xl p-4 shadow-sm ${pick?.isHighlighted ? 'bg-[#fff8e6] border-[#f7b32b]/50' : 'bg-white border-[#d9e8e5]'}`}>
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xs text-[#7aadaa]">{label}</div>
            <div className="text-base font-bold mt-1 text-[#1e4745]">{pick?.name}</div>
            <div className="text-xs text-[#7aadaa]">{pick?.points} Punkte</div>
          </div>
        ))}
      </div>
    </div>
  );
}
