// ============================================================
// Planen: Wiener Kalendertage und die Vorhersage, was bald fehlt.
// Reine Funktionen, damit sie sich ohne Server testen lassen.
// ============================================================
const DAY = 864e5;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Kalendertag + Stunde in Wien, egal in welcher Zeitzone der Server läuft
export function vienna(ts = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

// "2026-11-12" + 1 → "2026-11-13" (rechnet in UTC, deshalb ohne Sommerzeit-Ärger)
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const validDay = s => DATE_RE.test(s) && addDays(s, 0) === s;

const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Wann fehlt ein Artikel wahrscheinlich das nächste Mal?
// Grundlage: wann er bisher auf die Liste kam (r.at). Einträge, die keine
// 12 Stunden auseinander liegen, zählen als ein Mal. Ab 3 Malen gibt es
// eine Vorhersage: letztes Mal + typischer Abstand (Median).
export function forecast(requests, { now = Date.now(), ahead = 14, lookback = 120, minTimes = 3, skip = new Set() } = {}) {
  const since = now - lookback * DAY;
  const per = new Map();
  for (const r of requests) {
    if (!(r.at > since) || skip.has(r.item)) continue;
    (per.get(r.item) || per.set(r.item, []).get(r.item)).push(r);
  }
  const out = [];
  for (const [item, list] of per) {
    list.sort((a, b) => a.at - b.at);
    const times = [];
    for (const r of list) if (!times.length || r.at - times[times.length - 1] >= DAY / 2) times.push(r.at);
    if (times.length < minTimes) continue;
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    const every = median(gaps);
    const next = times[times.length - 1] + every;
    if (next > now + ahead * DAY) continue;
    const last = list[list.length - 1];
    out.push({
      item, next: Math.round(next), every: Math.round(every / DAY * 10) / 10, times: times.length,
      qty: Math.round(median(list.map(r => r.qty)) * 100) / 100, unit: last.unit,
    });
  }
  return out.sort((a, b) => a.next - b.next);
}
