// 개선 2차(docs/handoff/개선현황표-2차.csv) 계산 묶음. 테스트가 바로 불러오므로 다른 파일을 import하지 않는다.
type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes?: number; branchId?: string; kind?: string};
type Att = {id: string; employeeId: string; start: string; end: string | null; breakMinutes: number; breakStart?: string | null; breakPlan?: number | null; breaks?: {start: string; end: string}[]; credit?: {start: string; end: string} | null};
type Emp = {id: string; name: string; status?: string; branchId: string; payType?: string; wage?: number; joined?: string; birthMonth?: string; extra?: Extra; leaveReason?: string};
export type Extra = {tags?: string[]; memo?: string; skills?: string[]; contactOrder?: number; visaUntil?: string; maxWeek?: number; reviews?: {at: string; text: string}[]; exitReason?: string; rehire?: '가능' | '불가' | ''; beforeMin?: number; praise?: {at: string; text: string}[]};
export type A = {key: string; to: string; kind: string; title: string; body: string; url?: string};
const DAY = 86400000, H = 3600000;
export const kdate = (ms: number) => new Date(ms + 9 * H).toISOString().slice(0, 10);
const ktime = (ms: number) => new Date(ms + 9 * H).toISOString().slice(11, 16);
const at = (d: string, hm: string) => Date.parse(`${d}T${hm}:00+09:00`);
export const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
export const hoursOf = (s: {start: string; end: string; breakMinutes?: number}) => { let m = (Number(s.end.slice(0, 2)) * 60 + Number(s.end.slice(3))) - (Number(s.start.slice(0, 2)) * 60 + Number(s.start.slice(3))); if (m <= 0) m += 1440; return Math.max(0, m - (s.breakMinutes || 0)) / 60; };
const live = (es: Emp[]) => es.filter(e => e.status !== '퇴사');

/** B005 휴게 끝 5분 전 · B006 휴게 없이 4시간 · B014 16시간 넘게 열린 기록 */
export function workAlerts(d: {employees: Emp[]; attendance: Att[]}, now: number): A[] {
  const out: A[] = [], emp = new Map(live(d.employees).map(e => [e.id, e]));
  for (const a of d.attendance) {
    if (a.end) continue; const e = emp.get(a.employeeId); if (!e) continue; const s = Date.parse(a.start);
    if (a.breakStart && a.breakPlan) { const end = Date.parse(a.breakStart) + a.breakPlan * 60000; if (now >= end - 5 * 60000 && now < end) out.push({key: `breakend:${a.id}:${a.breakStart}`, to: e.id, kind: 'before', title: '휴게가 5분 뒤 끝나요', body: `${ktime(end)}에 휴게가 끝나요. 돌아오면 '휴게 끝'을 눌러 주세요.`, url: '/app?clock=1'}); }
    const rested = a.breakMinutes > 0 || !!a.breakStart || (a.breaks || []).length > 0;
    if (!rested && now - s >= 4 * H && now - s < 4.5 * H) {
      out.push({key: `nobreak:${a.id}`, to: e.id, kind: 'before', title: '4시간 넘게 쉬지 않고 일했어요', body: '4시간 일하면 30분 이상 쉬어야 해요(근로기준법 제54조). 쉴 때 휴게 시작을 눌러 주세요.', url: '/app?clock=1'});
      out.push({key: `nobreak-owner:${a.id}`, to: 'owner', kind: 'clockout', title: `${e.name}님이 4시간째 휴게 없이 일하고 있어요`, body: `${ktime(s)} 출근 · 휴게 시간을 챙겨 주세요(근로기준법 제54조).`});
    }
    if (now - s >= 16 * H) out.push({key: `long:${a.id}`, to: 'owner', kind: 'clockout', title: `${e.name}님 기록이 16시간 넘게 열려 있어요`, body: `${md(kdate(s))} ${ktime(s)} 출근 기록이 아직 퇴근 전이에요. 퇴근을 잊었는지 확인하고 기록을 고쳐 주세요.`, url: '/app?screen=attendance'});
  }
  return out;
}

