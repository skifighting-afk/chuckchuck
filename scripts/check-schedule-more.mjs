// 지시서 다음 근무표 묶음: 026 연속·사이 휴식 경고 · 027 예상 인건비 · 028 빈 근무 선착순
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
import {checkShift} from '../lib/schedule-rules.ts';
const E={id:'e1',name:'에이'},S=(id,date,start='09:00',end='18:00')=>({id,employeeId:'e1',date,start,end,breakMinutes:60});
const six=['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-05','2026-09-06'].map((d,i)=>S('s'+i,d));
ok('7th consecutive day warns',checkShift(S('n','2026-09-07'),six,E).some(c=>c.text.includes('7일 연속')),true);
ok('6 days no consecutive warn',checkShift(S('n','2026-09-06'),six.slice(0,5),E).some(c=>c.text.includes('연속')),false);
ok('short rest warns',checkShift(S('n','2026-09-10','06:00','12:00'),[S('a','2026-09-09','14:00','23:00')],E).some(c=>c.text.includes('쉬는 시간이 7시간')),true);
ok('enough rest no warn',checkShift(S('n','2026-09-10','10:00','15:00'),[S('a','2026-09-09','09:00','18:00')],E).some(c=>c.text.includes('쉬는 시간')),false);
ok('8h+ warns only fivePlus',[checkShift(S('n','2026-09-10','09:00','20:00'),[],E,'mon',true).some(c=>c.text.includes('연장수당')),checkShift(S('n','2026-09-10','09:00','20:00'),[],E,'mon',false).some(c=>c.text.includes('연장수당'))],[true,false]);
const st=async(u)=>(await call(u,'/api/store')).body;
let b=await st('boss');const A=b.state.employees.find(e=>e.name==='에이미').id;
const day=new Date(Date.now()+9*3600000+3*86400000).toISOString().slice(0,10);
const open={id:'os1',branchId:'branch-main',date:day,start:'18:00',end:'22:00',breakMinutes:0,status:'모집 중',createdAt:new Date().toISOString()};
let r=await raw('boss','/api/store');b=await r.json();
const put=await api(new Request('https://qa.local/api/store',{method:'PUT',headers:{origin:'https://qa.local','content-type':'application/json',...(await headersFor('boss'))},body:JSON.stringify({state:{...b.state,openShifts:[open]},version:b.version})}),env);
ok('PUT with open shift ok',put.status,200);
b=await st('boss');ok('audit open shift',b.audit.some(x=>x.action==='빈 근무 모집'),true);
let s=await st('amy');ok('staff sees open shift',(s.state.openShifts||[]).length,1);
ok('far branch staff does not see',((await st('far')).state.openShifts||[]).length,0);
ok('far branch staff cannot take',(await call('far','/api/store',{action:'takeOpenShift',id:'os1',version:(await st('far')).version})).status,400);
ok('amy takes open shift',(await call('amy','/api/store',{action:'takeOpenShift',id:'os1',version:s.version})).status,200);
s=await st('amy');ok('shift added to amy',s.state.shifts.some(x=>x.date===day&&x.start==='18:00'),true);
b=await st('boss');ok('owner sees assigned',b.state.openShifts[0].status+':'+b.state.openShifts[0].assignedTo,'배정됨:'+A);
ok('second take refused',(await call('amy','/api/store',{action:'takeOpenShift',id:'os1',version:s.version})).status,400);
console.log('PASS: 근무표 경고·빈 근무 선착순.');
await closeAll();
