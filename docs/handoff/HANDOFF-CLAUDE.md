# 척척사장 — Claude 인수 현황 (2026-10-04)

원본 인계 문서: `START-HERE.txt`, `NEXT-CODEX.txt` (변경 없음)

## 저장소 구성
- `main` 브랜치: 운영 배포 v23 소스(`app-v23`, 원 커밋 474c023) + 홈페이지 v37(`homepage-readdy-v37`) + 원본 `pending-work/`
- `pending-documents` 브랜치: `pending-work` 패치와 새 파일 3개를 v23 위에 적용한 상태 (미배포·미검증)
  - 패치는 LF, 소스는 CRLF라 `git apply`가 그대로는 실패함 → `--ignore-whitespace`로 적용 후 CRLF로 통일함

## 검증 결과
| 항목 | 결과 |
|---|---|
| SHA256.json 283개 파일 대조 | 전부 일치 |
| pending 패치 적용 | 성공 (8개 파일 수정 + 3개 신규, 156줄 추가 / 21줄 삭제) |
| npm ci / build / check / test | **미실행** — Claude 작업 환경에서 npm 레지스트리 접속이 정책상 차단됨(403). Node 22.22.0은 요구사항(>=22.13) 충족 |
| 홈페이지 빌드 | 미실행 (같은 이유) |

## 미배포 작업(문서 전달) 정적 검토 요약
기능: 사장님이 확정된 급여를 직원 앱으로 명세서 전송 → 직원이 열람·PNG 저장·저장확인. 계약서도 같은 다운로드/상태 UI 사용. `/api/documents` 라우트, 화면 연결, 급여 모델 필드명·runKey 형식(`월:지점`)은 맞음.

배포 전 결정·수정 필요:
1. **서명 시 이메일 인증 생략** (`app/contracts-api.ts:52, 69`) — 사장님 서명은 항상, 직원은 `deliveryMethod:'app'`이면 이메일 인증 없이 서명 가능. 요청 본문 값이라 직원이 임의로 선택 가능. 이메일 발송(RESEND) 미설정 상태를 우회하려는 의도로 보이나 **서명 신원확인 수준을 낮추는 제품/법무 결정**임. 또 `emailVerified`를 DB 값 대신 요청 헤더로 판단(`app/auth-api.ts:129`).
2. 급여 재오픈 시 앱으로 보낸 명세서가 취소되지 않음 (모달 문구는 "취소됩니다"라고 안내, `app/team.tsx:118`).
3. 목록 조회 시 문서마다 쿼리 1회씩(최대 201회) → D1 요청당 쿼리 한도 위험. JOIN으로 변경 권장 (`app/documents-api.ts:28`, `app/contracts-api.ts:38`).
4. 매장 데이터가 동시에 바뀌면(예: 직원 출근) 전송이 "급여가 변경되었어요" 오류로 실패 (`app/documents-api.ts:20-22`).
5. 퇴사/연결 해제된 직원도 문서 접근 유지.
6. 기존 이메일/종이 수령 경로·재발송 버튼이 UI에서 사라졌지만 API에는 남아 있음.
7. `drizzle/0004_app_documents.sql`, 확장된 `scripts/check-verified-contracts.mjs` 아직 실행 안 됨. 운영 DB에 검토 없이 적용 금지.

## 이어가기 순서 (npm 접속 가능한 PC/환경에서)
```
cd app-v23 && npm ci && npm run build && npm run check && npm test
git checkout pending-documents   # 같은 명령 반복 후 위 1~7 처리
```
배포는 기존 Sites 프로젝트(appgprj_6ab2…cd5)에 커밋 push → 버전 저장 → 배포 → 성공 확인. 롤백 기준은 v23. 비밀키·고객 DB는 이 저장소에 없음.
