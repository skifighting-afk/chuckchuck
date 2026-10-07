// 지시서 3주차: 근무표 규칙 — 114 주 15시간 넘김 경고, 127 연소자 근무 제한, 022 시간대별 필요 인원.
// 근무 추가·수정·끌어 옮기기·복사 모두 이 함수로 확인한다(막힘=저장 안 함, 경고=알리고 저장).
type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes?: number};
type Emp = {id: string; name: string; role?: string; birthMonth?: string};
export type Check = {level: 'block' | 'warn'; text: string};
/** 시간대별 필요 인원(근무표 초안 화면에서 정하는 staffingNeeds 그대로) */
export type Need = {weekday: number; start: string; end: string; count: number; branchId?: string};

const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function shiftHours(s: {start: string; end: string; breakMinutes?: number}) { let m = mins(s.end) - mins(s.start); if (m <= 0) m += 1440; return Math.max(0, m - (s.breakMinutes || 0)) / 60; }
export function weekStartOf(d: string, ws: 'mon' | 'sun' = 'mon') { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return plus(d, -(ws === 'mon' ? (w + 6) % 7 : w)); }
export function weekHours(shifts: Shift[], employeeId: string, date: string, ws: 'mon' | 'sun' = 'mon', ignoreId?: string) {
  const from = weekStartOf(date, ws), to = plus(from, 6);
  return shifts.filter(s => s.employeeId === employeeId && s.id !== ignoreId && s.date >= from && s.date <= to).reduce((n, s) => n + shiftHours(s), 0);
}
/** 만 나이(생년월은 YYYY-MM, 일은 모르므로 그달 1일로 보수적으로 계산) */
export function ageAt(birthMonth: string | undefined, date: string) {
  if (!birthMonth || !/^\d{4}-\d{2}$/.test(birthMonth)) return null;
  const [by, bm] = birthMonth.split('-').map(Number), [y, m] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
  return y - by - (m < bm ? 1 : 0);
}
const r1 = (h: number) => (Math.round(h * 10) / 10).toString().replace(/\.0$/, '');
/** 밤 10시~아침 6시와 겹치는지(자정 넘는 근무 포함) */
function touchesNight(s: {start: string; end: string}) {
  const a = mins(s.start); let b = mins(s.end); if (b <= a) b += 1440;
  // 겹치는 밤 구간: [-120,360], [1320,1800]
  return (a < 360 && b > 0) || (a < 1800 && b > 1320) || a < 360;
}

