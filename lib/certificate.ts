// 가이드 87: 재직증명서·경력증명서. 사장님이 직원 정보로 만들고 확인·서명(직인)해서 준다.
// 주민등록번호는 받지 않으므로 생년월이 있으면 생년월, 없으면 빈칸으로 둔다(사장님이 손으로 채움).
type E = {name: string; joined: string; endDate?: string; status: string; role: string; employment: string; birthMonth?: string; address?: string};
const ko = (d: string) => d ? `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : '[작성 필요]';
export function certificateText(kind: '재직' | '경력', store: {name: string; owner: string; address?: string; bizNo?: string}, e: E, issued: string, purpose = '') {
  const leftOrEnd = e.status === '퇴사' ? e.endDate : '';
  if (kind === '재직' && e.status === '퇴사') throw new Error('퇴사한 직원은 경력증명서로 발급해 주세요.');
  if (kind === '경력' && !leftOrEnd && e.status !== '퇴사') { /* 재직 중 경력증명서: 발급일까지로 적는다 */ }
  const period = `${ko(e.joined)} ~ ${kind === '재직' ? '현재(발급일 기준 재직 중)' : ko(leftOrEnd || issued)}`;
  return [
    `${kind}증명서`, '',
    `성명 : ${e.name}`,
    `생년월 : ${e.birthMonth ? `${e.birthMonth.slice(0, 4)}년 ${Number(e.birthMonth.slice(5, 7))}월` : '[작성 필요]'}`,
    `주소 : ${e.address?.trim() || '[작성 필요]'}`, '',
    `사업장명 : ${store.name}`,
    `사업장 주소 : ${store.address?.trim() || '[작성 필요]'}`,
    ...(store.bizNo ? [`사업자등록번호 : ${store.bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3')}`] : []),
    `${kind === '재직' ? '재직' : '근무'} 기간 : ${period}`,
    `담당 업무 : ${e.role}`,
    `근로 형태 : ${e.employment}`,
    `용도 : ${purpose.trim() || '[작성 필요]'}`, '',
    `위와 같이 ${kind === '재직' ? '재직하고 있음' : '근무하였음'}을 증명합니다.`, '',
    ko(issued), '',
    `${store.name}`, `대표자 ${store.owner || '[작성 필요]'} (서명 또는 인)`, '',
    '※ 척척사장에 등록된 정보로 만든 초안이에요. [작성 필요]를 채우고 대표자가 서명·날인해야 증명서로 쓸 수 있어요.',
  ].join('\n');
}