/** B015 사장님 출퇴근 알림 하루 요약: 켜 두면 낱개 미출근·퇴근 누락 알림 대신 저녁 9시에 한 번 */
export function digestFilter(list: A[], on: boolean) { return on ? list.filter(a => !(a.to === 'owner' && a.kind === 'noshow') && !(a.to === 'owner' && a.kind === 'clockout' && a.key.startsWith('clockout-owner:'))) : list; }
export function dailyDigest(d: {employees: Emp[]; shifts: Shift[]; attendance: Att[]}, now: number, tolerance = 5): A | null {
  const today = kdate(now), emp = new Map(live(d.employees).map(e => [e.id, e]));
  let worked = 0, late = 0, noshow = 0, open = 0; const names: string[] = [];
  for (const s of d.shifts.filter(x => x.date === today && emp.has(x.employeeId))) {
    const ss = at(s.date, s.start), mine = d.attendance.filter(a => a.employeeId === s.employeeId && kdate(Date.parse(a.start)) === today);
    if (!mine.length) { if (ss < now) { noshow++; names.push(emp.get(s.employeeId)!.name); } continue; }
    worked++; if (Date.parse(mine[0].start) > ss + tolerance * 60000) late++; if (mine.some(a => !a.end)) open++;
  }
  if (!worked && !noshow) return null;
  return {key: 'digest:' + today, to: 'owner', kind: 'brief', title: `오늘 출퇴근 요약 · ${worked}명 출근`, body: [late && `지각 ${late}명`, noshow && `기록 없음 ${noshow}명(${names.slice(0, 3).join(', ')}${names.length > 3 ? ' 외' : ''})`, open && `아직 근무 중 ${open}명`].filter(Boolean).join(' · ') || '지각·결근 없이 끝났어요.', url: '/app?screen=attendance'};
}

/** B035 공개한 근무표를 24시간이 지나도 확인하지 않은 직원에게 한 번 */
export function scheduleAckReminders(d: {employees: Emp[]; shifts: Shift[]; publishedWeeks?: Record<string, {at: string; acks: Record<string, string>}>}, now: number): A[] {
  const out: A[] = [];
  for (const [key, p] of Object.entries(d.publishedWeeks || {})) {
    const t = Date.parse(p.at); if (!Number.isFinite(t) || now - t < 24 * H || now - t > 72 * H) continue;
    const i = key.lastIndexOf(':'), branch = key.slice(0, i), week = key.slice(i + 1);
    for (const e of live(d.employees).filter(e => e.branchId === branch)) {
      if (p.acks?.[e.id] || !d.shifts.some(s => s.employeeId === e.id && s.date >= week && s.date <= plus(week, 6))) continue;
      out.push({key: `ackremind:${key}:${e.id}`, to: e.id, kind: 'schedule', title: '근무표를 아직 확인하지 않았어요', body: `${md(week)}부터 일주일 근무표예요. 보고 '확인했어요'를 눌러 주세요.`, url: '/app?screen=schedule'});
    }
  }
  return out;
}

/** B058 12월: 내년 최저임금보다 시급이 낮은 직원(사장님께 한 번) */
export function minWageNotice(d: {employees: Emp[]}, now: number, nextMin: number | undefined): A[] {
  const k = new Date(now + 9 * H); if (k.getUTCMonth() !== 11 || !nextMin) return [];
  const low = live(d.employees).filter(e => e.payType === '시급' && (e.wage || 0) < nextMin);
  if (!low.length) return [];
  return [{key: `minwage:${k.getUTCFullYear() + 1}`, to: 'owner', kind: 'payroll', title: `내년 최저임금보다 낮은 시급 직원 ${low.length}명`, body: `${k.getUTCFullYear() + 1}년 최저시급은 ${nextMin.toLocaleString('ko-KR')}원이에요. ${low.slice(0, 3).map(e => e.name).join(', ')}${low.length > 3 ? ' 외' : ''} — 직원 관리에서 '시급 일괄 인상'으로 1월 1일자 인상을 예약해 주세요.`, url: '/app?screen=team'}];
}

/** B090 외국인 직원 체류 기간 만료 60·30·7일 전(사장님이 넣은 날짜 기준) */
export function visaAlerts(d: {employees: Emp[]}, now: number): A[] {
  const today = kdate(now), out: A[] = [];
  for (const e of live(d.employees)) {
    const v = e.extra?.visaUntil; if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    const left = Math.round((Date.parse(v) - Date.parse(today)) / DAY);
    if ([60, 30, 7].includes(left)) out.push({key: `visa:${e.id}:${v}:${left}`, to: 'owner', kind: 'staff', title: `${e.name}님 체류 기간이 ${left}일 남았어요`, body: `${md(v)}까지예요. 연장 허가를 받았는지 확인하고 날짜를 바꿔 주세요. 만료 뒤 고용하면 출입국관리법 위반이 될 수 있어요.`, url: '/app?screen=team'});
  }
  return out;
}

/** B101 근무 전 알림 시간: 직원이 고른 값 → 매장 기본값 → 60분 */
export const beforeMinutesOf = (e: {extra?: Extra} | undefined, settings: any) => { const v = Number(e?.extra?.beforeMin ?? settings?.more?.beforeMinutes ?? 60); return [0, 30, 60, 120, 180].includes(v) ? v : 60; };

