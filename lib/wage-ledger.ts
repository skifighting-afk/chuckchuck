// 작업 022: 임금대장
// 근거: 근로기준법 제48조제1항(임금대장 작성), 제42조·시행령 제22조(3년 보존),
// 시행령 제27조(기재사항): 성명, 생년월일·사원번호 등 근로자를 특정할 수 있는 정보, 고용 연월일, 종사 업무,
// 임금 및 가족수당 계산기초, 근로일수, 근로시간수, 연장·야간·휴일근로 시간수, 기본급·수당 등 임금 내역별 금액,
// 공제 내역. (상시 4명 이하 사업장은 근로시간수·연장·야간·휴일 시간수 기재를 생략할 수 있다 — 여기서는 항상 적는다.)
// 확정(잠금)한 급여만 대장에 올린다. 확정 해제 중인 달은 '확정 해제 중'으로 따로 표시한다.
import {employeeNumber} from './payslip';

type Item = {name: string; amount: number; formula: string};
export type LedgerEntry = {
  month: string; payDate: string; branch: string; branchName: string; status: '확정' | '확정 해제 중'; revision: number; confirmedAt: string;
  employeeId: string; number: string; name: string; birthMonth: string; joined: string; duty: string; employment: string;
  payBasis: string; days: number; hours: number; overtimeHours: number; nightHours: number; holidayHours: number;
  earnings: Item[]; deductions: Item[]; gross: number; deduction: number; net: number;
};

const hoursIn = (items: Item[], prefix: string) => {
  const line = items.find(i => i.name.startsWith(prefix));
  const m = line?.formula.match(/(\d+(?:\.\d+)?)시간/);
  return m ? Number(m[1]) : 0;
};

/** from~to(YYYY-MM, 포함) 사이 확정 급여를 월·지점·직원 순으로 펼친다. branch를 주면 그 지점만. */
export function wageLedger(state: any, from: string, to: string, branch?: string): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  const branches = new Map<string, string>((state.branches || []).map((b: any) => [b.id, b.name]));
  const people = new Map<string, any>((state.employees || []).map((e: any) => [e.id, e]));
  for (const run of Object.values<any>(state.payrollRuns || {})) {
    if (!run?.rows || !run.month || run.month < from || run.month > to) continue;
    if (branch && run.branch !== branch) continue;
    // 한 번도 확정하지 않은 달은 없다(확정 때만 run이 생긴다). 해제 중이면 마지막 확정본을 보여 주되 표시한다.
    for (const r of run.rows) {
      const e = people.get(r.employeeId) || {};
      const payType = r.payType || e.payType || '';
      out.push({
        month: run.month, payDate: run.payDate || '', branch: run.branch, branchName: branches.get(run.branch) || run.branch,
        status: run.locked ? '확정' : '확정 해제 중', revision: run.revision || 1, confirmedAt: run.at || '',
        employeeId: r.employeeId, number: employeeNumber(r.employeeId), name: r.name, birthMonth: e.birthMonth || '', joined: e.joined || '',
        duty: [e.role, e.contract?.duties].filter(Boolean).join(' · '), employment: e.employment || '',
        payBasis: payType && e.wage ? `${payType} ${Math.round(e.wage).toLocaleString('ko-KR')}원` : payType,
        days: r.days ?? 0, hours: Number((r.hours ?? 0).toFixed(2)),
        overtimeHours: hoursIn(r.earnings || [], '연장'), nightHours: hoursIn(r.earnings || [], '야간'), holidayHours: hoursIn(r.earnings || [], '휴일'),
        earnings: r.earnings || [], deductions: r.deductions || [], gross: r.gross, deduction: r.deduction, net: r.net,
      });
    }
  }
  return out.sort((a, b) => a.month.localeCompare(b.month) || a.branchName.localeCompare(b.branchName, 'ko') || a.name.localeCompare(b.name, 'ko'));
}

/** 엑셀에서 수식으로 실행되지 않게 막고, 쉼표·따옴표를 감싼다. */
export const csvCell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';

/** 임금대장 CSV(엑셀용 BOM 포함). 지급·공제 항목은 이름별로 열을 만든다. */
export function ledgerCsv(entries: LedgerEntry[]) {
  const earn = [...new Set(entries.flatMap(e => e.earnings.map(i => i.name)))];
  const ded = [...new Set(entries.flatMap(e => e.deductions.map(i => i.name)))];
  const head = ['급여월', '지급일', '지점', '상태', '확정 차수', '직원번호', '성명', '생년월', '입사일', '종사 업무', '고용 형태', '임금 계산기초', '근로일수', '근로시간', '연장근로시간', '야간근로시간', '휴일근로시간',
    ...earn.map(n => '[지급] ' + n), '임금 총액', ...ded.map(n => '[공제] ' + n), '공제 총액', '실지급액'];
  const sum = (items: Item[], n: string) => items.filter(i => i.name === n).reduce((t, i) => t + i.amount, 0);
  const rows = entries.map(e => [e.month, e.payDate, e.branchName, e.status, e.revision, e.number, e.name, e.birthMonth, e.joined, e.duty, e.employment, e.payBasis, e.days, e.hours, e.overtimeHours, e.nightHours, e.holidayHours,
    ...earn.map(n => sum(e.earnings, n)), e.gross, ...ded.map(n => sum(e.deductions, n)), e.deduction, e.net]);
  return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}
