// 작업 046: 근무표와 실제 출퇴근을 비교해 지각·조퇴·미출근·예정 외 출근을 찾는다.
// 정상(허용 오차 안)은 따로 표시하지 않고, 사장님이 볼 것만 "확인 권장"으로 모은다.
export type Tolerance = 'lenient' | 'normal' | 'strict';
export const TOLERANCE_MINUTES: Record<Tolerance, number> = {lenient: 10, normal: 5, strict: 0};
export const TOLERANCE_NAMES: Record<Tolerance, string> = {lenient: '관대(10분)', normal: '보통(5분)', strict: '엄격(0분)'};
type Shift = {id: string; employeeId: string; date: string; start: string; end: string};
type Att = {id: string; employeeId: string; start: string; end: string | null};
export type Finding = {kind: '지각' | '조퇴' | '미출근' | '예정 외 출근'; employeeId: string; date: string; minutes?: number; shiftId?: string; attendanceId?: string};

const DAY = 86400000;
const kdate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);
const at = (date: string, hm: string) => Date.parse(`${date}T${hm}:00+09:00`);

/** date(YYYY-MM-DD, 한국)의 근무표·출퇴근 비교. now 이전에 끝난 근무만 미출근으로 본다. */
export function checkDay(date: string, shifts: Shift[], attendance: Att[], tolerance: Tolerance = 'normal', now = Date.now()): Finding[] {
  const tol = TOLERANCE_MINUTES[tolerance] * 60000, out: Finding[] = [];
  const todays = shifts.filter(s => s.date === date), recs = attendance.filter(a => kdate(a.start) === date), used = new Set<string>();
  for (const s of todays) {
    const ss = at(s.date, s.start), se = at(s.date, s.end) + (s.end <= s.start ? DAY : 0);
    // 같은 직원이 근무 시간 안에서 찍은 기록은 모두 이 근무에 묶는다(중간에 퇴근했다 다시 출근해도 '예정 외'가 아님).
    const mine = recs.filter(a => a.employeeId === s.employeeId && !used.has(a.id) && Date.parse(a.start) < se && (a.end ? Date.parse(a.end) : now) > ss - 2 * 3600000)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    if (!mine.length) { if (se <= now) out.push({kind: '미출근', employeeId: s.employeeId, date, shiftId: s.id}); continue; }
    for (const a of mine) used.add(a.id);
    const first = mine[0], last = mine[mine.length - 1];
    const late = Date.parse(first.start) - ss;
    if (late > tol) out.push({kind: '지각', employeeId: s.employeeId, date, minutes: Math.round(late / 60000), shiftId: s.id, attendanceId: first.id});
    if (last.end) { const early = se - Date.parse(last.end); if (early > tol) out.push({kind: '조퇴', employeeId: s.employeeId, date, minutes: Math.round(early / 60000), shiftId: s.id, attendanceId: last.id}); }
  }
  for (const a of recs) if (!used.has(a.id)) out.push({kind: '예정 외 출근', employeeId: a.employeeId, date, attendanceId: a.id});
  return out;
}
export function summarize(findings: Finding[]) {
  const c = {지각: 0, 조퇴: 0, 미출근: 0, '예정 외 출근': 0} as Record<Finding['kind'], number>;
  for (const f of findings) c[f.kind]++;
  return c;
}

// 가이드 88: 한 달 근태 요약 — 직원별 지각·조퇴·미출근 횟수와 지각 합계 분, 반복되는 요일.
export function monthPatterns(month: string, shifts: Shift[], attendance: Att[], tolerance: Tolerance = 'normal', now = Date.now()) {
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const all: Finding[] = [];
  for (let d = 1; d <= days; d++) all.push(...checkDay(`${month}-${String(d).padStart(2, '0')}`, shifts, attendance, tolerance, now));
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const by = new Map<string, {지각: number; 조퇴: number; 미출근: number; lateMinutes: number; weekdays: Record<string, number>}>();
  for (const f of all) {
    if (f.kind === '예정 외 출근') continue;
    const r = by.get(f.employeeId) || {지각: 0, 조퇴: 0, 미출근: 0, lateMinutes: 0, weekdays: {}};
    r[f.kind]++; if (f.kind === '지각') r.lateMinutes += f.minutes || 0;
    const w = WD[new Date(f.date + 'T00:00:00Z').getUTCDay()]; r.weekdays[w] = (r.weekdays[w] || 0) + 1;
    by.set(f.employeeId, r);
  }
  return [...by.entries()].map(([employeeId, r]) => {
    const top = Object.entries(r.weekdays).sort((a, b) => b[1] - a[1])[0];
    return {employeeId, 지각: r.지각, 조퇴: r.조퇴, 미출근: r.미출근, lateMinutes: r.lateMinutes, repeatDay: top && top[1] >= 2 ? top[0] : '', total: r.지각 + r.조퇴 + r.미출근};
  }).sort((a, b) => b.total - a.total);
}
