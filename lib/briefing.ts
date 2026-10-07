// 지시서 6주차 081 아침 브리핑(매일 8시) · 073 주간 리포트(월요일 8시) — 사장님 휴대폰 알림 한 통
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Emp = {id: string; name: string; status?: string; payType?: string; wage?: number};
type Shift = {employeeId: string; date: string; start: string; end: string};
type Att = {employeeId: string; start: string; end: string | null; breakMinutes?: number};
const kd = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const won = (n: number) => Math.round(n).toLocaleString('ko-KR');
const hrs = (a: Att) => a.end ? Math.max(0, (Date.parse(a.end) - Date.parse(a.start)) / 3600000 - (a.breakMinutes || 0) / 60) : 0;

export function dailyBrief(d: {employees: Emp[]; shifts: Shift[]; attendance: Att[]; requests?: any[]; leavesPending?: number}, today: string) {
  const emp = new Map(d.employees.filter(e => e.status !== '퇴사').map(e => [e.id, e]));
  const sh = d.shifts.filter(s => s.date === today && emp.has(s.employeeId)).sort((a, b) => a.start.localeCompare(b.start));
  const names = [...new Set(sh.map(s => emp.get(s.employeeId)!.name))];
  const open = d.attendance.filter(a => !a.end && kd(a.start) < today && emp.has(a.employeeId)).length;
  const pend = (d.requests || []).filter(r => r.status === '승인 대기').length;
  const todo = [pend && `정정 요청 ${pend}건`, d.leavesPending && `휴가 신청 ${d.leavesPending}건`, open && `어제 퇴근 안 찍은 기록 ${open}건`].filter(Boolean);
  const title = sh.length ? `오늘 ${names.length}명 근무 · 첫 근무 ${sh[0].start}` : '오늘은 잡힌 근무가 없어요';
  const body = [sh.length ? names.slice(0, 4).join(', ') + (names.length > 4 ? ` 외 ${names.length - 4}명` : '') : '', todo.length ? '처리할 것: ' + todo.join(', ') : '처리할 것은 없어요.'].filter(Boolean).join(' · ');
  return {title, body};
}
/** 월요일: 지난주(월~일) 기록 요약. 시급·일급 직원은 시간×시급으로 대략 셈(월급 직원 제외) */
export function weeklyBrief(d: {employees: Emp[]; shifts: Shift[]; attendance: Att[]}, monday: string) {
  const from = plus(monday, -7), to = plus(monday, -1), emp = new Map(d.employees.map(e => [e.id, e]));
  const recs = d.attendance.filter(a => emp.has(a.employeeId) && kd(a.start) >= from && kd(a.start) <= to);
  const hours = recs.reduce((n, a) => n + hrs(a), 0), cost = recs.reduce((n, a) => { const e = emp.get(a.employeeId)!; return n + (e.payType === '시급' ? hrs(a) * (e.wage || 0) : 0); }, 0);
  const plan = d.shifts.filter(s => emp.has(s.employeeId) && s.date >= from && s.date <= to);
  const missed = plan.filter(s => !recs.some(a => a.employeeId === s.employeeId && kd(a.start) === s.date)).length;
  return {title: `지난주 ${Number(from.slice(5, 7))}/${Number(from.slice(8))}~${Number(to.slice(5, 7))}/${Number(to.slice(8))} 근무 ${Math.round(hours * 10) / 10}시간`, body: `시급 직원 인건비 약 ${won(cost)}원(주휴·수당 제외) · 근무표 ${plan.length}건 중 출근 기록 없음 ${missed}건. 자세한 건 인건비 리포트에서 봐 주세요.`};
}
/** 지시서 140: 오늘 인건비 지금까지(시급=일한 시간×시급, 일급=출근하면 하루치, 월급=하루치(월급÷그달 일수)). 주휴·가산 제외 */
export function todayLabor(emps: Emp[], att: Att[], today: string, now: number) {
  const days = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  let cost = 0, hours = 0, working = 0;
  for (const e of emps.filter(e => e.status !== '퇴사')) {
    const mine = att.filter(a => a.employeeId === e.id && kd(a.start) === today);
    const h = mine.reduce((n, a) => n + Math.max(0, ((a.end ? Date.parse(a.end) : now) - Date.parse(a.start)) / 3600000 - (a.breakMinutes || 0) / 60), 0);
    hours += h; if (mine.some(a => !a.end)) working++;
    if (e.payType === '시급') cost += h * (e.wage || 0); else if (e.payType === '일급') cost += mine.length ? (e.wage || 0) : 0; else if (e.payType === '월급') cost += (e.wage || 0) / days;
  }
  return {cost: Math.round(cost), hours: Math.round(hours * 10) / 10, working};
}
/** 지시서 195: 3일 넘게 처리 안 한 요청(출퇴근 정정·휴가·대타·직원 문의·합류 신청) */
export function staleRequests(d: any, now: number, days = 3) {
  const cut = now - days * 86400000, old = (at?: string) => !!at && Date.parse(at) < cut;
  const n = {정정: (d.requests || []).filter((r: any) => r.status === '승인 대기' && old(r.at)).length, 휴가: (d._operations?.leaves || []).filter((l: any) => l.status === '승인 대기' && old(l.at)).length, '대타·교대': (d._operations?.swaps || []).filter((x: any) => x.status === '승인 대기' && old(x.at || x.createdAt)).length, '직원 문의': (d.staffAsks || []).filter((x: any) => x.status === '확인 중' && old(x.at)).length, '합류 신청': (d._joinApplications || []).filter((x: any) => x.status === 'pending' && old(x.createdAt)).length};
  const parts = Object.entries(n).filter(([, v]) => v > 0);
  return {total: parts.reduce((a, [, v]) => a + v, 0), text: parts.map(([k, v]) => `${k} ${v}건`).join(', ')};
}
