# 척척사장 HR 추가 기능 9개 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 HR 9개 기능을 기존 직원·근무표·매뉴얼에 연결하고 서버 저장·권한·모바일 사용을 검증해 배포한다.

**Architecture:** 기존 앱에 `/hr` 화면과 `/api/hr/*` API를 추가한다. 민감한 자료는 사업자별 PostgreSQL 테이블에 분리하고 일반 Team 응답에 섞지 않는다. PgD1 트랜잭션으로 현재 권한·동시 수정·중복 요청·감사를 함께 처리한다.

**Tech Stack:** React 19.2.6, TypeScript 5.9.3, Zod 3.25.76, Node >=22.13.0, postgres.js 3.4.5, Supabase/PostgreSQL, 기존 rolldown 빌드·Node assert 테스트·GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-11-hr-nine-features-design.md` — 2026-10-11 사용자 승인.

**상태:** 사용자 계획 승인 · 직접 구현 진행 중. 추가 HR 기능 구현 9/9 · 서버 검증 9/9 · 화면 57개 상태 확인 · 최종 리뷰·CI 검증 진행 중 · 배포 확인 0/9. 기존 100개 개선안과 별도로 추적한다.

## Global Constraints

- 선택 범위는 HR-01, HR-03, HR-04, HR-05, HR-06, HR-07, HR-08, HR-09, HR-10이다. 매출·지출·순이익·재고·발주 및 직원 추천 채용은 제외한다.
- 기존 근태·급여·계약·직원 상태·매뉴얼을 재사용한다. 미완성 요금·시작 안내 작업은 이 출시와 분리해 보존한다.
- 모든 조회·수정은 owner·branch·현재 계정 연결·접근 종료 여부·HR 권한·대상자 관계를 서버에서 확인한다.
- 상담 본문·비공개 면담 메모·설문 응답을 일반 Team·푸시·일반 감사·일반 내보내기에 담지 않는다.
- 자동 채용 결정·직원 순위·퇴사 위험 점수·자동 급여 차감·자동 근무표 공개를 만들지 않는다.
- 직원·매니저 권한은 현재 지점에 한정한다. 기존 `staffGone`을 재사용하며 미래 퇴사일을 무조건 접근 종료로 간주하지 않는다.
- 기존 owner 권한에는 공동관리자가 포함된다. 공개 범위에는 ‘사장님·공동관리자·지정 담당자’를 정확히 표시한다.
- 교육 담당자는 본인 배정 교육만 다룬다. 담당자 기록이 남아 있어도 현재 권한이 없으면 열람할 수 없다.
- 360·390·768·1280px, 큰 글씨, 키보드, 포커스 복귀, 저장 실패·409 충돌·중복 클릭을 확인한다.
- 실제 서버 저장·재조회·권한 격리·모바일 확인 후 검증 완료로 표시한다. 실제 배포 확인 전 배포 완료라 쓰지 않는다.

## Review Focus

1. 권한 변경과 저장이 동시에 발생: 쓰기 트랜잭션에서 현재 연결·지점·위임을 재검증한다. Task 1 `revokedDuringWrite`.
2. 같은 요청 키로 다른 내용 전송: 이전 성공을 재사용하지 않고 409를 반환한다. Task 1 `requestKeyMismatch`, Task 2·8 중복 실행.
3. 야간·같은 날 여러 근무·월 경계: 시작일 기준 분류, 순근무 시간, 원본 근무 근거가 일치한다. Task 4 `overnightBoundary`.
4. 담당자 퇴사·전근·권한 만료: 접근을 차단하고 인계 대기를 표시한다. Task 3·5·6 담당자 변경 시험.
5. 삭제·익명화·대표 변경 후 HR 자료 누락: FK·개인정보 정리·별도 내보내기를 연결한다. Task 9 `ownerLifecycle`.

## 파일 구조

공통 기반 뒤 각 기능 묶음을 API·화면·검증까지 완성한다. 각 묶음은 독립적으로 검토할 수 있으며, 전체 출시에는 9개 기능과 데이터 수명 관리가 모두 필요하다.

| 책임 | 생성·수정 파일 |
|---|---|
| 공통 타입·권한 | `lib/hr/types.ts`, `lib/hr/schemas.ts`, `lib/hr/access.ts` |
| 서버 공통 | `app/hr/context.ts`, `app/hr/mutation.ts`, `app/hr/router.ts`, `app/hr/grants-api.ts` |
| 트랜잭션 | `lib/pg-d1.ts` |
| 화면 공통 | `app/hr/workspace.tsx`, `app/hr/client.ts`, `app/hr/components.tsx`, `app/hr/hr.css` |
| 채용 | `lib/hr/hiring.ts`, `app/hr/hiring-api.ts`, `app/hr/hiring.tsx` |
| 교육·숙련도 | `lib/hr/training.ts`, `app/hr/training-api.ts`, `app/hr/training.tsx` |
| 근무 배정 | `lib/hr/staffing.ts`, `app/hr/staffing-api.ts`, `app/hr/staffing.tsx` |
| 면담 | `lib/hr/meetings.ts`, `app/hr/meetings-api.ts`, `app/hr/meetings.tsx` |
| 상담 | `lib/hr/cases.ts`, `app/hr/cases-api.ts`, `app/hr/cases.tsx` |
| 만족도 | `lib/hr/pulse.ts`, `app/hr/pulse-api.ts`, `app/hr/pulse.tsx` |
| 지급·반납 | `lib/hr/items.ts`, `app/hr/items-api.ts`, `app/hr/items.tsx` |
| 수명·내보내기 | `app/hr/lifecycle.ts`, `app/hr/export-api.ts`, `app/hr/export.tsx` |
| 데모 | `lib/hr/demo.ts`, `app/hr/demo-client.ts` |
| 기존 화면 연결 | `app/platform.tsx`, `app/team.tsx`, `app/team-ui.tsx`, `app/manager-desk.tsx`, `app/globals.css` |
| 기존 서버 연결 | `app/worker.ts`, `app/cron-api.ts`, `app/export-api.ts`, `app/withdraw-api.ts`, `lib/legal-docs.ts` |

모듈별 migration은 Task에 명시한다. 상류와 파일명이 충돌하면 사용하지 않은 더 늦은 타임스탬프로 변경하고 계획도 갱신한다. 모든 새 테이블에 owner·branch·버전·생성/수정 시각·작성자를 둔다. 자식 기록은 `(owner,parent_id)` 복합 FK로 다른 사업자와 연결되지 않게 한다.

## 공통 인터페이스

`lib/hr/types.ts`는 아래 타입을 내보낸다. `StoreData`는 기존 `lib/store-data.ts`, `PgD1`은 `lib/pg-d1.ts`에서 가져온다.

```ts
type HrScope = 'hiring'|'training'|'staffing'|'meetings'|'cases'|'pulse'|'items';
type HrDatabase = PgD1;
type HrMeta = {id:string;ownerId:string;branchId:string;createdBy:string;createdAt:string;updatedAt:string;version:number};
type HrCommandMeta = {requestId:string;version?:number};
type HrGrant = HrMeta & {employeeId:string;scope:HrScope;validUntil:string|null;revokedAt:string|null};
type HrContext = {userId:string;ownerId:string;access:'owner'|'manager'|'employee';coowner:boolean;selfId:string|null;branchId:string;store:StoreData;storeVersion:number;grants:HrGrant[];now:string};
type HrMutationResult<T> = {record:T;replayed:boolean};
type HrClient = {get<T>(path:string):Promise<T>;post<T>(path:string,body:unknown):Promise<T>};
type HrPanelProps = {client:HrClient;branchId:string;selfId:string|null};
```

`resolveHrContext(request:Request,env:{DB:HrDatabase},branchId?:string):Promise<HrContext>`는 기존 `resolveStore`와 현재 연결을 재사용한다. 내부 context를 그대로 JSON으로 반환하지 않는다. `asHrDatabase(db:D1Database):HrDatabase`를 context.ts에 정의해 기존 worker와 연결하고 PgD1 여부를 검사한다. 트랜잭션이 없을 때 비원자적 저장으로 후퇴하지 않는다.

`withHrMutation<T>(db:HrDatabase,ctx:HrContext,meta:HrCommandMeta & {operation:string;fingerprint:string},work:(tx:HrDatabase,fresh:HrContext)=>Promise<T>):Promise<HrMutationResult<T>>`는 stores 행 잠금→현재 권한·요청 키 재확인→변경·감사 확정을 한 트랜잭션으로 처리한다. 레코드 version은 모듈의 조건부 UPDATE에서 비교한다. 재전송도 현재 권한부터 확인하며, 민감 DTO를 감사 테이블에 저장하지 않는다.

모든 변경은 POST, 조회는 GET. 생성 201, 수정·동일 재전송 200, 잘못된 입력 400, 미인증 401, 권한 없음 403, 허용 범위에 없는 대상 404, 동시 수정·다른 내용의 요청 키 재사용 409. 기존 Origin·이용 상태·레이트 제한을 적용한다. 응답은 no-store, 오류는 기존 serverError로 처리하고 본문을 로그에 넣지 않는다.

## Task 1: HR 기반·독립 권한·진입 화면

**Files:** 공통 타입·권한·서버·화면 파일, `lib/pg-d1.ts`, `app/worker.ts`, `app/platform.tsx`, `supabase/migrations/20261011030000_hr_core.sql`, `scripts/hr-fixture.mjs`, `scripts/check-hr-core.mjs`.

**Interfaces:**
- `PgD1.transaction<T>(fn:(tx:PgD1)=>Promise<T>):Promise<T>`를 기존 postgres begin에 연결한다.
- `canHr(ctx:HrContext,scope:HrScope,operation:'read'|'write'|'manage',record?:{employeeId?:string;assigneeId?:string;buddyId?:string}):boolean`.
- `hrApi(request:Request,env:{DB:HrDatabase}):Promise<Response>`를 기존 인증·레이트 제한 다음에 라우팅한다.
- `GET /api/hr/context?branch=...`는 허용 지점·최소 직원 ID/이름·기능 권한만 반환한다. `GET/POST /api/hr/grants`는 owner만 조회·위임·회수·만료 설정한다.
- `HrWorkspace({demo=false}:{demo?:boolean})`를 `/hr`에서 lazy load한다. 각 모듈 Panel은 공통 `HrPanelProps`를 받는다.
- `createHrFixture()`는 기존 authedTest를 재사용한다. boss/staff/peer/manager/outsider, 두 사업자·두 지점, `call(actor,path,body?)`, `employeeId(actor)`, `store()`, `q`, `close()`를 제공한다.

- [x] **1. 환경 확인:** 기존 미완성 변경을 보존하고 using-git-worktrees에 따라 최신 main에서 HR 전용 worktree/branch를 준비한다. 승인 spec·plan만 복사하고 baseline `npm run check`, build, 기존 관련 테스트 결과를 기록한다.
- [x] **2. 실패 시험:** `assert.equal((await F.call('', '/api/hr/context')).status,401)`, 직원의 다른 지점 접근 403, 미위임 관리자의 위임 403, owner 위임 후 허용, 만료·회수·전근 후 403을 검증한다. transaction 예외 후 생성 행 0, 같은 키·내용의 감사 1건, `requestKeyMismatch` 409를 검증한다.
- [x] **3. 실패 확인:** `npm run build` 후 `node scripts/check-hr-core.mjs`; 새 API 미연결로 실패하는지 확인한다.
- [x] **4. 기반 구현:** hr_grants/hr_audit/hr_settings를 추가한다. owner FK는 stores(owner) ON UPDATE/DELETE CASCADE, RLS 활성화 및 anon/authenticated 직접 접근 revoke. 감사 요청 키는 owner+actor+request_id로 유일하며 원문 대신 fingerprint·작업·대상 ID만 저장한다. 후보 자동 파기는 기본 비활성화한다.
- [x] **5. 권한 경쟁·화면 시험:** 쓰기 잠금 전에 권한이 회수되는 `revokedDuringWrite`는 403·수정 0건이어야 한다. 권한 설정 화면, 만료 안내, 다른 지점 접근 거부를 확인한다.
- [x] **6. 통과·커밋:** core, `check-team.mjs`, `check-personal-access.mjs`, 타입 검사를 통과한 파일만 커밋한다. 운영 계정에 위임을 임의로 추가하지 않는다.

## Task 2: HR-01 채용 지원자→직원 연결

**Files:** 채용 3파일, router/workspace, `supabase/migrations/20261011040000_hr_hiring.sql`, `scripts/check-hr-hiring.mjs`.

**Interfaces:** `CandidateStage = '지원 접수'|'면접 예정'|'면접 완료'|'채용 결정'|'보류'|'지원 철회'|'종료'`. `Candidate = HrMeta & {name:string;phone:string;role:string;availability:string;source:string;stage:CandidateStage;interviewAt:string|null;questions:string;convertedEmployeeId:string|null;closedAt:string|null}`. `POST /api/hr/hiring` action은 save/stage/convert/retentionSettings/archive. convert는 new/link, employeeId, storeVersion을 받는다. `HiringPanel(props:HrPanelProps)`를 제공한다.

- [x] **1. 실패 시험:** 등록→면접→채용 결정→직원 전환을 시험한다. 전환 재전송은 직원 +1, 기존 직원 연결은 +0, 전화만 같으면 자동 연결하지 않음, 잘못된 날짜 400, 타 사업자·지점 403/404를 assert한다.
- [x] **2. 실패 확인:** build 후 `node scripts/check-hr-hiring.mjs`에서 미구현 실패를 확인한다.
- [x] **3. 구현:** hr_candidates에 이름40/전화30/업무20/가능시간1000/경로80/질문2000자 제한을 둔다. 전환은 owner만 확정한다. fresh store를 teamSchema 검증하고 `newMember` 기본값·입사 준비 상태로 추가하거나 선택 직원을 연결한다. candidate 갱신·store version 증가·감사를 같은 트랜잭션으로 저장한다.
- [x] **4. 화면:** 상태별 목록·명시적 상태 변경·직원 연결 전 확인을 제공한다. 종료 지원자 보관 일수는 owner의 명시 설정 후 적용하고 대상 건수·삭제 예정일을 표시한다.
- [x] **5. 통과·커밋:** core/hiring·타입 검사를 실행한다. 재조회, 직원 화면 연결, 다른 내용의 같은 키 409, 동시 store 변경 시 부분 저장 0을 확인한다.

## Task 3: HR-03·04 신입 담당자·업무 숙련도

**Files:** 교육·숙련도 3파일, router/workspace, `supabase/migrations/20261011050000_hr_training.sql`, `scripts/check-hr-training.mjs`.

**Interfaces:** `BuddyAssignment = HrMeta & {employeeId:string;buddyId:string;from:string;until:string;steps:{id:string;title:string;manualId:string|null;progress:'todo'|'doing'|'awaiting_ack'|'done';note:string;staffAckAt:string|null}[]}`. `SkillDefinition = HrMeta & {name:string;manualId:string|null;archivedAt:string|null}`. `SkillRecord = HrMeta & {employeeId:string;skillId:string;level:'교육 전'|'교육 중'|'도움받으면 가능'|'혼자 가능';checkedBy:string|null;checkedAt:string|null;note:string;reviewRequestedAt:string|null}`. POST actions: assignBuddy/updateStep/ackStep/reassignBuddy/saveSkill/setLevel/requestReview. `TrainingPanel(props:HrPanelProps)`.

- [x] **1. 실패 시험:** 선배는 자기 배정 단계만 변경, 신입은 자기 확인만 가능, 본인 숙련도 확정 403, 이전 선배는 재배정 후 403을 검증한다. 새 담당자에게 미완 단계가 보이며 기존 extra.skills 변경은 0이어야 한다.
- [x] **2. 실패 확인:** build 후 `node scripts/check-hr-training.mjs`.
- [x] **3. 구현:** hr_buddy_assignments/hr_skill_definitions/hr_skill_records를 추가한다. 기간 순서·현재 직원·같은 지점·매뉴얼 공개 대상을 검사한다. title100/note1000/단계30개 제한. 선배 배정은 전체 HR 권한 위임을 뜻하지 않는다. 숙련 변경은 owner 또는 training 위임자만 확정한다.
- [x] **4. 연결:** 담당자·교육 목록·다음 학습·확인일·매뉴얼 링크를 제공한다. 기존 자유 업무 태그는 미확인으로 보존한다. 퇴사·전근 선배는 재배정 안내, 편성 시 미확인 업무는 조언으로 표시하고 자동 탈락시키지 않는다.
- [x] **5. 통과·커밋:** core/training, `check-manual.mjs`, `check-team.mjs`, 타입 검사. 비공개 manualId 주입 거부·진행 동시 수정 409·담당 변경을 확인한다.

## Task 4: HR-05·06 희망 근무량·배정 균형

**Files:** 근무 배정 3파일, `app/team.tsx`, `app/manager-desk.tsx`, `supabase/migrations/20261011060000_hr_staffing.sql`, `scripts/check-hr-staffing.mjs`.

**Interfaces:** `WorkPreference = HrMeta & {employeeId:string;period:'week'|'month';periodKey:string;unit:'hours'|'days';min:number;max:number;reviewedAt:string|null;reviewedBy:string|null;reviewNote:string}`. `StaffingRow = {employeeId:string;plannedHours:number;shiftDays:number;weekendStarts:number;closingShifts:number;longestRun:number;closingConfigured:boolean;preferenceGap:number|null;evidenceShiftIds:string[]}`. `staffingSummary(store:StoreData,prefs:WorkPreference[],branchId:string,from:string,to:string):StaffingRow[]`. POST actions savePreference/reviewPreference. `StaffingPanel(props:HrPanelProps)`.

- [x] **1. 실패 시험:** 금22시→토06시·휴게60분은 7시간, 금요일 시작 1근무. 같은 토요일 2근무는 근무일1·근거2. 9/30→10/1은 9월 시작 근무. 미입력 차이 null, 희망60~70/배정48은 -12, 일수 희망은 시간과 비교하지 않음을 assert한다.
- [x] **2. 실패 확인:** `node scripts/check-hr-staffing.mjs`에서 순수 집계 실패, build 후 API 실패를 확인한다.
- [x] **3. 구현:** hr_work_preferences의 owner+employee+period+periodKey를 유일하게 둔다. 주 키는 weekStartOf, 월 키는 YYYY-MM. 시간 최대 주168/월744, 일수 최대 주7/월 실제 일수, min<=max, 명시 입력0은 유효하다. shiftHours의 휴게·자정 규칙을 재사용한다.
- [x] **4. 집계:** 기간·주말은 시작일, 연속 근무는 중복 제거한 시작일 집합으로 계산한다. 기간 밖 인접 근무도 연속일 계산에 포함하고 근거를 표시한다. 지원 근무는 shift.branchId 또는 소속 지점으로 분류하고 본인 전체 지점 시간은 별도 표시한다. 매장 영업시간의 마감 기준이 없으면 closingConfigured=false.
- [x] **5. 화면·통과·커밋:** 희망 변경·반영 상태·지표별 근거를 제공한다. 기존 일정 편집·공개만 연결하고 자동 수정하지 않는다. core/staffing, `check-schedule-more.mjs`, `check-improve2.mjs`, 타입 검사. 직원 간 조회·변경 거부와 월 경계를 확인한다.

## Task 5: HR-07 면담·약속

**Files:** 면담 3파일, router/workspace, `supabase/migrations/20261011070000_hr_meetings.sql`, `scripts/check-hr-meetings.mjs`.

**Interfaces:** `Meeting = HrMeta & {employeeId:string;assigneeId:string;scheduledAt:string;topic:string;sharedSummary:string;sharedAt:string|null;privateNote:string;ackAt:string|null;status:'scheduled'|'held'|'closed'}`. `MeetingAction = HrMeta & {meetingId:string;text:string;employeeId:string;due:string;status:'open'|'done';completedAt:string|null}`. `MeetingComment = HrMeta & {meetingId:string;body:string}`. `MeetingView = {meeting:Omit<Meeting,'privateNote'>;privateNote?:string;actions:MeetingAction[];comments:MeetingComment[]}`. `meetingView(ctx:HrContext,meeting:Meeting,actions:MeetingAction[],comments:MeetingComment[]):MeetingView`. POST actions save/share/ack/comment/action/actionComplete/reassign. comment는 공유 대화이며 hr_meeting_comments에 body1000자·작성자를 저장한다. `MeetingsPanel(props:HrPanelProps)`.

- [x] **1. 실패 시험:** privateNote 검증 문자열이 직원·동료·비담당 관리자·일반 Store·푸시·일반 export 어디에도 없어야 한다. 본인 공유 요약·약속·의견만 허용, 기한 변경 이력 존재, 퇴사 담당 접근 403을 assert한다.
- [x] **2. 실패 확인:** build 후 `node scripts/check-hr-meetings.mjs`.
- [x] **3. 구현:** hr_meetings/hr_meeting_actions/hr_meeting_comments 추가. 주제100/공유요약2000/비공개메모2000/약속200자·20개 제한. 공유 미리보기와 직원 조회는 같은 DTO를 사용한다. privateNote는 owner와 현재 지정·위임 담당자만 조회한다.
- [x] **4. 화면:** 공유 대상 안내, 직원 확인·의견, 약속 완료·기한 변경·담당자 인계를 제공한다. 면담 내용으로 근무·계약·급여가 변경되지 않음을 비교한다.
- [x] **5. 통과·커밋:** core/meetings·타입 검사, 공유 전 비공개·재조회·담당 만료·입력 보존을 확인한다.

## Task 6: HR-08 실명 의견·상담

**Files:** 상담 3파일, router/workspace, `supabase/migrations/20261011080000_hr_cases.sql`, `scripts/check-hr-cases.mjs`.

**Interfaces:** `HrCase = HrMeta & {employeeId:string;assigneeId:string|null;subject:string;status:'received'|'reviewing'|'answered'|'closed'|'handover';lastReplyAt:string|null}`. `CaseMessage = HrMeta & {caseId:string;fromEmployeeId:string|null;fromOwner:boolean;body:string}`. `CaseView = {record:HrCase;messages:CaseMessage[]}`. `caseView(ctx:HrContext,record:HrCase,messages:CaseMessage[]):CaseView`. POST actions submit/reply/status/reassign/reopen. `CasesPanel(props:HrPanelProps)`.

- [x] **1. 실패 시험:** 동료·다른 지점의 대상 조회404, 비담당 관리자403/404, 지정 담당의 위임 회수 후403, 인계 대기를 검증한다. 공개 범위 미확인400, 같은 submit1건, 본문이 알림·로그·일반 응답에 없는지 assert한다.
- [x] **2. 실패 확인:** build 후 `node scripts/check-hr-cases.mjs`.
- [x] **3. 구현:** hr_cases/hr_case_messages 추가. 제목100/본문2000자·대화200개 제한. 본인·owner·현재 유효한 지정 cases 담당자만 열람한다. 담당 만료 후 owner 인계 전 다른 담당자에게 자동 공개하지 않는다. 기존 익명 건의는 읽거나 변환하지 않는다.
- [x] **4. 화면·통과·커밋:** 제출 전 작성자 이름과 공개 대상을 안내한다. 접수·답변·재문의·인계를 제공한다. 푸시는 일반 제목·링크만 전한다. core/cases, `check-store-log.mjs`, 타입 검사와 409 입력 보존을 확인한다.

## Task 7: HR-09 짧은 근무 만족도

**Files:** 만족도 3파일, router/workspace, `supabase/migrations/20261011090000_hr_pulse.sql`, `scripts/check-hr-pulse.mjs`.

**Interfaces:** `PulseCampaign = HrMeta & {title:string;questions:{id:string;text:string}[];employeeIds:string[];opensAt:string;closesAt:string;status:'draft'|'open'|'closed'}`. `PulseAnswer = HrMeta & {campaignId:string;employeeId:string;values:Record<string,1|2|3|4|5>;comment:string;submittedAt:string}`. `pulseSummary(campaign:PulseCampaign,answers:PulseAnswer[]):{responded:number;targeted:number;distributions:Record<string,[number,number,number,number,number]>}`. POST actions saveCampaign/publish/answer/close. `PulsePanel(props:HrPanelProps)`.

- [x] **1. 실패 시험:** 대상8·응답6이면 responded6/targeted8, 미응답2는 분포에 0명 추가. 한 직원 한 응답, 마감과 동시에 제출409, 종료 전 수정 허용, 대상 외403, 타인 응답404, 공개 범위 미확인400을 assert한다.
- [x] **2. 실패 확인:** `node scripts/check-hr-pulse.mjs` 순수 집계, build 후 API 시험.
- [x] **3. 구현:** hr_pulse_campaigns/hr_pulse_answers 추가. 제목100/질문1~5개·각100/의견1000자 제한. 공개 시 대상자를 고정하고 응답은 owner·pulse 위임자만 전체 열람한다. 직원은 본인 응답만 조회한다. 응답0의 분포는 전부0.
- [x] **4. 화면·통과·커밋:** 자발적 응답·실명 공개 범위·마감·수정을 안내한다. 건너뛰기를 불이익이나 불만 점수로 처리하지 않는다. 인원수와 분포·의견만 보여 주며 익명 건의와 결합하지 않는다. core/pulse·타입 검사.

## Task 8: HR-10 지급품·부분 반납

**Files:** 지급·반납 3파일, router/workspace, `lib/offboarding.ts`, `app/team-ui.tsx`, `supabase/migrations/20261011095000_hr_items.sql`, `scripts/check-hr-items.mjs`.

**Interfaces:** `ItemAssignment = HrMeta & {employeeId:string;name:string;issued:number;returned:number;lost:number;issuedAt:string;dueAt:string|null;receivedAt:string|null;note:string}`. `ItemEvent = HrMeta & {assignmentId:string;kind:'issue'|'ack'|'requestReturn'|'return'|'lost';quantity:number;note:string}`. `outstandingItems(rows:ItemAssignment[],employeeId:string):ItemAssignment[]`는 issued-returned-lost>0인 행을 반환한다. 분실은 별도 미해결 표시한다. POST actions issue/ack/requestReturn/return/lost. `ItemsPanel(props:HrPanelProps)`.

- [x] **1. 실패 시험:** 지급2→반납1 잔여1, 같은 요청 재전송 잔여1, 잔여보다 많은 반납409, 다른 직원 수령확인403, 접근 종료 직원403·owner 반납 기록200, 급여 변동0을 assert한다.
- [x] **2. 실패 확인:** build 후 `node scripts/check-hr-items.mjs`.
- [x] **3. 구현:** hr_item_assignments/hr_item_events 추가. 이름80/메모500자·수량1~999 정수. 반납 수량과 이벤트를 한 트랜잭션으로 갱신한다. 수령 확인은 본인, 지급·반납 확정은 owner/items 담당. 출입키는 별칭만 입력한다.
- [x] **4. 화면·통과·커밋:** 지급→확인→부분 반납·분실 사유·퇴사 준비 미반납 목록을 연결한다. 비용·구매·재고·급여 차감을 넣지 않는다. core/items, `check-team.mjs`, 타입 검사. 동시 반납 중 초과 요청409와 잔여 비음수를 검증한다.

## Task 9: 자료 수명·내보내기·기한 알림

**Files:** 수명·내보내기 3파일, router/workspace, `supabase/migrations/20261011100000_hr_lifecycle.sql`, `app/cron-api.ts`, `app/export-api.ts`, `app/withdraw-api.ts`, `lib/legal-docs.ts`, `scripts/check-hr-lifecycle.mjs`.

**Interfaces:** `purgeClosedCandidates(db:HrDatabase,ownerId:string,now:string):Promise<number>`. `HrExport = {generatedAt:string;ownerId:string;mode:'self'|'owner';sections:Partial<Record<HrScope,unknown>>}`. `exportHrData(ctx:HrContext,selection:HrScope[],mode:'self'|'owner'):Promise<HrExport>`. POST /api/hr/export는 선택 범위만 출력하며 self는 본인에게 공개되는 DTO로 한정한다.

- [x] **1. 실패 시험:** `ownerLifecycle`: 대표 변경 후 owner FK 일치, stores 삭제 후 자식0, 직원 익명화 후 식별 정보·기밀 문자열 없음, 위임 즉시 무효화, 일반 export에 기밀 없음. 후보 보관 설정 미입력은 파기0, 설정한 종료 후보만 정리됨을 assert한다.
- [x] **2. 실패 확인:** build 후 `node scripts/check-hr-lifecycle.mjs`.
- [x] **3. 원자적 수명 연결:** stores.data UPDATE에 PostgreSQL AFTER UPDATE 트리거 `reconcile_hr_people()`를 둔다. 직원의 새 anonymizedAt 변경은 같은 DB 트랜잭션에서 관련 HR 본문·개인 연결을 정리하고 grant를 회수한다. 담당 퇴사·전근은 현재 접근 차단과 인계 대기를 반영한다. 트리거 실패 시 stores UPDATE도 롤백되는지 시험한다. owner 변경·삭제는 FK CASCADE로 처리한다.
- [x] **4. 운영·설명:** 후보 보관은 owner의 명시 설정 후 실행한다. 기존 급여·계약 보관 기간을 상담에 임의로 적용하지 않는다. 일반 export에는 HR 별도 내보내기를 안내한다. cron의 중복 방지 방식으로 면담·약속·반납 기한을 알리고 본문은 넣지 않는다. 처리 항목·공개 범위를 개인정보 안내와 맞춘다.
- [x] **5. 통과·커밋:** core/lifecycle, `check-transfer.mjs`, `check-withdraw.mjs`, `check-cron.mjs`, `check-store-log.mjs`, 타입 검사. 삭제·익명화 시험은 격리 테스트 DB에서만 수행한다.

## Task 10: 데모·모바일·전체 검증·배포

**Files:** 데모 2파일, 기존 화면 연결 파일, `scripts/check-hr-demo.mjs`, `scripts/check-model.mjs`, `scripts/e2e.mjs`, `scripts/mobile-check.mjs`, `.github/workflows/deploy.yml`, `docs/roadmap/development-progress.md`.

**Interfaces:** `HrDemoState = {store:StoreData;grants:HrGrant[];candidates:Candidate[];buddies:BuddyAssignment[];skills:SkillDefinition[];skillRecords:SkillRecord[];preferences:WorkPreference[];meetings:Meeting[];meetingActions:MeetingAction[];meetingComments:MeetingComment[];cases:HrCase[];caseMessages:CaseMessage[];campaigns:PulseCampaign[];answers:PulseAnswer[];items:ItemAssignment[];itemEvents:ItemEvent[]}`. `createHrDemo():HrDemoState`, `createHrDemoClient(state:HrDemoState,role:'owner'|'employee'|'manager'):HrClient`. 역할 전환에도 같은 예시 상태를 사용한다.

- [x] **1. 실패 시험:** 9개 기능의 조작 후 예시 상태 변화·역할별 조회·초기화를 assert한다. 실제 API POST는0이어야 한다.
- [x] **2. 데모·진입 연결:** `/demo?role=owner&screen=hr&view=hiring` 등 기능 링크를 제공한다. 관리자는 매장 운영→사람·교육, 직원은 내 교육/근무 희망/의견·상담/받은 물품 카드에서 진입한다. 기능을 홈에 모두 펼치지 않는다. 예시 데이터 표기를 고정한다.
- [x] **3. 검증 등록:** core/hiring/training/staffing/meetings/cases/pulse/items/lifecycle/demo 검사를 check-model에 등록한다. 기존 E2E에 9개 서버 저장→재조회 시나리오와 권한 실패를 추가한다.
- [x] **4. 화면 확인:** 360/390/768/1280px, 큰 글씨, 가로 넘침, 키보드, 포커스 복귀, 느린 통신, 409 입력 보존, 재접속을 확인한다. 기존 근태·급여·계약 핵심 동선도 확인한다. 브라우저 URL 제한은 우회하지 않는다.
- [ ] **5. 필수 검사:** `npm run check`, `npm run build`, `npm test`, `npm run check:function`, `npm run e2e`, `npm run mobile`. Windows 자식 프로세스 제한은 성공으로 처리하지 않고 Linux CI 결과를 확인한다.
- [x] **6. 리뷰·PR:** 선택한 실행 방식에 따른 코드 리뷰와 수정 후 HR 전용 PR을 만들고 Codex에 연결한다. 미완성 요금·시작 안내 변경을 섞지 않는다.
- [x] **7. 배포 순서 수정:** 현재 workflow는 화면이 DB·서버보다 먼저 배포된다. 새 HR 화면 노출 전에 DB migration→서버 함수→health→화면 배포 순으로 조정하고 앞 단계 실패 시 화면을 배포하지 않는다. 최신 main 조건과 기존 secrets/URL 설정을 보존한다.
- [ ] **8. 운영 확인:** 기존 자동 배포 승인 범위에 따라 CI 성공과 실제 배포 SHA·DB 적용·API·권한·화면을 확인한다. 실재 직원에게 시험 상담·알림을 만들지 않는다. 9개 항목별 증거를 기록하고 개발/검증/배포를 각각 판정한다.

## 실행 환경·완료 기록

PowerShell에서 `TEST_DATABASE_URL`은 격리된 테스트 DB로만 설정한다. 연결 문자열은 출력하지 않는다. build 후 해당 `node scripts/check-hr-*.mjs`를 실행한다. 각 Task의 첫 시험은 의도한 미구현 실패, 마지막 시험은 모든 assertion 통과를 확인한다.

커밋은 검증된 Task 단위로 만든다. 실행 출력 확인 후에만 체크박스를 바꾸며 아직 실행하지 않은 검사를 통과라고 기록하지 않는다. 기존 100개 개선안과 이번 HR 9개 번호를 혼합하지 않는다.

## 자체 검토·실행 방식

승인 설계의 9개 기능·담당자 인계·매뉴얼 공개 범위·직원 면담 의견·수명 관리·모바일·배포를 Task 1~10에 연결했다. Review Focus 5개는 담당 Task에 구체적 검증을 넣었다. 공통 타입·함수 이름과 후속 Task 참조를 통일했고, 본문은 구현 코드 대신 인터페이스와 완료 근거에 집중했다.

권장 방식은 **직접 구현(Native)**이다. 인증·DB·화면의 공통 인터페이스가 많아 이 채팅에서 순차 구현하며 연결을 확인한다. 에이전트 분담(Subagent-driven)을 선택하면 공통 기반을 먼저 정하고 묶음별 구현·독립 리뷰를 진행한다. 계획 검토와 실행 방식 선택 후 개발한다.
