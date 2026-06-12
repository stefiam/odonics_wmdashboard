import { useState, useEffect } from 'react';

const POLL_INTERVAL = 60_000;

export default function useLiveMatch() {
  const [liveMatch, setLiveMatch] = useState(null);

  useEffect(() => {
    async function fetchLive() {
      try {
        const res = await fetch('https://worldcup26.ir/get/games');
        if (!res.ok) return;
        const data = await res.json();
        const games = data.games || [];

        const live = games.find(g =>
          g.finished === 'FALSE' &&
          g.time_elapsed !== 'notstarted' &&
          g.time_elapsed !== 'finished' &&
          g.time_elapsed != null &&
          g.time_elapsed !== ''
        );

        if (!live) { setLiveMatch(null); return; }

        setLiveMatch({
          homeTeam:  live.home_team_name_en,
          awayTeam:  live.away_team_name_en,
          homeScore: parseInt(live.home_score) || 0,
          awayScore: parseInt(live.away_score) || 0,
          minute:    live.time_elapsed,
        });
      } catch {
        // stiller Fallback
      }
    }

    fetchLive();
    const id = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return liveMatch;
}
