// 하루 일과(매일 반복 퀘스트): 오픈 전 · 영업 중 · 마감 후에 사장님·직원이 챙길 일을 가게 기록으로 판정한다.
// - '확인' 일과(오늘 근무 보기·내일 근무 보기)는 화면에서 확인 버튼을 누른 표시(pings)로 판정한다.
// - 서버(cron)는 마감 시각에 남은 일과를 한 번 알림으로 보낸다(routineReminder).
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export type RoutineRole = 'owner' | 'staff';
export type RoutineSlot = 'open' | 'during' | 'close' | 'week' | 'month';
export type GuideStep = {find: string[]; hint: string; kind: 'click' | 'fill' | 'pick' | 'check'};
export type RoutineTask = {
  id: string; slot: RoutineSlot; emoji: string; title: string; detail: string;
  status: 'done' | 'todo' | 'wait'; lines?: string[]; warn?: boolean;
  check?: boolean;                 // '확인했어요'로 끝내는 일과
  page?: string; steps?: GuideStep[];
};
export const SLOT_NAMES: Record<RoutineSlot, string> = {open: '오픈 전', during: '영업 중', close: '마감 후', week: '이번 주', month: '이번 달'};

type Loose = any;
const H9 = 9 * 3600000;
export const kday = (ms: number) => new Date(ms + H9).toISOString().slice(0, 10);
const kmin = (ms: number) => {const d = new Date(ms + H9); return d.getUTCHours() * 60 + d.getUTCMinutes()};
const toMin = (t: string) => {const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0)};
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const wday = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();
const weekStart = (d: string, ws: 'mon' | 'sun') => plus(d, -(ws === 'mon' ? (wday(d) + 6) % 7 : wday(d)));
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const onLeave = (s: Loose, emp: string, d: string) => (s.approvedLeaves || []).some((l: Loose) => l.employeeId === emp && l.start <= d && l.end >= d);

/** 지금이 오픈 전·영업 중·마감 후 중 어디인지(영업시간이 없으면 오늘 근무 시간으로) */
export function slotNow(s: Loose, branch: string, now: number): RoutineSlot {
  const b = (s.branches || []).find((x: Loose) => x.id === branch) || {}, today = kday(now), m = kmin(now);
  const ids = new Set((s.employees || []).filter((e: Loose) => e.branchId === branch).map((e: Loose) => e.id));
  const sh = (s.shifts || []).filter((x: Loose) => x.date === today && ids.has(x.employeeId));
  let open = b.hours ? toMin(b.hours.open) : sh.length ? Math.min(...sh.map((x: Loose) => toMin(x.start))) : 9 * 60;
  let close = b.hours ? toMin(b.hours.close) : sh.length ? Math.max(...sh.map((x: Loose) => toMin(x.end) <= toMin(x.start) ? toMin(x.end) + 1440 : toMin(x.end))) : 22 * 60;
  if (close <= open) close += 1440;
  if (m < open) return 'open';
  return m < close - 60 ? 'during' : 'close';
}

