// 지시서 3차 필수 ② 근무표 편집: 165 반복 근무 한꺼번에 고치기, 164 하루·한 주 통째로 옮기기·지우기, 169 직원별 색
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes: number; series?: string; position?: string; note?: string};
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const span = (x: Shift) => { const day = Date.parse(x.date + 'T00:00:00Z') / 60000, s = day + mins(x.start); let e = day + mins(x.end); if (e <= s) e += 1440; return [s, e]; };
const clash = (a: Shift, list: Shift[]) => list.some(b => b.id !== a.id && b.employeeId === a.employeeId && (() => { const [x, y] = span(a), [p, q] = span(b); return x < q && p < y; })());

/** 165: 같은 반복 묶음의 이 날짜 이후 근무를 모두 같은 시간·업무·메모로 */
export function seriesEdit<T extends Shift>(shifts: T[], id: string, patch: Partial<Pick<Shift, 'start' | 'end' | 'breakMinutes' | 'position' | 'note'>>) {
  const me = shifts.find(x => x.id === id); if (!me?.series) return {shifts, count: 0};
  let count = 0; const out = shifts.map(x => x.series === me.series && x.date >= me.date ? (count++, {...x, ...patch}) : x);
  return {shifts: out, count};
}
export function seriesDelete<T extends Shift>(shifts: T[], id: string) {
  const me = shifts.find(x => x.id === id); if (!me?.series) return {shifts: shifts.filter(x => x.id !== id), count: 1};
  const keep = shifts.filter(x => !(x.series === me.series && x.date >= me.date)); return {shifts: keep, count: shifts.length - keep.length};
}
/** 164: 날짜 범위의 근무를 n일 옮기거나 지운다. blocked(date, employeeId)가 true인 날(휴가·확정 월)은 건너뛴다 */
export function rangeShift<T extends Shift>(shifts: T[], from: string, to: string, ids: string[] | null, days: number, blocked: (date: string, emp: string) => boolean = () => false) {
  const pick = (x: T) => x.date >= from && x.date <= to && (!ids || ids.includes(x.employeeId));
  const targets = shifts.filter(pick), rest = shifts.filter(x => !pick(x)), moved: T[] = [], skipped: {date: string; employeeId: string; why: string}[] = [];
  if (days === 0) { for (const t of targets) { if (blocked(t.date, t.employeeId)) { rest.push(t); skipped.push({date: t.date, employeeId: t.employeeId, why: '확정된 달'}); } } return {shifts: rest, moved: [] as T[], removed: targets.length - skipped.length, skipped}; }
  for (const t of targets) {
    const n = {...t, date: plus(t.date, days)};
    if (blocked(t.date, t.employeeId) || blocked(n.date, t.employeeId)) { rest.push(t); skipped.push({date: t.date, employeeId: t.employeeId, why: '휴가·확정된 달'}); continue; }
    if (clash(n, [...rest, ...moved])) { rest.push(t); skipped.push({date: t.date, employeeId: t.employeeId, why: '옮길 날에 겹치는 근무'}); continue; }
    moved.push(n);
  }
  return {shifts: [...rest, ...moved], moved, removed: 0, skipped};
}
/** 169: 직원별 색(글자와 함께 써서 색만으로 구분하지 않음) */
export const EMP_COLORS = ['#1f6f4a', '#1f4e8a', '#8a3b00', '#6b3d8a', '#00707a', '#8a6d00', '#9a2b55', '#3d5a1f'];
export const empColor = (id: string, ids: string[]) => EMP_COLORS[Math.max(0, ids.indexOf(id)) % EMP_COLORS.length];
/** 170: 근무표 변경 이력 한 줄 요약 */
export function shiftDiffSummary(before: Shift[] | null, after: Shift[] | null, name: (id: string) => string) {
  const b = new Map((before || []).map(x => [x.id, x])), a = new Map((after || []).map(x => [x.id, x]));
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
  const added = [...a.values()].filter(x => !b.has(x.id)), removed = [...b.values()].filter(x => !a.has(x.id));
  const changed = [...a.values()].filter(x => { const o = b.get(x.id); return o && (o.date !== x.date || o.start !== x.start || o.end !== x.end || o.employeeId !== x.employeeId || o.breakMinutes !== x.breakMinutes); });
  const parts: string[] = [];
  const few = (l: Shift[], f: (x: Shift) => string) => l.slice(0, 3).map(f).join(', ') + (l.length > 3 ? ` 외 ${l.length - 3}건` : '');
  if (added.length) parts.push(`추가 ${added.length}건(${few(added, x => `${name(x.employeeId)} ${md(x.date)} ${x.start}–${x.end}`)})`);
  if (changed.length) parts.push(`변경 ${changed.length}건(${few(changed, x => { const o = b.get(x.id)!; return `${name(x.employeeId)} ${md(o.date)} ${o.start}–${o.end} → ${o.date !== x.date ? md(x.date) + ' ' : ''}${x.start}–${x.end}`; })})`);
  if (removed.length) parts.push(`삭제 ${removed.length}건(${few(removed, x => `${name(x.employeeId)} ${md(x.date)}`)})`);
  return parts.join(' · ') || '변경 없음';
}
