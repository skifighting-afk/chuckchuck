# 카카오 알림톡 준비 (작업 093)

실제 발송 전 필요한 것(사장님/운영자 준비물):
1. 카카오톡 채널 개설 → 비즈니스 채널 인증
2. 알림톡 발송 대행사(예: 대행사 계약) 가입, 발신 프로필 키(sender key)·API 키 발급
3. 아래 템플릿 검수 신청(정보성 메시지만, 광고 문구 금지) → 승인 후 템플릿 코드 확인
4. Supabase 함수 비밀값에 `KAKAO_SENDER_KEY`, `ALIMTALK_API_KEY`, `ALIMTALK_ENDPOINT` 등록(채팅에 붙여 넣지 말 것)

키가 없으면 `sendAlimtalk`은 보내지 않고 `not_configured`를 돌려준다(가짜 성공 없음).

| 코드 | 이름 | 버튼 |
|---|---|---|
| PAYSLIP_SENT | 급여명세서 도착 | 명세서 보기 |
| CONTRACT_SIGN | 근로계약서 서명 요청 | 계약서 확인 |
| CORRECTION_RESULT | 출퇴근 정정 결과 | 기록 보기 |
| LEAVE_RESULT | 휴가 신청 결과 | 휴가 보기 |
| SWAP_REQUEST | 대타·교대 요청 | 요청 보기 |
| CLOCKOUT_MISSING | 퇴근 기록 누락 | 정정 요청 |

문구 원문은 `lib/alimtalk.ts`의 TEMPLATES. 검수 결과로 문구가 바뀌면 같은 파일을 고친다.
