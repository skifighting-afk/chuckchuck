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
console.log('PASS: 매일 작업 (비밀값·체험 종료 알림 7일·1일 각 한 번).');
await closeAll();
