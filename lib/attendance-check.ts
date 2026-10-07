// 작업 046: 근무표와 실제 출퇴근을 비교해 지각·조퇴·미출근·예정 외 출근을 찾는다.
// 정상(허용 오차 안)은 따로 표시하지 않고, 사장님이 볼 것만 "확인 권장"으로 모은다.
export type Tolerance = 'lenient' | 'normal' | 'strict';
export const TOLERANCE_MINUTES: Record<Tolerance, number> = {lenient: 10, normal: 5, strict: 0};
export const TOLERANCE_NAMES: Record<Tolerance, string> = {lenient: '관대(10분)', normal: '보통(5분)', strict: '엄격(0분)'};
type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes?: number};
type Att = {id: string; employeeId: string; start: string; end: string | null; breakStart?: string | null; breakPlan?: number | null};
type Leave = {employeeId: string; start: string; end: string};
// 지시서 2라운드 003: 한 줄에 붙는 상태. 확인 권장·척척 비서·기록표가 모두 이 판정(dayRows)을 쓴다.
export type StatusKind = '정상' | '지각' | '조퇴' | '미출근' | '결근' | '미퇴근' | '예정 외' | '휴게 중' | '휴가' | '출근 전';
export type Status = {kind: StatusKind; minutes?: number};
export type DayRow<S extends Shift = Shift, A extends Att = Att> = {key: string; employeeId: string; date: string; shift?: S; records: A[]; statuses: Status[]};
export type Finding = {kind: '지각' | '조퇴' | '미출근' | '결근' | '미퇴근' | '예정 외 출근'; employeeId: string; date: string; minutes?: number; shiftId?: string; attendanceId?: string};

const DAY = 86400000;
const kdate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);
const at = (date: string, hm: string) => Date.parse(`${date}T${hm}:00+09:00`);
const mins = (ms: number) => Math.round(ms / 60000);
/** 근무표 근무의 시작·끝(ms). 자정 넘는 근무는 다음 날 끝 */
export const shiftSpan = (s: {date: string; start: string; end: string}) => { const ss = at(s.date, s.start); return [ss, at(s.date, s.end) + (s.end <= s.start ? DAY : 0)] as const; };

/** date(한국)의 근무표 근무마다, 그리고 근무표에 없는 출근마다 한 줄. 줄마다 상태(여러 개 가능) */
export function dayRows<S extends Shift, A extends Att>(date: string, shifts: S[], attendance: A[], tolerance: Tolerance = 'normal', now = Date.now(), leaves: Leave[] = []): DayRow<S, A>[] {
  const tol = TOLERANCE_MINUTES[tolerance] * 60000, rows: DayRow<S, A>[] = [];
  const todays = shifts.filter(s => s.date === date).sort((a, b) => a.start.localeCompare(b.start)), recs = attendance.filter(a => kdate(a.start) === date), used = new Set<string>();
  const onLeave = (id: string) => leaves.some(l => l.employeeId === id && l.start <= date && date <= l.end);
  for (const s of todays) {
    const [ss, se] = shiftSpan(s);
    // 같은 직원이 근무 시간 안에서 찍은 기록은 모두 이 근무에 묶는다(중간에 퇴근했다 다시 출근해도 '예정 외'가 아님).
    const mine = recs.filter(a => a.employeeId === s.employeeId && !used.has(a.id) && Date.parse(a.start) < se && (a.end ? Date.parse(a.end) : now) > ss - 2 * 3600000)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const st: Status[] = [];
    for (const a of mine) used.add(a.id);
    if (!mine.length) {
      if (onLeave(s.employeeId)) st.push({kind: '휴가'});
      else if (now >= se) st.push({kind: '결근'});
      else if (now > ss + tol) st.push({kind: '미출근', minutes: mins(now - ss)});
      else st.push({kind: '출근 전'});
    } else {
      const first = mine[0], last = mine[mine.length - 1], open = mine.find(a => !a.end);
      const late = Date.parse(first.start) - ss;
      if (late > tol) st.push({kind: '지각', minutes: mins(late)});
      if (!open && last.end) { const early = se - Date.parse(last.end); if (early > tol) st.push({kind: '조퇴', minutes: mins(early)}); }
      if (open?.breakStart) st.push({kind: '휴게 중'});
      if (open && now > se + tol) st.push({kind: '미퇴근', minutes: mins(now - se)});
      if (!st.length) st.push({kind: '정상'});
    }
    rows.push({key: s.id, employeeId: s.employeeId, date, shift: s, records: mine, statuses: st});
  }
  for (const a of recs) if (!used.has(a.id)) rows.push({key: a.id, employeeId: a.employeeId, date, records: [a], statuses: [{kind: '예정 외'}, ...(!a.end && a.breakStart ? [{kind: '휴게 중' as const}] : [])]});
  return rows;
}

