// 지시서 8주차: 직원 화면 — 이번 주 주휴 조건 진행, 내 근무 달력
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Rec = {start: string; end: string | null; breakMinutes: number};
type Shift = {date: string; start: string; end: string; breakMinutes?: number};
const kd = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const worked = (r: Rec, now: number) => Math.max(0, ((r.end ? Date.parse(r.end) : now) - Date.parse(r.start)) / 3600000 - (r.breakMinutes || 0) / 60);
const sh = (s: Shift) => { const a = Number(s.start.slice(0, 2)) * 60 + Number(s.start.slice(3)); let b = Number(s.end.slice(0, 2)) * 60 + Number(s.end.slice(3)); if (b <= a) b += 1440; return Math.max(0, b - a - (s.breakMinutes || 0)) / 60; };

/** 이번 주 근무(기록) + 남은 근무표 → 주 15시간 넘을지 */
export function weekProgress(recs: Rec[], shifts: Shift[], now: number, ws: 'mon' | 'sun' = 'mon') {
  const today = kd(now), w = new Date(today + 'T00:00:00Z').getUTCDay(), from = plus(today, -(ws === 'mon' ? (w + 6) % 7 : w)), to = plus(from, 6);
  const done = recs.filter(r => kd(Date.parse(r.start)) >= from && kd(Date.parse(r.start)) <= to).reduce((n, r) => n + worked(r, now), 0);
  const ahead = shifts.filter(s => s.date > today && s.date <= to).reduce((n, s) => n + sh(s), 0);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const text = done >= 15 ? '이번 주 15시간을 넘겼어요. 주휴수당 조건(근무 시간)을 채웠어요.' : done + ahead >= 15 ? `남은 근무표대로 일하면 이번 주 ${r1(done + ahead)}시간이 돼 15시간을 넘어요.` : `이번 주 근무표대로면 ${r1(done + ahead)}시간이라 주휴수당 기준(15시간)보다 적어요.`;
  return {from, to, done: r1(done), ahead: r1(ahead), pct: Math.min(100, Math.round(done / 15 * 100)), text};
}

/** 내 근무 달력: 날마다 근무표·실제 시간 */
export function myMonth(month: string, recs: Rec[], shifts: Shift[], now: number) {
  const [y, m] = month.split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).getUTCDate(), today = kd(now);
  const days = Array.from({length: last}, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`, plan = shifts.filter(s => s.date === date), mine = recs.filter(r => kd(Date.parse(r.start)) === date);
    const hours = Math.round(mine.reduce((n, r) => n + worked(r, now), 0) * 10) / 10;
    const state = mine.some(r => !r.end) ? (date === today ? '근무 중' : '퇴근 기록 없음') : mine.length ? '근무함' : plan.length ? (date < today ? '기록 없음' : '예정') : '';
    return {date, dow: new Date(date + 'T00:00:00Z').getUTCDay(), plan: plan.map(s => `${s.start}–${s.end}`), hours, state};
  });
  return {days, lead: days[0].dow, total: Math.round(days.reduce((n, d) => n + d.hours, 0) * 10) / 10, workedDays: days.filter(d => d.hours > 0).length};
}
