// 지시서 나중: 020 키오스크 · 009 지각 사유 · 010 결근 누적 알림
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function raw(user,path,body){return api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function call(user,path,body){const r=await raw(user,path,body);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'매뉴얼 검수',branchName:'본점',ownerName:'가상대표',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['amy','에이미'],['far','다른지점']]){await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});const j=(await call('boss','/api/staff-join')).body;await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version});}
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);const F=d._members.find(m=>m.userId===id('far')).employeeId;d.branches.push({id:'b2',name:'2호점',address:''});d.employees.find(e=>e.id===F).branchId='b2';await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
const st=async(u)=>(await call(u,'/api/store')).body;
let b=await st('boss');const A=b.state.employees.find(e=>e.name==='에이미').id;
let r=await call('boss','/api/store',{action:'kioskLink',branchId:'branch-main',version:b.version});ok('owner makes kiosk link',[r.status,/\/kiosk\?k=[a-f0-9]{48}$/.test(r.body.kioskUrl||'')],[200,true]);
const k=new URL(r.body.kioskUrl).searchParams.get('k');
const KG=()=>api(new Request('https://qa.local/api/kiosk?k='+k),env).then(async r=>({status:r.status,body:await r.json()}));
const KP=(body)=>api(new Request('https://qa.local/api/kiosk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({k,...body})}),env).then(async r=>({status:r.status,body:await r.json()}));
let g=await KG();ok('kiosk lists branch staff only',[g.status,g.body.staff.some(e=>e.id===A),g.body.staff.some(e=>e.name==='다른지점')],[200,true,false]);
ok('kiosk shows no private data',Object.keys(g.body.staff[0]).sort().join(),'id,name,onBreak,pin,shift,working');
ok('no pin yet',(await KP({employeeId:A,pin:'4821'})).status,400);
let s=await st('amy');ok('easy pin refused',(await call('amy','/api/store',{action:'setKioskPin',pin:'1234',version:s.version})).status,400);
ok('staff sets pin',(await call('amy','/api/store',{action:'setKioskPin',pin:'4821',version:s.version})).status,200);
ok('wrong pin',(await KP({employeeId:A,pin:'0000'})).status,403);
r=await KP({employeeId:A,pin:'4821'});ok('kiosk clock in',[r.status,r.body.ok?.includes('출근')],[200,true]);
b=await st('boss');ok('attendance created via kiosk',b.state.attendance.some(a=>a.employeeId===A&&!a.end&&a.device==='kiosk'),true);ok('audit kiosk',b.audit.some(x=>x.action==='근태 기록(태블릿)'),true);
r=await KP({employeeId:A,pin:'4821'});ok('kiosk clock out',[r.status,r.body.ok?.includes('퇴근')],[200,true]);
ok('bad token',(await api(new Request('https://qa.local/api/kiosk?k='+'0'.repeat(48)),env)).status,404);
b=await st('boss');r=await call('boss','/api/store',{action:'kioskLink',branchId:'branch-main',off:true,version:b.version});ok('kiosk off',(await KG()).status,404);
// 009 지각 사유
b=await st('boss');const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
await call('boss','/api/store',{action:'manualAttendance',employeeId:A,start:new Date(Date.now()-3*3600000).toISOString(),end:new Date(Date.now()-2*3600000).toISOString(),breakMinutes:0,reason:'테스트',version:b.version});
b=await st('boss');const rec=b.state.attendance.filter(a=>a.employeeId===A&&a.end).at(-1);
s=await st('amy');ok('staff writes late reason',(await call('amy','/api/store',{action:'lateReason',id:rec.id,reason:'버스 지연',version:s.version})).status,200);
b=await st('boss');ok('reason visible to owner',b.state.attendance.find(a=>a.id===rec.id).lateReason,'버스 지연');
ok('other staff cannot',(await call('far','/api/store',{action:'lateReason',id:rec.id,reason:'x',version:(await st('far')).version})).status,400);
// 010 결근 누적(순수)
{const mod=await import('../dist/server/cron.js');
 const d={store:{name:'결근'},branches:[{id:'b',name:'본점'}],employees:[{id:'e1',name:'가',status:'재직',branchId:'b'}],settings:{absenceAlert:{absent:2,late:0}},
  shifts:[{id:'s1',employeeId:'e1',date:'2026-10-05',start:'09:00',end:'13:00'},{id:'s2',employeeId:'e1',date:'2026-10-06',start:'09:00',end:'13:00'}],attendance:[],_members:[]};
 await env.DB.prepare('INSERT INTO stores(owner,data,version,updated_at) VALUES(?,?,1,?)').bind('ab-owner',JSON.stringify(d),new Date().toISOString()).run();
 const sent=[];await mod.alertSweep(env,Date.parse('2026-10-08T09:05:00+09:00'),(u,m)=>sent.push(u+':'+m.title));
 ok('absence alert at 9am',sent.some(x=>x.startsWith('ab-owner:가님 이번 달 결근 2번')),true);
 const n=sent.length;await mod.alertSweep(env,Date.parse('2026-10-09T09:05:00+09:00'),(u,m)=>sent.push(u+':'+m.title));ok('once a month',sent.slice(n).some(x=>x.includes('결근')),false);
 await env.DB.prepare("DELETE FROM stores WHERE owner='ab-owner'").run();}
console.log('PASS: 키오스크·지각 사유·결근 누적 알림.');
await closeAll();
