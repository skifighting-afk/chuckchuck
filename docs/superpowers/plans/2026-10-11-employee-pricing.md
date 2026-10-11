# 직원당 요금 일치·기존 구독 보호 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 사용자가 선택한 직접 구현 방식을 유지한다.

**Goal:** 홈페이지의 직원당 요금과 앱 견적·서버 주문을 일치시키고, 기존 결제와 새 가격을 섞지 않는다.

**Architecture:** 순수 가격·집계 모듈을 추가하고 서버가 유효기간 있는 견적과 주문 스냅샷을 생성한다. 기존 지점제 함수는 과거 거래 복원에만 남기며, 결제 승인·이용권 반영·환불을 동일 주문에 대해 재시도할 수 있게 한다. 홈페이지의 현재 작업 자산 이식과 계정별 온보딩은 다음 독립 계획의 범위다.

**Tech Stack:** 기존 React 19·TypeScript·PostgreSQL/PgD1·Supabase 함수·토스 결제 연결. 새 결제 SDK나 런타임 의존성을 추가하지 않는다.

**Spec:** `docs/superpowers/specs/2026-10-11-improvements-200-design.md` A 절. 2026-10-11 사용자 “설계 승인 · 직접 구현 계속”.

## Global Constraints

- 베이직 직원 1명당 월 2,900원, 프로 3,900원, VAT 포함. 새 요금은 월 단위이며 지점·기간 할인 없음.
- 재직 직원만 과금·동일 인증 계정 중복 제외·0명 0원·인원 변경은 다음 청구 반영·기존 구독 보호.
- 초대 대기·입사 준비·퇴사·사장님 본인·서버에 표시된 테스트 직원은 제외한다. 이름·전화번호로 합치지 않는다.
- 전자계약은 양측 서명 완료 1건당 3,000원, 기존 계약 결제 경로를 유지한다.
- 30일 체험·카드 등록 없음·자동 결제 없음. 체험 종료일과 과거 유료 이용 기간을 늘리거나 줄이지 않는다.
- 실제 결제 승인·환불 테스트는 하지 않는다. 합성 DB와 가짜 공급자 테스트, 실제 공급자 샌드박스, 운영 조회 증거를 구분한다.
- 테스트 DB는 `127.0.0.1:55432/chuck_test`. 운영 직원·문서·결제 데이터를 테스트로 변경하지 않는다.
- 새 가입의 지점 한도는 기존 시스템 한도 50곳이며 요금과 분리한다. 직원 추가를 과금 인원 한도로 차단하지 않는다.

## Review Focus

1. 같은 인증 계정의 여러 직원 연결과 동명이인: 전자만 한 명, 후자는 별도 직원으로 집계한다(Task 1).
2. 견적을 본 뒤 직원·요금제가 바뀜: 주문 전에는 재확인, 주문 준비 후에는 고정된 금액을 승인한다(Task 3).
3. 공급자는 승인했지만 DB 반영이 실패함: 재시도가 추가 청구 없이 같은 주문의 반영을 마친다(Task 4).
4. 기존 6·12개월 결제 고객: 남은 이용 기간·가격·취소 계산을 유지하고 전환을 강제하지 않는다(Task 2·5).
5. 직원 0명과 잘못된 인원: 0원 주문은 공급자를 호출하지 않고, 음수·소수·무한대·상한 초과 입력은 거절한다(Task 1·3).

## File Structure

