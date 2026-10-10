// 결제 인원(결제일 재직 직원 수)과 직원 수 기준 금액·스냅샷 테스트. 테스트 데이터는 코드 안의 가짜 fixture다.
import assert from 'node:assert/strict';
const {billableStaffCount} = await import('../lib/billing-staff.ts');
const {monthlyPrice, periodPrice, employeeMonthlyPrice} = await import('../lib/plans.ts');
const {applyPlanPaid} = await import('../lib/toss.ts');
const emp = (id, status = '재직') => ({id, name: '가짜' + id, ...(status === undefined ? {} : {status})});
const link = (employeeId, userId) => ({employeeId, userId});

// 0명·1명·여러명: 0명이어도 사장님 한 명분(1명)으로 본다
assert.equal(billableStaffCount({}), 1, '직원 기록이 없으면 1명');
assert.equal(billableStaffCount({employees: []}), 1, '0명은 최소 1명');
assert.equal(billableStaffCount({employees: [emp('a')]}), 1);
assert.equal(billableStaffCount({employees: [emp('a'), emp('b'), emp('c')]}), 3, '여러 명');

// 퇴사·입사 준비(초대 대기 포함)는 빼고 재직만 센다
const mixed = {employees: [emp('a'), emp('b', '퇴사'), emp('c', '입사 준비'), emp('d'), {id: 'e', name: '가짜e'}]};
assert.equal(billableStaffCount(mixed), 2, '재직 a·d만');

// 같은 계정이 직원 줄 두 개에 연결되면 한 명, 관리자 계정이 직원으로도 잡혀 있어도 한 명
const dup = {employees: [emp('a'), emp('b')], _members: [link('a', 'u1'), link('b', 'u1')]};
assert.equal(billableStaffCount(dup), 1, '같은 userId는 한 명');
const owner = {employees: [emp('owner-staff'), emp('b')], _members: [link('owner-staff', 'owner-user')]};
assert.equal(billableStaffCount(owner), 2, '연결된 계정 한 명 + 연결 없는 직원 한 명');
// 퇴사한 줄이 같은 계정이어도, 재직 줄이 남아 있으면 그 사람은 한 명으로 센다
assert.equal(billableStaffCount({employees: [emp('a', '퇴사'), emp('b')], _members: [link('a', 'u1'), link('b', 'u1')]}), 1);

// 금액: 직원 1명당 단가 × 인원, 기간 할인 없음(10원 단위 내림)
assert.equal(monthlyPrice('basic', 1), 2900);
assert.equal(monthlyPrice('pro', 1), 3900);
assert.equal(monthlyPrice('basic', 10), 29000);
assert.equal(monthlyPrice('pro', 0), 3900, '0명 입력도 최소 1명');
assert.equal(periodPrice('basic', 5, 1), 14500);
assert.equal(periodPrice('basic', 5, 6), 87000, '6개월 할인 없음');
assert.equal(periodPrice('pro', 5, 12), 234000, '12개월 할인 없음');
assert.equal(employeeMonthlyPrice('pro', 3), 11700);

// 결제 스냅샷: 승인 때 남긴 인원·단가는 다음 결제에서 바뀌지 않고, 이전 결제 행에 값이 없으면 그대로 null
const before = {plan: 'basic', _account: {plan: 'basic', periodStart: '2026-10-01T00:00:00.000Z', paidUntil: '2026-11-01T00:00:00.000Z'}};
const after = applyPlanPaid(before._account, {plan: 'basic', storeSlots: 1, months: 1, amount: 14500, orderId: 'cc-p-test-000001', billedEmployees: 5}, Date.parse('2026-10-10T00:00:00Z'));
assert.equal(after.billedEmployees, 5, '결제 때 인원 기록');
assert.equal(after.periodPrice, 14500, '결제 금액 기록');
const legacy = applyPlanPaid({plan: 'pro'}, {plan: 'pro', storeSlots: 1, months: 1, amount: 9900, orderId: 'cc-p-test-000002'}, Date.parse('2026-10-10T00:00:00Z'));
assert.equal(legacy.billedEmployees, undefined, '인원 정보 없는 옛 결제는 기록을 만들지 않는다');
console.log('ok: 결제 인원·금액·스냅샷');