/** 확인 권장: 사장님이 볼 것만(정상·휴게 중·휴가·출근 전 제외) */
export function checkDay(date: string, shifts: Shift[], attendance: Att[], tolerance: Tolerance = 'normal', now = Date.now(), leaves: Leave[] = []): Finding[] {
  const out: Finding[] = [];
  for (const r of dayRows(date, shifts, attendance, tolerance, now, leaves)) for (const x of r.statuses) {
    if (x.kind === '예정 외') out.push({kind: '예정 외 출근', employeeId: r.employeeId, date, attendanceId: r.records[0]?.id});
    else if (x.kind === '지각' || x.kind === '조퇴' || x.kind === '미출근' || x.kind === '결근' || x.kind === '미퇴근')
      out.push({kind: x.kind, employeeId: r.employeeId, date, minutes: x.minutes, shiftId: r.shift?.id, attendanceId: x.kind === '조퇴' ? r.records.at(-1)?.id : r.records[0]?.id});
  }
  return out;
}
export function summarize(findings: Finding[]) {
  const c = {지각: 0, 조퇴: 0, 미출근: 0, 결근: 0, 미퇴근: 0, '예정 외 출근': 0} as Record<Finding['kind'], number>;
  for (const f of findings) c[f.kind]++;
  return c;
}

// 가이드 88: 한 달 근태 요약 — 직원별 지각·조퇴·미출근 횟수와 지각 합계 분, 반복되는 요일.
export function monthPatterns(month: string, shifts: Shift[], attendance: Att[], tolerance: Tolerance = 'normal', now = Date.now()) {
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const all: Finding[] = [];
  for (let d = 1; d <= days; d++) all.push(...checkDay(`${month}-${String(d).padStart(2, '0')}`, shifts, attendance, tolerance, now));
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const by = new Map<string, {지각: number; 조퇴: number; 결근: number; lateMinutes: number; weekdays: Record<string, number>}>();
  for (const f of all) {
    if (f.kind !== '지각' && f.kind !== '조퇴' && f.kind !== '결근') continue;
    const r = by.get(f.employeeId) || {지각: 0, 조퇴: 0, 결근: 0, lateMinutes: 0, weekdays: {}};
    r[f.kind]++; if (f.kind === '지각') r.lateMinutes += f.minutes || 0;
    const w = WD[new Date(f.date + 'T00:00:00Z').getUTCDay()]; r.weekdays[w] = (r.weekdays[w] || 0) + 1;
    by.set(f.employeeId, r);
  }
  return [...by.entries()].map(([employeeId, r]) => {
    const top = Object.entries(r.weekdays).sort((a, b) => b[1] - a[1])[0];
    return {employeeId, 지각: r.지각, 조퇴: r.조퇴, 결근: r.결근, lateMinutes: r.lateMinutes, repeatDay: top && top[1] >= 2 ? top[0] : '', total: r.지각 + r.조퇴 + r.결근};
  }).sort((a, b) => b.total - a.total);
}
