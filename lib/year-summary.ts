// 가이드 79: 연말정산·지급명세서 준비용 연간 합계. 확정한 급여(payrollRuns, locked)만 더한다.
type Line = {name: string; amount: number; taxFree?: boolean};
type Row = {employeeId: string; name: string; gross: number; net: number; earnings?: Line[]; deductions?: Line[]};
type Run = {locked?: boolean; month?: string; rows?: Row[]};
const KEYS = ['국민연금', '건강보험', '장기요양보험', '고용보험', '근로소득세', '지방소득세', '사업소득 원천징수'] as const;
export function yearSummary(runs: Record<string, Run>, year: string) {
  const by = new Map<string, {name: string; months: Set<string>; gross: number; taxFree: number; net: number} & Record<string, any>>();
  for (const run of Object.values(runs || {})) {
    if (!run?.locked || !run.month?.startsWith(year)) continue;
    for (const r of run.rows || []) {
      const x = by.get(r.employeeId) || {name: r.name, months: new Set<string>(), gross: 0, taxFree: 0, net: 0, ...Object.fromEntries(KEYS.map(k => [k, 0]))};
      x.months.add(run.month); x.gross += r.gross || 0; x.net += r.net || 0;
      x.taxFree += (r.earnings || []).filter(e => e.taxFree).reduce((n, e) => n + e.amount, 0);
      for (const d of r.deductions || []) if ((KEYS as readonly string[]).includes(d.name)) x[d.name] += d.amount;
      by.set(r.employeeId, x);
    }
  }
  return [...by.entries()].map(([employeeId, x]) => ({employeeId, name: x.name, months: [...x.months].sort(), gross: x.gross, taxFree: x.taxFree, taxable: x.gross - x.taxFree, net: x.net, ...Object.fromEntries(KEYS.map(k => [k, x[k]]))}));
}
const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
export function yearSummaryCsv(runs: Record<string, Run>, year: string) {
  const rows = yearSummary(runs, year);
  const head = ['성명', '확정한 달', '총지급', '비과세', '과세 대상', ...KEYS, '실지급 합계'];
  const body = rows.map(r => [r.name, r.months.length + '개월(' + r.months.map(m => m.slice(5)).join('·') + ')', r.gross, r.taxFree, r.taxable, ...KEYS.map(k => (r as any)[k]), r.net]);
  return '﻿' + [[`${year}년 연간 급여 합계 (확정한 급여만 · 연말정산·지급명세서 준비용 · 신고 대행 아님)`], head, ...body].map(r => r.map(cell).join(',')).join('\r\n');
}
