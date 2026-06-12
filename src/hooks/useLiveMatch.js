import { useState, useEffect } from 'react';

const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY;
const POLL_INTERVAL = 60_000;

export default function useLiveMatch() {
  const [liveMatch, setLiveMatch] = useState(null);

  useEffect(() => {
    if (!API_KEY) return;

    async function fetchLive() {
      try {
        const res = await fetch(
          'https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,PAUSED',
          { headers: { 'X-Auth-Token': API_KEY } }
        );
        if (!res.ok) return;
        const data = await res.json();
        const m = data.matches?.[0];
        if (!m) { setLiveMatch(null); return; }
        setLiveMatch({
          homeTeam:  m.homeTeam.shortName || m.homeTeam.name,
          awayTeam:  m.awayTeam.shortName || m.awayTeam.name,
          homeScore: m.score.fullTime.home ?? m.score.halfTime.home ?? 0,
          awayScore: m.score.fullTime.away ?? m.score.halfTime.away ?? 0,
          minute:    m.minute ?? null,
          status:    m.status,
        });
      } catch {
        // stiller Fallback — kein API-Key, kein Netz, etc.
      }
    }

    fetchLive();
    const id = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return liveMatch;
}
