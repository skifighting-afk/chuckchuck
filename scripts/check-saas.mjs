import assert from 'node:assert/strict';
import {seed} from '../lib/model.ts';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.com'}),{q,headersFor,id}=T,env=T.env,DB=env.DB;
async function call(user,path,body,method){const r=await api(new Request('https://test.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://test.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
const account=(u,b)=>call(u,'/api/account',b),store=(u,b,m)=>call(u,'/api/store',b,m),ops=(u,b)=>call(u,'/api/operations',b);
const setup=(plan,storeSlots)=>({action:'onboard',storeName:'테스트 매장',branchName:'본점',ownerName:'테스트 사장',plan,storeSlots,acknowledged:true,dpaAgreed:true});
// 요금제(2026-10-05): 베이직·프로, 지점 구간 요금(VAT 포함), 직원 수 제한 없음, 30일 체험, 6/12개월 할인
assert.equal((await account('')).status,401);assert.equal((await account('free',setup('basic'))).status,201);
let a=(await account('free')).data;assert.equal(a.account.status,'trialing');assert.equal(a.account.plan,'basic');assert.equal(a.account.monthlyPrice,9900);assert.equal(a.account.vatIncluded,true);assert.equal(a.account.qr,true,'trial includes QR');
assert.ok(Math.abs(Date.parse(a.account.trialEndsAt)-Date.now()-30*86400000)<60000,'30-day trial');
let st=(await store('free')).data;assert.equal(st.state.employees.length,0);assert.equal(st.state.legacy,undefined);assert.equal(st.qrRequired,true);
await q('INSERT INTO stores VALUES(?,?,?,?)',id('legacy'),JSON.stringify(seed()),1,new Date().toISOString()).run();const fixture=(await store('legacy')).data.state;
const employee=(i,branchId='branch-main')=>({...structuredClone(fixture.employees[0]),id:'test-'+i,name:'예시'+i,email:'test'+i+'@example.invalid',phone:'010-0000-0000',branchId,leaveBalance:5,status:'재직',contract:{...fixture.employees[0].contract,employer:'사장',workplace:'테스트'}});
st.state.employees=Array.from({length:12},(_,i)=>employee(i));let r=await store('free',{state:st.state,version:st.version},'PUT');assert.equal(r.status,200,'no employee limit: '+JSON.stringify(r).slice(0,200));st=r.data;
r=await ops('free',{action:'postNotice',version:st.version,title:'공지',body:'내일도 반갑게',branchId:'all'});assert.equal(r.status,200,JSON.stringify(r));
assert.equal((await account('free',{action:'checkout'})).status,503);
// 가격표: 베이직 9,900/14,900/18,900, 프로 14,900/19,900/23,900, 6지점부터 지점당 3,900
const price=async(plan,storeSlots,months)=>{const r=await account('free',{action:'changePlan',plan,storeSlots,months});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.account};
const trialEnd=a.account.trialEndsAt;
assert.equal((await price('pro',1)).monthlyPrice,14900);assert.equal((await price('basic',3)).monthlyPrice,14900);assert.equal((await price('pro',3)).monthlyPrice,19900);
assert.equal((await price('basic',5)).monthlyPrice,18900);assert.equal((await price('pro',5)).monthlyPrice,23900);assert.equal((await price('pro',7)).monthlyPrice,23900+2*3900);
a=await price('pro',1,12);assert.equal(a.periodPrice,Math.floor(14900*12*0.8/10)*10);a=await price('basic',1,6);assert.equal(a.periodPrice,Math.floor(9900*6*0.9/10)*10);assert.equal(a.trialEndsAt,trialEnd,'changing plan never extends trial');
assert.equal((await account('free',{action:'changePlan',plan:'gold'})).status,400);assert.equal((await account('free',{action:'changePlan',plan:'pro',storeSlots:0})).status,400);
// 지점 수: 고른 수보다 많이 만들 수 없고, 지점이 남아 있으면 줄일 수 없다
await price('pro',2);st=(await store('free')).data;st.state.branches.push({id:'branch-2',name:'2호점',address:''});st.state.employees.push(employee(20,'branch-2'));r=await store('free',{state:st.state,version:st.version},'PUT');assert.equal(r.status,200,JSON.stringify(r).slice(0,200));st=r.data;
assert.equal((await account('free',{action:'changePlan',plan:'basic',storeSlots:1})).status,409);
let op=(await ops('free')).data;r=await ops('free',{action:'requestLeave',version:op.version,employeeId:'test-0',start:'2026-10-01',end:'2026-10-01',days:1,kind:'연차',reason:'휴식'});assert.equal(r.status,200,JSON.stringify(r));op=r.data;const leave=op.leaves[0];r=await ops('free',{action:'reviewLeave',version:op.version,id:leave.id,approve:true,comment:'확인'});assert.equal(r.status,200);assert.equal(r.data.employees[0].leaveBalance,4);
// 작업 029: 연차 자동 계산 — 5명 미만이면 반영 불가, 5명 이상이면 입사일 기준 발생분 − 승인 연차로 맞춘다
op=r.data;assert.equal(op.employees[0].accrual.eligible,false);assert.equal((await ops('free',{action:'syncLeave',version:op.version,employeeId:'all'})).status,400);
st=(await store('free')).data;st.state.settings.fivePlus=true;st.state.employees[0].joined='2026-01-01';st.state.employees[0].weeklyHours=40;r=await store('free',{state:st.state,version:st.version},'PUT');assert.equal(r.status,200,JSON.stringify(r).slice(0,300));
op=(await ops('free')).data;const ac=op.employees[0].accrual;assert.equal(ac.eligible,true);assert.equal(ac.used,1);assert.equal(ac.remaining,ac.earned-1);
r=await ops('free',{action:'syncLeave',version:op.version,employeeId:'test-0'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.employees[0].leaveBalance,ac.remaining);
console.log('PASS: 연차 자동 계산 반영.');
// 베이직은 QR 없이 앱 버튼으로 출퇴근, 프로는 QR 필요(체험이 끝난 뒤 기준)
assert.equal((await account('other',setup('basic'))).status,201);assert.equal((await store('other')).data.state.employees.length,0);assert.equal((await ops('other')).data.notices.length,0);
let raw=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('other')).first()).data);raw._account.status='active';await q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(raw),id('other')).run();
assert.equal((await store('other')).data.qrRequired,false,'basic without trial: no QR');
assert.equal((await account('other',{action:'changePlan',plan:'pro'})).status,200);assert.equal((await store('other')).data.qrRequired,true,'pro: QR');
// 체험이 끝나면 조회만(저장 불가), 요금제를 바꿔도 체험이 다시 생기지 않는다
raw=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('other')).first()).data);raw._account.status='trialing';raw._account.trialEndsAt='2020-01-01T00:00:00.000Z';await q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(raw),id('other')).run();
st=(await store('other')).data;assert.equal((await store('other',{state:st.state,version:st.version},'PUT')).status,403);
assert.equal((await account('other',{action:'changePlan',plan:'basic'})).status,200);assert.equal((await account('other')).data.account.status,'expired');
// 예전 무료 요금제 가게는 베이직으로 계속 이용
raw._account={plan:'free',status:'free',storeSlots:1};await q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(raw),id('other')).run();
a=(await account('other')).data.account;assert.equal(a.plan,'basic');assert.equal(a.status,'active');st=(await store('other')).data;assert.equal((await store('other',{state:st.state,version:st.version},'PUT')).status,200);
st=(await store('free')).data;
const shift={id:'s1',employeeId:'test-0',date:'2026-10-01',start:'09:00',end:'17:00',breakMinutes:60};
assert.equal((await store('free',{state:{...st.state,shifts:[shift]},version:st.version},'PUT')).status,400);
shift.date='2026-10-02';assert.equal((await store('free',{state:{...st.state,shifts:[shift,{...shift,id:'s2',start:'16:00',end:'20:00'}]},version:st.version},'PUT')).status,400);
assert.equal((await store('free',{state:{...st.state,shifts:[shift]},version:st.version},'PUT')).status,200);
console.log('PASS: approved leave blocks shifts; overlapping shifts blocked.');
console.log('PASS: 요금제(베이직·프로 지점 구간 요금, VAT 포함, 직원 수 제한 없음, 30일 체험, 6·12개월 할인, QR은 프로, 체험 종료 후 조회만, 예전 무료 고객 보호).');
await closeAll();
