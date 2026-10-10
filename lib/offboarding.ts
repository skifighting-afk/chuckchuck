// 가이드 78: 퇴사 정리 목록. 근거: 근로기준법 제36조(금품청산 14일), 제39조(사용증명서), 퇴직급여법 제4·9조(1년·주15시간, 14일 지급),
// 건강보험 자격상실 14일 이내, 국민연금·고용보험 상실신고 다음 달 15일까지(4대사회보험 정보연계센터 안내).
type E = {name: string; joined: string; endDate?: string; weeklyHours: number; insurances: Record<string, {status: string}>};
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const nextMonth15 = (d: string) => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return m === 12 ? `${y + 1}-01-15` : `${y}-${String(m + 1).padStart(2, '0')}-15`; };
export function offboardingChecklist(e: E, lastDay: string) {
  // 퇴직일 = 마지막 근무 다음 날
  const retire = addDays(lastDay, 1), oneYear = addDays(e.joined, 365) <= retire, severance = oneYear && e.weeklyHours >= 15;
  const on = (n: string) => e.insurances?.[n]?.status === '가입';
  const items: {title: string; due?: string; note: string}[] = [
    {title: '마지막 달 급여 확정·명세서 보내기', due: addDays(retire, 14), note: '퇴직일부터 14일 안에 임금·퇴직금 등 모든 돈을 지급해야 해요(근로기준법 제36조). 늦추려면 직원과 합의해 기록을 남기세요.'},
    {title: '남은 연차 수당 정산', due: addDays(retire, 14), note: '5명 이상 사업장이면 쓰지 못한 연차를 수당으로 줘요. 급여 화면의 연차 잔여일을 확인하세요.'},
    severance
      ? {title: '퇴직금 지급', due: addDays(retire, 14), note: '1년 이상, 4주 평균 주 15시간 이상 일해 퇴직금 대상이에요. 퇴직금 확인 화면에서 금액을 계산하세요(퇴직연금 가입 사업장은 연금으로).'}
      : {title: '퇴직금 대상 확인', note: oneYear ? '1년 이상 일했지만 주 소정근로시간이 15시간 미만이라 대상이 아닐 수 있어요. 4주 평균을 확인하세요.' : '1년 미만이라 퇴직금 대상이 아니에요.'},
    ...(on('건강보험') ? [{title: '건강보험 자격상실 신고', due: addDays(retire, 14), note: '퇴직일부터 14일 안에 신고해요(4대사회보험 정보연계센터 또는 EDI).'}] : []),
    ...(on('국민연금') ? [{title: '국민연금 자격상실 신고', due: nextMonth15(retire), note: '퇴직한 달의 다음 달 15일까지 신고해요.'}] : []),
    ...(on('고용보험') ? [{title: '고용보험 상실신고·이직확인서', due: nextMonth15(retire), note: '다음 달 15일까지. 직원이 실업급여를 신청하면 이직확인서를 내야 해요. 상실 사유를 사실대로 적으세요.'}] : []),
    {title: '경력증명서(사용증명서)', note: '직원이 달라고 하면 바로 줘야 해요(근로기준법 제39조). 직원 카드의 경력증명서 버튼으로 만들 수 있어요.'},
    {title: '서류 보관', note: '근로계약서·임금대장·임금 결정 서류는 퇴직 후 3년 보관해요(제42조). 가게 데이터 전체 내려받기로 보관해 두세요.'},
    {title: '앱 연결 정리', note: '직원 상태를 퇴사로 두면 출퇴근·근무표에서 빠지고, 직원은 본인 서류만 계속 볼 수 있어요.'},
    {title: '지급품·출입키 반납 확인', note: '사람·교육의 지급·반납에서 직원별 미반납 수량과 분실 기록을 확인하세요. 반납 기록은 급여를 차감하지 않아요.'},
  ];
  return {retire, severance, items};
}
export function offboardingText(e: E, lastDay: string) {
  const {retire, items} = offboardingChecklist(e, lastDay);
  return [`${e.name} 퇴사 정리 (마지막 근무일 ${lastDay} · 퇴직일 ${retire})`, '', ...items.map((x, i) => `${i + 1}. ${x.title}${x.due ? ` — ${x.due}까지` : ''}\n   ${x.note}`), '', '법령 기준 안내예요. 실제 신고 기한과 금액은 관할 기관·노무사와 확인하세요.'].join('\n');
}
