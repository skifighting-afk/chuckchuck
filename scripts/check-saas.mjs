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
let a=(await account('free')).data;assert.equal(a.account.status,'trialing');assert.equal(a.account.plan,'basic');assert.equal(a.account.monthlyPrice,2900);assert.equal(a.account.vatIncluded,true);assert.equal(a.account.qr,true,'trial includes QR');
assert.ok(Math.abs(Date.parse(a.account.trialEndsAt)-Date.now()-30*86400000)<60000,'30-day trial');
let st=(await store('free')).data;assert.equal(st.state.employees.length,0);assert.equal(st.state.legacy,undefined);assert.equal(st.qrRequired,true);
await q('INSERT INTO stores VALUES(?,?,?,?)',id('legacy'),JSON.stringify(seed()),1,new Date().toISOString()).run();const fixture=(await store('legacy')).data.state;
const employee=(i,branchId='branch-main')=>({...structuredClone(fixture.employees[0]),id:'test-'+i,name:'예시'+i,email:'test'+i+'@example.invalid',phone:'010-0000-0000',branchId,leaveBalance:5,status:'재직',contract:{...fixture.employees[0].contract,employer:'사장',workplace:'테스트'}});
st.state.employees=Array.from({length:12},(_,i)=>employee(i));let r=await store('free',{state:st.state,version:st.version},'PUT');assert.equal(r.status,200,'no employee limit: '+JSON.stringify(r).slice(0,200));st=r.data;
r=await ops('free',{action:'postNotice',version:st.version,title:'공지',body:'내일도 반갑게',branchId:'all'});assert.equal(r.status,200,JSON.stringify(r));
assert.equal((await account('free',{action:'checkout'})).status,503);
// 가격표(2026-10-10): 직원 1명당 베이직 2,900·프로 3,900, 결제 인원 = 재직 직원 수(서버가 계산), 기간 할인 없음
const {billableStaffCount}=await import('../lib/billing-staff.ts');const staff=billableStaffCount(st.state);
const price=async(plan,months)=>{const r=await account('free',{action:'changePlan',plan,months});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.account};
const trialEnd=a.account.trialEndsAt;
assert.equal((await price('pro',1)).monthlyPrice,3900*staff);assert.equal((await price('basic',1)).monthlyPrice,2900*staff);assert.equal((await price('basic',1)).staffCount,staff);
a=await price('pro',12);assert.equal(a.periodPrice,3900*staff*12,'12개월 할인 없음');a=await price('basic',6);assert.equal(a.periodPrice,2900*staff*6,'6개월 할인 없음');assert.equal(a.trialEndsAt,trialEnd,'changing plan never extends trial');
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
// 작업 069: 세금계산서 정보·발행 요청
assert.equal((await account('free',{action:'taxInvoiceRequest',month:'2026-10'})).status,400,'needs billing info first');
assert.equal((await account('free',{action:'billingInfo',bizNo:'123-45-67890',company:'가게',ceo:'대표',email:'tax@example.com'})).status,400,'bad biz no');
r=await account('free',{action:'billingInfo',bizNo:'123-45-67891',company:'테스트 가게',ceo:'김대표',email:'TAX@example.com'});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.account.billing.bizNo,'1234567891');assert.equal(r.data.account.billing.email,'tax@example.com');
r=await account('free',{action:'taxInvoiceRequest',month:'2026-10'});assert.equal(r.status,200);assert.equal(r.data.account.invoiceRequests.length,1);
assert.equal((await account('free',{action:'taxInvoiceRequest',month:'2026-10'})).status,409,'duplicate month');
assert.ok(r.data.account.notice,'trial notice present');
console.log('PASS: 세금계산서 정보·발행 요청.');
// 작업 041: 기간제 만료 30일 전 안내 메일 준비(한 번만)
{const raw=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('free')).first()).data);raw.employees[0].status='재직';raw.employees[0].endDate=new Date(Date.now()+9*3600000+10*86400000).toISOString().slice(0,10);await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(raw),id('free')).run();}
await account('free');await account('free');
{const box=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('free')).first()).data)._outbox.filter(m=>m.key.startsWith('expiry:'));assert.equal(box.length,1,'one reminder');assert.equal(box[0].status,'발송 대기');assert.ok(box[0].subject.includes('기간제 계약'));}
console.log('PASS: 기간제 만료 안내 메일 준비.');
// 작업 064: 결제 내역(본인 가게 것만)
await q("INSERT INTO payments(id,owner,order_id,plan,store_slots,months,amount,status,paid_at,created_at) VALUES('p1',?,'o1','pro',1,1,14900,'paid',?,?)",id('free'),new Date().toISOString(),new Date().toISOString()).run();
assert.equal((await account('free')).data.payments.length,1);assert.equal((await account('other')).data.payments.length,0,'other store sees none');
console.log('PASS: 결제 내역.');
// 작업 018: 해지 예약은 결제 기간 끝까지 이용
assert.equal((await account('free',{action:'cancelSubscription',reason:''})).status,400,'trial cannot cancel subscription');
{const raw=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('free')).first()).data);raw._account.status='active';raw._account.periodStart=new Date(Date.now()-10*86400000).toISOString();raw._account.months=1;await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(raw),id('free')).run();}
r=await account('free',{action:'cancelSubscription',reason:'가게 정리'});assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(Date.parse(r.data.account.cancelAt)>Date.now(),'cancel at period end');assert.equal(r.data.account.status,'active','still usable');
st=(await store('free')).data;assert.equal((await store('free',{state:st.state,version:st.version},'PUT')).status,200,'can still save before period end');
r=await account('free',{action:'undoCancel'});assert.equal(r.status,200);assert.equal(r.data.account.cancelAt,null);
{const raw=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('free')).first()).data);raw._account.cancelAt=new Date(Date.now()-1000).toISOString();await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(raw),id('free')).run();}
assert.equal((await account('free')).data.account.status,'cancelled','after period end: read only');
console.log('PASS: 해지 예약.');
// 작업 011: 가게 등록 때 사업자등록번호(선택) — 키 없으면 미확인, 잘못된 번호는 다시 입력
assert.equal((await account('biz1',{...setup('basic'),bizNo:'12345'})).status,400);
assert.equal((await account('biz1',{...setup('basic'),bizNo:'123-45-67891'})).status,201);
assert.equal((await account('biz1')).data.account.bizCheck.status,'미확인');
console.log('PASS: 사업자등록번호 입력.');
await closeAll();
