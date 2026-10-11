# 계정·매장·역할별 시작 안내 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 사용자가 승인한 직접 구현·검증·자동 배포 방식을 유지한다. 기존 퀘스트·오늘의 일과를 보존한다.

**Goal:** 시작 안내의 숨김·나중에 하기·현재 단계를 서버에 구분해 저장하고, 같은 사람의 다른 기기에서는 이어서 시작하되 다른 계정·매장·역할에는 섞이지 않게 한다.

**Architecture:** 기존 `QuestBoard`/`QuestHost`의 역할별 퀘스트와 실제 기록 완료 판정을 유지한다. 인증된 서버가 사업자·매장·역할 범위를 결정한 진행 설정 API를 추가한다. 완료한 업무를 클라이언트가 임의로 저장하게 하지 않으며, 안내 환경 설정과 기록 열람 확인만 별도로 보관한다.

**Tech Stack:** React 19, TypeScript, PgD1/PostgreSQL. 새 런타임 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-11-improvements-200-design.md` A. 전체 실행 설계 승인·직접 구현 승인이 유지된다.

## Global Constraints

- `(인증 계정, 사업자, 매장, 역할, 안내 버전)`마다 진행 설정을 분리한다. `owner`, `manager`, `employee`는 서버가 현재 권한으로 판정한다.
- 업무 완료는 실제 매장 기록에서 도출한다. 화면만 눌렀다고 직원·근무·급여가 저장된 것으로 처리하지 않는다.
- 기존 main의 시작 퀘스트·오늘의 일과·접근성 개선을 교체하거나 되돌리지 않는다.
- 테스트 DB는 `postgres://postgres:postgres@127.0.0.1:55432/chuck_test`. 운영 고객 기록으로 테스트하지 않는다.
- 매출·지출·순이익·재고·발주·직원 추천 채용은 범위 밖이다.
- 이 묶음은 APP-001 및 HOME-065/066/070의 저장·복원 기반이다. 가입 폼·초대 만료·자료 가져오기·급여 기준 등 나머지 인수조건 전체 완료를 뜻하지 않는다.

## Review Focus

1. A 계정 로그아웃 뒤 B 계정 로그인: A의 안내 숨김과 진행 단계가 잠깐이라도 나타나거나 B 이름으로 저장되지 않는다.
2. 두 사업자의 매장 ID가 같음: 서버 사업자 범위까지 포함해 상태를 분리한다.
3. 직원 전근·퇴사·매니저 위임 만료: 이전 매장의 안내 쓰기와 접근 불가 단계가 거절된다.
4. 두 기기에서 다른 필드를 동시에 바꿈: 충돌을 알리고 읽은 버전 기준으로 재확인하며 마지막 응답 유실 재시도는 중복 업무를 만들지 않는다.
5. 서버 연결 실패·저장 실패: 안내 설정의 실패를 보여 주되 업무 화면 자체는 계속 쓸 수 있고, 임의의 서버 완료로 표시하지 않는다.

## File Structure

- Create `lib/start-guide.ts`: 버전·역할·허용 설정·단계 검증·안전한 기본값.
- Create `supabase/migrations/20261011150000_start_guide.sql`: `start_guide_preferences`의 범위 고유키·설정 JSONB·버전·RLS/revoke.
- Create `app/start-guide-api.ts`: 인증·현재 매장 연결·직원 소속·역할을 검증하는 GET/PATCH.
- Modify `app/worker.ts`: `/api/start-guide` 라우팅과 현재 사용자/사업자 안내 범위 DTO. 기존 결제 정보 보호를 유지한다.
- Create `app/start-guide-store.tsx`: 사용자/사업자/매장/역할별 공유 React 상태·서버 읽기·충돌·실패 복구.
- Modify `app/quests.tsx`, `app/team.tsx`, `app/team-ui.tsx`, `app/tour.tsx`: 기존 퀘스트 UI를 서버 설정에 연결하고 데모는 분리한 메모리 상태로 유지한다.
- Modify `app/manager-desk.tsx`: 실제 `manager-api.ts` 권한에 해당하는 안내만 표시한다. 관리자는 본인 직원 안내와 위임 업무 안내를 분리한다.
- Create `scripts/check-start-guide.mjs`, `scripts/start-guide-e2e.mjs`; modify `scripts/check-model.mjs`/`scripts/e2e.mjs`.

### Task 1: 서버 범위·설정 규칙

**Interfaces**
- `START_GUIDE_VERSION='2026-10-11-v2'`.
- `GuideRole='owner'|'manager'|'employee'`; `GuideKind='personal'|'management'`.
- `GuidePreferences={mini:boolean,hideAll:boolean,deferredUntil:string|null,active:{questId:string,step:number}|null,acknowledged:string[]}`. `acknowledged`는 기록 열람 등 안내 확인에만 사용한다. 업무 완료 목록은 저장하지 않는다.
- `validateGuidePatch(input,allowedQuestIds)`는 알려진 키·정수 단계·최대 30일 미루기·허용 퀘스트만 받는다. 사업자/사용자/역할을 입력 패치로 바꿀 수 없다.
- DB 고유키: `(user_id,owner,branch_id,role,guide_kind,guide_version)`. 열 `preferences jsonb`, `revision int`, `updated_at timestamptz`. 서버만 읽고 쓸 수 있도록 RLS/revoke.

