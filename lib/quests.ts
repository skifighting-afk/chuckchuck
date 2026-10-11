// 시작 퀘스트: 실제로 해 봐야 깨지는 미션. 화면에서 "여기에 입력" 하고 칸을 하나씩 짚어 준다.
// - 완료는 가게 기록(state)으로 판정하고, 기록에 안 남는 것(QR 띄우기·공지·비서 질문·탭 보기)은 화면에서 확인한 표시(ping)로 판정한다.
// - find 문법: 'css' | 'css@@글자'(글자를 포함) | 'css==글자'(글자가 정확히 같음) | 'field:라벨'(라벨로 시작하는 입력 칸)
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export type QuestRole = 'owner' | 'staff';
export type QuestStepKind = 'click' | 'fill' | 'pick' | 'check';
export type QuestStep = {find: string[]; hint: string; kind: QuestStepKind};
export type Quest = {
  id: string; chapter: number; emoji: string; title: string; why: string; xp: number;
  badge: {emoji: string; name: string};
  page?: string;            // 시작할 때 옮길 화면(사장님: 메뉴 이름, 직원: 탭 이름)
  steps: QuestStep[];
  doneSel?: string[];       // 화면에 이것이 보이면 완료(기록에 안 남는 퀘스트)
  doneOnLastClick?: boolean;// 마지막 단계를 누르면 완료(보기만 하는 퀘스트)
  noDemo?: boolean;         // 체험 화면에서는 할 수 없는 퀘스트
  needs?: string;           // 이 화면 요소가 없으면(기기·설정상 못 하면) 퀘스트를 숨긴다
  minutes: number;
};

export const CHAPTERS: Record<QuestRole, string[]> = {
  owner: ['가게 문 열기', '근무표 짜기', '출퇴근 받기', '가게 소통', '첫 월급날'],
  staff: ['합류 준비', '첫 출근'],
};