- Create `lib/billing-pricing.ts`: 새 요금 버전, 직원 집계, 가격 스냅샷. DB/화면 없이 테스트 가능한 계산만 담당.
- Create `app/billing-quotes.ts`: 사장님 권한으로 직원 연결을 조회하고 견적 생성·만료·동일 조건 검증.
- Create `app/billing-fulfill.ts`: 공급자 승인 후 같은 주문의 이용권 반영을 재시도하는 단일 경로.
- Create `supabase/migrations/20261011110000_employee_pricing.sql`: 견적 테이블과 주문 스냅샷·반영 시각, RLS/revoke 포함.
- Modify `app/toss-api.ts`, `lib/toss.ts`: 견적 기반 주문·0원 처리·승인 복구, 계약 결제 유지.
- Modify `app/saas-api.ts`, `lib/plans.ts`: 새 가입 요금 버전·현재 이용권/다음 견적 구분·가격과 지점 한도 분리.
- Modify `app/pricing.tsx`, `app/platform.tsx`, `app/billing.tsx`, `app/public-pages.tsx`, `app/saas.css`: 단가·과금 인원·포함/제외·기존 이용권 안내와 확인 단계.
- Modify `scripts/portable-build.mjs`, `site/render.ts`: 공개 메타/요금의 공통 단가 사용. 아직 배포하지 않은 홈페이지 자산은 건드리지 않는다.
- Create `scripts/check-employee-pricing.mjs`, `scripts/check-billing-quotes.mjs`, `scripts/billing-pricing-e2e.mjs`; integrate `scripts/check-model.mjs`, `scripts/e2e.mjs`.

### Task 1: 가격 버전과 서버 집계 규칙

**Interfaces**
- `EMPLOYEE_PRICING_VERSION = 'employee-monthly-2026-10-11'`.
- `billableEmployees({ownerId,employees,members,testEmployeeIds}): {count:number,included:{employeeId:string,identityKey:string}[],excluded:{employeeId:string,reason:'not-active'|'owner'|'test'|'duplicate-account'}[]}`.
- `members`는 기존 `_members`의 `{userId,employeeId}` 연결이다. 활성 직원 연결만 사용한다. 한 직원에 상충하는 인증 계정 두 개가 연결된 손상 데이터는 견적 오류로 막는다.
- 테스트 제외 목록은 서버 보호 `_account.billingTestEmployeeIds`에서만 가져온다. `/api/store`나 견적 요청에 넣은 테스트 표시를 신뢰하지 않는다.
- `employeePrice(plan:'basic'|'pro',count:number):number`: 정수 0~100000만 허용, `2900*count` 또는 `3900*count` 반환. 가격 상한은 기존 정수 금액 열 범위 이내다.
- `createPricingSnapshot(input): PricingSnapshot`: `{version,plan,unitPrice,count,amount,months:1,vatIncluded:true,countedAt,includedEmployeeIds,excluded,identityDigest}`. identityDigest는 식별키 정렬본의 SHA-256이며 원래 사용자 ID를 공개 견적에 내보내지 않는다.

- [ ] 직원 0·1·5·10명 금액을 `[0,2900,14500,29000]`·`[0,3900,19500,39000]`으로 단언한다. 동일 계정 두 연결 1명, 동명이인 별개 ID 2명, 초대/입사 준비/퇴사/본인/서버 테스트 제외를 실제 함수 입력으로 검사한다.
- [ ] `node scripts/check-employee-pricing.mjs` 실행, 새 모듈이 없어 실패함을 확인한다.
- [ ] 모듈 구현. 기존 `monthlyPrice`·`periodPrice`는 이름에 legacy 역할을 명시하고 기존 거래 복원 경로를 유지한다. `employeeMonthlyPrice`의 최소 1명 보정을 없애 공통 계산에 위임한다.
- [ ] 같은 검사와 `npm run check` 통과 후 커밋한다.

### Task 2: 가격 스냅샷 저장과 기존 이용권 보호

**Interfaces**
- 새 테이블 `billing_quotes`: `id text PK, owner text, pricing_version text, snapshot jsonb, created_at timestamptz, expires_at timestamptz, order_id text unique null`.
- `payments` 추가 열 `pricing_version text null, pricing_snapshot jsonb null, fulfilled_at timestamptz null`. 기존 행은 null 그대로 유지하고 금액을 재계산하지 않는다.
- 새 가입 `_account.pricingVersion`은 새 버전, `storeSlots`는 50. 기존 계정의 가격 버전은 읽기만으로 쓰지 않는다.
- 계정 응답은 `currentSubscription`(결제 원본 금액/기간)과 `nextQuote`(현재 직원 기준 예상액)를 분리한다. 기존 `periodPrice` 응답은 원본 `_account.periodPrice`를 우선한다.

