import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useState } from 'react';

const COLORS = [
  '#1e4745', '#3B82F6', '#EF4444', '#f7b32b', '#8B5CF6',
  '#EC4899', '#10B981', '#6366F1', '#F43F5E', '#A855F7',
  '#0EA5E9', '#D946EF', '#FB923C', '#E879F9', '#60A5FA',
  '#FCD34D', '#C084FC', '#F472B6', '#A78BFA', '#34D399',
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="bg-white border border-[#d9e8e5] rounded-lg p-3 shadow-lg text-xs min-w-[160px]">
      <div className="text-[#7aadaa] mb-2 font-medium">Spieltag {label}</div>
      {sorted.map(entry => (
        <div key={entry.name} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: entry.color }} className="font-medium">{entry.name}</span>
          <span className="text-[#1e4745] font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function PointsChart({ standings }) {
  const maxLen = Math.max(...standings.map(s => s.pointsHistory?.length || 0));
  const [hiddenLines, setHiddenLines] = useState(new Set());

  if (maxLen < 2) {
    return (
      <div className="bg-white rounded-xl border border-[#d9e8e5] p-8 text-center text-[#a8d0cc] shadow-sm">
        Noch nicht genug Daten für eine Verlaufsgrafik (mind. 2 Spieltage nötig).
      </div>
    );
  }

  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const entry = { spieltag: i + 1 };
    standings.forEach(p => {
      entry[p.name] = p.pointsHistory?.[i] ?? null;
    });
    return entry;
  });

  const toggleLine = (name) => {
    setHiddenLines(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#d9e8e5] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e4745] mb-4">Punkteverlauf über Zeit</h2>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5f0ef" />
            <XAxis
              dataKey="spieltag"
              label={{ value: 'Spieltag', position: 'insideBottom', offset: -2, fill: '#7aadaa', fontSize: 11 }}
              tick={{ fill: '#7aadaa', fontSize: 11 }}
              stroke="#d9e8e5"
            />
            <YAxis tick={{ fill: '#7aadaa', fontSize: 11 }} stroke="#d9e8e5" />
            <Tooltip content={<CustomTooltip />} />
            {standings.map((p, i) =>
              hiddenLines.has(p.name) ? null : (
                <Line
                  key={p.name}
                  type="monotone"
                  dataKey={p.name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Spieler-Toggle-Chips */}
      <div className="bg-white rounded-xl border border-[#d9e8e5] p-4 shadow-sm">
        <p className="text-xs text-[#a8d0cc] mb-3">Klick auf Namen zum Ein-/Ausblenden:</p>
        <div className="flex flex-wrap gap-2">
          {standings.map((p, i) => (
            <button
              key={p.name}
              onClick={() => toggleLine(p.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity border-[#d9e8e5] bg-[#f6fbfb] ${
                hiddenLines.has(p.name) ? 'opacity-30' : 'opacity-100'
              }`}
              style={{ color: COLORS[i % COLORS.length] }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {p.name}
              <span className="text-[#7aadaa] font-bold ml-0.5">{p.points}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
