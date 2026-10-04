import assert from 'node:assert/strict';
import {seed} from '../lib/model.ts';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';
import {closeAll} from './test-db.mjs';
const {q,env,headersFor,id,auth}=await authedTest({domain:'example.com'});
await q('INSERT INTO stores VALUES(?,?,?,?)',id('owner'),JSON.stringify(seed()),1,new Date().toISOString()).run();
let version=0,state;
async function request(body,options={}){const user=options.user??'owner',method=options.method|| (body?'POST':'GET');const r=await api(new Request('https://onjang.test'+(options.path||'/api/store'),{method,headers:{...(await headersFor(user,options.email?{email:options.email}:undefined)),...(options.headers||{}),origin:options.origin||'https://onjang.test'},...(body?{body:JSON.stringify({version,...body})}:{})}),env);const d=await r.json();if(user==='owner'&&r.ok&&d.state){state=d.state;version=d.version}return {status:r.status,d}}
assert.equal((await request(null,{user:''})).status,401);
// 위조한 신원 헤더만으로는 로그인되지 않는다(Supabase 토큰 필요).
assert.equal((await request(null,{user:'',headers:{'oai-authenticated-user-id':id('owner'),'oai-authenticated-user-email':'owner@example.com'}})).status,401);
assert.equal((await request({}, {origin:'https://evil.test'})).status,403);
let r=await request();assert.equal(r.status,200);assert.equal(state.schemaVersion,2);assert.equal(state.employees.length,6);assert.equal(state.legacy.purchases.length,4);
state.employees[0].email='worker@example.com';state.employees[0].phone='010-0000-0000';state.employees[0].contract.employer='테스트사업주';state.employees[0].access='중간관리자';
r=await request({state},{method:'PUT'});assert.equal(r.status,200,JSON.stringify(r));
assert.equal((await request({state,version:0},{method:'PUT'})).status,409);
const saved=structuredClone(state);state.attendance[0].breakMinutes+=5;assert.equal((await request({state},{method:'PUT'})).status,400);state=saved;
r=await request({action:'invite',id:'e0'});assert.equal(r.status,200);const token=new URL(r.d.inviteUrl).searchParams.get('invite');
// 초대 메일과 다른 이메일 계정은 수락할 수 없다(계정 이메일은 이제 Supabase 계정에 고정이라 별도 계정으로 확인).
assert.equal((await request({token},{path:'/api/join',user:'intruder',email:'wrong@example.com'})).status,403);
// 이메일 가입 계정은 이메일 확인을 마쳐야 초대를 수락할 수 있다.
await auth.user('unverified',{verified:false});
assert.equal((await request({token},{path:'/api/join',user:'unverified'})).status,403);
assert.equal((await request({token},{path:'/api/join',user:'worker',email:'worker@example.com'})).status,200);
r=await request(null,{user:'worker'});assert.equal(r.d.access,'manager');assert.deepEqual(r.d.state.employees.map(e=>e.id),['e0']);assert.ok(r.d.state.shifts.every(s=>s.employeeId==='e0'));assert.ok(r.d.state.attendance.every(a=>a.employeeId==='e0'));assert.equal(r.d.state.legacy,undefined);assert.deepEqual(r.d.audit,[]);let staffVersion=r.d.version;
assert.equal((await request({action:'finalize',version:staffVersion},{user:'worker'})).status,403);
await request();const before=state.attendance[0];r=await request({action:'request',id:before.id,start:before.start,end:before.end,breakMinutes:45,reason:'휴게 기록 정정',version:staffVersion},{user:'worker'});assert.equal(r.status,200,JSON.stringify(r));const rid=r.d.state.requests[0].id;
assert.equal((await request({action:'review',id:rid,approve:true,version:r.d.version},{user:'worker'})).status,403);
await request();assert.equal(state.attendance[0].breakMinutes,before.breakMinutes);r=await request({action:'review',id:rid,approve:true});assert.equal(r.status,200,JSON.stringify(r.d));assert.equal(state.attendance[0].breakMinutes,45);assert.equal(state.requests[0].actor.name,'김민지');assert.equal(state.requests[0].reviewer.id,id('owner'));
const month=before.start.slice(0,7);r=await request({action:'finalize',month,branch:'branch-main',payDate:month+'-25'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.d.outbox.length,6);assert.equal(r.d.emailConnected,false);const mail=r.d.outbox.find(x=>x.to==='worker@example.com');
assert.equal((await request({action:'send',id:mail.id})).status,400);
assert.equal((await request({action:'request',id:before.id,start:before.start,end:before.end,breakMinutes:30,reason:'변경'})).status,400);
const frozen=structuredClone(state);state.adjustments[month+':e0']={earnings:[{name:'주휴수당',amount:10000,formula:'확인'}],deductions:[],note:''};assert.equal((await request({state},{method:'PUT'})).status,400);state=frozen;
r=await request({action:'reopen',key:month+':branch-main',reason:'수당 추가 확인'});assert.equal(r.status,200);assert.equal(r.d.outbox[0].status,'확정 해제로 취소');
state.payrollRuns.fake={locked:true};assert.equal((await request({state},{method:'PUT'})).status,400);await request();
state.employees[0].insurances['국민연금']={status:'적용 제외',reason:''};assert.equal((await request({state},{method:'PUT'})).status,400);await request();
state.employees[0].taxMode='사업소득 3.3%';assert.equal((await request({state},{method:'PUT'})).status,400);await request();
assert.equal((await request(null,{user:'unrelated'})).status,409);
console.log('PASS: migration, auth, forged identity headers, origin, conflicts, owner isolation, email-bound invites (verified email only), role filtering, manager cannot approve, attendance before/after audit, payroll lock, reopen, unavailable email not marked sent, insurance and income validation.');
await closeAll();
