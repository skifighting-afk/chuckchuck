// 작업 016·017: 동의받는 문서와 판(버전). 문서를 고치면 version을 바꾼다 → 다음 로그인 때 다시 동의를 받는다.
// 지금은 사업자 정보가 확정되지 않은 '판매 준비' 판이다(작업 013·014·015에서 정식 문서로 교체).
export const LEGAL = {
  terms: {version: '2026-10-04-prelaunch', title: '이용약관(판매 준비 안내)', path: '/terms'},
  privacy: {version: '2026-10-04-prelaunch', title: '개인정보 처리방침(데이터 이용 안내)', path: '/privacy'},
  // 가게(사장님)가 직원 개인정보 처리를 척척사장봇에 맡기는 조항 (개인정보 보호법 제26조)
  dpa: {version: '2026-10-04-v1', title: '직원 개인정보 처리위탁', path: '/privacy#processing'},
} as const;
export const consentCurrent = (u: {terms_version?: string | null; privacy_version?: string | null}) =>
  u.terms_version === LEGAL.terms.version && u.privacy_version === LEGAL.privacy.version;
