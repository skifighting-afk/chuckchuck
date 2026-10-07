// 지시서 4주차: 급여 마감 — 지난달과 비교, 재확정 때 바뀐 점, 지급 완료 기록, 수당·공제 한꺼번에 넣기, 확정 이력.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Row = {employeeId: string; name: string; net: number; gross: number; hours: number};
type Item = {name: string; amount: number; formula: string; taxFree?: boolean};
type Adj = Record<string, {earnings: Item[]; deductions: Item[]; note: string; juhuKeep?: string[]}>;

export const prevMonthOf = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };

/** 지난달 대비: 새 직원·빠진 직원·30% 넘게 달라진 직원 */
export type Compare = {employeeId: string; name: string; prevNet: number | null; net: number | null; diff: number; pct: number | null; flag: '신규' | '이번 달 없음' | '크게 바뀜' | null};
export function compareMonths(cur: Row[], prev: Row[] | null | undefined, big = 0.3): Compare[] {
  if (!prev) return cur.map(r => ({employeeId: r.employeeId, name: r.name, prevNet: null, net: r.net, diff: 0, pct: null, flag: null}));
  const out: Compare[] = cur.map(r => {
    const p = prev.find(x => x.employeeId === r.employeeId);
    if (!p) return {employeeId: r.employeeId, name: r.name, prevNet: null, net: r.net, diff: r.net, pct: null, flag: '신규'};
    const diff = r.net - p.net, pct = p.net ? diff / p.net : null;
    return {employeeId: r.employeeId, name: r.name, prevNet: p.net, net: r.net, diff, pct, flag: pct !== null && Math.abs(pct) >= big ? '크게 바뀜' : null};
  });
  for (const p of prev) if (!cur.some(r => r.employeeId === p.employeeId)) out.push({employeeId: p.employeeId, name: p.name, prevNet: p.net, net: null, diff: -p.net, pct: null, flag: '이번 달 없음'});
  return out;
}
export const won = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + won(Math.abs(n)) + '원';

/** 재확정: 지난 확정과 달라진 직원(실수령·총지급·근무시간) */
export function revisionDiff(before: Row[] | undefined, after: Row[]) {
  if (!before) return [];
  const out: {employeeId: string; name: string; before: number | null; after: number | null; diff: number; hours: number}[] = [];
  for (const r of after) {
    const b = before.find(x => x.employeeId === r.employeeId);
    if (!b) out.push({employeeId: r.employeeId, name: r.name, before: null, after: r.net, diff: r.net, hours: r.hours});
    else if (b.net !== r.net || b.gross !== r.gross || Math.abs(b.hours - r.hours) > 0.005) out.push({employeeId: r.employeeId, name: r.name, before: b.net, after: r.net, diff: r.net - b.net, hours: Math.round((r.hours - b.hours) * 100) / 100});
  }
  for (const b of before) if (!after.some(r => r.employeeId === b.employeeId)) out.push({employeeId: b.employeeId, name: b.name, before: b.net, after: null, diff: -b.net, hours: -b.hours});
  return out;
}

/** 확정 해제할 때 지난 확정 내용을 남겨 둔다(재확정 때 비교·이력) */
export function reopenRun(run: any, reason: string, at: string, by: string) {
  const history = [...(run.history || [])];
  if (!history.some((h: any) => h.revision === (run.revision || 1) && h.kind === '확정')) history.push({kind: '확정', revision: run.revision || 1, at: run.at, by: run.actor?.name || '', total: run.rows.reduce((n: number, r: Row) => n + r.net, 0)});
  history.push({kind: '해제', revision: run.revision || 1, at, by, reason});
  return {...run, locked: false, prevRows: run.rows, paid: {}, history};
}
/** 재확정할 때 이력 붙이기 */
export function finalizeHistory(prev: any, revision: number, at: string, by: string, rows: Row[]) {
  return [...(prev?.history || []), {kind: '확정', revision, at, by, total: rows.reduce((n, r) => n + r.net, 0)}];
}