/** 사장님 하루 일과 */
export function ownerRoutine(s: Loose, branch: string, now: number, pings: Iterable<string> = [], tol = 5): RoutineTask[] {
  const p = new Set(pings), today = kday(now), m = kmin(now), tasks: RoutineTask[] = [];
  const b = (s.branches || []).find((x: Loose) => x.id === branch) || {}, emps = (s.employees || []).filter((e: Loose) => e.branchId === branch && e.status !== '퇴사');
  if (!emps.length) return tasks;
  const ids = new Set(emps.map((e: Loose) => e.id)), name = (id: string) => emps.find((e: Loose) => e.id === id)?.name || '직원';
  const mine = (x: Loose) => (x.branchId ? x.branchId === branch : ids.has(x.employeeId));
  const todayShifts = (s.shifts || []).filter((x: Loose) => x.date === today && mine(x) && ids.has(x.employeeId)).sort((a: Loose, c: Loose) => a.start.localeCompare(c.start));
  const att = (s.attendance || []).filter((a: Loose) => ids.has(a.employeeId));
  const attToday = att.filter((a: Loose) => kday(Date.parse(a.start)) === today);
  const closedToday = (b.closedDays || []).includes(wday(today));
  // 1) 오늘 근무 확인
  tasks.push({id: 'brief', slot: 'open', emoji: '👀', title: '오늘 근무 확인', check: true, status: p.has('brief') ? 'done' : 'todo',
    detail: todayShifts.length ? `오늘 ${new Set(todayShifts.map((x: Loose) => x.employeeId)).size}명 근무` : closedToday ? '오늘은 정기 휴무예요' : '오늘 잡힌 근무가 없어요',
    lines: todayShifts.slice(0, 8).map((x: Loose) => `${name(x.employeeId)} ${x.start}–${x.end}`)});
  // 2) 출근 챙기기
  if (todayShifts.length) {
    const started = todayShifts.filter((x: Loose) => toMin(x.start) + tol <= m && !onLeave(s, x.employeeId, today));
    const late = started.filter((x: Loose) => !attToday.some((a: Loose) => a.employeeId === x.employeeId));
    const first = todayShifts[0];
    tasks.push({id: 'arrive', slot: 'during', emoji: '🙋', title: '출근 안 한 사람 챙기기', page: '출퇴근 기록',
      status: !started.length ? 'wait' : late.length ? 'todo' : 'done', warn: late.length > 0,
      detail: !started.length ? `첫 출근 ${first.start} · 아직 출근 시간 전` : late.length ? `${late.length}명이 아직 출근 기록이 없어요` : '출근할 사람 모두 왔어요',
      lines: late.map((x: Loose) => `${name(x.employeeId)} ${x.start} 출근 예정`)});
  }
  // 3) 요청함 비우기(출퇴근 정정·직원 문의)
  const reqs = (s.requests || []).filter((r: Loose) => r.status === '승인 대기' && ids.has(r.before?.employeeId));
  const asks = (s.staffAsks || []).filter((a: Loose) => a.status === '확인 중' && ids.has(a.employeeId));
  tasks.push({id: 'requests', slot: 'during', emoji: '📥', title: '요청함 비우기', page: reqs.length ? '출퇴근 기록' : '직원 관리',
    status: reqs.length + asks.length ? 'todo' : 'done',
    detail: reqs.length + asks.length ? [reqs.length ? `출퇴근 정정 ${reqs.length}건` : '', asks.length ? `직원 문의 ${asks.length}건` : ''].filter(Boolean).join(' · ') : '처리할 요청이 없어요',
    steps: reqs.length ? [{find: ['.t-request button.primary@@승인'], hint: '내용을 보고 승인이나 반려를 눌러요', kind: 'click'}] : undefined});
  // 4) 퇴근 누락 정리
  const open = att.filter((a: Loose) => !a.end), stale: Loose[] = [], working: Loose[] = [];
  for (const a of open) {
    const d = kday(Date.parse(a.start)), sh = (s.shifts || []).find((x: Loose) => x.employeeId === a.employeeId && x.date === d);
    const endMin = sh ? (toMin(sh.end) <= toMin(sh.start) ? toMin(sh.end) + 1440 : toMin(sh.end)) : null;
    if (d < today || (endMin !== null && endMin + 30 <= m)) stale.push(a); else working.push(a);
  }
  if (todayShifts.length || attToday.length || stale.length) {
    const lastEnd = todayShifts.length ? Math.max(...todayShifts.map((x: Loose) => toMin(x.end) <= toMin(x.start) ? toMin(x.end) + 1440 : toMin(x.end))) : 0;
    tasks.push({id: 'clockout', slot: 'close', emoji: '🚪', title: '퇴근 누락 정리', page: '출퇴근 기록', warn: stale.length > 0,
      status: stale.length ? 'todo' : working.length || m < lastEnd ? 'wait' : 'done',
      detail: stale.length ? `퇴근을 안 찍은 기록 ${stale.length}건` : working.length ? `지금 ${working.length}명 근무 중 · 퇴근하면 확인` : m < lastEnd ? `마지막 퇴근 ${hm(lastEnd)}` : '모두 퇴근을 찍었어요',
      lines: stale.map((a: Loose) => `${name(a.employeeId)} ${md(kday(Date.parse(a.start)))} 출근 뒤 퇴근 기록 없음`),
      steps: stale.length ? [{find: ['.att-actions button==출퇴근 기록'], hint: '퇴근을 안 찍은 직원은 여기서 퇴근을 남겨요', kind: 'click'}] : undefined});
  }
  // 5) 내일 근무 확인
  const tmr = plus(today, 1), tShifts = (s.shifts || []).filter((x: Loose) => x.date === tmr && mine(x) && ids.has(x.employeeId)).sort((a: Loose, c: Loose) => a.start.localeCompare(c.start));
  const tClosed = (b.closedDays || []).includes(wday(tmr)), empty = !tShifts.length && !tClosed;
  tasks.push({id: 'tomorrow', slot: 'close', emoji: '🌙', title: '내일 근무 확인', check: !empty, page: empty ? '근무 스케줄' : undefined, warn: empty,
    status: p.has('tomorrow') || (tClosed && !tShifts.length) ? 'done' : 'todo',
    detail: tShifts.length ? `내일 ${new Set(tShifts.map((x: Loose) => x.employeeId)).size}명 근무` : tClosed ? '내일은 정기 휴무예요' : '내일 근무가 비어 있어요',
    lines: tShifts.slice(0, 8).map((x: Loose) => `${name(x.employeeId)} ${x.start}–${x.end}`)});
  // 6) 이번 주: 다음 주 근무표 공개(근무표 나오는 요일부터, 기본 목요일)
  const ws: 'mon' | 'sun' = s.settings?.weekStart === 'sun' ? 'sun' : 'mon', due = Number.isInteger(s.settings?.more?.scheduleDue) ? s.settings.more.scheduleDue : 4;
  const idx = (d: number) => ws === 'mon' ? (d + 6) % 7 : d;
  if (idx(wday(today)) >= idx(due)) {
    const next = plus(weekStart(today, ws), 7), has = (s.shifts || []).some((x: Loose) => ids.has(x.employeeId) && x.date >= next && x.date <= plus(next, 6));
    const pub = !!(s.publishedWeeks || {})[branch + ':' + next];
    tasks.push({id: 'publish', slot: 'week', emoji: '📣', title: '다음 주 근무표 공개', page: '근무 스케줄', status: pub ? 'done' : 'todo', warn: !has,
      detail: pub ? `${md(next)}~ 근무표를 공개했어요` : has ? `${md(next)}~ 근무표가 아직 공개 전이에요` : `${md(next)}~ 근무를 먼저 넣어요`,
      steps: [{find: ['button@@주간 · 7일'], hint: '주간 보기로 바꿔요', kind: 'click'}, {find: ['button@@다음 주 →'], hint: '다음 주로 넘겨요', kind: 'click'}, {find: ['.publish-bar button.primary'], hint: '"직원에게 공개"를 누르면 끝!', kind: 'click'}]});
  }
  // 7) 이번 달: 지난달 급여 확정(1~15일, 지난달 근무가 있었으면)
  const day = Number(today.slice(8, 10)), prev = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  if (day <= 15 && (s.shifts || []).some((x: Loose) => ids.has(x.employeeId) && x.date.startsWith(prev))) {
    const locked = !!(s.payrollRuns || {})[prev + ':' + branch]?.locked;
    tasks.push({id: 'payroll', slot: 'month', emoji: '💰', title: `${Number(prev.slice(5))}월 급여 확정`, page: '급여·명세서', status: locked ? 'done' : 'todo',
      detail: locked ? '확정하고 명세서를 보냈어요' : '근태를 보고 확정하면 명세서가 직원에게 가요',
      steps: [{find: ['[aria-label="급여 월"]'], hint: `${Number(prev.slice(5))}월로 바꿔요`, kind: 'fill'}, {find: ['button.primary@@급여 검토·확정'], hint: '검토하고 확정해요', kind: 'click'}]});
  }
  return tasks;
}

