// 가이드 57: 매일 작업 — 비밀값 확인, 체험 종료 7일·1일 전 알림 각 한 번
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const {env}=await authedTest();
const now=Date.now(),day=86400000;
const put=async(owner,trialEndsAt,extra={})=>{await env.DB.prepare('DELETE FROM stores WHERE owner=?').bind(owner).run();await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?)').bind(owner,JSON.stringify({store:{name:owner+'가게'},_account:{plan:'pro',status:'trialing',trialEndsAt:new Date(trialEndsAt).toISOString(),...extra}}),new Date().toISOString()).run()};
await put('cron-a',now+6.5*day);await put('cron-b',now+0.5*day);await put('cron-c',now+20*day);await put('cron-d',now+5*day,{status:'active'});
const call=(secret)=>api(new Request('https://qa.local/api/cron',{method:'POST',headers:secret?{'x-cron-secret':secret}:{}}),{...env,CRON_SECRET:'test-cron'});
assert.equal((await call()).status,403,'비밀값 없으면 막힘');
assert.equal((await call('wrong-cron')).status,403,'틀린 비밀값 막힘');
const sent=[];const notify=async(uid,m)=>{if(uid.startsWith('cron-'))sent.push([uid,m.title])};
const mod=await import('../dist/server/cron.js');
const n1=await mod.trialReminders(env,now,notify);
assert.deepEqual(sent.map(x=>x[0]).sort(),['cron-a','cron-b'],'7일 안·1일 안 체험만 알림, 유료·먼 체험은 제외');
assert.ok(sent.find(x=>x[0]==='cron-b')[1].includes('내일'),'1일 전은 내일 끝난다고 알림');
sent.length=0;await mod.trialReminders(env,now,notify);
assert.equal(sent.filter(x=>x[0].startsWith('cron-')).length,0,'같은 단계는 한 번만');
await mod.trialReminders(env,now+6*day,notify);
assert.deepEqual(sent.map(x=>x[0]),['cron-a'],'7일 알림 받은 가게도 1일 전에는 한 번 더');
const ok=await call('test-cron');assert.equal(ok.status,200,'올바른 비밀값이면 실행');
for(const o of ['cron-a','cron-b','cron-c','cron-d'])await env.DB.prepare('DELETE FROM stores WHERE owner=?').bind(o).run();
const st=await (await api(new Request('https://qa.local/api/status'),env)).json();assert.ok(st.ok&&st.db&&Array.isArray(st.notices),'서비스 상태: DB 연결과 안내 목록');
console.log('PASS: 서비스 상태(/api/status).');
// 지시서 2주차: 10분 알림 검사(미출근·퇴근 누락)는 한 번만 보내고 _alertsSent에 남긴다
{
 const d='2026-10-07',T=(hm)=>Date.parse(`${d}T${hm}:00+09:00`);
 const data={schemaVersion:2,store:{name:'알림',branch:'본점'},branches:[{id:'b',name:'본점',address:''}],employees:[{id:'e1',name:'가',status:'재직',payDay:10}],shifts:[{id:'s1',employeeId:'e1',date:d,start:'10:00',end:'15:00',breakMinutes:0}],attendance:[],requests:[],payrollRuns:{'2026-09:b':{locked:true,month:'2026-09',rows:[]}},adjustments:{},settings:{},_members:[{userId:'staff-x',employeeId:'e1'}]};
 await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?)').bind('alert-owner',JSON.stringify(data),new Date().toISOString()).run();
 const sent=[];const n1=await mod.alertSweep(env,T('10:20'),(uid,m)=>{sent.push(uid+':'+m.kind)});
 assert.ok(sent.includes('alert-owner:noshow'),'미출근 알림은 사장님에게');
 const n2=await mod.alertSweep(env,T('10:30'),(uid,m)=>{sent.push(uid+':'+m.kind)});
 assert.equal(sent.filter(x=>x==='alert-owner:noshow').length,1,'같은 알림은 한 번만');
 const saved=JSON.parse((await env.DB.prepare('SELECT data FROM stores WHERE owner=?').bind('alert-owner').first()).data);
 assert.ok(typeof saved._alertsSent==='object'&&saved._alertsSent['noshow:s1'],'보낸 알림 기록(객체로)');
 await env.DB.prepare('DELETE FROM stores WHERE owner=?').bind('alert-owner').run();
 console.log('PASS: 10분 알림 검사(한 번만 보내기).');
}
// 지시서 9주차: 서명 대기 계약서 다시 알림(2일 지난 뒤, 3일에 한 번)
{
 const mod=await import('../dist/server/cron.js');const iso=(ms)=>new Date(ms).toISOString();
 for(const [id,ago] of [['env-old',3],['env-new',1]])await env.DB.prepare("INSERT INTO contract_envelopes(id,owner_id,employee_id,employee_user_id,document_json,document_hash,owner_signature,status,created_at) VALUES(?,?,?,?,?,?,?,'waiting',?)").bind(id,'own-x',id+'-emp','emp-x',JSON.stringify({storeName:'가게',employeeName:'가'}),'h','{}',iso(now-ago*day)).run();
 const sent=[];const n1=await mod.contractReminders(env,now,(u,m)=>sent.push(u+':'+m.title));
 const n2=await mod.contractReminders(env,now+day,(u,m)=>sent.push(u));
 assert.equal(n1,1);assert.equal(n2,0);assert.ok(sent.some(x=>x.startsWith('emp-x:근로계약서 서명이'))&&sent.some(x=>x.startsWith('own-x:')));
 assert.equal(await mod.contractReminders(env,now+3*day+60000,()=>{}),2,'3일 뒤엔 둘 다(새 건도 2일 지남)');
 await env.DB.prepare("DELETE FROM contract_envelopes WHERE id IN ('env-old','env-new')").run();
 console.log('PASS: 서명 대기 계약서 다시 알림.');
}
// 지시서 147: 월요일 자동 백업(4주치)
{
 const mod=await import('../dist/server/cron.js');const mon=Date.parse('2026-10-05T01:00:00Z');
 await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?) ON CONFLICT(owner) DO NOTHING').bind('bk-owner',JSON.stringify({store:{name:'백업'},employees:[],shifts:[]}),new Date().toISOString()).run();
 assert.ok(await mod.weeklyBackups(env,mon)>=1);assert.equal(await mod.weeklyBackups(env,mon),0,'같은 주는 한 번');assert.equal(await mod.weeklyBackups(env,mon+86400000),0,'월요일에만');
 for(let i=1;i<=5;i++)await mod.weeklyBackups(env,mon+i*7*86400000);
 assert.equal(Number((await env.DB.prepare("SELECT count(*) AS n FROM store_backups WHERE owner='bk-owner'").first()).n),4,'4주치만');
 await env.DB.prepare("DELETE FROM store_backups").run();await env.DB.prepare("DELETE FROM stores WHERE owner='bk-owner'").run();
 console.log('PASS: 매주 자동 백업.');
}
{
 const mod=await import('../dist/server/cron.js');const now=Date.parse('2026-10-15T01:00:00Z');
 await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?)').bind('raise-owner',JSON.stringify({store:{name:'r'},employees:[{id:'e',name:'가',payType:'시급',wage:10030,status:'재직',wageHistory:[{from:'2026-10-15',wage:10320,prev:10030,payType:'시급'}]}],shifts:[]}),new Date().toISOString()).run();
 assert.equal(await mod.applyRaises(env,now-86400000),0,'전날엔 그대로');assert.ok(await mod.applyRaises(env,now)>=1);
 assert.equal(JSON.parse((await env.DB.prepare("SELECT data FROM stores WHERE owner='raise-owner'").first()).data).employees[0].wage,10320);
 await env.DB.prepare("DELETE FROM stores WHERE owner='raise-owner'").run();console.log('PASS: 예약 인상 자동 반영.');
}
// 지시서 199: 근무표 자동 게시(금요일 18시 → 다음 주)
{
 const mod=await import('../dist/server/cron.js');const fri=Date.parse('2026-10-09T18:05:00+09:00');
 const data={store:{name:'자동'},branches:[{id:'b',name:'본점'}],employees:[{id:'e1',name:'가',status:'재직',branchId:'b',payDay:10}],shifts:[{id:'s',employeeId:'e1',date:'2026-10-13',start:'10:00',end:'15:00'}],settings:{autoPublish:{weekday:5,hour:18}},_members:[{userId:'u-e1',employeeId:'e1'}]};
 await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?)').bind('ap-owner',JSON.stringify(data),new Date().toISOString()).run();
 const sent=[];await mod.alertSweep(env,fri,(u,m)=>sent.push(u+':'+m.title));
 const saved=JSON.parse((await env.DB.prepare("SELECT data FROM stores WHERE owner='ap-owner'").first()).data);
 assert.ok(saved.publishedWeeks['b:2026-10-12'],'다음 주 공개');assert.ok(sent.some(x=>x.startsWith('u-e1:다음 주 근무표')),'직원 알림');
 const before=sent.length;await mod.alertSweep(env,fri+10*60000,(u,m)=>sent.push(u));assert.ok(!sent.slice(before).includes('u-e1'),'한 번만');
 await env.DB.prepare("DELETE FROM stores WHERE owner='ap-owner'").run();console.log('PASS: 근무표 자동 게시.');
}
// 지시서 067·052: 마감 체크 없이 퇴근 · 안 읽은 공지 재알림
{
 const mod=await import('../dist/server/cron.js');const now=Date.parse('2026-10-14T22:10:00+09:00');
 const data={store:{name:'마감'},branches:[{id:'b',name:'본점'}],employees:[{id:'e1',name:'가',status:'재직',branchId:'b'},{id:'e2',name:'나',status:'재직',branchId:'b'}],shifts:[],
  attendance:[{id:'a1',employeeId:'e1',start:'2026-10-14T08:00:00.000Z',end:'2026-10-14T13:00:00.000Z',breakMinutes:0,breakStart:null}],
  _manuals:[{id:'m',title:'마감',branchId:'all',category:'마감',steps:[{text:'불 끄기'}],updatedAt:'2026-10-01'}],_checkRuns:[],
  _operations:{notices:[{id:'n1',title:'위생 점검',branchId:'all',target:{type:'all'},createdAt:'2026-10-13T12:00:00.000Z',reads:['u-e2']}],leaves:[]},
  _members:[{userId:'u-e1',employeeId:'e1'},{userId:'u-e2',employeeId:'e2'}]};
 await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?)').bind('cc-owner',JSON.stringify(data),new Date().toISOString()).run();
 const sent=[];await mod.alertSweep(env,now,(u,m)=>sent.push(u+':'+m.title));
 assert.ok(sent.some(x=>x.startsWith('cc-owner:가님이 마감 체크 없이')),'마감 체크 없이 퇴근 알림');
 assert.ok(sent.includes('u-e1:아직 안 읽은 공지가 있어요')&&!sent.includes('u-e2:아직 안 읽은 공지가 있어요'),'안 읽은 사람에게만');
 const before=sent.length;await mod.alertSweep(env,now+10*60000,(u,m)=>sent.push(u+':'+m.title));assert.equal(sent.length,before,'한 번만');
 await env.DB.prepare("DELETE FROM stores WHERE owner='cc-owner'").run();await env.DB.prepare("DELETE FROM attendance_records WHERE owner='cc-owner'").run();console.log('PASS: 마감 체크 누락·공지 재알림.');
}
// 지시서 060: 생일·입사 기념일
{
 const mod=await import('../dist/server/cron.js');
 const data={store:{name:'기념'},branches:[{id:'b',name:'본점'}],employees:[{id:'e1',name:'가',status:'재직',branchId:'b',birthMonth:'1999-11',joined:'2024-11-04'},{id:'e2',name:'나',status:'재직',branchId:'b',birthMonth:'2000-03',joined:'2026-01-01'}],shifts:[],_members:[]};
 await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?)').bind('care-owner',JSON.stringify(data),new Date().toISOString()).run();
 const sent=[];await mod.alertSweep(env,Date.parse('2026-11-01T08:03:00+09:00'),(u,m)=>sent.push(u+':'+m.title));
 assert.ok(sent.some(x=>x.startsWith('care-owner:🎂 11월 생일 1명')),'생일');assert.ok(sent.some(x=>x.includes('가님 입사 2주년이 3일 남았어요')),'기념일');
 await env.DB.prepare("DELETE FROM stores WHERE owner='care-owner'").run();console.log('PASS: 생일·입사 기념일.');
}
console.log('PASS: 매일 작업 (비밀값·체험 종료 알림 7일·1일 각 한 번).');
await closeAll();
