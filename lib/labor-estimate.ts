// 작업 032: 주휴수당·인건비 계산기(로그인 없이). 급여 엔진과 같은 요율표(RATES)를 쓴다.
// 근거: 근로기준법 제55조(주휴: 1주 소정근로시간 ÷ 40 × 8 × 시급, 주 15시간 이상·개근), 제56조(연장·야간 50% 가산, 상시 5명 이상),
// 4대보험 요율은 lib/pay-rules.ts RATES(2026). 사업주 고용보험 고용안정·직업능력개발 0.25%(150명 미만), 산재보험은 업종별이라 입력받는다.
// 월 환산은 1년 52.14주 ÷ 12 = 4.345주.
import {ratesFor} from './pay-rules';

export type EstimateInput = {wage: number; dailyHours: number; days: number; nightHours?: number; fivePlus?: boolean; deduction?: 'none' | '3.3' | 'insurance'; industrialRate?: number; year?: number; people?: number};
export const WEEKS_PER_MONTH = 4.345;
export const EMPLOYER_STABILITY = 0.0025; // 고용안정·직업능력개발(150명 미만)
const floor10 = (n: number) => Math.floor(n / 10) * 10;
const r0 = (n: number) => Math.round(n);

export function estimateLabor(i: EstimateInput) {
  const year = i.year || new Date().getFullYear(), rates = ratesFor(year);
  const wage = Math.max(0, i.wage || 0), daily = Math.max(0, Math.min(24, i.dailyHours || 0)), days = Math.max(0, Math.min(7, Math.floor(i.days || 0)));
  const weekly = daily * days, people = Math.max(1, Math.floor(i.people || 1));
  const base = weekly * wage;
  const juhuHours = weekly >= 15 ? Math.min(weekly, 40) / 40 * 8 : 0;
  const juhu = juhuHours * wage;
  const night = i.fivePlus ? Math.max(0, i.nightHours || 0) * wage * 0.5 : 0;
  // 연장: 하루 8시간 초과분 + 하루 8시간 이내 합계가 주 40시간을 넘는 분 (5명 이상만 가산)
  const overtimeHours = Math.max(0, daily - 8) * days + Math.max(0, Math.min(daily, 8) * days - 40);
  const overtime = i.fivePlus ? overtimeHours * wage * 0.5 : 0;
  const weekTotal = base + juhu + night + overtime;
  const month = weekTotal * WEEKS_PER_MONTH, monthHours = weekly * WEEKS_PER_MONTH;
  const insuranceOn = i.deduction === 'insurance';
  // 월 60시간 미만이면 국민연금·건강보험은 보통 적용 제외(고용·산재는 적용). 계산기는 안내만 하고 그대로 반영한다.
  const pensionHealth = insuranceOn && monthHours >= 60;
  const g = r0(month);
  const emp = {pension: pensionHealth ? floor10(g * rates.pension) : 0, health: pensionHealth ? floor10(g * rates.health) : 0, care: 0, employment: insuranceOn ? floor10(g * rates.employment) : 0, tax33: i.deduction === '3.3' ? floor10(g * 0.03) + floor10(g * 0.003) : 0};
  emp.care = pensionHealth ? floor10(emp.health * rates.care) : 0;
  const employeeDeduction = emp.pension + emp.health + emp.care + emp.employment + emp.tax33;
  const ind = Math.max(0, Math.min(0.2, i.industrialRate || 0));
  const er = {pension: emp.pension, health: emp.health, care: emp.care, employment: insuranceOn ? floor10(g * (rates.employment + EMPLOYER_STABILITY)) : 0, industrial: insuranceOn ? floor10(g * ind) : 0};
  const employerInsurance = er.pension + er.health + er.care + er.employment + er.industrial;
  return {
    year, minimumWage: rates.minimumWage, belowMinimum: wage > 0 && wage < rates.minimumWage,
    weeklyHours: weekly, juhuEligible: weekly >= 15, juhuHours,
    week: {base: r0(base), juhu: r0(juhu), night: r0(night), overtime: r0(overtime), total: r0(weekTotal)},
    month: {gross: g, hours: Math.round(monthHours * 10) / 10, employeeDeduction, net: g - employeeDeduction, employerInsurance, laborCost: g + employerInsurance},
    deductions: emp, employer: er, pensionHealthExcluded: insuranceOn && monthHours < 60,
    people, total: {gross: g * people, laborCost: (g + employerInsurance) * people},
  };
}
