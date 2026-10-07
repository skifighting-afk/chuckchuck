// 지시서 다음 프랜차이즈·보안 묶음: 093 지원 근무 배분 · 096 준수 현황 · 094·095 여러 가게 · 099 휴지통 · 084 카카오톡 비서 · 098 로그인 기록
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid',env:{KAKAO_SKILL_KEY:'k-test'}}),{q,headersFor,id}=T,env=T.env;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function raw(user,path,body){return api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function call(user,path,body){const r=await raw(user,path,body);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'매뉴얼 검수',branchName:'본점',ownerName:'가상대표',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['amy','에이미'],['far','다른지점']]){await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});const j=(await call('boss','/api/staff-join')).body;await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version});}
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);const F=d._members.find(m=>m.userId===id('far')).employeeId;d.branches.push({id:'b2',name:'2호점',address:''});d.employees.find(e=>e.id===F).branchId='b2';await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
import {branchAllocation,branchCompliance} from '../lib/branch-support.ts';
const emps=[{id:'a',name:'가',branchId:'b1',status:'재직',contract:{status:'체결 완료'}},{id:'c',name:'다',branchId:'b1',status:'재직',contract:{status:'작성 전'},healthCertUntil:'2026-10-10',birthMonth:'2010-01'}];
const sh=[{id:'s1',employeeId:'a',date:'2026-09-02',start:'09:00',end:'13:00',branchId:'b2'}];
const att=[{employeeId:'a',start:'2026-09-01T00:00:00Z',end:'2026-09-01T04:00:00Z',breakMinutes:0},{employeeId:'a',start:'2026-09-02T00:00:00Z',end:'2026-09-02T04:00:00Z',breakMinutes:0}];
const al=branchAllocation(emps,sh,att,'2026-09',{a:100000});
ok('support hours split',[al.b1.own,al.b1.supportOut,al.b2.supportIn],[4,4,4]);ok('cost split by hours',[al.b1.cost,al.b2.cost],[50000,50000]);
const c=branchCompliance('b1',emps,{today:'2026-10-01',lastRun:{rows:[{employeeId:'a'},{employeeId:'c'}],sent:1},published:false});
ok('compliance numbers',[c.contractRate,c.unsigned,c.payslipRate,c.health,c.minorsMissing,c.published],[50,1,50,1,1,false]);
const st=async(u)=>(await call(u,'/api/store')).body;
const put=async(state,version)=>api(new Request('https://qa.local/api/store',{method:'PUT',headers:{origin:'https://qa.local','content-type':'application/json',...(await headersFor('boss'))},body:JSON.stringify({state,version})}),env);
// 099 휴지통
let b=await st('boss');const A=b.state.employees.find(e=>e.name==='에이미').id;
const day=new Date(Date.now()+9*3600000+5*86400000).toISOString().slice(0,10);
let r=await put({...b.state,shifts:[...b.state.shifts,{id:'tr1',employeeId:A,date:day,start:'10:00',end:'14:00',breakMinutes:0}]},b.version);ok('add shift',r.status,200);
b=await st('boss');r=await put({...b.state,shifts:b.state.shifts.filter(x=>x.id!=='tr1')},b.version);ok('delete shift',r.status,200);
b=await st('boss');const t=b.trash.find(x=>x.kind==='shift');ok('deleted shift in trash',!!t&&t.label.includes(day),true);
ok('staff sees no trash','trash' in (await st('amy')),false);
r=await call('boss','/api/store',{action:'restore',id:t.id,version:b.version});ok('restore shift',r.status,200);
b=await st('boss');ok('shift back, trash empty',[b.state.shifts.some(x=>x.id==='tr1'),b.trash.some(x=>x.id===t.id)],[true,false]);
ok('restore twice fails',(await call('boss','/api/store',{action:'restore',id:t.id,version:b.version})).status,400);
// 094·095 여러 가게
let ms=(await call('boss','/api/multi-store')).body;ok('owner sees own store',ms.stores.length,1);
ok('not my store refused',(await call('boss','/api/multi-store',{action:'notice',targets:['someone-else'],title:'x',body:'y'})).status,400);
r=await call('boss','/api/multi-store',{action:'notice',targets:[ms.stores[0].owner],title:'본사 공지',body:'위생 점검 주간'});ok('broadcast to own store',[r.status,r.body.done.length],[200,1]);
const ops=(await call('amy','/api/operations')).body;ok('staff sees HQ notice',(ops.notices||[]).some(n=>n.title==='본사 공지'&&n.author==='본사'),true);
ok('staff cannot broadcast',(await call('amy','/api/multi-store',{action:'notice',targets:[ms.stores[0].owner],title:'x',body:'y'})).status,400);
// 084 카카오톡 비서
const K=(body,key='k-test')=>api(new Request('https://qa.local/api/kakao-skill',{method:'POST',headers:{'content-type':'application/json','x-skill-key':key},body:JSON.stringify(body)}),env).then(async r=>({status:r.status,body:await r.json()}));
const txt=r=>r.body.template?.outputs?.[0]?.simpleText?.text||'';
ok('wrong skill key',(await K({userRequest:{user:{id:'k1'},utterance:'안녕'}},'nope')).status,403);
ok('unlinked asks to link',txt(await K({userRequest:{user:{id:'k1'},utterance:'오늘 누가 근무해?'}})).includes('연결'),true);
const kc=(await call('boss','/api/kakao-skill?link=1',{action:'code'})).body.code;ok('code is 6 digits',/^\d{6}$/.test(kc),true);
ok('bad code',txt(await K({userRequest:{user:{id:'k1'},utterance:'연결 000000'}})).includes('맞지 않거나'),true);
ok('link with code',txt(await K({userRequest:{user:{id:'k1'},utterance:'연결 '+kc}})).includes('연결했어요'),true);
ok('code single use',txt(await K({userRequest:{user:{id:'k2'},utterance:'연결 '+kc}})).includes('맞지 않거나'),true);
const ans=await K({userRequest:{user:{id:'k1'},utterance:'오늘 누가 근무해?'}});ok('linked answers',[ans.status,txt(ans).length>0],[200,true]);
ok('status linked',(await call('boss','/api/kakao-skill?link=1',{action:'status'})).body.linked,true);
const ac=(await call('amy','/api/kakao-skill?link=1',{action:'code'})).body.code;ok('staff link answers staff-only',txt(await K({userRequest:{user:{id:'k3'},utterance:'연결 '+ac}})).includes('연결했어요')&&txt(await K({userRequest:{user:{id:'k3'},utterance:'인건비'}})).includes('사장님 계정만'),true);
console.log('PASS: 지원 근무·준수 현황·여러 가게·휴지통·카카오톡 비서.');
await closeAll();
