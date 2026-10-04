// 작업 028: 상시 근로자 수(근로기준법 시행령 제7조의2)
// 산정기간(법 적용 사유 발생일 전 1개월) 동안 사용한 근로자의 연인원 ÷ 그 기간 가동일수.
// 결과가 5명 이상이어도 5명 미만인 날이 가동일의 1/2 이상이면 5명 미만으로, 반대로 5명 미만이어도 5명 이상인 날이 1/2 미만이 아니면(=1/2 이상) 5명 이상으로 본다.
// 여기서는 출퇴근 기록이 있는 날을 가동일, 그날 출근한 서로 다른 직원 수를 그날 인원으로 센다(무급 휴일·휴무 직원 반영은 사장님 확인).
const kdate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);
export function headcount(attendance: {employeeId: string; start: string}[], from: string, to: string) {
  const byDay = new Map<string, Set<string>>();
  for (const a of attendance) { const d = kdate(a.start); if (d < from || d >= to) continue; (byDay.get(d) || byDay.set(d, new Set()).get(d)!).add(a.employeeId); }
  const days = [...byDay.values()].map(s => s.size), operating = days.length, total = days.reduce((n, x) => n + x, 0);
  const average = operating ? total / operating : 0, under = days.filter(x => x < 5).length, over = operating - under;
  const fivePlus = operating > 0 && (average >= 5 ? under * 2 < operating : over * 2 >= operating);
  return {average: Math.round(average * 10) / 10, operating, daysUnder5: under, daysAtLeast5: over, total, fivePlus};
}
/** 오늘 기준 직전 1개월(같은 날짜 전달 ~ 어제) */
export function lastMonthWindow(today: string) {
  const d = new Date(today + 'T00:00:00Z'); const from = new Date(d); from.setUTCMonth(from.getUTCMonth() - 1);
  return {from: from.toISOString().slice(0, 10), to: today};
}