- [ ] 기존 결제 행 6·12개월과 새 견적 행을 같은 테스트 DB에 넣어 마이그레이션 뒤 기존 amount/기간이 그대로이고 직원/공동관리자가 견적을 조회할 수 없음을 단언한다.
- [ ] 마이그레이션·응답 변경 전 실패를 확인한다.
- [ ] 추가형 마이그레이션과 응답 구현. 기존 무료/가격 버전 없는 계정에는 “기존 이용 조건”과 전환 전 견적만 보여 준다. 기존 paidUntil 전의 전환은 현재 이용권을 덮지 않고 다음 기간 주문으로 저장한다.
- [ ] `node scripts/check-billing-quotes.mjs`, 기존 `check-saas`/`check-toss`의 레거시 단언 통과 후 커밋한다.

### Task 3: 서버 견적·주문·0원 처리

**Interfaces**
- POST `/api/billing` `{action:'quote',plan}` → `{quoteId,expiresAt,snapshot,requiresConversionConsent,currentSubscription}`. TTL 15분, owner 권한만, 인증 계정 ID 대신 직원 이름/매장/제외 이유를 권한 범위 안에서 DTO로 조합한다.
- POST prepare `{kind:'plan',quoteId,agreed:true,convertPricing:true?}` → 기존 결제창 응답 또는 `{noCharge:true,orderId,amount:0}`.
- 주문 직전 현재 집계 identityDigest와 버전·plan을 대조한다. 인원/신원 변경 시 409 `QUOTE_CHANGED`, 만료 시 410 `QUOTE_EXPIRED`. 일정만 바뀌어도 견적을 버리지 않는다.
- 동일 quoteId 준비 재시도는 같은 orderId를 반환한다. 기존 유료 계정은 명시적인 `convertPricing:true`가 없으면 신규 버전 주문을 만들지 않는다.
- 0원 주문은 `provider='internal', status='no_charge'`, 공급자 호출 없이 Task 4의 이용권 반영을 사용한다. 결제 기록에는 “청구 없음”으로 표시한다.

- [ ] 직원·외부 계정 거절, 클라이언트 amount/count 변조 무시, 만료/인원 변경 거절, quoteId 재시도 동일 주문, 0명에서 공급자 호출 0회를 단언한다.
- [ ] 실패 확인 후 quote/prepare 구현. 기존 계약서 요금 prepare는 종전 경로를 유지한다.
- [ ] 테스트에서 준비 뒤 직원이 늘어나도 이미 만든 주문 금액은 유지하고 다음 견적만 달라짐을 확인한다.
- [ ] 서버 검사·타입 검사 통과 후 커밋한다.

### Task 4: 승인 유실·DB 충돌 복구

**Interfaces**
- `fulfillPlanOrder(db,orderId,now): Promise<{fulfilled:boolean,periodStart:string,periodEnd:string}>`. 주문 ID를 이용권의 적용 원장에 남기고 같은 주문 재반영을 막는다. 순차 재시도뿐 아니라 동시 요청도 DB 트랜잭션/행 잠금으로 보호한다.
- `lib/toss.ts`의 새 `applyPricingPaid`는 새 스냅샷을 보존한다. 기존 applyPlanPaid의 레거시 동작은 바꾸지 않는다.
- 현재 기간이 남아 있으면 신규 이용권은 `pendingSubscription`으로 다음 기간 시작에 적용한다. 역할·QR 기능은 현재 기간 기준으로 유지한다. 새 기간 경계 적용은 로그인/계정/권한 판정의 서버 공통 경로에서 수행한다.
- 공급자 승인 후 로컬 반영 실패는 사용자에게 “결제 승인됨·이용권 반영 확인 중”으로 알린다. paid 또는 confirming 재조회는 같은 주문을 복구하며 새 결제를 유도하지 않는다.

