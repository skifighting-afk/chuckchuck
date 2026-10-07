// 지시서 3주차: 근무표 규칙 — 114 주 15시간 넘김 경고, 127 연소자 근무 제한, 022 시간대별 필요 인원.
// 근무 추가·수정·끌어 옮기기·복사 모두 이 함수로 확인한다(막힘=저장 안 함, 경고=알리고 저장).
type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes?: number};
type Emp = {id: string; name: string; role?: string; birthMonth?: string};
export type Check = {level: 'block' | 'warn'; text: string};
export type Need = {id: string; days: number[]; from: string; to: string; need: number; role?: string};

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
export function checkShift(shift: Shift, all: Shift[], emp: Emp | undefined, ws: 'mon' | 'sun' = 'mon', fivePlus = false): Check[] {
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
  if (fivePlus && after > 52) out.push({level: 'warn', text: `${emp.name}님이 그 주 ${r1(after)}시간이 돼 주 52시간을 넘어요.`});
  return out;
}

/** 022 시간대별 필요 인원: 그날 시간대마다 부족·과잉 */
export function staffingGaps(date: string, shifts: Shift[], needs: Need[], emps: Emp[]) {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay(), out: {id: string; from: string; to: string; role?: string; need: number; have: number; kind: '부족' | '과잉'}[] = [];
  for (const n of needs.filter(n => n.days.includes(dow))) {
    const a = mins(n.from), b = mins(n.to) <= a ? mins(n.to) + 1440 : mins(n.to);
    // 30분마다 세서 가장 적은(부족)·가장 많은(과잉) 순간
    let lo = Infinity, hi = 0;
    for (let t = a; t < b; t += 30) {
      const have = shifts.filter(s => s.date === date && (!n.role || emps.find(e => e.id === s.employeeId)?.role === n.role) && (() => { const x = mins(s.start), y = mins(s.end) <= x ? mins(s.end) + 1440 : mins(s.end); return x <= t && t < y; })()).length;
      lo = Math.min(lo, have); hi = Math.max(hi, have);
    }
    if (lo < n.need) out.push({id: n.id, from: n.from, to: n.to, role: n.role, need: n.need, have: lo, kind: '부족'});
    else if (hi > n.need + 1) out.push({id: n.id, from: n.from, to: n.to, role: n.role, need: n.need, have: hi, kind: '과잉'});
  }
  return out;
}
