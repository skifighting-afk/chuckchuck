// 작업 023: 근로소득 간이세액표로 매월 원천징수할 소득세·지방소득세 계산
// 근거: 소득세법 시행령 [별표 2] 근로소득 간이세액표(제189조제1항). 표 자료는 data/income-tax-YYYY.json
// (공식 PDF → .github/workflows/fetch-data.yml로 글자 변환 → 646개 구간을 읽어 연속·단조 증가를 확인해 저장).
// 지방소득세는 소득세의 10%(지방세법 제103조의13). 원천징수 비율은 직원이 80%·100%·120% 중 고를 수 있다(시행령 제194조).
import t2026 from '../data/income-tax-2026.json';

type Table = {year: number; source: string; rows: [number, number, number[]][]; at10000: number[]; above: {over: number; upTo: number | null; add: number; base: number; rate: number; factor: number}[]; children: {one: number; two: number; perExtra: number}};
const TABLES: Record<number, Table> = {2026: t2026 as any};
export const hasTaxTable = (year: number) => !!TABLES[year];
export const taxTableFor = (year: number) => TABLES[year] || TABLES[Math.max(...Object.keys(TABLES).map(Number).filter(y => y <= year))] || TABLES[2026];

const floor10 = (n: number) => Math.floor(n / 10) * 10;
/** 공제대상가족 f명(1~11) 기준 표 세액 */
function tableTax(t: Table, monthly: number, f: number) {
  const k = monthly / 1000, col = Math.min(11, Math.max(1, f)) - 1;
  if (k < t.rows[0][0]) return 0;
  if (k < 10000) { const row = t.rows.find(([lo, hi]) => k >= lo && k < hi); return row ? row[2][col] : 0; }
  const base = t.at10000[col];
  if (k === 10000) return base;
  const band = t.above.find(b => k > b.over && (b.upTo === null || k <= b.upTo))!;
  return Math.floor(base + band.add + (monthly - band.base * 1000) * band.factor * band.rate);
}
/**
 * monthly: 월급여액(비과세·학자금 제외, 원), family: 공제대상가족 수(본인 포함), children: 그중 8세 이상 20세 이하 자녀 수, ratio: 80·100·120(%)
 */
export function incomeTax(monthly: number, year: number, family = 1, children = 0, ratio: 80 | 100 | 120 = 100) {
  const t = taxTableFor(year), f = Math.max(1, Math.floor(family));
  let tax = f <= 11 ? tableTax(t, monthly, f) : Math.max(0, tableTax(t, monthly, 11) - (tableTax(t, monthly, 10) - tableTax(t, monthly, 11)) * (f - 11));
  const c = Math.max(0, Math.floor(children));
  const childCut = c === 0 ? 0 : c === 1 ? t.children.one : c === 2 ? t.children.two : t.children.two + (c - 2) * t.children.perExtra;
  tax = Math.max(0, tax - childCut);
  tax = floor10(tax * ratio / 100);
  const local = floor10(tax * 0.1);
  return {incomeTax: tax, localTax: local, year: t.year, source: t.source, family: f, children: c, ratio};
}