/** 지급 완료 기록: 확정된 달만, 확정에 들어간 직원만 */
export function markPaid(run: any, ids: string[], date: string, undo = false): {run?: any; error?: string} {
  if (!run?.locked) return {error: '급여를 확정한 뒤에 지급 완료를 기록할 수 있어요.'};
  if (!undo && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return {error: '지급한 날짜를 골라 주세요.'};
  const valid = ids.filter(id => run.rows.some((r: Row) => r.employeeId === id));
  if (!valid.length) return {error: '지급 완료로 표시할 직원을 골라 주세요.'};
  const paid = {...(run.paid || {})};
  for (const id of valid) if (undo) delete paid[id]; else paid[id] = date;
  return {run: {...run, paid}};
}
export function paidSummary(run: any) {
  const rows: Row[] = run?.rows || [], paid = run?.paid || {};
  const done = rows.filter(r => paid[r.employeeId]);
  return {done: done.length, total: rows.length, left: rows.filter(r => !paid[r.employeeId]), amountLeft: rows.filter(r => !paid[r.employeeId]).reduce((n, r) => n + r.net, 0)};
}

/** 같은 수당·공제를 여러 직원에게 한꺼번에(같은 이름이 있으면 금액을 바꾼다) */
export function bulkAdjust(adj: Adj, month: string, ids: string[], kind: 'earnings' | 'deductions', item: Item): {adjustments?: Adj; error?: string} {
  if (!item.name.trim()) return {error: '항목 이름을 적어 주세요.'};
  if (!Number.isFinite(item.amount) || item.amount <= 0) return {error: '금액을 0원보다 크게 적어 주세요.'};
  if (!ids.length) return {error: '넣을 직원을 한 명 이상 골라 주세요.'};
  const next: Adj = {...adj};
  for (const id of ids) {
    const k = `${month}:${id}`, cur = next[k] || {earnings: [], deductions: [], note: ''};
    const list = cur[kind].filter(x => x.name !== item.name.trim());
    next[k] = {...cur, [kind]: [...list, {...item, name: item.name.trim()}]};
  }
  return {adjustments: next};
}

/** 지시서 4주차 033: 은행 대량이체 파일(엑셀에서 열리는 CSV). 계좌가 없는 직원은 따로 알려 준다 */
export function bankTransferCsv(rows: Row[], emps: {id: string; name: string; bankName?: string; bankAccount?: string; bankHolder?: string}[], month: string, storeName: string, paid: Record<string, string> = {}) {
  const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
  const ok: string[][] = [], missing: string[] = [];
  for (const r of rows) {
    if (paid[r.employeeId] || r.net <= 0) continue;
    const e = emps.find(x => x.id === r.employeeId), acct = (e?.bankAccount || '').replace(/[^\d-]/g, '');
    if (!e?.bankName || !acct) { missing.push(r.name); continue; }
    ok.push([e.bankName, acct, e.bankHolder || r.name, String(Math.round(r.net)), `${storeName.slice(0, 6)} ${Number(month.slice(5))}월급여`, `${r.name} ${Number(month.slice(5))}월급여`]);
  }
  const csv = '\uFEFF' + [['입금은행', '입금계좌번호', '예금주', '이체금액', '받는분 통장표시', '내 통장표시'], ...ok].map(r => r.map(cell).join(',')).join('\r\n');
  return {csv, count: ok.length, total: ok.reduce((n, r) => n + Number(r[3]), 0), missing};
}

/** 지시서 7주차 111: 퇴직금 산정 — 퇴직일 전 3개월(달력상) 임금 총액·일수를 확정 급여로 채운다. 3개월이 안 되는 달은 일할 */
export function retirementBasis(runs: Record<string, any>, employeeId: string, end: string) {
  const day = 86400000, endMs = Date.parse(end + 'T00:00:00Z'), [y, m, d] = end.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1 - 3, d), days = Math.round((endMs - startMs) / day);
  let wages = 0; const used: string[] = [], missing: string[] = [];
  for (let k = 0; k < 4; k++) {
    const mm = new Date(Date.UTC(y, m - 1 - k, 1)), month = mm.toISOString().slice(0, 7), mStart = mm.getTime(), mEnd = Date.UTC(mm.getUTCFullYear(), mm.getUTCMonth() + 1, 1);
    const lo = Math.max(mStart, startMs), hi = Math.min(mEnd, endMs); if (hi <= lo) continue;
    const row = Object.values(runs || {}).filter((r: any) => r?.locked && r.month === month).flatMap((r: any) => r.rows || []).find((x: any) => x.employeeId === employeeId);
    if (!row) { missing.push(month); continue; }
    wages += row.gross * (hi - lo) / (mEnd - mStart); used.push(month);
  }
  return {wages: Math.round(wages), days, used, missing};
}
