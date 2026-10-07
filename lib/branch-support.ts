// 지시서 093 지점 간 지원 근무 배분 · 096 지점별 준수 현황
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Shift = {id: string; employeeId: string; date: string; start: string; end: string; breakMinutes?: number; branchId?: string};
type Att = {employeeId: string; start: string; end: string | null; breakMinutes: number; credit?: {start: string; end: string} | null};
type Emp = {id: string; name: string; branchId: string; status: string; contract?: {status?: string}; healthCertUntil?: string; birthMonth?: string; minorDocs?: boolean};
const kd = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);
const hrs = (a: Att) => { const s = a.credit && a.end ? a.credit.start : a.start, e = a.credit && a.end ? a.credit.end : a.end; return e ? Math.max(0, (Date.parse(e) - Date.parse(s)) / 3600000 - a.breakMinutes / 60) : 0; };
/** 093: 그 달 실제 근무 시간을 일한 지점별로 나누고(그날 근무표의 근무 지점 기준), 직원 총 지급액을 시간 비율로 배분 */
export function branchAllocation(emps: Emp[], shifts: Shift[], att: Att[], month: string, gross: Record<string, number>) {
  const out: Record<string, {own: number; supportIn: number; supportOut: number; cost: number}> = {};
  const get = (b: string) => out[b] ||= {own: 0, supportIn: 0, supportOut: 0, cost: 0};
  for (const e of emps) {
    const recs = att.filter(a => a.employeeId === e.id && a.end && kd(a.start).startsWith(month)); let total = 0; const by: Record<string, number> = {};
    for (const a of recs) { const d = kd(a.start), sh = shifts.find(x => x.employeeId === e.id && x.date === d && x.branchId), b = sh?.branchId || e.branchId, h = hrs(a); by[b] = (by[b] || 0) + h; total += h; }
    for (const [b, h] of Object.entries(by)) { if (b === e.branchId) get(b).own += h; else { get(b).supportIn += h; get(e.branchId).supportOut += h; } get(b).cost += total ? (gross[e.id] || 0) * h / total : 0; }
    if (!total && gross[e.id]) get(e.branchId).cost += gross[e.id];
  }
  for (const v of Object.values(out)) { v.own = Math.round(v.own * 10) / 10; v.supportIn = Math.round(v.supportIn * 10) / 10; v.supportOut = Math.round(v.supportOut * 10) / 10; v.cost = Math.round(v.cost); }
  return out;
}
/** 096: 지점별 준수 현황 — 계약 체결률, 명세서 발송률(최근 확정 달), 보건증 만료·임박, 연소자 서류, 근무표 공개 */
export function branchCompliance(branchId: string, emps: Emp[], ctx: {today: string; lastRun?: {rows: {employeeId: string}[]; sent: number} | null; published?: boolean; trainingsDone?: number; trainingsTotal?: number}) {
  const es = emps.filter(e => e.branchId === branchId && e.status !== '퇴사');
  const signed = es.filter(e => e.contract?.status === '체결 완료').length;
  const soon = new Date(Date.parse(ctx.today + 'T00:00:00Z') + 30 * 86400000).toISOString().slice(0, 10);
  const health = es.filter(e => e.healthCertUntil && e.healthCertUntil < soon).length;
  const age = (bm?: string) => { if (!bm || !/^\d{4}-\d{2}$/.test(bm)) return null; const [y, m] = bm.split('-').map(Number); return Number(ctx.today.slice(0, 4)) - y - (Number(ctx.today.slice(5, 7)) < m ? 1 : 0); };
  const minorsMissing = es.filter(e => { const a = age(e.birthMonth); return a !== null && a < 18 && !e.minorDocs; }).length;
  const rows = ctx.lastRun?.rows.length || 0;
  return {staff: es.length, contractRate: es.length ? Math.round(signed / es.length * 100) : 100, unsigned: es.length - signed, payslipRate: rows ? Math.min(100, Math.round((ctx.lastRun!.sent) / rows * 100)) : null, health, minorsMissing, published: !!ctx.published};
}
