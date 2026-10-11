export function swapProgress(status: string, accepted = false) {
  const done = status === '승인' ? 4 : status === '승인 대기' || status === '반려' || status === '취소' && accepted ? 2 : 1;
  const ended = ['승인', '반려', '취소'].includes(status);
  return {
    done: [0, 1, 2, 3].map(i => i < done), ended,
    next: status === '승인' ? '승인 결과를 근무표에 반영했어요.' : status === '반려' ? '반려로 종료됐어요. 근무표는 바꾸지 않았어요.' : status === '취소' ? '요청을 취소했어요. 근무표는 바꾸지 않았어요.' : status === '승인 대기' ? '맡을 직원이 정해졌어요. 사장님 승인을 기다려요.' : '같은 매장 동료의 수락을 기다려요.',
  };
}
export function requestFollowup(kind: 'leave' | 'swap', status: string, owner: boolean): string {
  if (status === '승인') return kind === 'swap'
    ? owner ? '이미 반영된 요청은 여기서 취소할 수 없어요. 바뀐 근무는 근무 스케줄에서 조정해 주세요.' : '이미 근무표에 반영됐어요. 다시 바꿔야 하면 사장님에게 근무표 조정을 요청해 주세요.'
    : owner ? '승인된 휴가는 여기서 취소할 수 없어요. 변경이 필요하면 직원 관리의 연차 잔여일수와 근무 스케줄을 함께 확인해 주세요.' : '승인된 휴가를 바꾸려면 사장님에게 연차 잔여일수와 근무표 확인을 요청해 주세요.';
  if (status === '반려' || status === '취소') return kind === 'swap' ? '다시 구하려면 다가오는 근무에서 새로 요청해 주세요.' : '날짜와 사유를 확인한 뒤 휴가 신청에서 새로 요청해 주세요.';
  return '';
}
