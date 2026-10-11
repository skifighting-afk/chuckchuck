import assert from 'node:assert/strict';
import * as P from '../lib/plans.ts';
let checks=0;
const test=async(name,fn)=>{await fn();console.log(`PASS ${++checks}. ${name}`)};
const e=(id,status='재직',name='같은이름')=>({id,status,name});
const count=(employees,members=[],testEmployeeIds=[])=>P.billableEmployees({ownerId:'owner',employees,members,testEmployeeIds});
await test('VAT-included employee monthly amounts, including zero',()=>{
 assert.deepEqual([0,1,5,10].map(n=>P.employeePrice('basic',n)),[0,2900,14500,29000]);
 assert.deepEqual([0,1,5,10].map(n=>P.employeePrice('pro',n)),[0,3900,19500,39000]);
 assert.equal(P.employeeMonthlyPrice('basic',0),0);
});
await test('invalid counts and plans are rejected rather than silently clamped',()=>{
 for(const n of [-1,0.5,Infinity,NaN,100001,'2',null])assert.throws(()=>P.employeePrice('basic',n));
 assert.throws(()=>P.employeePrice('gold',1));
});
await test('unlinked employees and equal names remain separate people',()=>{
 assert.equal(count([e('a'),e('b')]).count,2);
});
await test('the same authenticated account across stores is counted once',()=>{
 const r=count([e('a'),e('b'),e('c')],[{employeeId:'a',userId:'person'},{employeeId:'b',userId:'person'}]);
 assert.equal(r.count,2);assert.deepEqual(r.excluded,[{employeeId:'b',reason:'duplicate-account'}]);
});
await test('nonactive employees, owner and protected test IDs are excluded',()=>{
 const r=count([e('pending','입사 준비'),e('retired','퇴사'),e('boss'),e('test'),e('active')],[{employeeId:'boss',userId:'owner'}],['test']);
 assert.equal(r.count,1);assert.deepEqual(r.excluded.map(x=>x.reason),['not-active','not-active','owner','test']);
});
await test('stale inactive account links do not affect active employees',()=>{
 assert.equal(count([e('gone','퇴사'),e('active')],[{employeeId:'gone',userId:'person'}]).count,1);
});
await test('corrupt duplicate employee IDs or conflicting account links stop the quote',()=>{
 assert.throws(()=>count([e('a'),e('a')]));
 assert.throws(()=>count([e('a')],[{employeeId:'a',userId:'person1'},{employeeId:'a',userId:'person2'}]));
 assert.equal(count([e('a')],[{employeeId:'a',userId:'person'},{employeeId:'a',userId:'person'}]).count,1);
});
await test('employee and account IDs have separate identity namespaces',()=>{
 assert.equal(count([e('same'),e('different')],[{employeeId:'different',userId:'same'}]).count,2);
});
await test('snapshots pin current count, prices and timestamp without exposing account IDs',async()=>{
 const input={ownerId:'owner',employees:[e('a'),e('b')],members:[{employeeId:'a',userId:'private-account'},{employeeId:'b',userId:'private-account'}],testEmployeeIds:[],plan:'pro',countedAt:'2026-10-11T00:00:00.000Z'};
 const q=await P.createPricingSnapshot(input);
 assert.equal(q.version,'employee-monthly-2026-10-11');assert.equal(q.count,1);assert.equal(q.unitPrice,3900);assert.equal(q.amount,3900);assert.equal(q.months,1);assert.equal(q.vatIncluded,true);assert.equal(q.countedAt,input.countedAt);
 assert.deepEqual(q.includedEmployeeIds,['a']);assert.match(q.identityDigest,/^[a-f0-9]{64}$/);assert(!JSON.stringify(q).includes('private-account'));
 input.employees.push(e('c'));assert.equal(q.count,1);assert.equal(q.amount,3900);
});
await test('quote identity digest is stable under row order but changes when identities change',async()=>{
 const input={ownerId:'owner',employees:[e('a'),e('b')],members:[],testEmployeeIds:[],plan:'basic',countedAt:'2026-10-11T00:00:00.000Z'};
 const one=await P.createPricingSnapshot(input),reordered=await P.createPricingSnapshot({...input,employees:[...input.employees].reverse()});
 assert.equal(one.identityDigest,reordered.identityDigest);
 assert.notEqual(one.identityDigest,(await P.createPricingSnapshot({...input,employees:[e('a'),e('c')]})).identityDigest);
});
await test('snapshots reject an invalid count timestamp',async()=>{
 await assert.rejects(()=>P.createPricingSnapshot({ownerId:'owner',employees:[],members:[],testEmployeeIds:[],plan:'basic',countedAt:'invalid'}));
});
console.log(`PASS: employee pricing ${checks} cases.`);
