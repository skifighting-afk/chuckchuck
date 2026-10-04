// 작업 048: 근무표 반복 등록·지난주 복사·주간 템플릿. 화면과 서버가 같은 규칙을 쓴다.
export type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes: number};
export type TemplateItem = {employeeId: string; weekday: number; start: string; end: string; breakMinutes: number};
export const MAX_REPEAT = 400;

const DAY = 86400000;
export const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
export const weekday = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay(); // 0=일
const range = (s: {date: string; start: string; end: string}) => {
  const a = Date.parse(s.date + 'T' + s.start + ':00+09:00'), b = Date.parse(s.date + 'T' + s.end + ':00+09:00') + (s.end <= s.start ? DAY : 0);
  return [a, b] as const;
};

/** 같은 직원끼리 겹치는 근무가 있으면 그 둘을 돌려준다(직원별 정렬 후 한 번 훑기). */
export function findShiftConflict(shifts: Shift[]): [Shift, Shift] | null {
  const by = new Map<string, {s: Shift; a: number; b: number}[]>();
  for (const s of shifts) { const [a, b] = range(s); (by.get(s.employeeId) || by.set(s.employeeId, []).get(s.employeeId)!).push({s, a, b}); }
  for (const list of by.values()) {
    list.sort((x, y) => x.a - y.a);
    for (let i = 1; i < list.length; i++) if (list[i].a < list[i - 1].b) return [list[i - 1].s, list[i].s];
  }
  return null;
}
const overlaps = (s: Shift, existing: Shift[]) => { const [a, b] = range(s); return existing.some(o => o.employeeId === s.employeeId && o.id !== s.id && (([oa, ob]) => a < ob && b > oa)(range(o))); };

/** 반복 등록: from부터 months개월 동안 고른 요일마다. 겹치는 날은 건너뛴다. */
export function repeatShifts(base: Omit<Shift, 'id' | 'date'>, from: string, weekdays: number[], months: number, existing: Shift[], newId: () => string = () => crypto.randomUUID()) {
  const until = new Date(Date.parse(from + 'T00:00:00Z')); until.setUTCMonth(until.getUTCMonth() + months);
  const end = until.toISOString().slice(0, 10), made: Shift[] = [], skipped: string[] = [];
  for (let d = from; d < end && made.length < MAX_REPEAT; d = addDays(d, 1)) {
    if (!weekdays.includes(weekday(d))) continue;
    const s = {...base, id: newId(), date: d};
    if (overlaps(s, [...existing, ...made])) skipped.push(d); else made.push(s);
  }
  return {made, skipped, until: end};
}

/** 한 주(7일) 근무를 다른 주로 복사. 겹치는 근무는 건너뛴다. */
export function copyWeek(shifts: Shift[], fromStart: string, toStart: string, newId: () => string = () => crypto.randomUUID()) {
  const offset = Math.round((Date.parse(toStart) - Date.parse(fromStart)) / DAY), fromEnd = addDays(fromStart, 7);
  const made: Shift[] = [], skipped: Shift[] = [];
  for (const s of shifts.filter(s => s.date >= fromStart && s.date < fromEnd).sort((a, b) => a.date.localeCompare(b.date))) {
    const n = {...s, id: newId(), date: addDays(s.date, offset)};
    if (overlaps(n, [...shifts, ...made])) skipped.push(n); else made.push(n);
  }
  return {made, skipped};
}

/** 이번 주 근무를 템플릿(요일별)으로 */
export function weekToTemplate(shifts: Shift[], weekStart: string): TemplateItem[] {
  const end = addDays(weekStart, 7);
  return shifts.filter(s => s.date >= weekStart && s.date < end).map(s => ({employeeId: s.employeeId, weekday: weekday(s.date), start: s.start, end: s.end, breakMinutes: s.breakMinutes}));
}
/** 템플릿을 weekStart부터의 7일에 붙이기(퇴사·없는 직원은 제외, 겹치면 건너뜀) */
export function applyTemplate(items: TemplateItem[], weekStart: string, shifts: Shift[], activeIds: Set<string>, newId: () => string = () => crypto.randomUUID()) {
  const made: Shift[] = [], skipped: Shift[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    for (const t of items.filter(t => t.weekday === weekday(d) && activeIds.has(t.employeeId))) {
      const n = {id: newId(), employeeId: t.employeeId, date: d, start: t.start, end: t.end, breakMinutes: t.breakMinutes};
      if (overlaps(n, [...shifts, ...made])) skipped.push(n); else made.push(n);
    }
  }
  return {made, skipped};
}
