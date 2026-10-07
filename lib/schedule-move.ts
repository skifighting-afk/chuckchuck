// 지시서 1라운드 B: 월간 근무표에서 근무 하나를 다른 날로 옮길 때의 규칙.
// 날짜만 바뀌고 직원·시간·휴게는 그대로. 막히는 칸: 같은 직원 시간 겹침, 승인된 휴가일, 확정·잠금된 급여월.
import type {Team} from './team-model';

type Shift = Team['shifts'][number];
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
/** 날짜 기준 분 구간(자정 넘는 근무는 다음 날까지) */
const span = (x: {date: string; start: string; end: string}) => {
  const day = Date.parse(x.date + 'T00:00:00Z') / 60000, s = day + mins(x.start);
  let e = day + mins(x.end); if (e <= s) e += 1440;
  return [s, e] as const;
};
const isLocked = (s: Team, employeeId: string, date: string) =>
  Object.values(s.payrollRuns || {}).some((r: any) => r?.locked && r.month === date.slice(0, 7) && (r.rows || []).some((e: any) => e.employeeId === employeeId));
const onLeave = (s: Team, employeeId: string, date: string) =>
  ((s as any).approvedLeaves || []).some((l: any) => l.employeeId === employeeId && l.start <= date && date <= l.end);

/** 옮길 수 없으면 이유 한 줄, 옮길 수 있으면 null */
export function moveBlockReason(s: Team, shift: Shift, date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '날짜를 알 수 없어요.';
  if (date === shift.date) return null;
  if (isLocked(s, shift.employeeId, shift.date)) return `${Number(shift.date.slice(5, 7))}월 급여가 확정돼 이 근무는 옮길 수 없어요.`;
  if (isLocked(s, shift.employeeId, date)) return `${Number(date.slice(5, 7))}월 급여가 확정돼 그날로 옮길 수 없어요.`;
  if (onLeave(s, shift.employeeId, date)) return '그날은 승인된 휴가라 옮길 수 없어요.';
  const [ns, ne] = span({...shift, date});
  const clash = s.shifts.find(x => x.id !== shift.id && x.employeeId === shift.employeeId && Math.abs(Date.parse(x.date) - Date.parse(date)) <= 86400000 && (() => {const [a, b] = span(x); return a < ne && ns < b})());
  if (clash) return `그날 ${clash.start}–${clash.end} 근무와 시간이 겹쳐요.`;
  return null;
}

/** 근무 하나의 날짜만 바꾼 새 근무 목록(막히면 원래 목록 그대로 + 이유) */
export function moveShift(s: Team, shiftId: string, date: string): {shifts: Team['shifts']; reason: string | null; from?: string} {
  const sh = s.shifts.find(x => x.id === shiftId);
  if (!sh) return {shifts: s.shifts, reason: '근무를 찾지 못했어요.'};
  const reason = moveBlockReason(s, sh, date);
  if (reason) return {shifts: s.shifts, reason};
  return {shifts: s.shifts.map(x => x.id === shiftId ? {...x, date} : x), reason: null, from: sh.date};
}

export const dayLabel = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
/** "김예시 10월 8일 → 9일로 옮겼어요" (달이 같으면 뒤쪽 달 생략) */
export function moveMessage(name: string, from: string, to: string) {
  return `${name} ${dayLabel(from)} → ${from.slice(0, 7) === to.slice(0, 7) ? Number(to.slice(8)) + '일' : dayLabel(to)}로 옮겼어요`;
}
