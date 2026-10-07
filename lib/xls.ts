// 지시서 150: 엑셀에서 바로 열리는 여러 시트 파일(SpreadsheetML 2003, .xls) — 라이브러리 없이 만든다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]!)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const sheetName = (n: string) => n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';
export function toXls(sheets: {name: string; rows: (string | number | null | undefined)[][]}[]) {
  const cell = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>'
    + sheets.map(s => `<Worksheet ss:Name="${esc(sheetName(s.name))}"><Table>${s.rows.map((r, i) => `<Row${i === 0 ? ' ss:StyleID="h"' : ''}>${r.map(cell).join('')}</Row>`).join('')}</Table></Worksheet>`).join('') + '</Workbook>';
}
const kst = (iso?: string | null) => iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().replace('T', ' ').slice(0, 16) : '';
/** 내려받은 가게 데이터(JSON)를 시트로 */
export function exportSheets(x: any) {
  const d = x.store || {}, emp = new Map((d.employees || []).map((e: any) => [e.id, e.name]));
  const n = (id: string) => emp.get(id) || id;
  const hrs = (a: any) => a.end ? Math.round(Math.max(0, (Date.parse(a.end) - Date.parse(a.start)) / 3600000 - (a.breakMinutes || 0) / 60) * 100) / 100 : '';
  return [
    {name: '직원', rows: [['이름', '업무', '상태', '근로 형태', '입사일', '종료일', '급여 형태', '금액', '주 시간', '전화', '이메일', '계약'], ...(d.employees || []).map((e: any) => [e.name, e.role, e.status, e.employment, e.joined, e.endDate, e.payType, e.wage, e.weeklyHours, e.phone, e.email, e.contract?.status])]},
    {name: '근무표', rows: [['날짜', '직원', '시작', '끝', '휴게(분)'], ...(d.shifts || []).slice().sort((a: any, b: any) => (a.date + a.start).localeCompare(b.date + b.start)).map((s: any) => [s.date, n(s.employeeId), s.start, s.end, s.breakMinutes])]},
    {name: '출퇴근', rows: [['직원', '출근', '퇴근', '휴게(분)', '찍은 시간(시간)', '비고'], ...(d.attendance || []).slice().sort((a: any, b: any) => a.start.localeCompare(b.start)).map((a: any) => [n(a.employeeId), kst(a.start), kst(a.end), a.breakMinutes, hrs(a), a.source === 'owner' ? '사장님 입력' : ''])]},
    {name: '급여 확정', rows: [['급여월', '지점', '지급일', '직원', '근무시간', '총 지급', '공제', '실수령', '지급 완료'], ...Object.values(d.payrollRuns || {}).filter((r: any) => r?.locked).flatMap((r: any) => (r.rows || []).map((x: any) => [r.month, r.branch, r.payDate, x.name, x.hours, x.gross, x.deduction, x.net, r.paid?.[x.employeeId] || '']))]},
    {name: '휴가', rows: [['직원', '종류', '시작', '끝', '일수', '상태', '사유'], ...((d._operations?.leaves) || []).map((l: any) => [n(l.employeeId), l.kind, l.start, l.end, l.days, l.status, l.reason])]},
    {name: '근로계약서', rows: [['직원', '상태', '만든 날', '서명 완료'], ...(x.contracts || []).map((c: any) => [c.document_json?.employeeName || n(c.employee_id), c.status, kst(c.created_at), kst(c.completed_at)])]},
    {name: '명세서 발송', rows: [['직원', '급여', '차수', '보낸 때'], ...(x.payslips || []).map((p: any) => [p.document_json?.name || n(p.employee_id), p.run_key, p.revision, kst(p.created_at)])]},
  ];
}
