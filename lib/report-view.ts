// 지시서 6주차: 인건비 리포트 — 6개월 추이, 요일·시간대별 근무 인원, 근무표 대비 실제, 매출 대비 인건비율, 한 줄 요약
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Shift = {employeeId: string; date: string; start: string; end: string; breakMinutes?: number};
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export const monthsBack = (m: string, n: number) => Array.from({length: n}, (_, i) => { const [y, mo] = m.split('-').map(Number), d = new Date(Date.UTC(y, mo - 1 - (n - 1 - i), 1)); return d.toISOString().slice(0, 7); });

/** 요일(월~일) × 시간(0~23) 근무 인원 합계(그달 같은 요일 평균) */
export function weekdayHourGrid(shifts: Shift[], month: string) {
  const grid = Array.from({length: 7}, () => Array(24).fill(0)), days = Array(7).fill(0);
  const [y, mo] = month.split('-').map(Number), last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) days[(new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7]++;
  for (const s of shifts.filter(s => s.date.startsWith(month))) {
    const w = (new Date(s.date + 'T00:00:00Z').getUTCDay() + 6) % 7, a = mins(s.start); let b = mins(s.end); if (b <= a) b += 1440;
    for (let h = 0; h < 24; h++) { const lo = Math.max(a, h * 60), hi = Math.min(b, h * 60 + 60); if (hi > lo) grid[w][h] += (hi - lo) / 60; }
  }
  return grid.map((row, w) => row.map(v => days[w] ? Math.round(v / days[w] * 10) / 10 : 0));
}
/** 직원별 근무표 시간 vs 실제 근무 시간 */
export function planVsActual(shifts: Shift[], actual: Record<string, number>, month: string, names: Record<string, string>) {
  const plan: Record<string, number> = {};
  for (const s of shifts.filter(s => s.date.startsWith(month))) { let m = mins(s.end) - mins(s.start); if (m <= 0) m += 1440; plan[s.employeeId] = (plan[s.employeeId] || 0) + Math.max(0, m - (s.breakMinutes || 0)) / 60; }
  const ids = [...new Set([...Object.keys(plan), ...Object.keys(actual)])].filter(id => names[id]);
  return ids.map(id => { const p = Math.round((plan[id] || 0) * 10) / 10, a = Math.round((actual[id] || 0) * 10) / 10; return {employeeId: id, name: names[id], plan: p, actual: a, diff: Math.round((a - p) * 10) / 10}; }).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}
export const laborRatio = (cost: number, sales?: number) => sales && sales > 0 ? Math.round(cost / sales * 1000) / 10 : null;
/** 이번 달 한 줄 요약(지난달과 비교, 인건비율, 근무표와 차이) */
export function summaryLines(cur: {month: string; cost: number; ratioCost?: number; hours: number; sales?: number}, prev: {cost: number; hours: number} | null, gaps: {name: string; diff: number}[], ongoing: boolean) {
  const out: string[] = [], won = (n: number) => Math.round(n).toLocaleString('ko-KR');
  if (ongoing) out.push(`${Number(cur.month.slice(5))}월은 아직 진행 중이라 지금까지의 기록만 셌어요.`);
  if (prev && prev.cost > 0 && !ongoing) { const p = Math.round((cur.cost - prev.cost) / prev.cost * 100); out.push(p === 0 ? '총 지급액은 지난달과 거의 같아요.' : `총 지급액(공제 전)이 지난달보다 ${Math.abs(p)}% ${p > 0 ? '늘었어요' : '줄었어요'} (${won(prev.cost)}원 → ${won(cur.cost)}원).`); }
  const r = laborRatio(cur.ratioCost ?? cur.cost, cur.sales);
  if (r !== null) out.push(`매출 대비 인건비율은 ${r}%예요.${r > 35 ? ' 음식점 보통 범위(25~35%)보다 높은 편이에요.' : ''}`);
  const big = gaps.filter(g => Math.abs(g.diff) >= 4).slice(0, 3);
  if (big.length) out.push('근무표와 실제 근무가 4시간 넘게 다른 직원: ' + big.map(g => `${g.name}(${g.diff > 0 ? '+' : ''}${g.diff}시간)`).join(', ') + '.');
  if (!out.length) out.push('특별히 확인할 점은 없어요.');
  return out;
}
/** 지시서 072: POS·카드사에서 내려받은 매출 파일(CSV)을 월별 합계로. 날짜 칸과 금액 칸을 알아서 찾는다 */
export function parseSalesCsv(text: string) {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).map(l => { const out: string[] = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if ((ch === ',' || ch === '\t') && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(c => c.trim()); });
  const date = (v: string) => { const m = v.match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}` : null; };
  const money = (v: string) => { const n = Number(v.replace(/[,원\s]/g, '')); return Number.isFinite(n) && /\d/.test(v) ? n : null; };
  const head = rows[0] || [], amountCol = head.findIndex(h => /매출|금액|합계|amount|total/i.test(h)), dateCol = head.findIndex(h => /날짜|일자|date/i.test(h));
  const sums: Record<string, number> = {}; let used = 0;
  for (const r of rows) {
    const di = dateCol >= 0 ? dateCol : r.findIndex(c => date(c)), d = di >= 0 ? date(r[di] || '') : null; if (!d) continue;
    const ai = amountCol >= 0 ? amountCol : r.map((c, i) => i).filter(i => i !== di && money(r[i]) !== null).pop() ?? -1, a = ai >= 0 ? money(r[ai] || '') : null; if (a === null || a < 0) continue;
    sums[d] = (sums[d] || 0) + a; used++;
  }
  return {sums: Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, Math.round(v)])), rows: used};
}