/** B010·B018 직원별 이번 달 지각·조퇴 횟수와 평균 출근 차이(분, +는 늦게) */
export function punctuality(shifts: Shift[], att: Att[], employeeId: string, month: string, tolerance = 5, now = Date.now()) {
  let late = 0, early = 0, diffSum = 0, n = 0;
  for (const s of shifts.filter(x => x.employeeId === employeeId && x.date.startsWith(month))) {
    const ss = at(s.date, s.start); let se = at(s.date, s.end); if (s.end <= s.start) se += DAY; if (ss > now) continue;
    const a = att.find(x => x.employeeId === employeeId && Date.parse(x.start) < se && (x.end ? Date.parse(x.end) : now) > ss - 2 * H); if (!a) continue;
    const diff = Math.round((Date.parse(a.start) - ss) / 60000); diffSum += diff; n++;
    if (diff > tolerance) late++; if (a.end && Date.parse(a.end) < se - tolerance * 60000) early++;
  }
  return {late, early, count: n, avg: n ? Math.round(diffSum / n) : 0};
}
export const habitText = (avg: number, n: number) => !n ? '' : avg <= -5 ? `평균 ${-avg}분 일찍 와요` : avg >= 5 ? `평균 ${avg}분 늦게 와요` : '거의 정시에 와요';

/** B022 다음 달 근무표 복제: 이번 달 n번째 ○요일 근무를 다음 달 같은 n번째 ○요일로(다음 달에 없는 5번째 주는 건너뜀) */
export function copyMonth(shifts: Shift[], month: string, ids: Set<string>, newId: () => string) {
  const [y, m] = month.split('-').map(Number), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const exists = new Set(shifts.filter(s => s.date.startsWith(next)).map(s => s.employeeId + s.date + s.start));
  const out: Shift[] = []; let skipped = 0;
  for (const s of shifts.filter(x => x.date.startsWith(month) && ids.has(x.employeeId))) {
    const d = new Date(s.date + 'T00:00:00Z'), wd = d.getUTCDay(), nth = Math.ceil(d.getUTCDate() / 7);
    const first = new Date(Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5)) - 1, 1)), off = (wd - first.getUTCDay() + 7) % 7, day = 1 + off + (nth - 1) * 7;
    const date = `${next}-${String(day).padStart(2, '0')}`; if (!date.startsWith(next) || Number.isNaN(Date.parse(date)) || new Date(date + 'T00:00:00Z').getUTCMonth() !== first.getUTCMonth()) { skipped++; continue; }
    if (exists.has(s.employeeId + date + s.start)) { skipped++; continue; }
    const {id, series, ...rest} = s as any; out.push({...rest, id: newId(), date});
  }
  return {next, shifts: out, skipped};
}

/** B023·B034 직원별 이번 주 시간 합계와 15·40·최대 시간 선 */
export function weekLoad(shifts: Shift[], es: Emp[], week: string) {
  return live(es).map(e => { const h = shifts.filter(s => s.employeeId === e.id && s.date >= week && s.date <= plus(week, 6)).reduce((t, s) => t + hoursOf(s), 0); const max = e.extra?.maxWeek; return {id: e.id, name: e.name, hours: Math.round(h * 10) / 10, max, over: !!max && h > max, juhu: h >= 15, over40: h > 40}; });
}

/** B024 직원별 이번 달 주말(토·일) 근무 횟수 */
export function weekendCount(shifts: Shift[], es: Emp[], month: string) {
  return live(es).map(e => ({id: e.id, name: e.name, n: shifts.filter(s => s.employeeId === e.id && s.date.startsWith(month) && [0, 6].includes(new Date(s.date + 'T00:00:00Z').getUTCDay())).length})).sort((a, b) => b.n - a.n);
}

/** B027 근무 길이에 맞는 최소 휴게(근로기준법 제54조): 4시간 이상 30분, 8시간 이상 60분 */
export function suggestedBreak(start: string, end: string) { const total = hoursOf({start, end, breakMinutes: 0}); return total >= 8.5 ? 60 : total >= 4.5 ? 30 : 0; }

/** B032 근무 종류(시작 시각 기준) — 오픈·미들·마감 */
export function shiftKind(s: {start: string; end: string}, open = '09:00', close = '22:00') {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)); const st = m(s.start), en = m(s.end) <= st ? m(s.end) + 1440 : m(s.end);
  if (st <= m(open) + 60) return '오픈'; if (en >= (m(close) <= m(open) ? m(close) + 1440 : m(close)) - 60) return '마감'; return '미들';
}

