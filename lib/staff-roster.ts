// 지시서 5주차: 직원 명부 — 상태별 거르기, 검색, 명부 CSV(엑셀에서 수식으로 읽히지 않게 막는다)
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type M = {id: string; name: string; role: string; email: string; phone: string; joined: string; status: string; employment: string; endDate?: string; healthCertUntil?: string; weeklyHours?: number; payType?: string; emergencyName?: string; emergencyPhone?: string};
// 지시서 121·122: 기본은 일하는 직원만, 퇴사자는 따로 '퇴사자 보관함'에
export const STATUS_FILTERS = ['일하는 직원', '입사 준비', '퇴사자 보관함'] as const;
const match = (status: string, f: string) => f === '일하는 직원' ? status !== '퇴사' : f === '퇴사자 보관함' ? status === '퇴사' : f === '전체' ? true : status === f;
export function filterStaff<T extends M>(list: T[], status: string, q: string) {
  const s = q.trim().toLowerCase();
  return list.filter(e => match(e.status, status) && (!s || [e.name, e.role, e.email, e.phone].some(v => (v || '').toLowerCase().includes(s))));
}
export const statusCounts = (list: M[]) => Object.fromEntries(STATUS_FILTERS.map(k => [k, list.filter(e => match(e.status, k)).length]));
const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
export function rosterCsv(list: M[], branchName: string) {
  const head = ['지점', '이름', '업무', '상태', '근로 형태', '입사일', '계약 종료일', '주 소정근로시간', '급여 형태', '전화', '이메일', '보건증 만료일', '비상연락처', '비상연락처 전화'];
  const rows = list.map(e => [branchName, e.name, e.role, e.status, e.employment, e.joined, e.endDate || '', e.weeklyHours ?? '', e.payType || '', e.phone, e.email, e.healthCertUntil || '', e.emergencyName || '', e.emergencyPhone || '']);
  return '﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
}
