// 가이드 65·66: 신고용 자료 정리. 앱은 신고를 대신하지 않고, 홈택스·4대보험 EDI에 옮겨 적기 쉽게 숫자만 모은다.
// 65: 원천징수이행상황신고서 — 근로소득 간이세액(A01), 사업소득(A25) 인원·총지급액·소득세(지방소득세는 별도 신고)
// 66: 4대보험 취득·상실 — 그달 입사·퇴사 직원 명단. 주민등록번호는 앱에 없으므로 사장님이 직접 적는다.
type Row = {employeeId: string; name: string; gross: number; deductions: {name: string; amount: number}[]};
type Emp = {id: string; name: string; joined: string; endDate?: string; status: string; taxMode: string; income: string; weeklyHours: number; wage: number; payType: string; role: string; insurances: Record<string, {status: string}>};
const f10 = (n: number) => Math.floor(n / 10) * 10;
export function withholdingSummary(rows: Row[], employees: Emp[]) {
  const emp = (id: string) => employees.find(e => e.id === id);
  const a01 = {code: 'A01', label: '근로소득 간이세액', people: 0, gross: 0, incomeTax: 0, localTax: 0};
  const a25 = {code: 'A25', label: '사업소득(3.3%)', people: 0, gross: 0, incomeTax: 0, localTax: 0};
  for (const r of rows) {
    const e = emp(r.employeeId); if (!e || r.gross <= 0) continue;
    const it = r.deductions.find(d => d.name === '근로소득세')?.amount || 0, lt = r.deductions.find(d => d.name === '지방소득세')?.amount || 0;
    if (e.taxMode === '사업소득 3.3%' || e.income === '사업소득') {
      const tax = f10(r.gross * 0.03); a25.people++; a25.gross += r.gross; a25.incomeTax += tax; a25.localTax += f10(tax * 0.1);
    } else if (e.income === '근로소득' || e.taxMode === '4대보험 자동') {
      a01.people++; a01.gross += r.gross; a01.incomeTax += it; a01.localTax += lt;
    }
  }
  return [a01, a25].filter(x => x.people);
}
export function insuranceChanges(employees: Emp[], month: string) {
  const inMonth = (d?: string) => !!d && d.startsWith(month);
  const monthly = (e: Emp) => e.payType === '월급' ? e.wage : e.payType === '시급' ? Math.round(e.wage * e.weeklyHours * 52 / 12 * (e.weeklyHours >= 15 ? 1.2 : 1)) : Math.round(e.wage * e.weeklyHours / 8 * 52 / 12);
  const on = (e: Emp) => Object.entries(e.insurances || {}).filter(([, v]) => v.status === '가입').map(([k]) => k).join('·') || '가입 보험 없음';
  return {
    acquire: employees.filter(e => inMonth(e.joined) && e.status !== '입사 준비').map(e => ({name: e.name, date: e.joined, monthlyPay: monthly(e), weeklyHours: e.weeklyHours, job: e.role, insurances: on(e)})),
    lose: employees.filter(e => e.status === '퇴사' && inMonth(e.endDate)).map(e => ({name: e.name, date: e.endDate!, insurances: on(e)})),
  };
}
const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
export function filingCsv(month: string, rows: Row[], employees: Emp[]) {
  const w = withholdingSummary(rows, employees), c = insuranceChanges(employees, month);
  const lines: unknown[][] = [[`${month} 신고 자료 (척척사장봇 · 신고 대행 아님 · 금액은 홈택스·EDI에서 다시 확인)`], [],
    ['원천징수이행상황신고서', '코드', '인원', '총지급액', '소득세', '지방소득세(별도 신고)'], ...w.map(x => ['', x.code + ' ' + x.label, x.people, x.gross, x.incomeTax, x.localTax]), [],
    ['4대보험 자격취득', '성명', '취득일(입사일)', '월 보수액(추정)', '주 소정근로시간', '직종', '가입 보험', '주민등록번호(직접 기입)'], ...c.acquire.map(x => ['', x.name, x.date, x.monthlyPay, x.weeklyHours, x.job, x.insurances, '']), [],
    ['4대보험 자격상실', '성명', '마지막 근무일', '가입 보험', '상실 사유(직접 기입)', '주민등록번호(직접 기입)'], ...c.lose.map(x => ['', x.name, x.date, x.insurances, '', ''])];
  return '﻿' + lines.map(r => r.map(cell).join(',')).join('\r\n');
}
