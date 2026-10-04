// 법정수당·4대보험 자동 계산 (시급 직원 기준). +EV 급여 엔진을 척척 데이터 모델에 맞게 옮김.
// 근거: 근로기준법 제55조(주휴)·제56조(연장·야간 가산), 시행령 별표1(상시 4인 이하 사업장은 가산수당 미적용).
// 요율: 2026년 근로자 부담분. 해마다 RATES에 추가한다.
//
// 계산하지 않는 것(화면에 따로 안내): 휴일근로 가산, 근로소득세(간이세액표), 4대보험 기준소득월액 상·하한, 주휴 개근 여부.

export const KST = 9 * 3600000;
const floor10 = (n: number) => Math.floor(n / 10) * 10;
export const won = (n: number) => Math.round(n).toLocaleString('ko-KR');

export const RATES: Record<number, {pension: number; health: number; care: number; employment: number; minimumWage: number}> = {
  // 국민연금 9.5%의 절반, 건강보험 7.19%의 절반, 장기요양 = 건강보험료 × 13.14%(0.9448% ÷ 7.19%), 고용보험(실업급여) 0.9%
  2026: {pension: 0.0475, health: 0.03595, care: 0.1314, employment: 0.009, minimumWage: 10320},
};
/** 그해 요율이 등록돼 있는지(없으면 가장 가까운 이전 해 요율로 계산하고 경고한다) */
export const hasRatesFor = (year: number) => !!RATES[year];
export const ratesFor = (year: number) => RATES[year] || RATES[Math.max(...Object.keys(RATES).map(Number).filter(y => y <= year))] || RATES[2026];

type Record_ = {start: string; end: string | null; breakMinutes: number};

/** 한 출퇴근 기록을 분 단위로 나눔: 실근무, 야간(22~06시, 한국 시간). 휴게는 낮·밤에 비율로 뺀다. */
export function splitRecord(a: Record_) {
  if (!a.end) return {worked: 0, night: 0};
  const start = Math.floor((+new Date(a.start) + KST) / 60000), end = Math.floor((+new Date(a.end) + KST) / 60000);
  const total = Math.max(0, end - start);
  let night = 0;
  for (let t = start; t < end; t++) { const m = ((t % 1440) + 1440) % 1440; if (m >= 1320 || m < 360) night++; }
  const brk = Math.min(total, Math.max(0, a.breakMinutes || 0)), keep = total ? (total - brk) / total : 0;
  return {worked: (total - brk) / 60, night: (night * keep) / 60};
}

/** 한국 시간 날짜(YYYY-MM-DD) */
export const kday = (iso: string) => new Date(+new Date(iso) + KST).toISOString().slice(0, 10);
/** 그 날짜가 속한 주의 월요일 */
export function monday(day: string) { const d = new Date(day + 'T00:00:00Z'), w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); }
const plusDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export type Line = {name: string; amount: number; formula: string};

/**
 * 시급 직원의 한 달 법정수당.
 * - 주휴수당: 월~일 한 주 실근무 15시간 이상이면 min(주 시간, 40) ÷ 40 × 8 × 시급. 그 주의 일요일이 속한 달에 지급.
 * - 연장 가산(5인 이상): 하루 8시간 초과분 + (주 40시간 초과분 − 이미 센 하루 초과분) × 시급 × 50%
 * - 야간 가산(5인 이상): 22~06시 근무 × 시급 × 50%
 * records에는 앞뒤 달 기록이 섞여 있어도 된다(주 경계 계산용).
 */
export function allowances(records: Record_[], month: string, wage: number, fivePlus: boolean) {
  const byDay = new Map<string, {worked: number; night: number}>();
  for (const a of records) { if (!a.end) continue; const d = kday(a.start), s = splitRecord(a), cur = byDay.get(d) || {worked: 0, night: 0}; cur.worked += s.worked; cur.night += s.night; byDay.set(d, cur); }
  const weeks = new Map<string, {hours: number; dailyOt: number}>();
  let night = 0, dailyOt = 0;
  for (const [d, v] of byDay) {
    const w = weeks.get(monday(d)) || {hours: 0, dailyOt: 0}, ot = Math.max(0, v.worked - 8);
    w.hours += v.worked; w.dailyOt += ot; weeks.set(monday(d), w);
    if (d.startsWith(month)) { night += v.night; dailyOt += ot; }
  }
  let juhu = 0, juhuWeeks = 0, weeklyOt = 0;
  const notes: string[] = [];
  for (const [mon, w] of weeks) {
    const sunday = plusDays(mon, 6);
    if (!sunday.startsWith(month)) continue;
    if (w.hours >= 15) { juhu += Math.min(w.hours, 40) / 40 * 8 * wage; juhuWeeks++; }
    weeklyOt += Math.max(0, w.hours - w.dailyOt - 40);
  }
  const lines: Line[] = [];
  if (juhu > 0) lines.push({name: '주휴수당', amount: Math.round(juhu), formula: `주 15시간 이상 ${juhuWeeks}주 · min(주 시간, 40) ÷ 40 × 8시간 × ${won(wage)}원 (개근 여부 확인)`});
  if (fivePlus) {
    const ot = dailyOt + weeklyOt;
    if (ot > 0) lines.push({name: '연장근로 가산', amount: Math.round(ot * wage * 0.5), formula: `${ot.toFixed(2)}시간(하루 8시간·주 40시간 초과) × ${won(wage)}원 × 50%`});
    if (night > 0) lines.push({name: '야간근로 가산', amount: Math.round(night * wage * 0.5), formula: `${night.toFixed(2)}시간(22~06시) × ${won(wage)}원 × 50%`});
  } else if (dailyOt + weeklyOt + night > 0) notes.push('상시 5인 미만으로 설정되어 연장·야간 가산수당을 넣지 않았어요.');
  return {lines, notes, night, overtime: dailyOt + weeklyOt};
}

/** 4대보험 근로자 부담분. status가 '가입'인 보험만 뗀다(10원 미만 버림). */
export function insuranceLines(gross: number, year: number, insurances: Record<string, {status: string}>) {
  const r = ratesFor(year), on = (n: string) => insurances?.[n]?.status === '가입', lines: Line[] = [];
  if (on('국민연금')) lines.push({name: '국민연금', amount: floor10(gross * r.pension), formula: `${won(gross)}원 × ${(r.pension * 100).toFixed(2)}% (기준소득월액 상·하한 별도 확인)`});
  if (on('건강보험')) {
    const h = floor10(gross * r.health);
    lines.push({name: '건강보험', amount: h, formula: `${won(gross)}원 × ${(r.health * 100).toFixed(3)}%`});
    if (on('장기요양')) lines.push({name: '장기요양보험', amount: floor10(h * r.care), formula: `건강보험료 ${won(h)}원 × ${(r.care * 100).toFixed(2)}%`});
  }
  if (on('고용보험')) lines.push({name: '고용보험', amount: floor10(gross * r.employment), formula: `${won(gross)}원 × ${(r.employment * 100).toFixed(1)}%`});
  return lines;
}
