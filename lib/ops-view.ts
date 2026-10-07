// 지시서 1라운드 C: 휴가·공지 화면에서 쓰는 계산(서버·화면·체험 화면이 같이 쓴다).
// - 승인하면 생기는 영향 한 줄(휴가: 그날 같은 업무에 남는 사람 / 대타: 맡는 직원의 주 근무시간)
// - 앞으로 2주 휴가 달력, 공지 받는 사람
export type OpsShift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes?: number};
export type OpsEmp = {id: string; name: string; role?: string; branchId?: string};
export type NoticeTarget = {type: 'all'} | {type: 'role'; roles: string[]} | {type: 'people'; ids: string[]};

const DAY = 86400000;
export const plusDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export function shiftHours(s: OpsShift) { let m = mins(s.end) - mins(s.start); if (m <= 0) m += 1440; return Math.max(0, m - (s.breakMinutes || 0)) / 60; }
const overlap = (a: OpsShift, b: OpsShift) => { const [a1, b1] = [mins(a.start), mins(a.end) <= mins(a.start) ? mins(a.end) + 1440 : mins(a.end)], [a2, b2] = [mins(b.start), mins(b.end) <= mins(b.start) ? mins(b.end) + 1440 : mins(b.end)]; return a1 < b2 && a2 < b1; };
export const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
const hrs = (h: number) => (Math.round(h * 10) / 10).toString().replace(/\.0$/, '');

/** 주 시작일(월요일 기본) */
export function weekStartOf(date: string, weekStart: 'mon' | 'sun' = 'mon') {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay(), back = weekStart === 'mon' ? (dow + 6) % 7 : dow;
  return plusDays(date, -back);
}

/** 휴가를 승인하면: 빠지는 근무, 그날 같은 업무에 남는 사람 */
export function leaveImpact(leave: {employeeId: string; start: string; end: string}, shifts: OpsShift[], emps: OpsEmp[]) {
  const me = emps.find(e => e.id === leave.employeeId), role = me?.role || '';
  const mine = shifts.filter(s => s.employeeId === leave.employeeId && s.date >= leave.start && s.date <= leave.end).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  if (!mine.length) return {removed: [] as OpsShift[], text: '그 기간엔 잡힌 근무가 없어요.', alone: false};
  // 근무가 있는 날마다, 같은 업무로 겹치는 시간에 일하는 다른 사람 수
  let worst: {date: string; left: number} | null = null;
  for (const s of mine) {
    const left = shifts.filter(x => x.employeeId !== leave.employeeId && x.date === s.date && overlap(x, s) && (!role || emps.find(e => e.id === x.employeeId)?.role === role)).length;
    if (!worst || left < worst.left) worst = {date: s.date, left};
  }
  const where = role ? `${role}에` : '';
  const head = mine.length === 1 ? `${md(mine[0].date)} ${mine[0].start}–${mine[0].end} 근무가 빠져요. ` : `근무 ${mine.length}개가 근무표에서 빠져요. `;
  const text = head + (worst!.left === 0 ? `승인하면 ${md(worst!.date)} ${where} 아무도 없어요.` : `그날 ${where} ${worst!.left}명이 남아요.`);
  return {removed: mine, text: text.replace(/\s+/g, ' ').trim(), alone: worst!.left === 0};
}

/** 대타·교대를 승인하면: 맡는 직원의 그 주 근무시간 변화 */
export function swapImpact(swap: {kind: string; shift: OpsShift; taker?: {id: string; name: string} | null; counter?: OpsShift | null}, shifts: OpsShift[], weekStart: 'mon' | 'sun' = 'mon') {
  if (!swap.taker) return '';
  const from = weekStartOf(swap.shift.date, weekStart), to = plusDays(from, 6);
  const week = (id: string) => shifts.filter(s => s.employeeId === id && s.date >= from && s.date <= to).reduce((n, s) => n + shiftHours(s), 0);
  const before = week(swap.taker.id), add = shiftHours(swap.shift), minus = swap.counter && swap.counter.date >= from && swap.counter.date <= to ? shiftHours(swap.counter) : 0;
  const after = before + add - minus;
  const warn = before < 15 && after >= 15 ? ' · 주 15시간을 넘어 주휴수당이 생겨요' : after > 52 ? ' · 주 52시간을 넘어요' : '';
  return `${swap.taker.name}님은 그 주 ${hrs(before)}시간에서 ${hrs(after)}시간이 돼요${warn}.`;
}

