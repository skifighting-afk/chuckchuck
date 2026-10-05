// 법정수당·4대보험 자동 계산 (시급 직원 기준). +EV 급여 엔진을 척척 데이터 모델에 맞게 옮김.
// 근거: 근로기준법 제55조(주휴)·제56조(연장·야간 가산), 시행령 별표1(상시 4인 이하 사업장은 가산수당 미적용).
// 요율: 2026년 근로자 부담분. 해마다 RATES에 추가한다.
//
// 계산하지 않는 것(화면에 따로 안내): 휴일근로 가산, 근로소득세(간이세액표), 4대보험 기준소득월액 상·하한, 주휴 개근 여부.

export const KST = 9 * 3600000;
const floor10 = (n: number) => Math.floor(n / 10) * 10;
export const won = (n: number) => Math.round(n).toLocaleString('ko-KR');

export type Rates = {pension: number; health: number; care: number; employment: number; minimumWage: number; pending?: ('pension' | 'health' | 'care' | 'employment' | 'minimumWage')[]};
export const RATE_NAMES = {pension: '국민연금', health: '건강보험', care: '장기요양보험', employment: '고용보험', minimumWage: '최저임금'} as const;
export const RATES: Record<number, Rates> = {
  // 국민연금 9.5%의 절반, 건강보험 7.19%의 절반, 장기요양 = 건강보험료 × 13.14%(0.9448% ÷ 7.19%), 고용보험(실업급여) 0.9%
  2026: {pension: 0.0475, health: 0.03595, care: 0.9448 / 7.19, employment: 0.009, minimumWage: 10320},
  // 2027 (2026-10-05 확인): 최저임금 10,700원(2026-07-14 최저임금위원회 의결), 국민연금 10%의 절반(2025년 개정 국민연금법, 매년 0.5%p 인상),
  // 건강보험 7.19% 동결(2026-09-08 건강보험정책심의위원회). 장기요양보험료율은 10월 이후 결정 예정이라 2026년 비율로 두고 pending에 적는다.
  2027: {pension: 0.05, health: 0.03595, care: 0.9448 / 7.19, employment: 0.009, minimumWage: 10700, pending: ['care']},
};
/** 그해 아직 발표되지 않아 이전 해 값으로 둔 항목 */
export const pendingRates = (year: number) => (RATES[year]?.pending || []).map(k => RATE_NAMES[k]);
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

/** 주 묶음 키(그 주 첫날) */
export const weekKeyOf = (d: string, weekStart: 'mon' | 'sun' = 'mon') => weekStart === 'sun' ? plusDays(monday(plusDays(d, 1)), -1) : monday(d);

export type Line = {name: string; amount: number; formula: string};

/**
 * 시급 직원의 한 달 법정수당.
 * - 주휴수당: 한 주(월~일, 설정에 따라 일~토) 실근무 15시간 이상이면 min(주 시간, 40) ÷ 40 × 8 × 시급. 그 주의 일요일이 속한 달에 지급.
 * - 연장 가산(5인 이상): 하루 8시간 초과분 + (주 40시간 초과분 − 이미 센 하루 초과분) × 시급 × 50%
 * - 야간 가산(5인 이상): 22~06시 근무 × 시급 × 50%
 * records에는 앞뒤 달 기록이 섞여 있어도 된다(주 경계 계산용).
 */