export const QUESTS: Record<QuestRole, Quest[]> = {
  owner: [
    {id: 'store', chapter: 0, emoji: '🏪', title: '가게 간판 달기', why: '주소와 영업시간은 근로계약서·명세서·근무표에 그대로 쓰여요.', xp: 100, minutes: 1,
      badge: {emoji: '🪧', name: '간판 장인'}, page: '설정', steps: [
        {find: ['field:주소'], hint: '가게 주소를 여기에 적어 주세요', kind: 'fill'},
        {find: ['.branch-hours fieldset input[type=checkbox]'], hint: '영업시간을 정해 두면 근무표가 그 시간에 맞춰져요. 체크!', kind: 'check'},
        {find: ['button.primary==설정 저장'], hint: '다 적었으면 저장을 눌러요', kind: 'click'},
      ]},
    {id: 'staff', chapter: 0, emoji: '🧑‍🍳', title: '첫 직원 채용', why: '직원이 있어야 근무표·출퇴근·급여가 열려요.', xp: 150, minutes: 2,
      badge: {emoji: '🤝', name: '첫 동료'}, page: '직원 관리', steps: [
        {find: ['button.primary@@직원 등록', 'button.primary@@첫 직원 등록하기'], hint: '여기를 눌러 직원을 등록해요', kind: 'click'},
        {find: ['[role=dialog] field:이름'], hint: '직원 이름을 적어요', kind: 'fill'},
        {find: ['[role=dialog] field:이메일'], hint: '명세서·계약서를 받을 이메일이에요', kind: 'fill'},
        {find: ['[role=dialog] field:연락처'], hint: '휴대폰 번호를 적어요', kind: 'fill'},
        {find: ['[role=dialog] field:약속한 급여'], hint: '시급이면 시간당 금액이에요. 최저임금보다 낮으면 바로 알려 줘요', kind: 'fill'},
        {find: ['[role=dialog] button.primary@@직원 등록하기', '[role=dialog] button.primary@@직원 정보 저장'], hint: '저장하면 퀘스트 완료!', kind: 'click'},
      ]},
    {id: 'shift', chapter: 1, emoji: '🗓️', title: '첫 근무 넣기', why: '근무표가 있어야 지각·결근을 알아서 챙겨 줘요.', xp: 150, minutes: 1,
      badge: {emoji: '📅', name: '근무표 설계사'}, page: '근무 스케줄', steps: [
        {find: ['button.primary@@근무 추가'], hint: '여기를 눌러 근무를 넣어요', kind: 'click'},
        {find: ['[role=dialog] field:직원'], hint: '누가 일하나요? 직원을 골라요', kind: 'pick'},
        {find: ['[role=dialog] field:근무일'], hint: '일하는 날짜를 골라요', kind: 'fill'},
        {find: ['[role=dialog] field:출근'], hint: '출근 시간을 적어요', kind: 'fill'},
        {find: ['[role=dialog] field:퇴근'], hint: '퇴근 시간이에요. 휴게가 부족하면 바로 알려 줘요', kind: 'fill'},
        {find: ['[role=dialog] button.primary@@일정 저장'], hint: '저장하면 근무표에 쏙!', kind: 'click'},
      ]},
    {id: 'publish', chapter: 1, emoji: '📣', title: '근무표 공개하기', why: '공개하면 직원 휴대폰에 알림이 가고, 누가 확인했는지 보여요.', xp: 100, minutes: 1,
      badge: {emoji: '📢', name: '확성기'}, page: '근무 스케줄', steps: [
        {find: ['.publish-bar button.primary'], hint: '여기를 누르면 직원들에게 이번 주 근무표가 공개돼요', kind: 'click'},
      ]},
    {id: 'qr', chapter: 2, emoji: '📱', title: '출퇴근 QR 띄우기', why: '매장에 붙이거나 태블릿에 띄우면 직원이 찍는 순간 기록돼요.', xp: 100, minutes: 1,
      badge: {emoji: '🔳', name: 'QR 마스터'}, page: '출퇴근 기록', doneSel: ['.t-qr img', '.live-qr'], steps: [
        {find: ['.att-actions button==출퇴근 QR'], hint: '여기를 눌러 우리 가게 QR을 만들어요', kind: 'click'},
      ]},
    {id: 'clock', chapter: 2, emoji: '⏱️', title: '첫 출퇴근 기록', why: '직원이 QR을 못 찍었을 때도 사장님이 바로 남길 수 있어요.', xp: 150, minutes: 1,
      badge: {emoji: '⏰', name: '칼출근'}, page: '출퇴근 기록', steps: [
        {find: ['.att-actions button==출퇴근 기록'], hint: '여기를 눌러 출퇴근을 직접 기록해 봐요', kind: 'click'},
        {find: ['[role=dialog] field:직원'], hint: '누구의 기록인가요?', kind: 'pick'},
        {find: ['[role=dialog] field:기록 종류'], hint: '출근·휴게·퇴근 중에 골라요', kind: 'pick'},
        {find: ['[role=dialog] button.primary@@현재 시각으로 기록'], hint: '누르면 지금 시각으로 남아요', kind: 'click'},
      ]},
    {id: 'notice', chapter: 3, emoji: '📢', title: '첫 공지 올리기', why: '단톡방 대신 공지로 남기면 누가 읽었는지 보여요.', xp: 100, minutes: 1,
      badge: {emoji: '📌', name: '공지 요정'}, page: '휴가·공지', doneSel: ['.ops-notice'], steps: [
        {find: ['[role=tab]@@공지'], hint: '공지 탭을 열어요', kind: 'click'},
        {find: ['.ops-notice-form field:제목'], hint: '제목을 적어요. 예: 이번 주 마감 청소 당번', kind: 'fill'},
        {find: ['.ops-notice-form field:내용'], hint: '내용을 적어요', kind: 'fill'},
        {find: ['.ops-notice-form button[type=submit]'], hint: '보내면 직원들에게 알림이 가요', kind: 'click'},
      ]},
    {id: 'ask', chapter: 3, emoji: '🤖', title: '척척 비서에게 질문', why: '모르는 건 물어보고, 근무 추가도 말로 시킬 수 있어요.', xp: 50, minutes: 1,
      badge: {emoji: '💬', name: '수다쟁이'}, page: '홈', doneSel: ['.ast-msg.me'], steps: [
        {find: ['.ast-fab'], hint: '척척 비서를 불러요', kind: 'click'},
        {find: ['.ast-input input'], hint: '"오늘 누가 일해?"라고 물어보세요', kind: 'fill'},
        {find: ['.ast-input button[type=submit]'], hint: '보내기!', kind: 'click'},
      ]},
    {id: 'pay', chapter: 4, emoji: '💰', title: '첫 급여 확정', why: '확정하면 근태가 잠기고 임금명세서가 직원에게 가요.', xp: 200, minutes: 2,
      badge: {emoji: '🏆', name: '월급날의 영웅'}, page: '급여·명세서', steps: [
        {find: ['button.primary@@급여 검토·확정'], hint: '여기를 눌러 이번 달 급여를 검토해요', kind: 'click'},
        {find: ['[role=dialog] field:실제 지급 예정일'], hint: '실제로 줄 날짜를 골라요', kind: 'fill'},
        {find: ['[role=dialog] .t-check input[type=checkbox]'], hint: '수당·공제·누락을 확인했으면 체크', kind: 'check'},
        {find: ['[role=dialog] button.primary==급여 확정'], hint: '누르면 급여가 확정돼요', kind: 'click'},
      ]},
  ],
  staff: [
    {id: 'push', chapter: 0, emoji: '🔔', title: '알림 켜기', why: '근무 전, 근무표가 바뀔 때, 명세서가 왔을 때 알려 줘요.', xp: 50, minutes: 1,
      badge: {emoji: '🔔', name: '알림 수신 완료'}, page: '내 근무', needs: '.push-toggle', doneSel: ['.push-toggle button@@끄기'], steps: [
        {find: ['.push-toggle button'], hint: '여기를 누르고 "허용"을 골라요', kind: 'click'},
      ]},
    {id: 'schedule', chapter: 0, emoji: '📅', title: '내 근무표 보기', why: '언제 일하는지 휴대폰에서 바로 확인해요.', xp: 50, minutes: 1,
      badge: {emoji: '🗓️', name: '일정 체크'}, page: '내 근무', doneOnLastClick: true, steps: [
        {find: ['.staff-tabs button@@근무표'], hint: '여기를 눌러 내 근무표를 열어요', kind: 'click'},
      ]},
    {id: 'wish', chapter: 0, emoji: '🙋', title: '쉬고 싶은 날 알리기', why: '근무표를 짜기 전에 사장님이 참고해요. 휴가 신청과는 달라요.', xp: 100, minutes: 1, noDemo: true,
      badge: {emoji: '🌴', name: '계획형 크루'}, page: '내 근무', steps: [
        {find: ['input[type=date][aria-label=날짜]'], hint: '"쉬고 싶은 날"에서 날짜를 골라요', kind: 'fill'},
        {find: ['button.secondary==내기'], hint: '누르면 사장님께 전달돼요', kind: 'click'},
      ]},
    {id: 'clock', chapter: 1, emoji: '⏱️', title: '첫 출근 찍기', why: '매장에서 버튼을 누르고 QR을 찍으면 끝이에요.', xp: 150, minutes: 1,
      badge: {emoji: '🚀', name: '첫 출근'}, page: '내 근무', steps: [
        {find: ['.clock-big', '.clock-card button'], hint: '매장에 도착하면 이 버튼을 누르고 매장 QR을 찍어요', kind: 'click'},
      ]},
    {id: 'pay', chapter: 1, emoji: '💰', title: '내 급여 확인', why: '이번 달 예상 급여와 "왜 이 금액인지"를 볼 수 있어요.', xp: 50, minutes: 1,
      badge: {emoji: '💵', name: '꼼꼼 확인'}, page: '내 근무', doneOnLastClick: true, steps: [
        {find: ['.staff-tabs button@@급여'], hint: '여기를 눌러 내 급여를 열어요', kind: 'click'},
      ]},
  ],
};

