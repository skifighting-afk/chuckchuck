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
    // 같은 직원의 출퇴근 중 근무 시간과 가장 가까운 것
    const mine = recs.filter(a => a.employeeId === s.employeeId && !used.has(a.id)).sort((a, b) => Math.abs(Date.parse(a.start) - ss) - Math.abs(Date.parse(b.start) - ss));
    const a = mine.find(a => Date.parse(a.start) < se && (a.end ? Date.parse(a.end) : now) > ss - 2 * 3600000);
    if (!a) { if (se <= now) out.push({kind: '미출근', employeeId: s.employeeId, date, shiftId: s.id}); continue; }
    used.add(a.id);
    const late = Date.parse(a.start) - ss;
    if (late > tol) out.push({kind: '지각', employeeId: s.employeeId, date, minutes: Math.round(late / 60000), shiftId: s.id, attendanceId: a.id});
    if (a.end) { const early = se - Date.parse(a.end); if (early > tol) out.push({kind: '조퇴', employeeId: s.employeeId, date, minutes: Math.round(early / 60000), shiftId: s.id, attendanceId: a.id}); }
  }
  for (const a of recs) if (!used.has(a.id)) out.push({kind: '예정 외 출근', employeeId: a.employeeId, date, attendanceId: a.id});
  return out;
}
export function summarize(findings: Finding[]) {
  const c = {지각: 0, 조퇴: 0, 미출근: 0, '예정 외 출근': 0} as Record<Finding['kind'], number>;
  for (const f of findings) c[f.kind]++;
  return c;
}
