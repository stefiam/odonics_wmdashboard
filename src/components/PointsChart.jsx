import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useState } from 'react';

// 20 visuell unterschiedliche Farben (teal-töne vermieden)
const COLORS = [
  '#d9e8e5', '#3B82F6', '#EF4444', '#F97316', '#8B5CF6',
  '#EC4899', '#FBBF24', '#6366F1', '#F43F5E', '#A855F7',
  '#0EA5E9', '#D946EF', '#FB923C', '#E879F9', '#60A5FA',
  '#FCD34D', '#C084FC', '#F472B6', '#A78BFA', '#93C5FD',
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="bg-[#183d3b] border border-[#2d6460] rounded-lg p-3 shadow-xl text-xs min-w-[160px]">
      <div className="text-gray-400 mb-2 font-medium">Spieltag {label}</div>
      {sorted.map(entry => (
        <div key={entry.name} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: entry.color }} className="font-medium">{entry.name}</span>
          <span className="text-white font-bold">{entry.value}</span>
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
      <div className="bg-[#255552] rounded-xl border border-[#2d6460] p-8 text-center text-gray-500">
        Noch nicht genug Daten für eine Verlaufsgrafik (mind. 2 Spieltage nötig).
      </div>
    );
  }

  // Daten in Recharts-Format transformieren
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
      <div className="bg-[#255552] rounded-xl border border-[#2d6460] p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Punkteverlauf über Zeit</h2>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3d7a76" />
            <XAxis
              dataKey="spieltag"
              label={{ value: 'Spieltag', position: 'insideBottom', offset: -2, fill: '#a8d0cc', fontSize: 11 }}
              tick={{ fill: '#a8d0cc', fontSize: 11 }}
              stroke="#3d7a76"
            />
            <YAxis tick={{ fill: '#a8d0cc', fontSize: 11 }} stroke="#3d7a76" />
            <Tooltip content={<CustomTooltip />} />
            {standings.map((p, i) => (
              <Line
                key={p.name}
                type="monotone"
                dataKey={p.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={p.isHighlighted ? 3 : 1.5}
                dot={false}
                activeDot={{ r: 4 }}
                opacity={hiddenLines.has(p.name) ? 0 : 1}
                strokeDasharray={p.isHighlighted ? '0' : '0'}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Spieler-Toggle-Chips */}
      <div className="bg-[#255552] rounded-xl border border-[#2d6460] p-4">
        <p className="text-xs text-gray-500 mb-3">Klick auf Namen zum Ein-/Ausblenden:</p>
        <div className="flex flex-wrap gap-2">
          {standings.map((p, i) => (
            <button
              key={p.name}
              onClick={() => toggleLine(p.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity ${
                hiddenLines.has(p.name) ? 'opacity-30' : 'opacity-100'
              } ${p.isHighlighted ? 'border-[#d9e8e5]/50' : 'border-[#2d6460]'}`}
              style={{ color: COLORS[i % COLORS.length] }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {p.name}
              <span className="text-gray-400 font-bold ml-0.5">{p.points}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