export const LEVELS: Record<QuestRole, {xp: number; title: string}[]> = {
  owner: [{xp: 0, title: '새내기 사장님'}, {xp: 150, title: '초보 사장님'}, {xp: 400, title: '척척 사장님'}, {xp: 750, title: '베테랑 사장님'}, {xp: 1100, title: '척척 마스터'}],
  staff: [{xp: 0, title: '새내기 크루'}, {xp: 100, title: '성실 크루'}, {xp: 250, title: '에이스 크루'}, {xp: 400, title: '척척 크루 마스터'}],
};

type Loose = any;
/** 퀘스트별 완료 여부. pings: 화면에서 확인한 퀘스트 id */
export function questDone(role: QuestRole, state: Loose, branch: string, selfId: string, pings: Iterable<string> = []): Record<string, boolean> {
  const p = new Set(pings), s = state || {}, emps: Loose[] = s.employees || [];
  if (role === 'staff') {
    return {
      push: p.has('push'), schedule: p.has('schedule'), pay: p.has('pay'),
      wish: (s.dayOffWishes || []).some((w: Loose) => w.employeeId === selfId) || p.has('wish'),
      clock: (s.attendance || []).some((a: Loose) => a.employeeId === selfId),
    };
  }
  const ids = new Set(emps.filter(e => e.branchId === branch).map(e => e.id)), b = (s.branches || []).find((x: Loose) => x.id === branch) || {};
  return {
    store: !!String(b.address || '').trim() && !!b.hours,
    staff: ids.size > 0,
    shift: (s.shifts || []).some((x: Loose) => ids.has(x.employeeId)),
    publish: Object.keys(s.publishedWeeks || {}).some(k => k.slice(0, k.lastIndexOf(':')) === branch),
    qr: p.has('qr'),
    clock: (s.attendance || []).some((a: Loose) => ids.has(a.employeeId)),
    notice: p.has('notice'),
    ask: p.has('ask'),
    pay: Object.values(s.payrollRuns || {}).some((r: Loose) => r?.locked && r.branch === branch),
  };
}

