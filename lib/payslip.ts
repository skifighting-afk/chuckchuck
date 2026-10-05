// 임금명세서 본문. 이메일 명세서와 앱 명세서가 같은 내용을 쓴다.
// 근거: 근로기준법 제48조제2항, 같은 법 시행령 제27조의2 (기재사항)
// 1) 근로자를 특정할 수 있는 정보(성명, 생년월일, 사원번호 등) 2) 임금지급일 3) 임금 총액
// 4) 기본급·각종 수당 등 구성항목별 금액
// 5) 출근일수·시간 등에 따라 금액이 달라지는 항목의 계산방법(연장·야간·휴일근로는 그 시간 수 포함)
// 6) 공제 항목별 금액과 총액 등 공제내역
type Item = {name: string; amount: number; formula: string};
export type PayslipRow = {employeeId: string; name: string; hours?: number; days?: number; earnings: Item[]; deductions: Item[]; gross: number; deduction: number; net: number; note?: string};

const money = (v: number) => Math.round(v).toLocaleString('ko-KR') + '원';
/** 화면·서류에 쓰는 짧은 직원번호(내부 ID 앞 8자리, 영문 대문자·숫자) */
export const employeeNumber = (id: string) => id.replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toUpperCase();

export function payslipText(store: string, month: string, payDate: string, row: PayslipRow) {
  const lines = [
    `${store} · ${month} 임금명세서`,
    `성명: ${row.name}`,
    `직원번호: ${employeeNumber(row.employeeId)}`,
    `임금지급일: ${payDate}`,
  ];
  if (row.days !== undefined || row.hours !== undefined) lines.push(`근무일수: ${row.days ?? 0}일 · 총 근로시간: ${(row.hours ?? 0).toFixed(2)}시간`);
  lines.push('', '[지급 항목]', ...row.earnings.map(i => `${i.name}: ${money(i.amount)}${i.formula?.trim() ? ` (계산방법: ${i.formula})` : ''}`), `임금 총액: ${money(row.gross)}`);
  lines.push('', '[공제 항목]', ...(row.deductions.length ? row.deductions.map(i => `${i.name}: ${money(i.amount)} (${i.formula})`) : ['공제 없음']), `공제 총액: ${money(row.deduction)}`);
  lines.push('', `실지급액: ${money(row.net)}`);
  if (row.note) lines.push('', `비고: ${row.note}`);
  return lines.join('\n');
}

/** 기재사항 점검: 빠진 항목 이름 목록(없으면 빈 배열) */
export function payslipMissing(text: string) {
  const need: [string, RegExp][] = [
    ['성명', /^성명: .+/m], ['직원번호', /^직원번호: [0-9A-Z]+/m], ['임금지급일', /^임금지급일: \d{4}-\d{2}-\d{2}/m],
    ['임금 총액', /^임금 총액: /m], ['구성항목별 금액·계산방법', /\(계산방법: .+\)/], ['공제 내역', /^공제 총액: /m],
  ];
  const missing = need.filter(([, re]) => !re.test(text)).map(([n]) => n);
  // 근무시간·일수에 따라 달라지는 항목(기본급·주휴·가산)은 계산방법이 있어야 한다.
  for (const kind of ['기본급', '주휴수당', '연장', '야간', '휴일']) {
    const line = text.split('\n').find(l => l.startsWith(kind));
    if (line && !line.includes('(계산방법: ')) missing.push(`${kind} 계산방법`);
  }
  // 연장·야간·휴일 가산이 있으면 그 시간 수가 계산방법에 있어야 한다.
  for (const kind of ['연장', '야간', '휴일']) {
    const line = text.split('\n').find(l => l.startsWith(kind));
    if (line && !/\d+(\.\d+)?시간/.test(line)) missing.push(`${kind}근로 시간 수`);
  }
  return missing;
}

/** 급여 확정 전 점검: 명세서에 법정 기재사항이 빠지는 직원 목록 */
export function payslipProblems(store: string, month: string, payDate: string, rows: PayslipRow[]) {
  return rows.map(r => ({name: r.name, missing: payslipMissing(payslipText(store, month, payDate, r))})).filter(x => x.missing.length);
}

// 명세서를 칸으로 보여 주기 위한 구조. 저장된 명세서는 글(payslipText)이라 다시 나눠 읽는다.
export type PayslipView = {title: string; info: [string, string][]; earnings: Item[]; gross: number; deductions: Item[]; deduction: number; net: number; note?: string};
const num = (v: string) => Number(v.replace(/[^\d-]/g, '')) || 0;
export function payslipFromRow(store: string, month: string, payDate: string, row: PayslipRow): PayslipView {
  const info: [string, string][] = [['성명', row.name], ['직원번호', employeeNumber(row.employeeId)], ['임금지급일', payDate]];
  if (row.days !== undefined || row.hours !== undefined) info.push(['근무', `${row.days ?? 0}일 · ${(row.hours ?? 0).toFixed(2)}시간`]);
  return {title: `${store} · ${month} 임금명세서`, info, earnings: row.earnings, gross: row.gross, deductions: row.deductions, deduction: row.deduction, net: row.net, note: row.note || undefined};
}
export function parsePayslip(text: string): PayslipView | null {
  const lines = text.split('\n'), v: PayslipView = {title: lines[0] || '임금명세서', info: [], earnings: [], gross: 0, deductions: [], deduction: 0, net: 0};
  let part: 'info' | 'earn' | 'deduct' | 'end' = 'info';
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    if (line === '[지급 항목]') { part = 'earn'; continue }
    if (line === '[공제 항목]') { part = 'deduct'; continue }
    const total = /^(임금 총액|공제 총액|실지급액): (.+)$/.exec(line);
    if (total) { if (total[1] === '임금 총액') v.gross = num(total[2]); else if (total[1] === '공제 총액') v.deduction = num(total[2]); else { v.net = num(total[2]); part = 'end' } continue }
    if (line.startsWith('비고: ')) { v.note = line.slice(4); continue }
    if (part === 'info') { const m = /^([^:]+): (.*)$/.exec(line); if (m) v.info.push([m[1] === '근무일수' ? '근무' : m[1], m[1] === '근무일수' ? m[2].replace(' · 총 근로시간: ', ' · ') : m[2]]); continue }
    if (line === '공제 없음') continue;
    const m = /^(.+?): (-?[\d,]+)원(?: \((?:계산방법: )?(.*)\))?$/.exec(line);
    if (m && (part === 'earn' || part === 'deduct')) (part === 'earn' ? v.earnings : v.deductions).push({name: m[1], amount: num(m[2]), formula: m[3] || ''});
  }
  return v.earnings.length || v.net ? v : null;
}
