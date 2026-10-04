// 작업 056: 회원 탈퇴 점검
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest,TEST_PASSWORD} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,sql,headersFor,id,auth}=T,env=T.env;
let n=0;function ok(label,value){assert.ok(value,label);console.log(`${++n}. PASS ${label}`)}
async function call(user,path,body,method){const r=await api(new Request('https://qa.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,body:await r.json().catch(()=>null)}}
const onboard=user=>call(user,'/api/account',{action:'onboard',storeName:'탈퇴 검수',branchName:'본점',ownerName:'가상대표',plan:'starter',acknowledged:true,dpaAgreed:true});
const withdraw=(user,extra={})=>call(user,'/api/withdraw',{action:'withdraw',password:TEST_PASSWORD,confirm:'탈퇴',...extra});

ok('owner store created',(await onboard('boss')).status===201);
// 직원 한 명 연결
const st=(await call('boss','/api/store')).body;
await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:st.version});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
await call('staff','/api/staff-join',{action:'apply',code,name:'탈퇴직원',phone:'01000000000'});
let j=(await call('boss','/api/staff-join')).body;
await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version});
const read=async owner=>{const row=await q('SELECT data FROM stores WHERE owner=?',id(owner)).first();return row?JSON.parse(row.data):null};
const staffEmployee=(await read('boss'))._members.find(m=>m.userId===id('staff')).employeeId;
await q("INSERT INTO payslip_documents(id,owner_id,employee_id,employee_user_id,run_key,revision,document_json,created_at) VALUES('slip-1',?,?,?,'2026-09:branch-main',1,'{}','2026-10-01T00:00:00Z')",id('boss'),staffEmployee,id('staff')).run();
await q("INSERT INTO document_activity(kind,document_id,viewed_at) VALUES('payslip','slip-1','2026-10-01T00:00:00Z')").run();

ok('anonymous cannot withdraw',(await call('','/api/withdraw',{action:'withdraw'})).status===401);
ok('withdraw needs typed confirmation',(await withdraw('boss',{confirm:'네'})).status===400);
ok('withdraw needs current password',(await withdraw('boss',{password:'wrong-password'})).status===400);
let r=await withdraw('boss');ok('owner must export before withdrawing',r.status===409&&r.body.code==='EXPORT_REQUIRED');
ok('owner exports store data',(await api(new Request('https://qa.local/api/export',{headers:{origin:'https://qa.local',...(await headersFor('boss'))}}),env)).status===200);
r=await withdraw('boss');ok('owner schedules deletion after export',r.status===200&&r.body.scheduled===true);
const purgeAt=Date.parse(r.body.purgeAt);ok('deletion scheduled 30 days later',Math.abs(purgeAt-Date.now()-30*86400000)<60000);
ok('second schedule rejected',(await withdraw('boss')).status===409);
r=await call('boss','/api/account');ok('owner sees pending deletion',!!r.body.account.deletion&&r.body.storeClosingAt===r.body.account.deletion.purgeAt);
r=await call('staff','/api/account');ok('employee sees store closing date',r.body.storeClosingAt===new Date(purgeAt).toISOString());
let s=(await call('boss','/api/store')).body;
r=await call('boss','/api/store',{...s,store:{...s.store,name:'바꾸기'}},'PUT');
ok('store is read-only while deletion pending',r.status===403);
ok('cancel withdrawal',(await call('boss','/api/withdraw',{action:'cancelWithdraw'})).status===200);
r=await call('boss','/api/account');ok('cancel clears pending deletion',r.body.account.deletion===null&&r.body.storeClosingAt===null);
ok('deletion row removed on cancel',!(await q('SELECT 1 AS x FROM account_deletions WHERE user_id=?',id('boss')).first()));
ok('cancel without pending rejected',(await call('boss','/api/withdraw',{action:'cancelWithdraw'})).status===404);

// 직원 탈퇴: 계정은 바로 지우고, 가게 쪽 기록은 남긴다.
const staffAuth=(await auth.user('staff')).authId;
r=await withdraw('staff');ok('employee withdraws immediately',r.status===200&&r.body.deleted===true);
ok('employee app account removed',!(await q('SELECT 1 AS x FROM app_users WHERE id=?',id('staff')).first()));
ok('employee login account removed',!auth.users.has(staffAuth));
let d=await read('boss');
ok('employee unlinked from store',!d._members.some(m=>m.userId===id('staff')));
ok('employee records stay with owner',d.employees.some(e=>e.id===staffEmployee)&&!!(await q("SELECT 1 AS x FROM payslip_documents WHERE id='slip-1'").first()));
ok('employee withdrawal audited',d._audit.some(a=>a.action==='직원 계정 탈퇴'));

// 기한 도래: 다음 요청 때 가게 데이터·서류·계정을 지운다.
await withdraw('boss');
await q('UPDATE account_deletions SET purge_at=0 WHERE user_id=?',id('boss')).run();
const bossAuth=(await auth.user('boss')).authId;
await call('other','/api/account');
ok('due store purged',!(await read('boss')));
ok('sent payslips purged with store',!(await q("SELECT 1 AS x FROM payslip_documents WHERE owner_id=?",id('boss')).first())&&!(await q("SELECT 1 AS x FROM document_activity WHERE document_id='slip-1'").first()));
ok('owner accounts removed',!auth.users.has(bossAuth)&&!(await q('SELECT 1 AS x FROM app_users WHERE id=?',id('boss')).first()));
ok('deletion marked done',!!(await q('SELECT done_at FROM account_deletions WHERE user_id=?',id('boss')).first()).done_at);

// 매일 정리(pg_cron)도 기한 지난 가게 데이터를 지운다.
await onboard('boss2');
await api(new Request('https://qa.local/api/export',{headers:{origin:'https://qa.local',...(await headersFor('boss2'))}}),env);
await withdraw('boss2');
await q("INSERT INTO payslip_documents(id,owner_id,employee_id,employee_user_id,run_key,revision,document_json,created_at) VALUES('slip-2',?,'e','native:x','k',1,'{}','x')",id('boss2')).run();
await q('UPDATE account_deletions SET purge_at=0 WHERE user_id=?',id('boss2')).run();
const out=(await sql`select purge_expired() as r`)[0].r;
ok('daily purge removes due withdrawn store',(typeof out==='string'?JSON.parse(out):out).withdrawn_stores===1&&!(await read('boss2')));
let blocked=false;try{await q("INSERT INTO payslip_documents(id,owner_id,employee_id,employee_user_id,run_key,revision,document_json,created_at) VALUES('slip-3','o','e','u','k',1,'{}','x')").run();await q("DELETE FROM payslip_documents WHERE id='slip-3'").run()}catch{blocked=true}
ok('sent payslips stay immutable outside store purge',blocked);
console.log(`${n}/${n} passed`);
await closeAll();
