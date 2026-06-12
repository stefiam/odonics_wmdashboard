import { useState } from 'react';

const MAX_PTS_PER_GAME = 4; // Kicktipp WM: Exakttreffer = 4 Punkte

export default function WhatIf({ standings, matches }) {
  const [scenario, setScenario] = useState('best'); // best | avg | worst

  const played = matches.filter(m => m.played).length;
  const remaining = matches.filter(m => !m.played).length;

  // Punkte pro verbleibendem Spiel je Szenario
  const ptsPerGame = scenario === 'best' ? MAX_PTS_PER_GAME : scenario === 'worst' ? 0 : 2;
  const addPts = remaining * ptsPerGame;

  const leaderPoints = Math.max(0, ...standings.map(s => s.points));

  const rows = standings
    .map(s => ({
      ...s,
      maxPossible: s.points + remaining * MAX_PTS_PER_GAME,
      projected: s.points + addPts,
      // Kann theoretisch noch gewinnen: eigener Bestfall ≥ aktueller Führender
      canWin: remaining > 0 && s.points + remaining * MAX_PTS_PER_GAME >= leaderPoints,
    }))
    .sort((a, b) => b.projected - a.projected);

  const globalMax = Math.max(1, ...rows.map(r => r.projected));

  const scenarioInfo = {
    best:  { label: '🚀 Bestfall', desc: 'jeder trifft alle Restspiele exakt (+4/Spiel)' },
    avg:   { label: '📊 Realistisch', desc: 'Tendenz-Schnitt (+2/Spiel)' },
    worst: { label: '📉 Schlechtfall', desc: 'keine weiteren Punkte' },
  }[scenario];

  return (
    <div className="space-y-4">
      {/* Szenario-Auswahl */}
      <div className="bg-white rounded-xl border border-[#d9e8e5] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e4745] mb-1">Was wäre wenn…?</h2>
        <div className="text-xs text-[#7aadaa] mb-3">
          {played} gespielt · {remaining} offen · max. {MAX_PTS_PER_GAME} Pkt/Spiel
        </div>
        <div className="flex gap-2 flex-wrap">
          {['best', 'avg', 'worst'].map(val => {
            const info = { best: '🚀 Bestfall', avg: '📊 Realistisch', worst: '📉 Schlechtfall' }[val];
            return (
              <button
                key={val}
                onClick={() => setScenario(val)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  scenario === val
                    ? 'bg-[#f7b32b] border-[#f7b32b] text-white'
                    : 'border-[#d9e8e5] text-[#2d6460] hover:border-[#f7b32b]'
                }`}
              >
                {info}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-[#7aadaa] mt-2">{scenarioInfo.label}: {scenarioInfo.desc}</div>
      </div>

      {/* Projektion */}
      <div className="bg-white rounded-xl border border-[#d9e8e5] overflow-hidden shadow-sm">
        <div className="px-4 py-2 border-b border-[#e5f0ef] bg-[#f6fbfb] grid grid-cols-[auto_1fr_auto_auto] gap-2 text-xs text-[#7aadaa] uppercase tracking-wider">
          <span className="w-6">#</span>
          <span>Spieler</span>
          <span className="w-16 text-right">Jetzt</span>
          <span className="w-20 text-right">Projiziert</span>
        </div>
        {rows.map((p, idx) => {
          const projW = (p.projected / globalMax) * 100;
          const currentW = (p.points / globalMax) * 100;
          return (
            <div
              key={p.name}
              className="px-4 py-3 border-b border-[#e5f0ef] last:border-0"
            >
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center mb-1.5">
                <span className="w-6 text-xs text-[#7aadaa] font-mono">{idx + 1}.</span>
                <span className="text-sm text-[#1e4745] truncate font-semibold">
                  {p.name}
                  {p.canWin && (
                    <span className="ml-1.5 text-[10px] text-emerald-600 font-normal">kann noch gewinnen</span>
                  )}
                </span>
                <span className="w-16 text-right text-xs text-[#7aadaa]">{p.points} Pkt</span>
                <span className="w-20 text-right text-sm font-bold text-[#1e4745]">{p.projected} Pkt</span>
              </div>
              <div className="h-1.5 bg-[#e5f0ef] rounded-full overflow-hidden relative ml-8">
                <div className="absolute left-0 top-0 h-full bg-[#d9e8e5] rounded-full" style={{ width: `${projW}%` }} />
                <div className="absolute left-0 top-0 h-full bg-[#1e4745] rounded-full" style={{ width: `${currentW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-[#a8d0cc] text-center">
        Dunkel = aktuelle Punkte · Hell = projizierter Zuwachs ({ptsPerGame} Pkt × {remaining} Spiele)
      </div>
    </div>
  );
}
