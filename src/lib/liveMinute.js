// worldcup26.ir liefert keine Minutenzahl (time_elapsed = "live"), daher
// schätzen wir aus der Anstoßzeit. 2. Halbzeit bewusst ohne genaue Minute
// (Pausen-/Nachspielzeit unbekannt → keine falsche Präzision).
export function liveMinuteLabel(startMs, now) {
  const elapsed = Math.floor((now - startMs) / 60000);
  if (elapsed < 0) return null;
  if (elapsed <= 45) return `${Math.max(1, elapsed)}'`;
  if (elapsed <= 62) return 'HZ';
  return '2. HZ';
}
