// 지시서 11주차: 개인정보 보존·파기 — 근로기준법 제42조(근로자 명부·계약서·임금대장 등 3년 보존)가 지난 퇴사자의 연락처를 지운다.
// 이름은 지난 급여 기록과 맞추려고 성+가린 이름으로 남기고, 연락처·주소·비상연락처·메모는 비운다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type M = {id: string; name: string; status: string; endDate?: string; joined: string; email: string; phone: string; address?: string; notes?: string; emergencyName?: string; emergencyPhone?: string; birthMonth?: string; [k: string]: any};
export const RETAIN_YEARS = 3;
const minus = (d: string, y: number) => `${Number(d.slice(0, 4)) - y}${d.slice(4)}`;
export function retentionDue<T extends M>(list: T[], today: string) {
  const cut = minus(today, RETAIN_YEARS);
  return list.filter(e => e.status === '퇴사' && !e.anonymizedAt && (e.endDate || e.joined) && (e.endDate || e.joined) <= cut);
}
export const maskName = (n: string) => n.length <= 1 ? n + '○' : n[0] + '○'.repeat(Math.min(3, n.length - 1));
export function anonymize<T extends M>(e: T, at: string): T {
  return {...e, name: maskName(e.name), email: '', phone: '', address: '', notes: '', emergencyName: undefined, emergencyPhone: undefined, bankName: undefined, bankAccount: undefined, bankHolder: undefined, birthMonth: '', anonymizedAt: at};
}
/** 직원 본인 자료 내려받기(개인정보 열람): 내 정보·근무표·출퇴근·확정된 급여 */
export function myDataExport(state: any, selfId: string, at: string) {
  const me = state.employees.find((e: any) => e.id === selfId);
  if (!me) return null;
  const {contract, insurances, managerPermissions, ...profile} = me;
  return {
    안내: '척척사장에 저장된 내 정보예요. 다른 사람에게 보내지 마세요.', 내려받은때: at, 매장: state.store?.name,
    내정보: {...profile, 근로계약: contract ? {상태: contract.status, 근무일: contract.workDays, 시간: `${contract.start}–${contract.end}`, 체결일: contract.signedAt} : null, 보험: insurances},
    근무표: (state.shifts || []).filter((s: any) => s.employeeId === selfId).map((s: any) => ({날짜: s.date, 시작: s.start, 끝: s.end, 휴게분: s.breakMinutes})),
    출퇴근: (state.attendance || []).filter((a: any) => a.employeeId === selfId).map((a: any) => ({출근: a.start, 퇴근: a.end, 휴게분: a.breakMinutes})),
    급여: Object.values(state.payrollRuns || {}).filter((r: any) => r?.locked).flatMap((r: any) => (r.rows || []).filter((x: any) => x.employeeId === selfId).map((x: any) => ({월: r.month, 지급일: r.payDate, 총지급: x.gross, 공제: x.deduction, 실수령: x.net, 근무시간: x.hours}))),
  };
}