- [ ] 승인 응답 유실, 승인 성공 후 저장 실패, 동일 주문 동시 confirm 2회, 현재 기간이 있는 계정과 없는 계정 각각 검사한다. 돈은 한 주문만 승인되고 이용권도 한 번만 연장됨을 단언한다.
- [ ] 실패를 확인한 뒤 승인 상태·복구 경로 구현. 공급자 응답의 주문번호·금액·상태를 원본 주문과 대조한다.
- [ ] 1월31일·윤년2월·한국 자정 경계의 다음 달 기간을 검사한다. 말일은 목표 달의 말일에 맞춘다.
- [ ] 서버 검사·기존 계약 요금 검사 통과 후 커밋한다.

### Task 5: 결제 화면·홈페이지 요금 일치

**Interfaces**
- `PricingPicker`는 공개 예상 인원 `employees`를 입력받는다. 인증 계정 주문은 이 입력을 쓰지 않고 Task 3 서버 견적을 사용한다.
- `Checkout`은 견적 → 포함/제외 확인 → 약관/명시적 가격 전환 동의 → 주문 준비 순으로 연결한다. 0원은 “0원으로 이용 시작”, paid/refunded/no_charge 기록을 구분한다.
- 현재 이용권 금액과 다음 청구 예상 금액을 따로 표시한다. 새 요금의 “지점 수 요금·6/12개월 할인·직원 수와 무관” 문구를 공개 화면/메타에서 제거한다.
- 과거 거래의 환불은 해당 결제 amount·period_start·period_end와 누적 환불액만으로 계산한다. 새 단가×현재 인원으로 과거 환불을 계산하지 않는다.

- [ ] 공개 0·1·5명 가격, 로그인 계정 서버 집계, 기존 유료 전환 동의, 직원 추가 후 다음 예상액, 0원 이용 시작을 실제 브라우저+합성 DB로 검사한다.
- [ ] 실패 확인 후 화면과 복사문구 구현. 지점 관리 설정은 요금 입력과 분리하고 단가·VAT·체험·계약료를 같은 위치에서 안내한다.
- [ ] 320/390/768/1440px·큰 글씨·키보드·연결 실패/다시 시도 검사. 견적 실패 시 이전 금액으로 결제하지 못하게 한다.
- [ ] `npm run check`, `npm run build`, `npm test`, `npm run e2e`, `npm run mobile`, `npm run check:function` 실행. 실패는 생략하지 않고 원인과 실제 통과 범위를 기록한다.
- [ ] 새 검토자의 전체 변경 검토 후 Important/Critical 수정, PR 연결·CI·자동 배포·운영 SHA/조회 화면 확인. 운영에서 실제 결제나 환불을 만들지 않는다.

## Self-review / 범위 경계

- A 절 중 직원당 요금·기존 구독·주문·취소·환불은 위 5개 Task에 연결했다. 역할별 온보딩(APP-001~010)은 후속 A2 계획, 실제 공급자 샌드박스(APP-093)는 연결 상태에 따른 외부 검증 단계다.
- 견적 식별자와 주문 스냅샷은 사용자 입력 금액을 신뢰하지 않는 동일 인터페이스다. 과거 요금 함수 삭제로 기존 결제 고객을 손상시키지 않는다.
- 새 영상 저장·최소 분석은 승인된 전체 설계에 남아 있으며 이 결제 묶음에 섞지 않는다.
- 구현 후에만 대장에 검증 증거를 등록한다. 이 계획 저장은 200개 개발 완료를 뜻하지 않는다.

## 실행 방식

2026-10-11 사용자 “계획 확인 · 직접 구현 계속”으로 이 실행 계획 검토를 완료했다. 전체 구조 설계 승인과 직접 구현 방식을 유지하며 위 순서로 진행한다.