/** B033 인원이 부족한 칸에 넣을 수 있는 직원: 그 시간에 근무가 없고, 주 최대 시간을 넘지 않는 사람(가능 시간 낸 사람 먼저) */
export function fillCandidates(shifts: Shift[], es: Emp[], date: string, start: string, end: string, avail: Record<string, {slots: {weekday: number; start: string; end: string}[]}> = {}, week?: string) {
  const wd = new Date(date + 'T00:00:00Z').getUTCDay(), need = hoursOf({start, end});
  const busy = (id: string) => shifts.some(s => s.employeeId === id && s.date === date && s.start < end && start < s.end);
  return live(es).filter(e => !busy(e.id)).map(e => {
    const fits = (avail[e.id]?.slots || []).some(x => x.weekday === wd && x.start <= start && x.end >= end);
    const h = week ? shifts.filter(s => s.employeeId === e.id && s.date >= week && s.date <= plus(week, 6)).reduce((t, s) => t + hoursOf(s), 0) : 0;
    return {id: e.id, name: e.name, fits, hours: Math.round(h * 10) / 10, blocked: !!e.extra?.maxWeek && h + need > e.extra.maxWeek};
  }).filter(x => !x.blocked).sort((a, b) => Number(b.fits) - Number(a.fits) || a.hours - b.hours);
}

/** B038·B096 지난주(또는 바뀌기 전)와 비교해 달라진 근무 id·직원·날짜 */
export function changedCells(before: Shift[], after: Shift[]) {
  const sig = (s: Shift) => `${s.employeeId}|${s.date}|${s.start}|${s.end}|${s.breakMinutes || 0}`;
  const was = new Set(before.map(sig)), now = new Set(after.map(sig));
  return {added: after.filter(s => !was.has(sig(s))).map(s => s.id), removed: before.filter(s => !now.has(sig(s))).map(s => ({employeeId: s.employeeId, date: s.date, start: s.start, end: s.end}))};
}

