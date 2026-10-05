// 작업 013: 운영자(사업자) 정보 — 화면 아래, 이용약관, 개인정보 처리방침이 모두 이 한 곳을 본다.
// 값이 비어 있으면 화면에 '확인 필요'로 보인다. 실제 값은 사업자등록증·통신판매업 신고증 기준으로 채운다.
// 값을 채우면 lib/legal.ts의 약관·방침 판(version)도 함께 올린다(다시 동의 받기).
export const OPERATOR = {
  service: '척척사장봇',
  company: '',            // 상호
  representative: '',     // 대표자
  bizNo: '',              // 사업자등록번호 10자리(숫자만)
  mailOrderNo: '',        // 통신판매업 신고번호
  address: '',            // 사업장 주소
  phone: '',              // 고객 문의 전화
  email: '',              // 고객 문의 이메일
  privacyOfficer: {name: '', position: '', contact: ''}, // 개인정보 보호책임자
  hosting: 'Supabase Inc.(서버·데이터베이스, 서울 리전) · GitHub Inc.(화면 파일)',
} as const;
export const PENDING = '확인 필요';
export const show = (v: string) => v.trim() || PENDING;
export const formatBizNo = (v: string) => v.replace(/\D/g, '').replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3');
/** 공정거래위원회 사업자 정보 공개 페이지(통신판매업자 확인) */
export const ftcLink = (bizNo: string) => bizNo ? `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${bizNo.replace(/\D/g, '')}` : '';
/** 화면 아래(푸터)에 보여 줄 줄들 — 전자상거래법 제10조 표시 항목 */
export function operatorLines(o = OPERATOR) {
  return [
    ['상호', show(o.company)], ['대표자', show(o.representative)],
    ['사업자등록번호', o.bizNo ? formatBizNo(o.bizNo) : PENDING], ['통신판매업 신고번호', show(o.mailOrderNo)],
    ['주소', show(o.address)], ['전화', show(o.phone)], ['이메일', show(o.email)],
    ['개인정보 보호책임자', o.privacyOfficer.name ? `${o.privacyOfficer.name}${o.privacyOfficer.position ? ' ' + o.privacyOfficer.position : ''}` : PENDING],
    ['호스팅 제공자', o.hosting],
  ] as [string, string][];
}
/** 아직 채우지 않은 항목 이름 (본사 화면·문서 점검용) */
export function operatorMissing(o = OPERATOR) {
  const need: [string, string][] = [['상호', o.company], ['대표자', o.representative], ['사업자등록번호', o.bizNo], ['통신판매업 신고번호', o.mailOrderNo], ['주소', o.address], ['전화', o.phone], ['이메일', o.email], ['개인정보 보호책임자', o.privacyOfficer.name], ['보호책임자 연락처', o.privacyOfficer.contact]];
  return need.filter(([, v]) => !v.trim()).map(([k]) => k);
}
