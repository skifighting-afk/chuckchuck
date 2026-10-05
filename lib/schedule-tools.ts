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

// 작업 050: 근무 가능 시간으로 근무표 초안
export type Slot = {weekday: number; start: string; end: string};
export type Need = Slot & {count: number; breakMinutes: number};
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const span = (s: {start: string; end: string}) => { const a = mins(s.start), b = mins(s.end); return [a, b <= a ? b + 1440 : b] as const; };
const net = (s: {start: string; end: string; breakMinutes: number}) => { const [a, b] = span(s); return Math.max(0, b - a - s.breakMinutes) / 60; };
/** 필요 인원(요일·시간·명수)을 근무 가능 시간이 맞는 직원으로 채운다. 이번 주 배정 시간이 적은 직원부터, 주 소정근로시간을 넘기지 않게. */
export function draftFromAvailability(needs: Need[], availability: Record<string, Slot[]>, weekStart: string, shifts: Shift[], staff: {id: string; weeklyHours: number}[], leaves: {employeeId: string; start: string; end: string}[] = [], newId: () => string = () => crypto.randomUUID()) {
  const end = addDays(weekStart, 7), made: Shift[] = [], unfilled: {date: string; start: string; end: string; missing: number}[] = [];
  const hours = new Map(staff.map(e => [e.id, 0]));
  for (const s of shifts) if (s.date >= weekStart && s.date < end && hours.has(s.employeeId)) hours.set(s.employeeId, hours.get(s.employeeId)! + net(s));
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i), wd = weekday(date);
    for (const need of needs.filter(n => n.weekday === wd).sort((a, b) => a.start.localeCompare(b.start))) {
      const [na, nb] = span(need);
      const covering = (s: Shift) => s.date === date && (([a, b]) => a <= na && b >= nb)(span(s));
      let missing = need.count - [...shifts, ...made].filter(covering).length;
      const dur = net(need);
      const candidates = staff.filter(e => {
        if ([...shifts, ...made].some(s => s.employeeId === e.id && covering(s))) return false;
        if (!(availability[e.id] || []).some(sl => sl.weekday === wd && (([a, b]) => a <= na && b >= nb)(span(sl)))) return false;
        if (leaves.some(l => l.employeeId === e.id && date >= l.start && date <= l.end)) return false;
        if (e.weeklyHours > 0 && hours.get(e.id)! + dur > e.weeklyHours) return false;
        return true;
      }).sort((a, b) => hours.get(a.id)! - hours.get(b.id)! || a.id.localeCompare(b.id));
      for (const e of candidates) {
        if (missing <= 0) break;
        const s = {id: newId(), employeeId: e.id, date, start: need.start, end: need.end, breakMinutes: need.breakMinutes};
        if (overlaps(s, [...shifts, ...made])) continue;
        made.push(s); hours.set(e.id, hours.get(e.id)! + dur); missing--;
      }
      if (missing > 0) unfilled.push({date, start: need.start, end: need.end, missing});
    }
  }
  return {made, unfilled};
}

// 가이드 81: 근무표를 짤 때 가산수당이 붙는 근무를 미리 보여 준다(5명 이상 사업장).
// 야간: 22~06시 근무(휴게는 근무 시간 비율로 뺌). 연장: 하루 8시간 넘는 시간과 주 40시간 넘는 시간 중 큰 쪽(겹쳐 세지 않음).
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export function premiumPreview(shifts: Shift[], weekStart: string, names: Record<string, string>) {
  const end = new Date(Date.parse(weekStart + 'T00:00:00Z') + 7 * 86400000).toISOString().slice(0, 10);
  const by = new Map<string, {night: number; daily: number; total: number}>();
  for (const s of shifts.filter(x => x.date >= weekStart && x.date < end)) {
    const a = toMin(s.start), b0 = toMin(s.end), b = b0 <= a ? b0 + 1440 : b0, span = b - a;
    if (span <= 0) continue;
    let night = 0; for (let t = a; t < b; t++) { const m = t % 1440; if (m >= 1320 || m < 360) night++; }
    const keep = (span - Math.min(span, s.breakMinutes)) / span, worked = (span - Math.min(span, s.breakMinutes)) / 60;
    const r = by.get(s.employeeId) || {night: 0, daily: 0, total: 0};
    r.night += night * keep / 60; r.daily += Math.max(0, worked - 8); r.total += worked;
    by.set(s.employeeId, r);
  }
  return [...by.entries()].map(([id, r]) => ({employeeId: id, name: names[id] || '직원', night: Math.round(r.night * 10) / 10, overtime: Math.round(Math.max(r.daily, r.total - 40) * 10) / 10, total: Math.round(r.total * 10) / 10}))
    .filter(x => x.night > 0 || x.overtime > 0);
}
