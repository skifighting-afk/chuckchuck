# 직원당 요금 A1 검증 기록

PR: https://github.com/skifighting-afk/chuckchuck/pull/19

직원당 2,900/3,900원·VAT 포함·동일 인증 계정 중복 제외·재직자만 집계·0명 0원. 현재 결제 원본과 다음 견적을 분리하고 기존 6/12개월 이용권은 보존한다. 신규 주문은 남은 체험/유료 기간 다음에 적용한다.

## 검증

- 순수 가격/환불/취소 13개, 견적 12개, 승인 복구 11개, 최종 검토 회귀 9개, 기존 Toss 29개, 공동관리자 16개 통과.
- 최종 검토 회귀: 무료 기간 중복 준비·전송 전 승인 유실(404 및 IN_PROGRESS)·14일 지난 불확실 승인·부분 환불 누적·체험 보존·예약 이용권 전액 환불·공동관리자 화면/내려받기/백업 정보 보호.
- 타입 검사·빌드·Supabase 함수 검사 통과.
- d5b36b1에서 Linux 전체 검사, 브라우저 38개 흐름 및 모바일 검사 통과. 검토 수정 뒤 최종 HEAD의 같은 CI를 다시 요구한다.
- 로컬 전체 npm test는 비밀값 검사 단계의 OS git spawn EPERM에서 중단됐다. Linux CI에서는 해당 검사까지 수행한다.
- 실제 결제·환불·운영 고객 데이터 변경은 테스트로 실행하지 않았다. Toss 공급자 샌드박스 검증은 APP-093에 별도로 남는다.

## 최종 검토

독립 검토자 pricing_final_review: Critical 없음, Important 6개. 모두 8개의 실패 재현 검사에서 수정 후 통과. 추가로 승인 후 부분 환불이 먼저 처리되어도 이용권을 복구하는 9번째 실패 재현을 수정했다. CI 최종 확인 전 배포 완료로 보지 않는다. 재검토를 중복 요청하지 않는다.

## 구현 판단 및 잘못됐을 때의 비용

- Ruling: Extend lib/plans.ts rather than add billing-pricing.ts — shared prices and existing direct Node imports avoid duplicate prices/runtime dependencies — cost if wrong: extract module later.
- Ruling: Skill helper scripts require bash, unavailable at C:/Program Files/Git/bin/bash.exe — perform equivalent brief extraction/test logging in PowerShell and keep the same plan-scoped ledger — cost if wrong: bookkeeping format only.
- Task 2: complete (BASE 7a6bde1; tests: check-billing-quotes 7/7, check-saas pass, check-toss 29/29, check-admin pass, npm run check/build pass). New account metadata RED undefined -> GREEN. Ruling: legacy suites explicitly seed old pricing version; dedicated new API suite tests new onboarding. Existing payment price/period untouched.
- Task 3: Ruling: bring transactional fulfillment core forward from Task 4 — 0-price orders must actually activate once in Task 3 — cost if wrong: core still requires Task 4 recovery/concurrency tests before release.
- Task 3: Ruling: PostgreSQL JSON parameters use existing ?::text::jsonb convention — raw ?::jsonb double-serialized snapshots in a reproduced DB assertion — cost if wrong: cannot load snapshots; regression covers it.
- Task 4: Ruling: split confirmation and refund into billing-confirm.ts/billing-refund.ts — transactions and supplier uncertainty remain focused and testable — cost if wrong: module consolidation.
- Task 4: Ruling: retain a queue behind pendingSubscription for independently purchased next periods — concurrent legitimate orders must not overwrite each other; 0-price future stockpiling rejected — cost if wrong: queue presentation needs clear UI.
- Task 4: Ruling: add persisted payment_refunds request IDs and update HQ form — retrying an uncertain refund must preserve its amount/key even after connection loss — cost if wrong: older HQ clients must reload.
- Task 5: Ruling: preserve legacy paid rows with existing period_start/end as already fulfilled — pre-migration transactions must not be re-applied just because fulfilled_at was added later — cost if wrong: an old inconsistent order requires manual investigation rather than automatic extension.
- Task 5: Ruling: AccountBilling separates billing presentation from platform routing; server denies coowner pricing DTO — retain owner-only billing privacy — cost if wrong: coowners ask representative for billing details.
- Final: Ruling: Pre-send approval recovery — lookup first, then repeat original POST/key only for missing or READY/IN_PROGRESS matching payment within 14 days; older uncertainty requires provider investigation — cost if wrong: unresolved orders require customer support rather than another charge.
- Final: Ruling: Full refund of queued employee-priced entitlement — remove that order only; later original purchased dates remain fixed, cancellation clamps to last remaining entitlement end — cost if wrong: there can be a visible unpaid gap until the later purchase starts; changing original dates requires a separate decision.
- Final: Ruling: Full refund of current employee-priced entitlement ends its access immediately; legacy refund behavior remains for original contracts — cost if wrong: legacy entitlement requires support/manual reconciliation under its original terms.
- Final: Ruling: Actual Toss sandbox/live transaction not run — synthetic supplier plus isolated DB and deployment read-only evidence are distinct from supplier certification; APP-093 remains external verification — cost if wrong: provider-specific behavior remains a release risk until sandbox evidence exists.
- Final: Ruling: Reviewer did not judge pending CI — executor will require exact-head green browser/mobile/model checks before merge — cost if wrong: no release while checks fail.
- Final: Ruling: Legal enforceability set aside — preserve explicit prelaunch/legal review status, original paid terms and no real charges in testing — cost if wrong: operator must finalize terms before accepting real payments.

## 미룬 작은 항목

- Final: minor (deferred): quote UI shows unit/count/timestamp but does not display the pricing version; server snapshot and owner payment DTO retain it.
