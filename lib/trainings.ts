// 지시서 129: 법정 의무교육 체크 — 해마다 해야 하는 교육과 올해 이수 기록. 기준은 바뀔 수 있어 '확인' 문구를 함께 둔다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export const TRAININGS = [
  {kind: '직장 내 성희롱 예방교육', when: '해마다 1번 이상', who: '모든 사업장', note: '10명 미만은 교육 자료를 나눠 주고 게시하는 방법도 돼요(남녀고용평등법 시행령 제3조).', need: () => true},
  {kind: '장애인 인식개선 교육', when: '해마다 1번 이상', who: '모든 사업장', note: '50명 미만은 고용노동부 교육 자료 배포로 할 수 있어요.', need: () => true},
  {kind: '산업안전보건교육', when: '분기마다(업무별 시간 다름)', who: '상시 5명 이상', note: '판매·서비스직은 분기 3시간 이상 등. 업종·인원에 따라 달라요.', need: (n: number) => n >= 5},
  {kind: '개인정보보호 교육', when: '해마다(권장)', who: '직원 개인정보를 다루는 사람', note: '직원 연락처·급여를 다루는 매니저가 있으면 해 두세요.', need: () => true},
  {kind: '퇴직연금 교육', when: '해마다 1번 이상', who: '퇴직연금에 가입한 사업장', note: '퇴직연금 사업자가 대신 해 주기도 해요.', need: (_n: number, pension?: boolean) => !!pension},
] as const;
export type TrainingRec = {id: string; kind: string; date: string; attendees: string[]; note?: string};
export function trainingStatus(recs: TrainingRec[], year: number, staffCount: number, staffIds: string[], pension = false) {
  return TRAININGS.filter(t => t.need(staffCount, pension)).map(t => {
    const mine = recs.filter(r => r.kind === t.kind && r.date.startsWith(String(year))).sort((a, b) => b.date.localeCompare(a.date));
    const covered = new Set(mine.flatMap(r => r.attendees)), missing = staffIds.filter(id => !covered.has(id));
    return {...t, need: undefined, done: mine.length > 0, last: mine[0]?.date || null, missing};
  });
}