/** 이 근무를 넣거나 바꾸면 생기는 문제 */
export function checkShift(shift: Shift, all: Shift[], emp: Emp | undefined, ws: 'mon' | 'sun' = 'mon', fivePlus = false, branch?: {hours?: {open: string; close: string}; closedDays?: number[]}): Check[] {
  const out: Check[] = [];
  if (!emp) return out;
  const before = weekHours(all, emp.id, shift.date, ws, shift.id), after = before + shiftHours(shift);
  // 127 연소자(18세 미만): 밤 10시~아침 6시, 하루 7시간·주 35시간 넘으면 막음
  const age = ageAt(emp.birthMonth, shift.date);
  if (age !== null && age < 18) {
    if (touchesNight(shift)) out.push({level: 'block', text: `${emp.name}님은 만 18세 미만이라 밤 10시~아침 6시 근무를 넣을 수 없어요(본인 동의와 노동부 인가가 있어야 해요).`});
    if (shiftHours(shift) > 7) out.push({level: 'block', text: `${emp.name}님은 만 18세 미만이라 하루 7시간을 넘길 수 없어요(지금 ${r1(shiftHours(shift))}시간).`});
    if (after > 35) out.push({level: 'block', text: `${emp.name}님은 만 18세 미만이라 주 35시간을 넘길 수 없어요(이 근무를 넣으면 ${r1(after)}시간).`});
  }
  // 114 주 15시간을 처음 넘기는 순간: 주휴수당이 생김
  if (before < 15 && after >= 15) out.push({level: 'warn', text: `이 근무를 넣으면 ${emp.name}님이 그 주 ${r1(before)}시간에서 ${r1(after)}시간이 돼 주 15시간을 넘어요. 주휴수당이 생겨요.`});
  // 지시서 5주차: 정기 휴무일·영업시간 밖(2시간 넘게 벗어날 때만, 준비·마감 시간은 괜찮다)
  if (branch?.closedDays?.includes(new Date(shift.date + 'T00:00:00Z').getUTCDay())) out.push({level: 'warn', text: '그날은 매장 정기 휴무일이에요. 영업하는 날이 맞는지 확인해 주세요.'});
  if (branch?.hours) { const o = mins(branch.hours.open), c0 = mins(branch.hours.close), c = c0 <= o ? c0 + 1440 : c0, a = mins(shift.start), b0 = mins(shift.end), b = b0 <= a ? b0 + 1440 : b0;
    if (a < o - 120 || b > c + 120) out.push({level: 'warn', text: `영업시간(${branch.hours.open}–${branch.hours.close})보다 2시간 넘게 벗어난 근무예요.`}); }
  // 지시서 026: 연속 근무일 · 근무 사이 쉬는 시간 · 하루 8시간(5인 이상)
  const mine = all.filter(x => x.employeeId === emp.id && x.id !== shift.id), days = new Set([...mine.map(x => x.date), shift.date]);
  let run = 1; for (let d = plus(shift.date, -1); days.has(d); d = plus(d, -1)) run++; for (let d = plus(shift.date, 1); days.has(d); d = plus(d, 1)) run++;
  if (run >= 7) out.push({level: 'warn', text: `${emp.name}님이 ${run}일 연속 근무가 돼요. 1주에 하루 이상은 쉬는 날(주휴일)을 줘야 해요.`});
  const span = (x: Shift) => { const a = Date.parse(x.date + 'T00:00:00Z') / 60000 + mins(x.start); let b = Date.parse(x.date + 'T00:00:00Z') / 60000 + mins(x.end); if (b <= a) b += 1440; return [a, b]; };
  const [ss, se] = span(shift); let gap = Infinity;
  for (const x of mine) { const [a, b] = span(x); if (b <= ss) gap = Math.min(gap, ss - b); else if (a >= se) gap = Math.min(gap, a - se); }
  if (gap < 11 * 60 && gap >= 0) out.push({level: 'warn', text: `앞뒤 근무 사이 쉬는 시간이 ${r1(gap / 60)}시간뿐이에요. 11시간 이상 쉬게 하는 것을 권해요.`});
  if (fivePlus && shiftHours(shift) > 8) out.push({level: 'warn', text: `하루 ${r1(shiftHours(shift))}시간 근무라 8시간을 넘는 ${r1(shiftHours(shift) - 8)}시간은 연장수당(1.5배)이 붙어요.`});
  if (fivePlus && after > 52) out.push({level: 'warn', text: `${emp.name}님이 그 주 ${r1(after)}시간이 돼 주 52시간을 넘어요.`});
  return out;
}

/** 022 시간대별 필요 인원: 그날 시간대마다 부족·과잉(30분마다 세서 가장 적은·많은 순간) */
export function staffingGaps(date: string, shifts: Shift[], needs: Need[]) {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay(), out: {from: string; to: string; need: number; have: number; kind: '부족' | '과잉'}[] = [];
  const day = shifts.filter(s => s.date === date);
  for (const n of needs.filter(n => n.weekday === dow)) {
    const a = mins(n.start), b = mins(n.end) <= a ? mins(n.end) + 1440 : mins(n.end);
    let lo = Infinity, hi = 0;
    for (let t = a; t < b; t += 30) {
      const have = day.filter(s => { const x = mins(s.start), y = mins(s.end) <= x ? mins(s.end) + 1440 : mins(s.end); return x <= t && t < y; }).length;
      lo = Math.min(lo, have); hi = Math.max(hi, have);
    }
    if (lo < n.count) out.push({from: n.start, to: n.end, need: n.count, have: lo, kind: '부족'});
    else if (hi > n.count + 1) out.push({from: n.start, to: n.end, need: n.count, have: hi, kind: '과잉'});
  }
  return out.sort((x, y) => x.from.localeCompare(y.from));
}