- [ ] 순수 검증 검사와 서로 다른 범위 키 검사를 먼저 작성하고 실행한다. Expected: 모듈 없음 또는 미구현으로 실패.
- [ ] 순수 규칙과 추가형 마이그레이션을 구현한다. Expected: 알 수 없는 키·부정확한 단계·권한 없는 퀘스트 거절, 기본값 안정.
- [ ] `node scripts/check-start-guide.mjs`, `npm run check` 통과 후 커밋.

### Task 2: 인증된 설정 API

**Interfaces**
- GET `/api/start-guide?branchId=...&kind=personal|management` → `{scope:{key,branchId,role,kind,guideVersion},preferences,revision,availableQuestIds}`. `scope.key`는 인증 계정·사업자·매장·역할·버전의 서버 생성 해시다.
- PATCH 같은 경로 `{patch,revision,requestId}`. 현재 revision 불일치에는 409 `GUIDE_CHANGED`와 최신 허용 설정을 반환한다. 업무 데이터는 변경하지 않는다.
- 사업자·사용자는 헤더와 `resolveStore`에서만 얻는다. 직원/매니저는 본인 소속 매장만, 사장님/공동관리자는 현재 접근 가능한 매장만 허용한다. 퇴사·접근 회수는 403.
- `management`는 중간관리자만 허용하며 `managerPermissions`와 만료되지 않은 대리 승인 범위를 같은 기준으로 제한한다. 개인정보·급여 원본을 새 DTO에 추가하지 않는다.

- [ ] 두 계정·두 사업자(같은 branch ID)·두 매장·세 역할·퇴사·전근·교차 사업자 변조·위임 만료·RLS 거절을 검사한다. Expected: API 없음으로 실패.
- [ ] API 및 라우팅 구현. Expected: 같은 범위에서만 설정 저장·조회, 타인 설정 접근 불가.
- [ ] 두 기기 stale revision·동시 PATCH·응답 유실 재확인·기록 불변 검사를 통과하고 커밋한다.

### Task 3: 기존 퀘스트·안내 UI 연결

**Interfaces**
- `StartGuideProvider`가 현재 서버 DTO의 사용자/사업자 맥락과 선택 매장을 받는다. 서버 범위가 확인되기 전 다른 범위의 메모리/저장 상태를 표시하지 않는다.
- 기존 `useQuestStore`를 범위별 서버 설정에 연결한다. 업무 완료는 `questDone`의 실제 데이터 판정, 열람 안내 확인은 허용 acknowledgement로 구분한다.
- demo는 `(demoRole,branch,selfId,guideVersion)`별 메모리만 사용한다. 실제 계정의 localStorage 숨김을 데모에 적용하지 않는다.
- 숨기기·다시 열기·나중에 하기·현재 단계 복원·설정 저장 실패/재시도·409 최신 상태 확인을 제공한다. 업무 입력값이나 작업 저장 결과를 지우지 않는다.
- 매니저 위임 업무는 `schedule`, `attendance`, `leave`, `notices` 권한에 대응하는 단계만 보여 주고 `/manager`의 해당 영역으로 연결한다. 안내 시작 자체가 근무 등록·승인을 실행하지 않는다.

- [ ] 브라우저에서 숨김/복원·다른 매장 분리·서버 연결 실패를 먼저 검사한다. Expected: 기존 role-only 저장 때문에 분리/다른 기기 복원이 실패.
- [ ] UI 연결과 관리자 허용 단계 구현. Expected: 실제 동작 UI 유지, 범위 변경 시 안내 재설정, 실패 재시도 가능.
- [ ] `npm run check`, `npm run build`, API 검사·핵심 E2E 통과 후 커밋.

### Task 4: 두 기기·모바일·배포

- [ ] 독립 브라우저 context 두 개로 동일 계정 이어 시작, 다른 계정/매장 숨김 분리, 전근/권한 회수 뒤 쓰기 거절을 검사한다.
- [ ] 320/390/768/1440px·큰 글씨·키보드·초점 복귀·설정 저장 실패·409 충돌 흐름을 확인한다.
- [ ] `npm run check`, `npm run build`, `npm test`, `npm run check:function`, `npm run e2e`, `npm run mobile`를 실행한다. 로컬 OS 제약은 증거와 함께 구분하고 Linux CI 전체 통과를 요구한다.
- [ ] 새 검토자의 전체 범위 검토 1회 후 Important/Critical을 실패 재현→수정→전체 검사로 해결한다. PR 연결·정확한 HEAD의 CI·자동 배포·운영 SHA와 조회 확인까지 진행한다.
- [ ] 대장은 통과한 개별 인수조건만 갱신한다. 실제 사장님 사용 관측이나 나머지 가입 개선을 완료로 표시하지 않는다.
