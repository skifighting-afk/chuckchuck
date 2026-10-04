# 척척사장봇

매장 사장님을 위한 직원·출퇴근·근무표·급여·근로계약 관리 앱.

## 구성

| 부분 | 기술 | 위치 |
|---|---|---|
| 화면 | React + TypeScript, Tailwind | `app/*.tsx` → GitHub Pages |
| 서버 API | 기존 `app/worker.ts`와 `app/*-api.ts`를 Supabase Edge Function 하나(`api`)로 실행 | `supabase/functions/api/entry.ts` |
| DB | Supabase Postgres | `supabase/migrations/` |
| 로그인 | Supabase Auth (가입은 서버 `/api/auth`를 통해서만) | `app/auth-api.ts` |
| 홈페이지 | Readdy 원본 (별도 프로젝트) | `homepage/` |

- 화면은 지금처럼 `fetch('/api/...')`를 부른다. `app/api-client.ts`가 이를 `https://<프로젝트>.supabase.co/functions/v1/api/...`로 보내고 로그인 토큰을 붙인다.
- 서버 코드는 `env.DB`(D1 모양)만 쓴다. `lib/pg-d1.ts`가 이를 Postgres로 연결한다.
- 서버는 토큰을 직접 확인해 신원 헤더를 만든다. 브라우저가 보낸 신원 헤더는 버린다.

## 배포 (자동)

`main`에 올리면 `.github/workflows/deploy.yml`이 실행된다.

1. 설치 → 타입 검사 → 빌드 → 테스트(실제 Postgres 16)
2. 화면을 GitHub Pages에 배포
3. Supabase: DB 마이그레이션, 로그인 설정, 비밀값, 서버 함수 배포
4. 결과와 로그를 `ci-status` 브랜치에 기록

### 저장소에 필요한 설정 (Settings → Secrets and variables → Actions)

| 종류 | 이름 | 설명 |
|---|---|---|
| Secret | `SUPABASE_ACCESS_TOKEN` | supabase.com 계정 토큰 |
| Secret | `SUPABASE_DB_PASSWORD` | 프로젝트 DB 비밀번호 |
| Secret | `SUPABASE_PROJECT_REF` | 프로젝트 ID |
| Variable | `SUPABASE_URL` | `https://<프로젝트 ID>.supabase.co` |
| Variable | `SUPABASE_ANON_KEY` | 공개용 키 |
| Variable | `APP_DOMAIN` | 화면 도메인 (예: `app.example.kr`). 화면이 사이트 최상위 주소에서 돌아야 해서 사실상 필수 |
| Secret (선택) | `HQ_ADMIN_EMAIL` | 본사 화면을 쓸 이메일. 앱에서 이메일 확인을 마쳐야 열림 |
| Secret (선택) | `HQ_NATIVE_USER_ID` | 본사 계정 ID(`native:<uuid>`) |
| Secret (선택) | `RESEND_API_KEY` | 이메일 확인·계약서 사본 메일 발송 |
| Variable (선택) | `EMAIL_FROM` | 보내는 사람 주소 (예: `척척사장봇 <no-reply@example.kr>`) |

Settings → Pages의 Source는 **GitHub Actions**로 둔다.

비밀번호 재설정 메일은 Supabase Auth가 보낸다. 실제 고객에게 보내려면 Supabase 대시보드의 Authentication → SMTP에 발송 서비스를 연결해야 한다(기본 메일은 프로젝트 팀원에게만, 시간당 몇 통만 간다).

## 개발

Node 22.13 이상.

### 로컬에서 전체 실행 (작업 002)
Docker Desktop을 켠 뒤:
```
npm install
npm run dev            # 처음 한 번, 또는 DB를 비우려면: npm run dev -- --reset
```
1. Supabase 로컬 스택(Postgres·로그인·서버 함수 실행기)이 켜지고 `supabase/migrations`가 적용된다.
2. 화면과 서버 함수를 빌드하고, `app/`·`lib/`를 고치면 자동으로 다시 빌드한다.
3. 서버 함수 `api`가 로컬에서 돈다(`supabase functions serve`).
4. 화면: http://localhost:5173 · DB 화면(Studio): http://127.0.0.1:54323
- 운영 Supabase에는 연결하지 않는다. 로컬 주소·키는 `supabase status`에서 읽는다.
- 끌 때: Ctrl+C 후 `npx supabase stop`.

### 점검

```
npm install
npm run check        # 타입 검사
npm run build        # dist/client, dist/server, supabase/functions/api/index.js
npm test             # Postgres 필요: TEST_DATABASE_URL (기본 postgres://postgres:postgres@localhost:5432/chuck_test)
npm run check:function
```

테스트는 매번 새 스키마를 만들고 `supabase/migrations`를 적용한 뒤 끝나면 지운다.

## 하지 않는 것 (홍보 금지)

법정수당 완전 자동 산정, 공인 전자서명, 급여 송금, 세금 신고, GPS 출퇴근 인증, 매출·재고 관리, 실제 결제(PG 미연결). 자세한 원칙은 `homepage/project_plan.md`.

## 이력

- v23까지: ChatGPT Sites(Cloudflare Worker + D1)에서 운영. 인계 자료는 `docs/handoff/`.
- 2026-10: GitHub + Supabase로 이전.
