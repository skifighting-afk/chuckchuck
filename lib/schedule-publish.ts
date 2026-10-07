// 지시서 3주차 023: 주간 근무표 공개 + 직원 확인.
// 사장님이 '직원에게 공개'를 누르면 그 주(지점별) 근무표가 공개되고 직원에게 알림이 간다.
// 직원은 '확인했어요'를 누른다. 공개 뒤 그 직원의 그 주 근무가 바뀌면 확인이 풀려 다시 확인해야 한다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekStartOf = (d: string, ws: 'mon' | 'sun' = 'mon') => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return plus(d, -(ws === 'mon' ? (w + 6) % 7 : w)); };

type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes?: number};
export type Published = Record<string, {at: string; acks: Record<string, string>}>;

export const pubKey = (branchId: string, weekStart: string) => `${branchId}:${weekStart}`;
export const keyWeek = (key: string) => key.slice(key.lastIndexOf(':') + 1);
export const keyBranch = (key: string) => key.slice(0, key.lastIndexOf(':'));

const sig = (shifts: Shift[], emp: string, from: string) => {
  const to = plus(from, 6);
  return JSON.stringify(shifts.filter(s => s.employeeId === emp && s.date >= from && s.date <= to).map(s => [s.date, s.start, s.end, s.breakMinutes || 0]).sort());
};

/** 화면용: 이 주 공개 상태와 확인한·안 한 직원 */
export function publishStatus(pw: Published | undefined, branchId: string, date: string, staff: {id: string; name: string; branchId: string}[], ws: 'mon' | 'sun' = 'mon') {
  const week = weekStartOf(date, ws), key = pubKey(branchId, week), p = pw?.[key];
  const here = staff.filter(e => e.branchId === branchId);
  return {key, week, published: !!p, at: p?.at || null, acked: here.filter(e => p?.acks?.[e.id]), pending: here.filter(e => !p?.acks?.[e.id])};
}

/** 서버: 사장님 저장분을 합친다. 확인 기록은 서버 것만 믿고, 근무가 바뀐 직원의 확인은 푼다. 새로 공개(또는 다시 공개)된 key를 돌려준다 */
export function mergePublished(prev: Published | undefined, next: Published | undefined, prevShifts: Shift[], nextShifts: Shift[]) {
  const out: Published = {}, fresh: string[] = [];
  for (const [key, v] of Object.entries(next || {})) {
    const old = prev?.[key], week = keyWeek(key);
    if (!old || old.at !== v.at) fresh.push(key);
    const acks: Record<string, string> = {};
    for (const [emp, at] of Object.entries(old?.acks || {})) if (!fresh.includes(key) && sig(prevShifts, emp, week) === sig(nextShifts, emp, week)) acks[emp] = at;
    out[key] = {at: v.at, acks};
  }
  return {published: out, fresh};
}

/** 직원 확인. 공개되지 않은 주면 이유 */
export function ackWeek(pw: Published | undefined, key: string, employeeId: string, branchId: string, now: string): {published: Published; error?: string} {
  const p = pw?.[key];
  if (!p) return {published: pw || {}, error: '아직 공개되지 않은 근무표예요. 사장님이 공개하면 알려 드릴게요.'};
  if (keyBranch(key) !== branchId) return {published: pw!, error: '내 매장 근무표만 확인할 수 있어요. 매장을 다시 확인해 주세요.'};
  return {published: {...pw, [key]: {...p, acks: {...p.acks, [employeeId]: now}}}};
}

/** 직원 화면: 확인해야 할 공개 근무표(이번 주부터) */
export function pendingAcks(pw: Published | undefined, employeeId: string, branchId: string, today: string, ws: 'mon' | 'sun' = 'mon') {
  const from = weekStartOf(today, ws);
  return Object.entries(pw || {}).filter(([k, v]) => keyBranch(k) === branchId && keyWeek(k) >= from && !v.acks?.[employeeId]).map(([k]) => k).sort();
}
