import {normalizeTeam,today,datePlus,calculate,blankInsurance,type Team} from './team-model';
// 작업 090: 체험 화면용 가상 매장. 실제 매장을 읽지도, 저장하지도 않는다.
// 지난달 전체와 이번 달 오늘까지 근무 기록을 만들고, 지난달 급여는 새 자동 계산(주휴·4대보험)으로 확정해 둔다.
// 숫자는 화면에서 다시 계산한 값과 같아야 한다(scripts/check-demo.mjs).

type Plan = {name: string; role: '홀' | '주방' | '매니저'; payType: '시급' | '월급'; wage: number; weekly: number; days: number[]; start: string; end: string; brk: number; part: boolean; duties: string};
const PEOPLE: Plan[] = [
  // days: 0=일 … 6=토
  {name: '김예시', role: '홀', payType: '시급', wage: 10320, weekly: 25, days: [1, 2, 3, 4, 5], start: '09:00', end: '15:00', brk: 60, part: false, duties: '홀 서빙·계산'},
  {name: '박샘플', role: '주방', payType: '시급', wage: 11000, weekly: 35, days: [1, 2, 3, 4, 5], start: '13:00', end: '21:00', brk: 60, part: false, duties: '주방 조리 보조'},
  {name: '이체험', role: '매니저', payType: '월급', wage: 2300000, weekly: 40, days: [1, 2, 3, 4, 5], start: '10:00', end: '19:00', brk: 60, part: false, duties: '매장 관리'},
  {name: '정가상', role: '홀', payType: '시급', wage: 10500, weekly: 12, days: [0, 6], start: '11:00', end: '18:00', brk: 60, part: true, duties: '주말 홀 서빙'},
];
const dow = (d: string) => new Date(d + 'T12:00:00+09:00').getUTCDay();
const iso = (d: string, hm: string) => new Date(`${d}T${hm}:00+09:00`).toISOString();
const monthStart = (d: string) => d.slice(0, 8) + '01';
const prevMonth = (d: string) => { const [y, m] = d.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

export function demoTeam(now = today()): Team {
  const s = normalizeTeam(null); delete s.legacy;
  s.store = {name: '척척이네 식당', branch: '본점'}; s.branches = [{id: 'branch-main', name: '본점', address: ''}];
  const base = s.employees[0];
  const prev = prevMonth(now), from = prev + '-01';
  s.employees = PEOPLE.map((p, i) => {
    const insurances: Record<string, {status: '확인 필요' | '가입' | '적용 제외'; reason: string}> = blankInsurance();
    for (const n of Object.keys(insurances)) insurances[n] = p.part && ['국민연금', '건강보험', '장기요양'].includes(n) ? {status: '적용 제외', reason: '월 60시간 미만 단시간 근로(예시)'} : {status: '가입', reason: ''};
    return {...base, id: `e${i}a1b2c3-demo`, name: p.name, email: `demo${i}@example.invalid`, phone: '010-0000-0000', address: '', joined: datePlus(from, -60 - i * 30), status: '재직' as const,
      role: p.role, employment: p.part ? '단시간' as const : p.payType === '월급' ? '기간의 정함 없음' as const : '단시간' as const, weeklyHours: p.weekly, payType: p.payType, wage: p.wage, payDay: 10,
      income: '근로소득' as const, taxMode: '4대보험 자동' as const, autoPay: true, taxReason: '', insurances, leaveBalance: 5,
      contract: {...base.contract, workplace: '척척이네 식당', employer: '예시 사장님', duties: p.duties, start: p.start, end: p.end, breakMinutes: p.brk, workDays: p.days.map(d => '일월화수목금토'[d]).join(', ')}};
  });
  // 근무 기록: 지난달 1일부터 오늘까지 계획대로. 오늘 근무 중인 사람은 퇴근 전으로 둔다.
  s.attendance = [];
  for (let d = from; d <= now; d = datePlus(d, 1)) {
    PEOPLE.forEach((p, i) => {
      if (!p.days.includes(dow(d))) return;
      const open = d === now && i === PEOPLE.findIndex(x => x.days.includes(dow(now)));
      s.attendance.push({id: `demo-attendance-${i}-${d}`, employeeId: `e${i}a1b2c3-demo`, start: iso(d, p.start), end: open ? null : iso(d, p.end), breakMinutes: p.brk, breakStart: null});
    });
  }
  s.shifts = s.employees.flatMap((e, i) => Array.from({length: 7}, (_, j) => datePlus(now, j)).filter(d => PEOPLE[i].days.includes(dow(d))).map((d, j) => ({id: `demo-shift-${i}-${j}`, employeeId: e.id, date: d, start: PEOPLE[i].start, end: PEOPLE[i].end, breakMinutes: PEOPLE[i].brk})));
  s.requests = []; s.adjustments = {};
  s.settings = {...s.settings, employerName: '예시 사장님', autoPayslip: false, autoContract: false, fivePlus: false};
  // 지난달 급여는 확정해 둔다(화면이 다시 계산한 값과 같아야 한다).
  s.payrollRuns = {};
  const rows = calculate(s, prev).filter(r => r.branchId === 'branch-main');
  s.payrollRuns[prev + ':branch-main'] = {locked: true, month: prev, branch: 'branch-main', payDate: monthStart(now).slice(0, 8) + '10', rows, at: monthStart(now) + 'T00:00:00.000Z', actor: {id: 'demo', name: '예시 사장님', email: ''}, revision: 1};
  return s;
}