/** 직원 하루 일과 */
export function staffRoutine(s: Loose, selfId: string, now: number, pings: Iterable<string> = []): RoutineTask[] {
  const p = new Set(pings), today = kday(now), tasks: RoutineTask[] = [];
  const myShifts = (s.shifts || []).filter((x: Loose) => x.employeeId === selfId).sort((a: Loose, c: Loose) => (a.date + a.start).localeCompare(c.date + c.start));
  const todayShifts = myShifts.filter((x: Loose) => x.date === today);
  const att = (s.attendance || []).filter((a: Loose) => a.employeeId === selfId && kday(Date.parse(a.start)) === today);
  const me = (s.employees || []).find((e: Loose) => e.id === selfId) || {};
  if (todayShifts.length) tasks.push({id: 'in', slot: 'open', emoji: '⏱️', title: '출근 찍기', status: att.length ? 'done' : 'todo',
    detail: att.length ? '출근을 찍었어요' : `오늘 ${todayShifts[0].start} 출근 · 매장에서 QR을 찍어요`,
    steps: att.length ? undefined : [{find: ['.clock-big', '.clock-card button'], hint: '매장에 도착하면 이 버튼을 누르고 QR을 찍어요', kind: 'click'}]});
  // 공개된 근무표 확인(이번 주·다음 주)
  const ws: 'mon' | 'sun' = s.settings?.weekStart === 'sun' ? 'sun' : 'mon', w0 = weekStart(today, ws);
  // 화면의 '확인했어요'(StaffPublishAck·pendingAcks)와 같은 기준: 이번 주부터 공개된 주
  for (const [key, pub] of Object.entries(s.publishedWeeks || {}) as [string, Loose][]) {
    const w = key.slice(key.lastIndexOf(':') + 1);
    if (key.slice(0, key.lastIndexOf(':')) !== (me.branchId || '') || w < w0) continue;
    const acked = !!pub.acks?.[selfId];
    tasks.push({id: 'ack:' + w, slot: 'open', emoji: '✅', title: `${md(w)}~ 근무표 확인`, status: acked ? 'done' : 'todo',
      detail: acked ? '확인했다고 알렸어요' : '내 근무 시간을 보고 "확인했어요"를 눌러요',
      steps: acked ? undefined : [{find: ['.publish-ack button'], hint: '근무 시간을 보고 눌러요', kind: 'click'}]});
  }
  if (att.length) {
    const working = att.some((a: Loose) => !a.end);
    tasks.push({id: 'out', slot: 'close', emoji: '🏠', title: '퇴근 찍기', status: working ? 'todo' : 'done',
      detail: working ? '퇴근할 때 꼭 찍어요. 안 찍으면 급여 계산이 늦어져요' : '퇴근을 찍었어요',
      steps: working ? [{find: ['.clock-big', '.clock-card button'], hint: '퇴근할 때 이 버튼을 눌러요', kind: 'click'}] : undefined});
  }
  const next = myShifts.find((x: Loose) => x.date > today);
  if (next) tasks.push({id: 'next', slot: 'close', emoji: '📅', title: '다음 근무 확인', check: true, status: p.has('next') ? 'done' : 'todo',
    detail: `${md(next.date)} ${next.start}–${next.end}`});
  return tasks;
}

