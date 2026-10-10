// 지시서 2주차: 10분마다 도는 알림 검사(001 미출근, 002 퇴근 누락, 101 근무 전, 117 급여일 전 미확정).
// 매장 데이터 한 곳에서 "지금 보낼 알림" 목록을 만든다. 보낸 알림은 key로 한 번만(호출부가 _alertsSent에 기록).
type Shift = {id: string; employeeId: string; date: string; start: string; end: string};
type Att = {id: string; employeeId: string; start: string; end: string | null};
type Emp = {id: string; name: string; status?: string; branchId?: string; healthCertUntil?: string; employment?: string; endDate?: string; joined?: string; probation?: {months: number}};
export type Alert = {key: string; to: 'owner' | string; kind: 'noshow' | 'clockout' | 'before' | 'payroll' | 'schedule' | 'staff'; title: string; body: string; url?: string};
const DAY = 86400000;
const kdate = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const at = (d: string, hm: string) => Date.parse(`${d}T${hm}:00+09:00`);
const span = (s: Shift) => { const a = at(s.date, s.start); let b = at(s.date, s.end); if (s.end <= s.start) b += DAY; return [a, b]; };

export function alertsFor(data: {employees: Emp[]; shifts: Shift[]; attendance: Att[]; approvedLeaves?: {employeeId: string; start: string; end: string}[]; payrollRuns?: Record<string, any>; branches?: {id: string; name: string}[]; availability?: Record<string, {updatedAt?: string}>; settings?: any}, now = Date.now()): Alert[] {
  const out: Alert[] = [], today = kdate(now), y = kdate(now - DAY);
  const emp = new Map(data.employees.filter(e => e.status !== '퇴사').map(e => [e.id, e]));
  const leave = (id: string, d: string) => (data.approvedLeaves || []).some(l => l.employeeId === id && l.start <= d && d <= l.end);
  for (const s of data.shifts) {
    if (s.date !== today && s.date !== y) continue;
    const e = emp.get(s.employeeId); if (!e || leave(e.id, s.date)) continue;
    const [ss, se] = span(s);
    const mine = data.attendance.filter(a => a.employeeId === s.employeeId && Date.parse(a.start) < se && (a.end ? Date.parse(a.end) : now) > ss - 2 * 3600000);
    // 101 근무 1시간 전(직원)
    // 개선 2차 B101: 직원이 고른 시간(0이면 끔) → 매장 기본값 → 60분 · B003 알림에서 바로 출근 화면으로
    const bm = (() => { const v = Number((e as any).extra?.beforeMin ?? data.settings?.more?.beforeMinutes ?? 60); return [0, 30, 60, 120, 180].includes(v) ? v : 60; })();
    if (bm && ss - now <= bm * 60000 && ss - now > 0 && !mine.length) out.push({key: 'before:' + s.id, to: e.id, kind: 'before', title: bm >= 60 ? `${bm / 60}시간 뒤 근무가 있어요` : `${bm}분 뒤 근무가 있어요`, body: `${s.start}–${s.end} 근무예요. 매장 QR을 찍고 출근해 주세요.`, url: '/app?clock=1'});
    // 001 미출근(사장님): 예정 +10분, 근무가 끝나기 전, 기록 없음
    if (now >= ss + 10 * 60000 && now < se && !mine.length) out.push({key: 'noshow:' + s.id, to: 'owner', kind: 'noshow', title: `${e.name}님 출근 기록이 없어요`, body: `${s.start} 출근 예정이었어요. ${Math.round((now - ss) / 60000)}분째 기록이 없어요.`});
    // 002 퇴근 누락(직원·사장님): 예정 퇴근 +30분, 열린 기록
    const open = mine.find(a => !a.end);
    if (open && now >= se + 30 * 60000) {
      out.push({key: 'clockout:' + open.id, to: e.id, kind: 'clockout', title: '퇴근 기록을 잊으셨나요?', body: `${s.end} 퇴근 예정이었어요. 퇴근 QR을 찍거나, 실제 퇴근 시각으로 정정 요청을 보내 주세요.`});
      out.push({key: 'clockout-owner:' + open.id, to: 'owner', kind: 'clockout', title: `${e.name}님 퇴근 기록이 없어요`, body: `${s.end} 퇴근 예정이었는데 아직 근무 중으로 남아 있어요.`});
    }
  }
  // 117 급여일 3일 전 미확정(사장님): 지난달 급여가 확정되지 않았고, 급여일(직원 중 가장 이른 날) 3일 전~당일
  const m = new Date(now + 9 * 3600000), prev = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const days = data.employees.filter(e => e.status !== '퇴사').map(e => Number((e as any).payDay) || 10);
  if (days.length) {
    const payDay = Math.min(...days), pd = `${today.slice(0, 8)}${String(Math.min(payDay, 28)).padStart(2, '0')}`, left = Math.round((Date.parse(pd) - Date.parse(today)) / DAY);
    const locked = Object.values(data.payrollRuns || {}).some((r: any) => r?.locked && r.month === prev);
    if (!locked && left >= 0 && left <= 3) out.push({key: 'payday:' + prev, to: 'owner', kind: 'payroll', title: `${Number(prev.slice(5))}월 급여가 아직 확정 전이에요`, body: `급여일(${Number(pd.slice(5, 7))}월 ${Number(pd.slice(8))}일)까지 ${left}일 남았어요. 급여 검토·확정을 눌러 명세서를 준비해 주세요.`});
  }
  // 지시서 5주차: 서류·기간 알림(오전 9시 이후, 30일·7일·1일 전 그날 한 번씩) — 보건증 만료, 기간제 계약 끝, 수습 끝
  if (m.getUTCHours() >= 9) {
    const left = (d: string) => Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / DAY);
    const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
    for (const e of emp.values() as Iterable<any>) {
      const hc = e.healthCertUntil, end = e.employment === '기간제' ? e.endDate : '', pm = e.probation?.months, pe = pm && e.joined ? (() => { const [y, mo, dd] = e.joined.split('-').map(Number); const x = new Date(Date.UTC(y, mo - 1 + pm, dd)); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); })() : '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(hc || '') && [30, 7, 1].includes(left(hc))) {
        out.push({key: `doc:health:${e.id}:${hc}:${left(hc)}`, to: 'owner', kind: 'staff', title: `${e.name}님 보건증이 ${left(hc)}일 뒤 끝나요`, body: `${md(hc)}까지예요. 새 보건증을 받으면 직원 관리에서 날짜를 바꿔 주세요.`});
        out.push({key: `doc:health-me:${e.id}:${hc}:${left(hc)}`, to: e.id, kind: 'staff', title: `보건증이 ${left(hc)}일 뒤 끝나요`, body: `${md(hc)}까지예요. 보건소나 병원에서 다시 받아 사장님께 알려 주세요.`});
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(end || '') && [30, 7].includes(left(end))) out.push({key: `doc:end:${e.id}:${end}:${left(end)}`, to: 'owner', kind: 'staff', title: `${e.name}님 계약이 ${left(end)}일 뒤 끝나요`, body: `기간제 계약 끝나는 날이 ${md(end)}이에요. 재계약하거나 퇴사 처리를 준비해 주세요.`});
      if (pe && [7, 1].includes(left(pe))) out.push({key: `doc:prob:${e.id}:${pe}:${left(pe)}`, to: 'owner', kind: 'staff', title: `${e.name}님 수습이 ${left(pe)}일 뒤 끝나요`, body: `${md(pe)}까지 수습이에요. 다음 달부터 수습 감액 없이 계산돼요.`});
    }
  }
  // 107 근무 가능 시간 마감일(설정한 요일) 오전 10시 이후: 이번 주에 아직 안 낸 직원에게
  const due = data.settings?.availabilityDue;
  if (typeof due === 'number' && m.getUTCDay() === due && m.getUTCHours() >= 10) {
    const wk = Date.parse(today + 'T00:00:00+09:00') - ((m.getUTCDay() + 6) % 7) * DAY;
    for (const e of emp.values()) {
      const up = data.availability?.[e.id]?.updatedAt;
      if (!up || Date.parse(up) < wk) out.push({key: `avail:${today}:${e.id}`, to: e.id, kind: 'schedule', title: '오늘까지 근무 가능 시간을 내 주세요', body: '다음 주 근무표를 짜기 전에 일할 수 있는 요일과 시간을 앱에서 알려 주세요.'});
    }
  }
  return out;
}