// 단시간 근로자(partTimeWeekly: 주 소정근로시간 40시간 미만)는 5명 이상 사업장에서 소정근로시간을 넘긴 근로에도 50% 가산(기간제법 제6조).
// 여기서는 주 단위로 '주 소정근로시간 초과분'을 센다(하루 8시간 초과분과 겹쳐 세지 않음).
export function allowances(records: Record_[], month: string, wage: number, fivePlus: boolean, weekStart: 'mon' | 'sun' = 'mon', holidays: Map<string, string> = new Map(), skipJuhu: Set<string> = new Set(), partTimeWeekly?: number) {
  const weeklyLimit = partTimeWeekly && partTimeWeekly > 0 && partTimeWeekly < 40 ? partTimeWeekly : 40;
  // 주 시작요일: 월요일(기본) 또는 일요일. 주휴는 그 주의 마지막 날이 속한 달에 지급.
  const weekOf = (d: string) => weekStart === 'sun' ? plusDays(monday(plusDays(d, 1)), -1) : monday(d);
  const byDay = new Map<string, {worked: number; night: number}>();
  for (const a of records) { if (!a.end) continue; const d = kday(a.start), s = splitRecord(a), cur = byDay.get(d) || {worked: 0, night: 0}; cur.worked += s.worked; cur.night += s.night; byDay.set(d, cur); }
  const weeks = new Map<string, {hours: number; dailyOt: number}>();
  let night = 0, dailyOt = 0, hol8 = 0, holOver = 0;
  const holNames = new Set<string>();
  for (const [d, v] of byDay) {
    const w = weeks.get(weekOf(d)) || {hours: 0, dailyOt: 0, holiday: 0};
    // 휴일근로(작업 025): 8시간 이내 50%, 초과 100% 가산. 같은 시간을 연장 가산과 겹쳐 세지 않도록 주 시간 계산에서는 뺀다(주휴 판단에는 넣음).
    if (holidays.has(d)) { (w as any).holiday = ((w as any).holiday || 0) + v.worked; w.hours += v.worked; weeks.set(weekOf(d), w); if (d.startsWith(month)) { night += v.night; hol8 += Math.min(8, v.worked); holOver += Math.max(0, v.worked - 8); holNames.add(holidays.get(d)!); } continue; }
    const ot = Math.max(0, v.worked - 8);
    w.hours += v.worked; w.dailyOt += ot; weeks.set(weekOf(d), w);
    if (d.startsWith(month)) { night += v.night; dailyOt += ot; }
  }
  let juhu = 0, juhuWeeks = 0, weeklyOt = 0;
  const notes: string[] = [];
  for (const [first, w] of weeks) {
    const last = plusDays(first, 6);
    if (!last.startsWith(month)) continue;
    if (w.hours >= 15 && skipJuhu.has(first)) notes.push(`${first} 주는 근무표의 근무일에 결근이 있어 주휴수당을 넣지 않았어요(개근 아님). 사장님이 인정하면 수당·공제에서 '개근 인정'을 눌러 주세요.`);
    // 주휴는 소정근로시간 기준(근로기준법 시행령 제30조): 계약 시간을 넘겨 일한 시간은 주휴 계산에 넣지 않는다.
    else if (w.hours >= 15) { juhu += Math.min(w.hours, weeklyLimit) / 40 * 8 * wage; juhuWeeks++; }
    weeklyOt += Math.max(0, w.hours - ((w as any).holiday || 0) - w.dailyOt - weeklyLimit);
  }
  const lines: Line[] = [];
  if (juhu > 0) lines.push({name: '주휴수당', amount: Math.round(juhu), formula: `주 15시간 이상 ${juhuWeeks}주 · min(주 시간, ${weeklyLimit < 40 ? '주 소정 ' + weeklyLimit : 40}) ÷ 40 × 8시간 × ${won(wage)}원 (개근 여부 확인)`});
  if (fivePlus) {
    const ot = dailyOt + weeklyOt;
    if (ot > 0) lines.push({name: '연장근로 가산', amount: Math.round(ot * wage * 0.5), formula: `${ot.toFixed(2)}시간(하루 8시간·주 ${weeklyLimit}시간${weeklyLimit < 40 ? '(단시간 근로자 주 소정근로시간)' : ''} 초과) × ${won(wage)}원 × 50%`});
    const holPay = hol8 * wage * 0.5 + holOver * wage;
    if (holPay > 0) lines.push({name: '휴일근로 가산', amount: Math.round(holPay), formula: `${hol8.toFixed(2)}시간 × ${won(wage)}원 × 50%${holOver ? ` + 8시간 초과 ${holOver.toFixed(2)}시간 × ${won(wage)}원 × 100%` : ''} (${[...holNames].join('·')})`});
    if (night > 0) lines.push({name: '야간근로 가산', amount: Math.round(night * wage * 0.5), formula: `${night.toFixed(2)}시간(22~06시) × ${won(wage)}원 × 50%`});
  } else if (dailyOt + weeklyOt + night + hol8 + holOver > 0) notes.push('상시 5인 미만으로 설정되어 연장·야간·휴일 가산수당을 넣지 않았어요.');
  return {lines, notes, night, overtime: dailyOt + weeklyOt};
}

// 작업 024: 국민연금 기준소득월액 상·하한(매년 7월 변경, 보건복지부 고시). 기준소득월액은 1천원 미만 버림.
export const PENSION_LIMITS: {from: string; min: number; max: number}[] = [
  {from: '2025-07', min: 400000, max: 6370000},
  {from: '2026-07', min: 410000, max: 6590000},
];
// 건강보험 직장가입자 보수월액보험료 본인 부담 상한(월). 하한은 월 60시간 미만이 대부분 적용 제외라 따로 두지 않는다.
export const HEALTH_MAX_EMPLOYEE: Record<number, number> = {2026: 4591740};
export const pensionLimitFor = (month: string) => [...PENSION_LIMITS].reverse().find(l => month >= l.from) || PENSION_LIMITS[0];

/** 4대보험 근로자 부담분. status가 '가입'인 보험만 뗀다(10원 미만 버림). month(YYYY-MM)가 있으면 국민연금 상·하한을 적용한다. */
export function insuranceLines(gross: number, year: number, insurances: Record<string, {status: string}>, month?: string) {
  const r = ratesFor(year), on = (n: string) => insurances?.[n]?.status === '가입', lines: Line[] = [];
  if (on('국민연금')) {
    const lim = month ? pensionLimitFor(month) : null, base = lim ? Math.min(lim.max, Math.max(lim.min, Math.floor(gross / 1000) * 1000)) : gross;
    const note = !lim ? '' : base !== Math.floor(gross / 1000) * 1000 ? ` · 기준소득월액 ${base === lim.min ? '하한' : '상한'} ${won(base)}원 적용` : ' · 기준소득월액(천원 미만 버림)';
    lines.push({name: '국민연금', amount: floor10(base * r.pension), formula: `${won(base)}원 × ${(r.pension * 100).toFixed(2)}%${note}`});
  }
  if (on('건강보험')) {
    const cap = HEALTH_MAX_EMPLOYEE[year], h = Math.min(floor10(gross * r.health), cap ?? Infinity);
    lines.push({name: '건강보험', amount: h, formula: `${won(gross)}원 × ${(r.health * 100).toFixed(3)}%`});
    if (on('장기요양')) lines.push({name: '장기요양보험', amount: floor10(h * r.care), formula: `건강보험료 ${won(h)}원 × ${(r.care * 100).toFixed(2)}%`});
  }
  if (on('고용보험')) lines.push({name: '고용보험', amount: floor10(gross * r.employment), formula: `${won(gross)}원 × ${(r.employment * 100).toFixed(1)}%`});
  return lines;
}