/** 앞으로 days일, 날짜마다 쉬는 사람(승인·승인 대기) */
export function leaveCalendar(leaves: {employeeId: string; name: string; start: string; end: string; status: string}[], from: string, days = 14) {
  return Array.from({length: days}, (_, i) => {
    const date = plusDays(from, i);
    const people = leaves.filter(l => (l.status === '승인' || l.status === '승인 대기') && l.start <= date && date <= l.end).map(l => ({name: l.name, status: l.status}));
    return {date, people, busy: people.length >= 2};
  });
}

/** 공지를 받을 직원 id */
export function noticeAudience(target: NoticeTarget | undefined, emps: OpsEmp[], branchId: string) {
  const here = emps.filter(e => branchId === 'all' || e.branchId === branchId);
  if (!target || target.type === 'all') return here.map(e => e.id);
  if (target.type === 'role') return here.filter(e => target.roles.includes(e.role || '')).map(e => e.id);
  return here.filter(e => target.ids.includes(e.id)).map(e => e.id);
}
export const targetLabel = (t: NoticeTarget | undefined, emps: OpsEmp[]) =>
  !t || t.type === 'all' ? '전체' : t.type === 'role' ? t.roles.join('·') + ' 직원' : t.ids.map(id => emps.find(e => e.id === id)?.name || '').filter(Boolean).join(', ');

export const REJECT_REASONS = ['그날 인원이 부족해요', '다른 날로 바꿔 줄 수 있을까요?', '조금 더 일찍 말해 주세요'];

/** 지시서 055: 대타 추천 — 그날 근무가 겹치지 않고 휴가가 아닌 직원을, 근무 가능 시간·그 주 시간(주 15·40·52시간 영향) 순으로 */
export function rankSubstitutes(shift: OpsShift, colleagues: OpsEmp[], shifts: OpsShift[], availability: Record<string, {slots?: {weekday: number; start: string; end: string}[]}>, leaves: {employeeId: string; start: string; end: string; status: string}[], weekStart: 'mon' | 'sun' = 'mon') {
  const span = (x: {start: string; end: string}) => { const a = mins(x.start); let b = mins(x.end); if (b <= a) b += 1440; return [a, b]; };
  const [sa, sb] = span(shift), wd = new Date(shift.date + 'T00:00:00Z').getUTCDay(), from = weekStartOf(shift.date, weekStart), to = new Date(Date.parse(from + 'T00:00:00Z') + 6 * 86400000).toISOString().slice(0, 10), h = shiftHours(shift);
  return colleagues.filter(c => c.id !== shift.employeeId).map(c => {
    const mine = shifts.filter(x => x.employeeId === c.id && x.id !== shift.id);
    const clash = mine.some(x => x.date === shift.date && (([a, b]) => a < sb && b > sa)(span(x)));
    const off = leaves.some(l => l.employeeId === c.id && l.status === '승인' && l.start <= shift.date && shift.date <= l.end);
    const before = mine.filter(x => x.date >= from && x.date <= to).reduce((n, x) => n + shiftHours(x), 0), after = before + h;
    const free = (availability[c.id]?.slots || []).some(sl => sl.weekday === wd && (([a, b]) => a <= sa && b >= sb)(span(sl)));
    const sameDay = mine.some(x => x.date === shift.date);
    const notes: string[] = [];
    if (free) notes.push('근무 가능 시간 안');
    if (sameDay && !clash) notes.push('그날 다른 시간 근무 있음');
    if (before < 15 && after >= 15) notes.push(`주 ${Math.round(after * 10) / 10}시간이 돼 주휴수당 생김`);
    if (after > 52) notes.push('주 52시간 넘음');
    else if (after > 40) notes.push('주 40시간 넘어 연장');
    const score = (clash || off ? -100 : 0) + (free ? 3 : 0) + (sameDay ? -1 : 1) + (before < 15 && after >= 15 ? -1 : 0) + (after > 40 ? -2 : 0) + (after > 52 ? -5 : 0);
    return {id: c.id, name: c.name, ok: !clash && !off, reason: clash ? '그 시간에 근무 있음' : off ? '그날 휴가' : notes.join(' · ') || `그 주 ${Math.round(after * 10) / 10}시간`, weekHours: Math.round(after * 10) / 10, score};
  }).sort((a, b) => b.score - a.score || a.weekHours - b.weekHours);
}
