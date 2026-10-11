// 튜토리얼 센터: 모를 때 "튜토리얼"을 누르면 하고 싶은 일을 골라, 그 화면으로 옮겨 누를 곳·입력할 곳을 짚어 준다.
// - from: 시작 퀘스트(lib/quests.ts)의 단계를 그대로 빌려 쓴다. steps: 이 튜토리얼만의 단계. href: 다른 주소로 이동만.
// - 초기 설정(SETUP_STEPS)은 처음 가입한 사장님이 꼭 끝내야 모든 메뉴가 열리는 3단계다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export type TutorialStep = {find: string[]; hint: string; kind: 'click' | 'fill' | 'pick' | 'check'};
export type Tutorial = {id: string; emoji: string; title: string; page?: string; from?: string; steps?: TutorialStep[]; href?: string; keywords?: string};

export const SETUP_STEPS = ['store', 'staff', 'shift'] as const;

export const TUTORIALS: Record<'owner' | 'staff', Tutorial[]> = {
  owner: [
    {id: 'staff', emoji: '🧑‍🍳', title: '직원 등록하기', page: '직원 관리', from: 'staff', keywords: '알바 추가 입사 등록'},
    {id: 'join', emoji: '🔗', title: '직원 가입 링크 보내기', href: '/staff-requests', keywords: '초대 합류 신청 수락 코드'},
    {id: 'shift', emoji: '🗓️', title: '근무 넣기', page: '근무 스케줄', from: 'shift', keywords: '스케줄 근무표 일정 추가'},
    {id: 'copy', emoji: '📋', title: '지난주 근무 그대로 복사', page: '근무 스케줄', keywords: '복제 반복 근무표', steps: [
      {find: ['button@@주간 · 7일'], hint: '주간 보기로 바꿔요', kind: 'click'},
      {find: ['button@@지난주 복사'], hint: '누르면 지난주 근무가 이번 주로 들어와요', kind: 'click'}]},
    {id: 'publish', emoji: '📣', title: '근무표 공개하기', page: '근무 스케줄', from: 'publish', keywords: '알림 직원에게 보내기 확인'},
    {id: 'qr', emoji: '📱', title: '출퇴근 QR 띄우기', page: '출퇴근 기록', from: 'qr', keywords: '큐알 출근 태블릿'},
    {id: 'clock', emoji: '⏱️', title: '출퇴근 직접 기록하기', page: '출퇴근 기록', from: 'clock', keywords: '출근 퇴근 누락 대신'},
    {id: 'approve', emoji: '✅', title: '출퇴근 정정 요청 승인하기', page: '출퇴근 기록', keywords: '수정 요청 반려', steps: [
      {find: ['.t-request button.primary@@승인'], hint: '내용을 보고 승인이나 반려를 눌러요. 요청이 없으면 이 칸이 보이지 않아요', kind: 'click'}]},
    {id: 'excel', emoji: '📥', title: '출퇴근 엑셀로 받기', page: '출퇴근 기록', keywords: '다운로드 근태 파일', steps: [
      {find: ['.att-actions button==엑셀 내려받기'], hint: '기간을 고르고 내려받아요', kind: 'click'}]},
    {id: 'leave', emoji: '🌴', title: '휴가 신청 승인하기', page: '휴가·공지', keywords: '연차 휴무 승인 대타', steps: [
      {find: ['[role=tab]@@휴가'], hint: '휴가 탭을 열고, 승인 대기 중인 신청에서 승인을 눌러요', kind: 'click'}]},
    {id: 'notice', emoji: '📢', title: '공지 올리기', page: '휴가·공지', from: 'notice', keywords: '알림 공지사항 전달'},
    {id: 'pay', emoji: '💰', title: '급여 확정하고 명세서 보내기', page: '급여·명세서', from: 'pay', keywords: '월급 명세서 정산'},
    {id: 'contract', emoji: '✍️', title: '근로계약서 보내기', page: '근로계약서', keywords: '전자 계약 서명', steps: [
      {find: ['a[href="/contracts"]'], hint: '전자계약서 화면에서 직원을 고르고 보내요', kind: 'click'}]},
    {id: 'store', emoji: '🏪', title: '가게 주소·영업시간 바꾸기', page: '설정', from: 'store', keywords: '매장 정보 지점'},
    {id: 'ask', emoji: '🤖', title: '척척 비서에게 물어보기', page: '홈', from: 'ask', keywords: 'AI 질문 도움'},
  ],
  staff: [
    {id: 'in', emoji: '⏱️', title: '출근·퇴근 찍기', page: '내 근무', keywords: 'QR 출근 퇴근 휴게', steps: [
      {find: ['.clock-big', '.clock-card button'], hint: '매장에서 이 버튼을 누르고 매장 QR을 찍어요', kind: 'click'}]},
    {id: 'schedule', emoji: '📅', title: '내 근무표 보기', page: '내 근무', from: 'schedule', keywords: '스케줄 일정'},
    {id: 'ack', emoji: '✅', title: '근무표 "확인했어요" 누르기', page: '내 근무', keywords: '공개 확인', steps: [
      {find: ['.publish-ack button'], hint: '근무 시간을 보고 눌러요. 새로 공개된 근무표가 없으면 이 칸이 보이지 않아요', kind: 'click'}]},
    {id: 'swap', emoji: '🔁', title: '대타·교대 구하기', page: '내 근무', keywords: '바꾸기 못 나가요', steps: [
      {find: ['.staff-next-swap'], hint: '여기를 눌러 동료에게 대타를 부탁해요', kind: 'click'}]},
    {id: 'wish', emoji: '🙋', title: '쉬고 싶은 날 알리기', page: '내 근무', from: 'wish', keywords: '휴무 희망'},
    {id: 'pay', emoji: '💰', title: '내 급여·명세서 보기', page: '내 근무', from: 'pay', keywords: '월급 명세서'},
    {id: 'push', emoji: '🔔', title: '알림 켜기', page: '내 근무', from: 'push', keywords: '푸시 알람'},
  ],
};

/** 검색: 제목·키워드에 들어 있는 글자로 거른다(띄어쓰기 무시) */
export function searchTutorials(list: Tutorial[], q: string) {
  const n = (s: string) => s.replace(/\s+/g, '').toLowerCase(), k = n(q);
  return k ? list.filter(t => n(t.title + (t.keywords || '')).includes(k)) : list;
}

/** 초기 설정이 필요한지: 설정 완료 표시가 없고, 이미 직원·근무가 있는 기존 매장이 아니면 */
export function setupNeeded(s: any, done: Record<string, boolean>) {
  if (s?.settings?.more?.setupDoneAt) return false;
  if (SETUP_STEPS.every(k => done[k])) return false;
  const hasEmp = (s?.employees || []).length > 0, hasShift = (s?.shifts || []).length > 0;
  return !(hasEmp && hasShift);
}
