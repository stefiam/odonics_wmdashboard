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

function hotStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] > 0) streak++;
    else break;
  }
  return streak;
}

export default function RecentForm({ standings, matches }) {
  const playedMatches = matches.filter(m => m.played).slice(-8);

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
                const recentHistory = player.pointsHistory?.slice(-playedMatches.length) || [];
                const streak = hotStreak(recentHistory);
                const recentPts = recentHistory.reduce((sum, v, i) => {
                  const prev = i === 0 ? (player.pointsHistory?.[player.pointsHistory.length - playedMatches.length - 1] || 0) : recentHistory[i - 1];
                  return sum + (v - prev);
                }, 0);

                return (
                  <tr
                    key={player.name}
                    className={`border-b border-[#e5f0ef] last:border-0 hover:bg-[#f6fbfb] transition-colors ${
                      player.isHighlighted ? 'bg-[#fff8e6]' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${player.isHighlighted ? 'text-[#1e4745] font-bold' : 'text-[#1e4745]'}`}>
                        {player.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs font-bold ${recentPts >= 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                        +{recentPts}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {playedMatches.map((match) => {
                          const pred = player.predictions?.[match.id];
                          let type = 'pending';
                          let title = `${match.label}: kein Tipp`;
                          if (pred) {
                            title = `${match.label}: ${pred.tip} (${pred.points} Pkt)`;
                            if (pred.points >= 3) type = 'exact';
                            else if (pred.points >= 1) type = 'good';
                            else type = 'wrong';
                          }
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
      </div>

      {/* Highlight-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Heißeste Form', icon: '🔥', pick: standings.reduce((a, b) => hotStreak(b.pointsHistory || []) > hotStreak(a.pointsHistory || []) ? b : a, standings[0]) },
          { label: 'Meiste Exakttreffer', icon: '🎯', pick: standings.reduce((a, b) => b.exact > a.exact ? b : a, standings[0]) },
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
