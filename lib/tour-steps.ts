// 처음 시작 가이드 단계(사장님·직원). target은 화면에서 찾을 곳(앞에서부터 먼저 보이는 것), mobile은 휴대폰 폭에서 대신 찾을 곳.
// page가 있으면 그 화면으로 옮긴 뒤 찾는다. 대상을 못 찾으면 가운데 카드로만 보여 준다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export type TourRole = 'owner' | 'staff';
export type TourStep = {title: string; body: string; tip?: string; emoji?: string; target?: string[]; mobile?: string[]; page?: string; action?: {label: string; page?: string; href?: string}};
export const TOURS: Record<TourRole, TourStep[]> = {
  owner: [
    {emoji: '👋', title: '척척사장에 오신 걸 환영해요', body: '직원 등록부터 근무표, 출퇴근, 급여 정리까지 2분이면 둘러볼 수 있어요. 실제 버튼을 하나씩 짚어 드릴게요.', tip: '언제든 Esc나 건너뛰기로 닫고, 도움말에서 다시 볼 수 있어요.'},
    {emoji: '📋', title: '메뉴는 여기 모여 있어요', body: '홈, 직원 관리, 근무 스케줄, 출퇴근 기록, 급여·명세서, 근로계약서까지 메뉴에서 바로 가요. 휴대폰에서는 이 버튼을 누르면 메뉴가 열려요.', target: ['[data-sidebar="sidebar"]', '.t-sidebar'], mobile: ['button[aria-label="메뉴 열고 닫기"]'], page: '홈'},
    {emoji: '✅', title: '5분 시작하기부터', body: '가게 만들기 → 직원 연결 → 근무표 → 첫 출퇴근 → 첫 급여 확정. 남은 일을 순서대로 알려 주고, "지금 하기"를 누르면 그 화면으로 가요.', target: ['.start-steps', '.home-more2', 'main h1'], page: '홈'},
    {emoji: '🧑‍🍳', title: '직원은 링크 하나로 합류해요', body: '직원 가입 주소를 단톡방에 보내면 직원이 이름·전화번호로 가입하고, 사장님은 수락만 누르면 돼요. 직접 입력해도 돼요.', tip: "'가입 안내 문구 복사'를 쓰면 보낼 글까지 만들어 줘요.", target: ['.home-schedule-link', '#sm2-title'], page: '직원 관리'},
    {emoji: '🗓️', title: '근무표는 끌어서 옮기기', body: '칸을 눌러 근무를 넣고, 지난주 복사·다음 달 복제로 한 번에 채워요. 주 15시간·52시간·휴게 시간이 넘으면 바로 알려 줘요.', tip: '공개를 누르면 직원 폰에 알림이 가고, 누가 확인했는지 보여요.', target: ['.t-schedule', '#sch2-title', 'main h1'], page: '근무 스케줄'},
    {emoji: '📱', title: '출퇴근은 매장 QR로', body: '출퇴근 QR을 만들어 매장에 붙이거나 태블릿에 띄우면, 직원이 찍는 순간 기록돼요. 지각·미출근·퇴근 누락은 자동으로 알려 줘요.', target: ['.att-actions', 'main h1'], page: '출퇴근 기록'},
    {emoji: '💰', title: '급여는 자동 계산', body: '출퇴근 기록으로 주휴수당, 연장·야간 가산, 4대보험, 세금까지 계산해요. 확인하고 확정하면 임금명세서가 직원에게 가요.', tip: '숫자 옆 "계산 근거"를 누르면 어떻게 나온 금액인지 보여요.', target: ['[aria-label="급여 월"]', 'main h1'], page: '급여·명세서'},
    {emoji: '🤖', title: '모르면 척척 비서에게', body: '"오늘 누가 일해?", "이번 달 인건비 얼마야?"처럼 물어보거나 "/근무"처럼 짧게 시켜요. 근무 추가도 말로 할 수 있어요.', target: ['.ast-dock .ast-input', '.ast-fab'], page: '홈'},
    {emoji: '❓', title: '화면마다 도움말', body: '제목 옆 물음표를 누르면 그 화면 도움말이 열려요. 알림 벨에는 지난 알림이 모여 있어요.', target: ['.page-help', 'main h1'], page: '홈'},
    {emoji: '🚀', title: '이제 시작해 볼까요?', body: '첫 직원을 연결하면 근무표·출퇴근·급여가 차례로 열려요. 30일 동안 모든 기능을 무료로 쓸 수 있어요.', action: {label: '첫 직원 연결하기', page: '직원 관리'}},
  ],
  staff: [
    {emoji: '👋', title: '반가워요!', body: '척척사장으로 출퇴근을 찍고, 내 근무표와 급여를 휴대폰에서 바로 확인해요. 30초면 둘러볼 수 있어요.'},
    {emoji: '⏱️', title: '출근·퇴근은 이 버튼', body: '매장에 오면 누르고 매장 QR을 찍어요. 휴게 시작·끝도 여기서 눌러요.', tip: '인터넷이 끊겨도 휴대폰에 저장했다가 연결되면 보내요.', target: ['.clock-big', '.clock-card']},
    {emoji: '📅', title: '오늘 한눈에', body: '다음 근무까지 남은 시간, 급여일, 이번 달 지각·조퇴, 남은 연차가 여기 있어요. 근무표가 바뀌면 바뀐 칸을 알려 줘요.', target: ['.staff-today2', '.staff-stats']},
    {emoji: '🗂️', title: '아래 탭으로 이동', body: '내 근무표, 내 급여(명세서·"내 급여 왜 이래요?"), 휴가·공지, 매뉴얼을 오가요.', target: ['.staff-tabs']},
    {emoji: '🔔', title: '알림을 켜 두세요', body: '근무 1시간 전, 근무표가 바뀔 때, 명세서가 왔을 때 알려 줘요.', target: ['.push-toggle', '.staff-tabs']},
    {emoji: '🎉', title: '준비 끝!', body: '궁금한 건 아래 "자주 묻는 질문"이나 사장님께 1:1 메시지로 물어보세요.'},
  ],
};