export function routineFor(role: RoutineRole, s: Loose, branch: string, selfId: string, now: number, pings: Iterable<string> = [], tol = 5) {
  const tasks = role === 'owner' ? ownerRoutine(s, branch, now, pings, tol) : staffRoutine(s, selfId, now, pings);
  const done = tasks.filter(t => t.status === 'done').length;
  return {tasks, done, total: tasks.length, all: tasks.length > 0 && done === tasks.length, slot: role === 'owner' ? slotNow(s, branch, now) : (tasks.some(t => t.id === 'out') ? 'close' : 'open') as RoutineSlot};
}

/** 연속 완주 일수: 완주한 날(YYYY-MM-DD) 목록에서, 쉬는 날 하루는 건너뛰어도 이어진다 */
export function streakOf(marks: string[], today: string): number {
  const days = [...new Set(marks)].filter(d => d <= today).sort().reverse();
  if (!days.length) return 0;
  const gap = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
  if (gap(today, days[0]) > 2) return 0;
  let n = 1;
  for (let i = 1; i < days.length; i++) {if (gap(days[i - 1], days[i]) <= 2) n++; else break}
  return n;
}

/** 서버: 마감 시각에 남은 일과를 사장님께 한 번(설정 '마감 일과 알림', 기본은 매장 닫는 시각·없으면 밤 10시) */
export function routineReminder(s: Loose, now: number, tol = 5) {
  const out: Loose[] = [], hourSet = s.settings?.more?.routineHour, kh = new Date(now + H9).getUTCHours(), today = kday(now);
  if (hourSet === -1) return out;
  for (const b of s.branches || []) {
    const close = b.hours ? Math.floor(toMin(b.hours.close) / 60) : 22, hour = Number.isInteger(hourSet) ? hourSet : (b.hours && toMin(b.hours.close) <= toMin(b.hours.open) ? 23 : close);
    if (kh !== hour) continue;
    const left = ownerRoutine(s, b.id, now, [], tol).filter(t => t.status === 'todo' && (!t.check || t.warn) && t.slot !== 'open');
    if (!left.length) continue;
    const multi = (s.branches || []).length > 1;
    out.push({key: `routine:${b.id}:${today}`, to: 'owner', kind: 'brief', url: '/app?daily=1',
      title: `${multi ? b.name + ' · ' : ''}오늘 일과 ${left.length}개가 남았어요`,
      body: left.map(t => `${t.emoji} ${t.title}: ${t.detail}`).join(' / ').slice(0, 300)});
  }
  return out;
}
