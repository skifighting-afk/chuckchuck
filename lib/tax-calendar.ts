// 지시서 7주차 115 신고 기한 달력 · 116 4대보험 취득·상실 신고 기한 · 120 지원금(두루누리) 대상 안내
// 기한이 주말·공휴일이면 다음 영업일(공휴일 목록은 부르는 쪽이 넘겨 준다). 법·제도는 바뀔 수 있으니 화면에서 '확인' 링크를 함께 둔다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Emp = {id: string; name: string; joined: string; status: string; endDate?: string; income?: string; employment?: string; insurances?: Record<string, {status: string}>};
export type Deadline = {date: string; title: string; detail: string; kind: '세금' | '4대보험' | '신고'; employeeId?: string};
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function nextBusinessDay(d: string, holidays: Set<string> = new Set()) { let x = d; for (let i = 0; i < 10; i++) { const w = new Date(x + 'T00:00:00Z').getUTCDay(); if (w !== 0 && w !== 6 && !holidays.has(x)) return x; x = plus(x, 1); } return x; }
const lastDay = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
const prevMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };

/** 그 달에 할 신고·납부(전달 급여 기준) */
export function deadlinesFor(month: string, emps: Emp[], holidays: Set<string> = new Set()): Deadline[] {
  const prev = prevMonth(month), pm = Number(prev.slice(5)), out: Deadline[] = [], d = (x: string) => nextBusinessDay(x, holidays);
  const active = emps.filter(e => e.status !== '퇴사' || (e.endDate || '') >= prev + '-01');
  if (active.some(e => e.income === '근로소득' || e.income === '사업소득')) out.push({date: d(month + '-10'), title: '원천세 신고·납부', detail: `${pm}월에 준 급여의 원천징수 세금(홈택스). 반기별 납부 승인을 받았으면 1월·7월에만 해요.`, kind: '세금'});
  if (active.some(e => Object.values(e.insurances || {}).some(i => i.status === '가입'))) out.push({date: d(month + '-10'), title: '4대보험료 납부', detail: '국민연금·건강보험·고용보험 고지서 금액을 내요(자동이체면 확인만).', kind: '4대보험'});
  if (active.some(e => e.employment === '일용')) out.push({date: d(lastDay(month)), title: '일용근로소득 지급명세서', detail: `${pm}월에 일용직에게 준 급여를 홈택스에 내요.`, kind: '신고'});
  if (active.some(e => e.income === '사업소득')) out.push({date: d(lastDay(month)), title: '사업소득 간이지급명세서', detail: `${pm}월에 3.3%로 지급한 금액을 홈택스에 내요.`, kind: '신고'});
  if (month.endsWith('-01') || month.endsWith('-07')) out.push({date: d(lastDay(month)), title: '근로소득 간이지급명세서(반기)', detail: '지난 6개월 근로소득을 홈택스에 내요.', kind: '신고'});
  if (month.endsWith('-03')) { out.push({date: d(month + '-10'), title: '근로소득 지급명세서·연말정산', detail: '지난해 연말정산 결과와 지급명세서를 내요.', kind: '세금'}); out.push({date: d(month + '-15'), title: '고용·산재보험 보수총액 신고', detail: '지난해 보수 총액을 근로복지공단에 신고해요.', kind: '4대보험'}); }
  // 116: 입사·퇴사 다음 달 15일까지 4대보험 취득·상실 신고
  for (const e of emps) {
    if (e.joined && e.joined.startsWith(prev) && Object.values(e.insurances || {}).some(i => i.status !== '적용 제외')) out.push({date: d(month + '-15'), title: `${e.name} 4대보험 취득 신고`, detail: `${e.joined} 입사 · 4대 사회보험 정보연계센터(EDI)나 공단에 신고해요.`, kind: '4대보험', employeeId: e.id});
    if (e.status === '퇴사' && e.endDate && e.endDate.startsWith(prev)) out.push({date: d(month + '-15'), title: `${e.name} 4대보험 상실 신고`, detail: `${e.endDate} 퇴사 · 상실 신고와 함께 고용보험 이직확인서가 필요할 수 있어요.`, kind: '4대보험', employeeId: e.id});
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
/** 오늘부터 n일 안의 기한(이번 달·다음 달) */
export function upcomingDeadlines(today: string, emps: Emp[], days = 14, holidays: Set<string> = new Set()) {
  const m = today.slice(0, 7);
  return [...deadlinesFor(m, emps, holidays), ...deadlinesFor(nextMonth(m), emps, holidays)].filter(x => x.date >= today && x.date <= plus(today, days));
}
/** 120 두루누리 사회보험료 지원: 근로자 10명 미만 사업장, 월평균보수 기준 미만, 4대보험 새로 가입한 근로자(재산·소득 요건은 공단 확인) */
export const DURUNURI_LIMIT = 2700000;
export function durunuriCandidates(emps: Emp[], grossById: Record<string, number>) {
  const active = emps.filter(e => e.status !== '퇴사');
  if (active.length >= 10) return {eligibleStore: false, list: [] as Emp[]};
  return {eligibleStore: true, list: active.filter(e => e.income === '근로소득' && (grossById[e.id] || 0) > 0 && grossById[e.id] < DURUNURI_LIMIT && ['고용보험', '국민연금'].some(k => e.insurances?.[k]?.status === '가입'))};
}