/** B040 근무표 엑셀(직원 × 날짜) */
export function scheduleGrid(shifts: Shift[], es: Emp[], from: string, to: string) {
  const days: string[] = []; for (let d = from; d <= to; d = plus(d, 1)) days.push(d);
  const W = '일월화수목금토';
  return [['직원', ...days.map(d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}(${W[new Date(d + 'T00:00:00Z').getUTCDay()]})`), '합계(시간)'],
    ...live(es).map(e => { const mine = shifts.filter(s => s.employeeId === e.id && s.date >= from && s.date <= to); return [e.name, ...days.map(d => mine.filter(s => s.date === d).map(s => `${s.start}-${s.end}`).join(' / ')), Math.round(mine.reduce((t, s) => t + hoursOf(s), 0) * 10) / 10]; })];
}

/** B039 공휴일 근무 가산 미리 보기(5인 이상): 8시간까지 50%, 넘는 시간 100% */
export function holidayPremium(shift: {start: string; end: string; breakMinutes?: number}, wage: number, fivePlus: boolean) {
  if (!fivePlus) return 0; const h = hoursOf(shift); return Math.round((Math.min(h, 8) * 0.5 + Math.max(0, h - 8) * 1) * wage);
}

/** B046 급여 반올림 단위(원 단위 계산 뒤 지급액만 내림) */
export const roundPay = (n: number, unit: 1 | 10 | 100 = 1) => unit === 1 ? Math.round(n) : Math.floor(n / unit) * unit;

/** B051 연차수당 정산 예상: 남은 연차 × 1일 통상임금(시급 × 하루 소정 시간) */
export const leavePayout = (days: number, wage: number, dailyHours: number) => Math.round(Math.max(0, days) * wage * Math.max(0, dailyHours));

/** B054 바뀐 계좌로 아직 한 번도 지급하지 않았는지 */
export function newAccount(e: {bankAccount?: string; extra?: any}, paidAccounts: string[]) { return !!e.bankAccount && !paidAccounts.includes(e.bankAccount); }

/** B055 이체 합계 대조: 명세서 실지급 합계와 은행 파일 합계 */
export const transferCheck = (slips: number[], file: number[]) => { const a = slips.reduce((t, n) => t + n, 0), b = file.reduce((t, n) => t + n, 0); return {slips: a, file: b, ok: a === b, diff: b - a}; };

/** B067 두루누리 지원 예상(10인 미만, 월 보수 270만 원 미만 신규 가입 근로자: 고용·국민연금 근로자·사업주 부담의 80%) */
export function durunuri(monthly: number, staffCount: number, rates = {pension: 0.0475, employment: 0.009}) {
  if (staffCount >= 10 || monthly >= 2700000 || monthly <= 0) return 0;
  return Math.round(monthly * (rates.pension + rates.employment) * 0.8);
}

/** B069 급여 계산 기간: 시작일(1~28)부터 다음 달 시작일 전날까지 */
export function payPeriod(month: string, startDay = 1) {
  const s = Math.min(28, Math.max(1, startDay)); if (s === 1) { const [y, m] = month.split('-').map(Number); return {from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)}; }
  const [y, m] = month.split('-').map(Number), from = new Date(Date.UTC(y, m - 2, s)).toISOString().slice(0, 10), to = new Date(Date.UTC(y, m - 1, s - 1)).toISOString().slice(0, 10);
  return {from, to};
}

/** B070·B095 급여일까지 남은 날 */
export function payDayLeft(today: string, payDay: number) {
  const [y, m, d] = today.split('-').map(Number), last = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  let target = `${today.slice(0, 7)}-${String(Math.min(payDay, last(y, m))).padStart(2, '0')}`;
  if (d > Math.min(payDay, last(y, m))) { const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; target = `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(payDay, last(ny, nm))).padStart(2, '0')}`; }
  return {date: target, left: Math.round((Date.parse(target) - Date.parse(today)) / DAY)};
}

/** B073 직원 준비 상태 배지 */
export function readiness(e: {contract?: {status?: string}; bankAccount?: string; phone?: string; birthMonth?: string; healthCertUntil?: string; onboarding?: {docs?: string; training?: string}}, today: string) {
  const items = [
    {k: '계약', ok: e.contract?.status === '체결 완료'},
    {k: '서류', ok: !!e.onboarding?.docs},
    {k: '교육', ok: !!e.onboarding?.training},
    {k: '보건증', ok: !!e.healthCertUntil && e.healthCertUntil >= today},
  ];
  return {items, done: items.filter(i => i.ok).length, total: items.length};
}

/** B086 빠진 정보 */
export function missingInfo(e: {phone?: string; bankAccount?: string; birthMonth?: string; emergencyPhone?: string; payType?: string}) {
  return [!e.phone && '연락처', !e.bankAccount && '계좌', !e.birthMonth && '생년월', !e.emergencyPhone && '비상 연락처'].filter(Boolean) as string[];
}

/** B079 근속 배지 */
export function tenureBadge(joined: string | undefined, today: string) {
  if (!joined) return null; const [y, m, d] = joined.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
  const months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
  return months >= 24 ? {label: `${Math.floor(months / 12)}년 근속`, months} : months >= 12 ? {label: '1년 근속', months} : months >= 6 ? {label: '6개월', months} : months >= 3 ? {label: '3개월', months} : null;
}

/** B088 직원 근무 이력 한 장 */
export function workHistory(e: Emp & {wageHistory?: {from: string; wage: number}[]}, shifts: Shift[], att: Att[]) {
  const mine = att.filter(a => a.employeeId === e.id && a.end);
  const months = new Map<string, {days: Set<string>; hours: number}>();
  for (const a of mine) { const k = kdate(Date.parse(a.start)).slice(0, 7), r = months.get(k) || {days: new Set(), hours: 0}; r.days.add(kdate(Date.parse(a.start))); r.hours += Math.max(0, (Date.parse(a.end!) - Date.parse(a.start)) / H - a.breakMinutes / 60); months.set(k, r); }
  return {joined: e.joined, first: mine.length ? kdate(Date.parse(mine.map(a => a.start).sort()[0])) : null, months: [...months.entries()].sort().map(([m, r]) => ({month: m, days: r.days.size, hours: Math.round(r.hours * 10) / 10})), wages: e.wageHistory || [], scheduled: shifts.filter(s => s.employeeId === e.id).length};
}

/** B092 다음 근무까지 남은 시간 */
export function untilNext(shifts: Shift[], employeeId: string, now: number) {
  const next = shifts.filter(s => s.employeeId === employeeId && at(s.date, s.start) > now).sort((a, b) => at(a.date, a.start) - at(b.date, b.start))[0];
  if (!next) return null; const min = Math.round((at(next.date, next.start) - now) / 60000);
  return {shift: next, min, text: min < 60 ? `${min}분 뒤` : min < 1440 ? `${Math.floor(min / 60)}시간 ${min % 60 ? (min % 60) + '분 ' : ''}뒤` : `${Math.floor(min / 1440)}일 뒤`};
}

/** B132·B133 요일별 인건비(시급·일급, 출퇴근 기준)와 매출 대비 비율 */
export function weekdayCost(att: Att[], es: Emp[], month: string) {
  const out = Array.from({length: 7}, () => ({cost: 0, hours: 0, days: new Set<string>()})), emp = new Map(es.map(e => [e.id, e]));
  for (const a of att) { if (!a.end) continue; const d = kdate(Date.parse(a.start)); if (!d.startsWith(month)) continue; const e = emp.get(a.employeeId); if (!e) continue; const h = Math.max(0, (Date.parse((a.credit || a).end!) - Date.parse((a.credit || a).start)) / H - a.breakMinutes / 60), wd = new Date(d + 'T00:00:00Z').getUTCDay();
    out[wd].hours += h; out[wd].days.add(d); out[wd].cost += e.payType === '시급' ? h * (e.wage || 0) : 0; }
  return out.map((r, wd) => ({wd, cost: Math.round(r.cost), hours: Math.round(r.hours * 10) / 10, perDay: r.days.size ? Math.round(r.cost / r.days.size) : 0}));
}
export const ratioState = (cost: number, sales: number, target?: number) => { if (!sales) return null; const pct = Math.round(cost / sales * 1000) / 10; return {pct, over: !!target && pct > target}; };

/** B135 지각 많은 요일·시간대 */
export function lateHotspots(shifts: Shift[], att: Att[], month: string, tolerance = 5, now = Date.now()) {
  const wd = Array(7).fill(0), slot: Record<string, number> = {};
  for (const s of shifts.filter(x => x.date.startsWith(month))) { const ss = at(s.date, s.start); if (ss > now) continue; const a = att.find(x => x.employeeId === s.employeeId && Math.abs(Date.parse(x.start) - ss) < 4 * H); if (a && Date.parse(a.start) > ss + tolerance * 60000) { wd[new Date(s.date + 'T00:00:00Z').getUTCDay()]++; const k = s.start.slice(0, 2) + '시'; slot[k] = (slot[k] || 0) + 1; } }
  return {weekday: wd, slots: Object.entries(slot).sort((a, b) => b[1] - a[1]).slice(0, 3)};
}

/** B136 대타·교대 달별 횟수 */
export function swapTrend(swaps: {at: string; status: string}[], months: string[]) { return months.map(m => ({month: m, n: swaps.filter(s => s.at.startsWith(m) && s.status === '승인').length})); }

/** B137 연장 많은 직원(주 40시간 넘는 주가 2번 이상) · B138 이직 위험(지난달보다 근무 30% 이상 줄고 지각 늘어남) */
export function riskFlags(shifts: Shift[], att: Att[], es: Emp[], month: string, prevMonth: string, now = Date.now()) {
  return live(es).map(e => {
    const weeks = new Map<string, number>(); for (const s of shifts.filter(x => x.employeeId === e.id && x.date.startsWith(month))) { const d = new Date(s.date + 'T00:00:00Z'), mon = plus(s.date, -((d.getUTCDay() + 6) % 7)); weeks.set(mon, (weeks.get(mon) || 0) + hoursOf(s)); }
    const overWeeks = [...weeks.values()].filter(h => h > 40).length;
    const hrs = (m: string) => shifts.filter(x => x.employeeId === e.id && x.date.startsWith(m)).reduce((t, s) => t + hoursOf(s), 0);
    const cur = punctuality(shifts, att, e.id, month, 5, now), prev = punctuality(shifts, att, e.id, prevMonth, 5, now), h1 = hrs(month), h0 = hrs(prevMonth);
    const leaving = h0 >= 20 && h1 <= h0 * 0.7 && cur.late > prev.late;
    return {id: e.id, name: e.name, overWeeks, leaving, hours: Math.round(h1), prevHours: Math.round(h0)};
  }).filter(x => x.overWeeks >= 2 || x.leaving);
}

/** B140 작년 같은 달 비교(확정 급여 기준) */
export function yearOverYear(runs: Record<string, any>, month: string) {
  const sum = (m: string) => { const r = Object.values(runs || {}).filter((x: any) => x?.locked && x.month === m); if (!r.length) return null; return r.reduce((t: number, x: any) => t + (Number(x.totals?.gross ?? x.gross ?? 0) || (x.rows || []).reduce((s: number, y: any) => s + (Number(y.gross) || 0), 0)), 0); };
  const ly = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`, a = sum(month), b = sum(ly);
  return {month, lastYear: ly, now: a, before: b, pct: a != null && b ? Math.round((a - b) / b * 1000) / 10 : null};
}

