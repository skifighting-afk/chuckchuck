# 오류 찾기 (작업 007)

사용자가 "오류 번호 E-ABC123" 같은 번호를 알려 주면:

1. Supabase 대시보드 → Edge Functions → `api` → Logs
2. 검색창에 오류 번호(예: `E-ABC123`)를 넣는다.
3. 한 줄 JSON이 나온다: `errorId`, `where`(어느 기능), `name`·`code`(오류 종류), `message`(개인정보를 지운 내용), `at`(시각).

로그에 남기지 않는 것: 이메일, 이름, 전화·계좌 같은 긴 숫자, 계정 ID, DB 오류 안의 실제 값. (`lib/errors.ts`의 `scrub`)
로그 보관 기간은 Supabase 요금제를 따른다(무료: 1일, Pro: 7일). 오래 걸리는 문의는 그날 바로 확인한다.
