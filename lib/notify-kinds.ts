// 지시서 2주차 132: 알림 종류와 기본값. 사람마다 받을 알림만 켤 수 있다.
export const NOTIFY_KINDS = {
  noshow: {label: '미출근 알림', who: 'owner', desc: '예정 시각 10분이 지나도 출근 기록이 없을 때'},
  clockout: {label: '퇴근 누락 알림', who: 'both', desc: '예정 퇴근 30분이 지나도 퇴근 기록이 없을 때'},
  before: {label: '근무 전 알림', who: 'staff', desc: '근무 시작 1시간 전'},
  schedule: {label: '근무표 변경', who: 'staff', desc: '내 근무가 바뀌었을 때'},
  leave: {label: '휴가·대타', who: 'both', desc: '신청이 오거나 처리됐을 때'},
  notice: {label: '매장 공지', who: 'staff', desc: '새 공지·다시 알림'},
  manual: {label: '매뉴얼', who: 'staff', desc: '새 매뉴얼·바뀐 매뉴얼'},
  payroll: {label: '급여·명세서', who: 'both', desc: '명세서 도착, 급여일 전 미확정'},
  staff: {label: '서류·계약 기한', who: 'both', desc: '보건증·계약·수습이 끝나기 전'},
  brief: {label: '아침 브리핑·주간 리포트', who: 'owner', desc: '매일 아침 8시 오늘 근무·할 일, 월요일엔 지난주 요약'},
  account: {label: '계정·요금', who: 'owner', desc: '체험 종료 안내 등'},
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;
/** 제목으로 종류 짐작(예전 호출부 호환) */
export function guessKind(title: string): NotifyKind {
  if (/보건증|계약이 .*끝나|수습이/.test(title)) return 'staff';
  if (/공지/.test(title)) return 'notice';
  if (/매뉴얼/.test(title)) return 'manual';
  if (/휴가|대타|교대/.test(title)) return 'leave';
  if (/명세서|급여/.test(title)) return 'payroll';
  if (/체험|요금|결제/.test(title)) return 'account';
  if (/근무표/.test(title)) return 'schedule';
  if (/퇴근/.test(title)) return 'clockout';
  if (/출근/.test(title)) return 'noshow';
  return 'account';
}
export const kindsFor = (role: 'owner' | 'staff') => (Object.keys(NOTIFY_KINDS) as NotifyKind[]).filter(k => NOTIFY_KINDS[k].who === 'both' || NOTIFY_KINDS[k].who === role);
