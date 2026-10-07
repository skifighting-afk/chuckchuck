// 지시서 085: 근로감독 대비 서류 묶음 — 최근 3년치(근로기준법 제42조 보존 서류)를 엑셀 한 파일(여러 시트)로.
// 근로자 명부(제41조) · 근로계약 현황(제17조) · 임금대장(제48조, 항목별) · 임금명세서 교부 기록 · 출퇴근 원본 · 휴가 · 서명 서류 · 의무교육
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
const kst = (iso?: string | null) => iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().replace('T', ' ').slice(0, 16) : '';
type Row = (string | number | null | undefined)[];
export function inspectionSheets(x: any, now = Date.now()) {
  const d = x.store || {}, since = new Date(now - 3 * 365 * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
  const emp = new Map<string, any>((d.employees || []).map((e: any) => [e.id, e])), n = (id: string) => emp.get(id)?.name || id;
  const br = new Map<string, string>((d.branches || []).map((b: any) => [b.id, b.name]));
  // 퇴직 후 3년이 지난 직원은 뺀다
  const people = (d.employees || []).filter((e: any) => !(e.status === '퇴사' && e.endDate && e.endDate < since));
  const runs = Object.values<any>(d.payrollRuns || {}).filter(r => r?.locked && r.month >= since.slice(0, 7)).sort((a, b) => (a.month + a.branch).localeCompare(b.month + b.branch));
  const kinds = [...new Set(runs.flatMap(r => (r.rows || []).flatMap((x: any) => (x.earnings || []).map((e: any) => e.name))))] as string[];
  const dkinds = [...new Set(runs.flatMap(r => (r.rows || []).flatMap((x: any) => (x.deductions || []).map((e: any) => e.name))))] as string[];
  const sheets: {name: string; rows: Row[]}[] = [
    {name: '근로자 명부', rows: [['지점', '성명', '생년월', '주소', '종사 업무', '근로 형태', '고용일', '퇴직일', '퇴직 사유', '주 소정근로시간', '전화'], ...people.map((e: any) => [br.get(e.branchId) || '', e.name, e.birthMonth || '', e.address || '', e.contract?.duties || e.role, e.employment, e.joined, e.endDate || '', e.leaveReason || '', e.weeklyHours, e.phone])]},
    {name: '근로계약 현황', rows: [['성명', '계약 상태', '체결 시각', '임금', '근로시간', '휴일', '전자계약 상태', '전자계약 완료'], ...people.map((e: any) => { const c = (x.contracts || []).filter((c: any) => c.employee_id === e.id).at(-1); return [e.name, e.contract?.status || '', kst(e.contract?.signedAt), `${e.payType} ${e.wage}원`, `${e.contract?.start || ''}~${e.contract?.end || ''} · 주 ${e.weeklyHours}시간`, e.contract?.holiday || '', c?.status || '', kst(c?.completed_at)]; })]},
    {name: '임금대장', rows: [['급여월', '지점', '지급일', '성명', '근로일수', '근로시간', ...kinds, '총 지급', ...dkinds, '공제 합계', '실수령', '지급 완료일', '계산 근거'],
      ...runs.flatMap(r => (r.rows || []).map((x: any) => [r.month, br.get(r.branch) || r.branch, r.payDate, x.name, x.days ?? '', Math.round((x.hours || 0) * 100) / 100, ...kinds.map(k => (x.earnings || []).filter((e: any) => e.name === k).reduce((s: number, e: any) => s + e.amount, 0) || ''), x.gross, ...dkinds.map(k => (x.deductions || []).filter((e: any) => e.name === k).reduce((s: number, e: any) => s + e.amount, 0) || ''), x.deduction, x.net, r.paid?.[x.employeeId] || '', (x.earnings || []).map((e: any) => `${e.name}: ${e.formula}`).join(' / ')])),
      ...((d.importedPay || []) as any[]).filter(p => p.month >= since.slice(0, 7)).map(p => [p.month, '', '', n(p.employeeId), '', '', ...kinds.map(() => ''), p.gross, ...dkinds.map(() => ''), p.deduction, p.net, '', '다른 서비스에서 가져온 기록' + (p.source ? ` (${p.source})` : '')])]},
    {name: '임금명세서 교부', rows: [['성명', '급여', '차수', '보낸 때', '열어 본 때'], ...(x.payslips || []).filter((p: any) => String(p.run_key || '').slice(0, 7) >= since.slice(0, 7)).map((p: any) => { const seen = (x.documentActivity || []).find((a: any) => a.kind === 'payslip' && a.document_id === p.id && a.viewed_at); return [p.document_json?.name || n(p.employee_id), p.run_key, p.revision, kst(p.created_at), kst(seen?.viewed_at)]; })]},
    {name: '출퇴근 원본', rows: [['날짜', '성명', '출근', '퇴근', '휴게(분)', '인정 출근', '인정 퇴근', '입력'], ...(d.attendance || []).filter((a: any) => kst(a.start).slice(0, 10) >= since).sort((a: any, b: any) => a.start.localeCompare(b.start)).map((a: any) => [kst(a.start).slice(0, 10), n(a.employeeId), kst(a.start).slice(11), a.end ? kst(a.end) : '근무 중', Math.round(a.breakMinutes || 0), a.credit ? kst(a.credit.start).slice(11) : '', a.credit ? kst(a.credit.end).slice(11) : '', a.source === 'owner' ? '사장님 입력' : '직원'])]},
    {name: '휴가', rows: [['성명', '종류', '시작', '끝', '일수', '상태', '사유'], ...((d._operations?.leaves) || []).filter((l: any) => l.start >= since).map((l: any) => [n(l.employeeId), l.kind, l.start, l.end, l.days, l.status, l.reason])]},
    {name: '서명 서류', rows: [['서류', '보낸 때', '성명', '서명 시각'], ...((d._signDocs) || []).flatMap((s: any) => s.employeeIds.map((id: string) => [s.title, kst(s.createdAt), n(id), kst(s.signs?.[id]?.at) || '서명 전']))]},
    {name: '의무교육', rows: [['교육', '날짜', '참석자', '메모'], ...((d.trainings) || []).filter((t: any) => t.date >= since).map((t: any) => [t.kind, t.date, (t.attendees || []).map(n).join(', '), t.note || ''])]},
  ];
  return {since, sheets, counts: Object.fromEntries(sheets.map(s => [s.name, s.rows.length - 1]))};
}
