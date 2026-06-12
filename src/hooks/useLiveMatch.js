import { useState, useEffect } from 'react';

const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY;
const POLL_INTERVAL = 30_000;

export default function useLiveMatch() {
  const [liveMatch, setLiveMatch] = useState(null);

  useEffect(() => {
    if (!API_KEY) return;

    async function fetchLive() {
      try {
        const res = await fetch(
          'https://api.football-data.org/v4/competitions/WC/matches?status=LIVE',
          { headers: { 'X-Auth-Token': API_KEY } }
        );
        if (!res.ok) {
          console.warn('[LiveTicker] API error:', res.status, res.statusText);
          return;
        }
        const data = await res.json();
        const m = data.matches?.[0];
        if (!m) { setLiveMatch(null); return; }

        // Score: optional chaining falls fullTime/halfTime null sein kann
        const homeScore = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0;
        const awayScore = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0;

        // Minute: aus API falls vorhanden, sonst aus Anstoßzeit berechnen
        let minute = m.minute ?? null;
        if ((minute === null || minute === 0) && m.status === 'IN_PLAY' && m.utcDate) {
          const elapsed = Math.floor((Date.now() - new Date(m.utcDate)) / 60000);
          // Zweite Halbzeit: ~15 min Pause abziehen wenn elapsed > 60
          const adjusted = elapsed > 60 ? elapsed - 15 : elapsed;
          minute = Math.max(1, Math.min(adjusted, 90));
        }

        setLiveMatch({
          homeTeam:  m.homeTeam?.shortName || m.homeTeam?.name || '?',
          awayTeam:  m.awayTeam?.shortName || m.awayTeam?.name || '?',
          homeScore,
          awayScore,
          minute,
          status: m.status,
        });
      } catch (err) {
        console.warn('[LiveTicker] Fetch error:', err);
      }
    }

    fetchLive();
    const id = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return liveMatch;
}
