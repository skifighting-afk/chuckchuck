// 지시서 5주차 042: 입사 체크리스트 — 계약 → 서류 → 교육 → QR 출근 테스트(첫 출근 기록)
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type E = {id: string; status: string; joined: string; contract: {status: string}; onboarding?: {docs?: string; training?: string}};
export type Step = {key: 'contract' | 'docs' | 'training' | 'qr'; label: string; done: boolean; auto: boolean};
export function onboardingSteps(e: E, hasAttendance: boolean): Step[] {
  return [
    {key: 'contract', label: '근로계약서 체결', done: e.contract.status === '체결 완료', auto: true},
    {key: 'docs', label: '서류 받기(보건증·통장 사본)', done: !!e.onboarding?.docs, auto: false},
    {key: 'training', label: '매뉴얼·위생 교육', done: !!e.onboarding?.training, auto: false},
    {key: 'qr', label: 'QR 출근 테스트(첫 출근)', done: hasAttendance, auto: true},
  ];
}
/** 체크리스트를 보여 줄 직원: 입사 준비이거나 입사 30일 안이고 아직 다 안 끝남 */
export function showOnboarding(e: E, hasAttendance: boolean, today: string) {
  if (e.status === '퇴사') return false;
  const recent = e.status === '입사 준비' || Date.parse(today) - Date.parse(e.joined) <= 30 * 86400000;
  return recent && onboardingSteps(e, hasAttendance).some(s => !s.done);
}
