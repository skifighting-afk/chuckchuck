// 지시서 7주차: 급여 정확도 점검 — 확정 전에 계산을 틀리게 만들 수 있는 기록·설정을 직원별로 모은다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Emp = {id: string; name: string; payType: string; wage: number; weeklyHours: number; income: string; taxMode: string; status: string; insurances?: Record<string, {status: string}>; employment?: string};
type Rec = {employeeId: string; start: string; end: string | null; breakMinutes: number};
type Shift = {employeeId: string; date: string; start: string; end: string; breakMinutes?: number};
export type Finding = {employeeId: string; name: string; level: '확인 필요' | '참고'; text: string; fix: string};
const kd = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);
const hrs = (r: Rec) => r.end ? Math.max(0, (Date.parse(r.end) - Date.parse(r.start)) / 3600000 - (r.breakMinutes || 0) / 60) : 0;
const monday = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7); return x.toISOString().slice(0, 10); };

export function payAudit(emps: Emp[], recs: Rec[], shifts: Shift[], month: string, fivePlus: boolean): Finding[] {
  const out: Finding[] = [];
  for (const e of emps.filter(e => e.status !== '퇴사' || recs.some(r => r.employeeId === e.id && kd(r.start).startsWith(month)))) {
    const mine = recs.filter(r => r.employeeId === e.id && kd(r.start).startsWith(month)), add = (level: Finding['level'], text: string, fix: string) => out.push({employeeId: e.id, name: e.name, level, text, fix});
    if (!e.wage && mine.length) add('확인 필요', '임금이 0원이라 급여가 계산되지 않아요.', '직원 관리에서 시급이나 월급을 입력해 주세요.');
    if (e.income === '미검토' && mine.length) add('확인 필요', '소득 구분이 정해지지 않았어요.', '직원 관리에서 근로소득·사업소득 중 골라 주세요.');
    const long = mine.filter(r => hrs(r) >= 16);
    if (long.length) add('확인 필요', `하루 16시간 넘는 기록이 ${long.length}건 있어요(${long.slice(0, 3).map(r => kd(r.start).slice(5).replace('-', '/')).join(', ')}).`, '퇴근을 늦게 찍은 건 아닌지 출퇴근 기록에서 확인해 주세요.');
    const tiny = mine.filter(r => r.end && hrs(r) < 0.1);
    if (tiny.length) add('참고', `5분도 안 되는 기록이 ${tiny.length}건 있어요.`, '출근을 두 번 찍은 기록이면 정정해 주세요.');
    // 3.3% 사업소득인데 근무표대로 매주 15시간 넘게 일하면 근로자로 볼 가능성이 높다
    if (e.income === '사업소득') {
      const weeks: Record<string, number> = {};
      for (const s of shifts.filter(s => s.employeeId === e.id && s.date.startsWith(month))) { const a = Number(s.start.slice(0, 2)) * 60 + Number(s.start.slice(3)); let b = Number(s.end.slice(0, 2)) * 60 + Number(s.end.slice(3)); if (b <= a) b += 1440; weeks[monday(s.date)] = (weeks[monday(s.date)] || 0) + (b - a - (s.breakMinutes || 0)) / 60; }
      if (Object.values(weeks).filter(h => h >= 15).length >= 2) add('확인 필요', '3.3% 사업소득으로 처리하지만 근무표대로 매주 15시간 넘게 일해요. 근로자로 판단되면 주휴수당·4대보험이 생길 수 있어요.', '일하는 방식(지휘·감독, 정해진 시간)을 보고 근로소득으로 바꿀지 노무사와 확인해 주세요.');
    }
    if (e.taxMode === '4대보험 자동') { const need = Object.entries(e.insurances || {}).filter(([, v]) => v.status === '확인 필요').map(([k]) => k); if (need.length) add('참고', `${need.join('·')} 가입 여부가 '확인 필요'예요.`, '직원 관리에서 가입·적용 제외를 정해 주세요. 정하기 전엔 공제하지 않아요.'); }
    if (fivePlus) {
      const w: Record<string, number> = {};
      for (const r of mine) w[monday(kd(r.start))] = (w[monday(kd(r.start))] || 0) + hrs(r);
      const over = Object.entries(w).filter(([, h]) => h > 52);
      if (over.length) add('확인 필요', `주 52시간을 넘긴 주가 ${over.length}번 있어요(${over.map(([k, h]) => `${k.slice(5).replace('-', '/')}주 ${Math.round(h)}시간`).join(', ')}).`, '근무표를 나눠 주 52시간 안으로 맞춰 주세요. 연장근로 한도 위반이 될 수 있어요.');
    }
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === '확인 필요' ? -1 : 1));
}
