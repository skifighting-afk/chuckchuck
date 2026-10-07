// 지시서 089: 직원용 비서 "내 급여 왜 이래요?" — 명세서 항목과 지난달을 비교해 쉬운 말로 풀어 준다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Item = {name: string; amount: number; formula?: string};
type Row = {hours?: number; days?: number; gross: number; deduction: number; net: number; earnings?: Item[]; deductions?: Item[]};
const w = (n: number) => Math.round(n).toLocaleString('ko-KR');
export function explainPay(cur: Row, prev?: Row | null, month = '') {
  const out: string[] = [], m = month ? Number(month.slice(5)) + '월 ' : '';
  out.push(`${m}실수령 ${w(cur.net)}원 = 총 지급 ${w(cur.gross)}원 − 공제 ${w(cur.deduction)}원이에요.`);
  const base = (cur.earnings || []).find(x => x.name === '기본급'); if (base?.formula) out.push(`기본급 ${w(base.amount)}원: ${base.formula}`);
  for (const x of (cur.earnings || []).filter(x => x.name !== '기본급')) out.push(`${x.name} ${w(x.amount)}원${x.formula ? `: ${x.formula}` : ''}`);
  const ins = (cur.deductions || []).filter(x => /연금|보험|장기요양/.test(x.name)), tax = (cur.deductions || []).filter(x => /소득세|원천징수/.test(x.name)), other = (cur.deductions || []).filter(x => !ins.includes(x) && !tax.includes(x));
  if (ins.length) out.push(`4대보험 ${w(ins.reduce((s, x) => s + x.amount, 0))}원: ${ins.map(x => `${x.name} ${w(x.amount)}원`).join(', ')} (나라에 내는 보험료로, 사장님도 비슷한 금액을 함께 내요)`);
  if (tax.length) out.push(`세금 ${w(tax.reduce((s, x) => s + x.amount, 0))}원: ${tax.map(x => `${x.name} ${w(x.amount)}원`).join(', ')}`);
  for (const x of other) out.push(`${x.name} ${w(x.amount)}원 빠졌어요${x.formula ? `: ${x.formula}` : ''}`);
  if (prev) {
    const d = cur.net - prev.net;
    if (Math.abs(d) >= 1000) {
      const why: string[] = [];
      const dh = (cur.hours || 0) - (prev.hours || 0); if (Math.abs(dh) >= 0.5) why.push(`일한 시간이 ${dh > 0 ? '+' : ''}${Math.round(dh * 10) / 10}시간`);
      const names = new Set([...(cur.earnings || []), ...(prev.earnings || [])].map(x => x.name));
      for (const n of names) { const a = (cur.earnings || []).filter(x => x.name === n).reduce((s, x) => s + x.amount, 0), b = (prev.earnings || []).filter(x => x.name === n).reduce((s, x) => s + x.amount, 0); if (n !== '기본급' && Math.abs(a - b) >= 1000) why.push(`${n} ${a > b ? '+' : ''}${w(a - b)}원`); }
      const dd = cur.deduction - prev.deduction; if (Math.abs(dd) >= 1000) why.push(`공제 ${dd > 0 ? '+' : ''}${w(dd)}원`);
      out.push(`지난달보다 ${w(Math.abs(d))}원 ${d > 0 ? '많아요' : '적어요'}${why.length ? ` — ${why.join(', ')}` : ''}.`);
    } else out.push('지난달과 거의 같아요.');
  }
  return out;
}