/** 쌓인 경험치로 레벨·다음 레벨까지 */
export function levelOf(role: QuestRole, xp: number) {
  const L = LEVELS[role];
  let i = 0; while (i + 1 < L.length && xp >= L[i + 1].xp) i++;
  const next = L[i + 1], from = L[i].xp;
  return {level: i + 1, title: L[i].title, xp, next: next ? next.xp : null, nextTitle: next ? next.title : null, pct: next ? Math.round((xp - from) / (next.xp - from) * 100) : 100, max: !next};
}

/** 보드에 그릴 요약: 경험치·레벨·다음 퀘스트·장별 진행 */
export function questSummary(role: QuestRole, done: Record<string, boolean>, demo = false, skip: string[] = []) {
  const list = QUESTS[role].filter(q => !(demo && q.noDemo) && !skip.includes(q.id));
  const xp = list.filter(q => done[q.id]).reduce((n, q) => n + q.xp, 0), total = list.reduce((n, q) => n + q.xp, 0);
  const next = list.find(q => !done[q.id]) || null, count = list.filter(q => done[q.id]).length;
  const chapters = CHAPTERS[role].map((name, i) => {const qs = list.filter(q => q.chapter === i); return {name, quests: qs, done: qs.every(q => done[q.id])}}).filter(c => c.quests.length);
  return {list, xp, total, count, next, all: !next, chapters, level: levelOf(role, xp)};
}

/** find 문자열 풀기(화면 쪽에서 씀) */
export function parseFind(f: string): {scope: string; css: string; text?: string; exact?: boolean; field?: string} {
  const m = /^(.*?)\s*field:(.+)$/.exec(f);
  if (m) return {scope: m[1].trim(), css: '', field: m[2].trim()};
  const ex = f.indexOf('=='), inc = f.indexOf('@@');
  if (ex > 0) return {scope: '', css: f.slice(0, ex), text: f.slice(ex + 2), exact: true};
  if (inc > 0) return {scope: '', css: f.slice(0, inc), text: f.slice(inc + 2)};
  return {scope: '', css: f};
}