/** B144 주휴수당 비중 */
export const juhuShare = (juhu: number, gross: number) => gross ? Math.round(juhu / gross * 1000) / 10 : 0;

/** B151 자동 규칙: 이번 달 지각이 N번이 되면 직원 메모에 한 줄(한 달에 한 번) */
export function lateMemoRule(e: {name: string; extra?: Extra}, lateCount: number, month: string, n = 3) {
  if (!n || lateCount < n) return null; const line = `${month} 지각 ${lateCount}번(자동 기록)`;
  if ((e.extra?.memo || '').includes(`${month} 지각`)) return null; return line;
}

/** B153·B127 반복 할 일: 매일·매주 ○요일·매달 ○일 */
export type Repeat = {id: string; title: string; every: 'day' | 'week' | 'month'; weekday?: number; day?: number; to?: string; branchId?: string};
export function repeatsDue(list: Repeat[], date: string) {
  const d = new Date(date + 'T00:00:00Z');
  return list.filter(r => r.every === 'day' || (r.every === 'week' && r.weekday === d.getUTCDay()) || (r.every === 'month' && r.day === d.getUTCDate()));
}

/** B158 비서 단축 명령 */
export const SLASH: Record<string, string> = {'/근무': '오늘 근무 누구야?', '/출근': '지금 누가 일하고 있어?', '/급여': '이번 달 인건비 얼마야?', '/휴가': '대기 중인 휴가 신청 있어?', '/할일': '오늘 할 일 알려줘', '/지각': '이번 달 지각 많은 직원 누구야?'};
export const expandSlash = (q: string) => { const t = q.trim(), k = Object.keys(SLASH).find(x => t === x || t.startsWith(x + ' ')); return k ? SLASH[k] : q; };

