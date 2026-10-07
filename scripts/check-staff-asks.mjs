// 지시서 104·105·106: 증명서 요청·명세서 문의·정보 변경 요청(직원) → 사장님 처리
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
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';


const A=d._members.find(m=>m.userId===id('amy')).employeeId;
const st=async(u)=>(await call(u,'/api/store')).body;
let s=await st('amy');ok('pay question needs month/message',(await call('amy','/api/store',{action:'staffAsk',type:'pay',month:'x',message:'',version:s.version})).status,400);
ok('staff sends pay question',(await call('amy','/api/store',{action:'staffAsk',type:'pay',month:'2026-09',item:'기본급',message:'근무 하루 빠짐',version:s.version})).status,200);
s=await st('amy');ok('staff sends profile change',(await call('amy','/api/store',{action:'staffAsk',type:'profile',changes:{phone:'010-1111-2222',bankName:'국민',bankAccount:'123-45',role:'매니저'},version:s.version})).status,200);
s=await st('amy');ok('staff sees only own asks',s.state.staffAsks.length,2);
ok('profile change ignores non-allowed fields',Object.keys(s.state.staffAsks[1].changes).sort().join(),'bankAccount,bankName,phone');
let b=await st('boss');const prof=b.state.staffAsks.find(x=>x.type==='profile'),pq=b.state.staffAsks.find(x=>x.type==='pay');
ok('staff cannot answer',(await call('amy','/api/store',{action:'answerAsk',id:pq.id,answer:'x',version:s.version})).status,403);
ok('owner applies profile change',(await call('boss','/api/store',{action:'answerAsk',id:prof.id,apply:true,answer:'바꿨어요',version:b.version})).status,200);
b=await st('boss');ok('member updated',[b.state.employees.find(e=>e.id===A).phone,b.state.employees.find(e=>e.id===A).bankName],['010-1111-2222','국민']);
ok('owner must write answer for pay question',(await call('boss','/api/store',{action:'answerAsk',id:pq.id,answer:'',version:b.version})).status,400);
ok('owner answers pay question',(await call('boss','/api/store',{action:'answerAsk',id:pq.id,answer:'다시 확정할게요',version:b.version})).status,200);
s=await st('amy');ok('staff sees answer',s.state.staffAsks.find(x=>x.type==='pay').answer,'다시 확정할게요');
ok('certificate request',(await call('amy','/api/store',{action:'requestCertificate',kind:'재직',purpose:'은행',version:s.version})).status,200);
s=await st('amy');ok('one certificate request a day',(await call('amy','/api/store',{action:'requestCertificate',kind:'재직',version:s.version})).status,400);
s=await st('amy');ok('offline clock needs valid time',(await call('amy','/api/store',{action:'staffAsk',type:'clock',kind:'in',at:'2020-01-01T00:00:00Z',version:s.version})).status,400);
ok('offline clock queued as ask',(await call('amy','/api/store',{action:'staffAsk',type:'clock',kind:'in',at:new Date(Date.now()-3600000).toISOString(),version:s.version})).status,200);
b=await st('boss');const ck=b.state.staffAsks.find(x=>x.type==='clock');ok('owner approves offline clock',(await call('boss','/api/store',{action:'answerAsk',id:ck.id,apply:true,answer:'확인',version:b.version})).status,200);
b=await st('boss');ok('attendance created at saved time',b.state.attendance.some(a=>a.employeeId===A&&a.start===ck.clockAt&&!a.end),true);
console.log('PASS: 직원 요청(명세서 문의·정보 변경·증명서).');
await closeAll();
