// 직원 수 기준 요금(2026-10-10): 베이직 1명 2,900원, 프로 1명 3,900원, 할인·지점 없음.
import assert from 'node:assert/strict';
const {EMPLOYEE_PRICE, employeeMonthlyPrice} = await import('../lib/plans.ts');
assert.equal(EMPLOYEE_PRICE.basic, 2900);
assert.equal(EMPLOYEE_PRICE.pro, 3900);
assert.equal(employeeMonthlyPrice('basic'), 2900);
assert.equal(employeeMonthlyPrice('pro', 1), 3900);
assert.equal(employeeMonthlyPrice('basic', 5), 14500);
assert.equal(employeeMonthlyPrice('pro', 12), 46800);
assert.equal(employeeMonthlyPrice('basic', 0), 2900, '0명이어도 최소 1명으로 본다');
assert.equal(employeeMonthlyPrice('basic', 2.7), 5800, '소수는 버린다');
console.log('ok: 직원 수 기준 요금');
