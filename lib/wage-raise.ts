// 지시서 154 시급 일괄 인상 · 045 시급 인상 예약 · 046 시급 변경 이력
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type H = {from: string; wage: number; prev: number; payType: '시급' | '월급' | '일급'; note?: string; at?: string};
type E = {id: string; name: string; payType: '시급' | '월급' | '일급'; wage: number; status: string; wageHistory?: H[]};
export type RaiseMode = {kind: 'min'; to: number} | {kind: 'pct'; pct: number} | {kind: 'add'; add: number} | {kind: 'set'; to: number};
const round10 = (n: number) => Math.ceil(n / 10) * 10;
export function newWage(cur: number, m: RaiseMode) { return m.kind === 'min' ? Math.max(cur, m.to) : m.kind === 'pct' ? round10(cur * (1 + m.pct / 100)) : m.kind === 'add' ? cur + m.add : m.to; }
/** 고른 직원의 시급(또는 일급·월급)을 from 날짜부터 바꾼다. 오늘 이전·오늘이면 바로, 미래면 그날 자동 적용 */
export function planRaise<T extends E>(emps: T[], ids: string[], m: RaiseMode, from: string, today: string, note = '', at = '') {
  const changes: {id: string; name: string; prev: number; next: number}[] = [];
  const next = emps.map(e => {
    if (!ids.includes(e.id) || e.status === '퇴사') return e;
    const w = newWage(e.wage, m); if (w === e.wage || w <= 0) return e;
    changes.push({id: e.id, name: e.name, prev: e.wage, next: w});
    const hist = [...(e.wageHistory || []).filter(h => !(h.from === from && h.payType === e.payType)), {from, wage: w, prev: e.wage, payType: e.payType, note, at}].sort((a, b) => a.from < b.from ? -1 : 1).slice(-100);
    return {...e, wage: from <= today ? w : e.wage, wageHistory: hist};
  });
  return {employees: next, changes};
}
/** 예약한 날이 된 인상분을 지금 시급에 반영(매일) */
export function applyDueRaises<T extends E>(emps: T[], today: string) {
  let changed = false;
  const next = emps.map(e => { const due = (e.wageHistory || []).filter(h => h.payType === e.payType && h.from <= today).pop(); if (due && due.wage !== e.wage && !(e.wageHistory || []).some(h => h.payType === e.payType && h.from > due.from && h.from <= today)) { changed = true; return {...e, wage: due.wage}; } return e; });
  return {employees: next, changed};
}