/** B188 추천 코드: 사장님 계정 id에서 만든 8자 코드(대문자·숫자) */
export function referralCode(seed: string) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) { s += A[h % A.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; } return s; }

/** B191 해지 이유 선택지 */
export const CANCEL_REASONS = ['가격이 부담돼요', '쓰는 기능이 적어요', '사용이 어려워요', '가게를 닫거나 쉬어요', '다른 서비스로 옮겨요', '직원이 잘 안 써요'] as const;

/** B194 이번 달 쓴 기능(가게 데이터에서 셈) */
export function usageSummary(d: any, month: string) {
  const inM = (t?: string) => !!t && String(t).startsWith(month);
  return [
    {k: '근무표', n: (d.shifts || []).filter((s: any) => s.date?.startsWith(month)).length},
    {k: '출퇴근 기록', n: (d.attendance || []).filter((a: any) => inM(new Date(Date.parse(a.start) + 9 * H).toISOString())).length},
    {k: '공지', n: (d._operations?.notices || []).filter((n: any) => inM(n.createdAt)).length},
    {k: '휴가 처리', n: (d._operations?.leaves || []).filter((l: any) => inM(l.at)).length},
    {k: '급여 확정', n: Object.values(d.payrollRuns || {}).filter((r: any) => r?.locked && r.month === month).length},
  ];
}

/** B196 화면 오류 보고에서 개인정보 지우기 */
export function scrubError(s: string) {
  return String(s || '').slice(0, 600).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[이메일]').replace(/01[016-9]-?\d{3,4}-?\d{4}/g, '[전화]').replace(/\d{6}-?[1-4]\d{6}/g, '[번호]').replace(/\d{2,6}-\d{2,6}-\d{2,8}/g, '[번호]').replace(/(token|key|secret|password|pw)=[^&\s]+/gi, '$1=[숨김]');
}

/** B200 비밀값처럼 보이는 문자열 */
export const SECRET_PATTERNS: [string, RegExp][] = [
  ['Supabase service_role JWT', /eyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*cm9sZSI6InNlcnZpY2Vfcm9sZS[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{20,}/],
  ['GitHub 토큰', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['AWS 키', /\bAKIA[0-9A-Z]{16}\b/],
  ['Resend 키', /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/],
  ['토스 비밀키', /\b(live|test)_sk_[A-Za-z0-9]{20,}\b/],
  ['개인 키', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Slack 토큰', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
];
export const findSecrets = (text: string) => SECRET_PATTERNS.filter(([, r]) => r.test(text)).map(([n]) => n);

/** B065 근무표 기준 이번 달 예상 인건비가 예산 90%·100%를 넘으면(사장님께 한 번씩) */
export function budgetAlert(d: {employees: Emp[]; shifts: Shift[]; settings?: any}, now: number): A[] {
  const budget = Number(d.settings?.laborBudget); if (!budget) return [];
  const month = kdate(now).slice(0, 7), live2 = live(d.employees), ids = new Set(live2.map(e => e.id)); let cost = 0;
  for (const s of d.shifts) { if (!s.date.startsWith(month) || !ids.has(s.employeeId)) continue; const e = live2.find(x => x.id === s.employeeId)!; if (e.payType === '시급') cost += hoursOf(s) * (e.wage || 0); }
  cost += live2.filter(e => e.payType === '월급').reduce((t, e) => t + (e.wage || 0), 0);
  const pct = cost / budget; if (pct < 0.9) return [];
  const lv = pct >= 1 ? 100 : 90;
  return [{key: `budget:${month}:${lv}`, to: 'owner', kind: 'payroll', title: lv === 100 ? `${Number(month.slice(5))}월 예상 인건비가 예산을 넘었어요` : `${Number(month.slice(5))}월 예상 인건비가 예산의 90%를 넘었어요`, body: `근무표 기준 약 ${Math.round(cost).toLocaleString('ko-KR')}원 · 예산 ${budget.toLocaleString('ko-KR')}원. 근무표에서 시간을 조정할 수 있어요.`, url: '/app?screen=schedule'}];
}

/** B050 일용직 근로내용확인신고 자료: 직원별 그 달 일한 날(일자)·시간·지급액(세전, 시급×시간 또는 일급) */
export function dailyWorkerReport(es: (Emp & {employment?: string})[], att: Att[], month: string) {
  const rows: (string | number)[][] = [['이름', '생년월', '일한 날', '일수', '시간', '지급액(세전, 근무 기록 기준)']];
  for (const e of es.filter(x => x.employment === '일용')) {
    const days = new Map<string, number>();
    for (const a of att) { if (a.employeeId !== e.id || !a.end) continue; const d = kdate(Date.parse(a.start)); if (!d.startsWith(month)) continue; days.set(d, (days.get(d) || 0) + Math.max(0, (Date.parse(a.end) - Date.parse(a.start)) / H - a.breakMinutes / 60)); }
    if (!days.size) continue; const h = [...days.values()].reduce((t, x) => t + x, 0);
    rows.push([e.name, e.birthMonth || '', [...days.keys()].sort().map(d => Number(d.slice(8))).join(','), days.size, Math.round(h * 10) / 10, Math.round(e.payType === '일급' ? days.size * (e.wage || 0) : h * (e.wage || 0))]);
  }
  return rows;
}

/** B044 다가오는 급여일 달력: 날짜 → 그날 받는 직원 */
export function payCalendar(es: (Emp & {payDay?: number})[], today: string, months = 2) {
  const out = new Map<string, string[]>();
  for (const e of live(es) as (Emp & {payDay?: number})[]) { let d = today; for (let i = 0; i < months; i++) { const p = payDayLeft(d, e.payDay || 10); out.set(p.date, [...(out.get(p.date) || []), e.name]); d = plus(p.date, 1); } }
  return [...out.entries()].sort().map(([date, names]) => ({date, names}));
}

/** B054 직원이 요청해 바꾼 계좌가 아직 한 번도 확정 급여를 거치지 않았는지 */
export function accountChangedSince(asks: {employeeId: string; type: string; status: string; changes?: Record<string, string>; answeredAt?: string; at: string}[], runs: Record<string, any>, employeeId: string) {
  const ch = asks.filter(a => a.employeeId === employeeId && a.type === 'profile' && a.status === '반영함' && a.changes && ('bankAccount' in a.changes || 'bankName' in a.changes)).map(a => a.answeredAt || a.at).sort().pop();
  if (!ch) return false; const lastLock = Object.values(runs || {}).filter((r: any) => r?.locked && (r.rows || []).some((x: any) => x.employeeId === employeeId)).map((r: any) => r.at || '').sort().pop() || '';
  return lastLock < ch;
}

/** B052 마감 체크 진행률 */
export const progressOf = (checks: {ok: boolean}[]) => ({done: checks.filter(c => c.ok).length, total: checks.length, pct: checks.length ? Math.round(checks.filter(c => c.ok).length / checks.length * 100) : 0});

/** B152 자동 규칙: 금요일 오후 3시가 지나도 다음 주 근무표를 공개하지 않은 지점이 있으면 사장님께(자동 게시를 켠 매장은 빼고) */
export function nextWeekReminder(d: {branches?: {id: string; name: string}[]; employees: Emp[]; shifts: Shift[]; publishedWeeks?: Record<string, any>; settings?: any}, now: number): A[] {
  const k = new Date(now + 9 * H); if (k.getUTCDay() !== 5 || k.getUTCHours() < 15 || d.settings?.autoPublish || d.settings?.more?.fridayCheck === false) return [];
  const today = kdate(now), sun = d.settings?.weekStart === 'sun', wd = new Date(today + 'T00:00:00Z').getUTCDay(), start = plus(today, sun ? 7 - wd : (8 - wd) % 7 || 7);
  const out: A[] = [];
  for (const b of d.branches || []) {
    if ((b as any).info?.status === '휴점' || !live(d.employees).some(e => e.branchId === b.id) || d.publishedWeeks?.[b.id + ':' + start]) continue;
    out.push({key: `nextweek:${b.id}:${start}`, to: 'owner', kind: 'schedule', title: `${(d.branches || []).length > 1 ? b.name + ' ' : ''}다음 주 근무표가 아직 공개 전이에요`, body: `${md(start)}부터 일주일 근무표를 짜고 '공개'를 눌러 주세요. 설정에서 자동 게시를 켜 둘 수도 있어요.`, url: '/app?screen=schedule'});
  }
  return out;
}
