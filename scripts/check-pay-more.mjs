// 지시서 다음 급여 묶음: 037 가불·선지급 차감 · 036 주급 기간
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
import {calculate} from '../dist/server/team-model.js';
const st=async(u)=>(await call(u,'/api/store')).body;
let b=await st('boss');const A=b.state.employees.find(e=>e.name==='에이미').id;
const month=new Date(Date.now()+9*3600000).toISOString().slice(0,7),d1=month+'-01';
const put=async(state,version)=>api(new Request('https://qa.local/api/store',{method:'PUT',headers:{origin:'https://qa.local','content-type':'application/json',...(await headersFor('boss'))},body:JSON.stringify({state,version})}),env);
const base=calculate(b.state,month).find(r=>r.employeeId===A);
const adv={id:'adv1',employeeId:A,date:d1,amount:50000,kind:'가불',note:'요청'};
let r=await put({...b.state,advances:[adv]},b.version);ok('owner records advance',r.status,200);
b=await st('boss');ok('advance audit',b.audit.some(x=>x.action==='가불·선지급 기록'),true);
const after=calculate(b.state,month).find(r=>r.employeeId===A);
ok('advance becomes deduction',after.deductions.find(d=>d.name==='가불·선지급')?.amount,50000);ok('net reduced',base.net-after.net,50000);
let s=await st('amy');ok('staff sees own advance without author',[s.state.advances.length,'by' in s.state.advances[0]],[1,false]);
// 확정된 달은 바꿀 수 없다
b=await st('boss');const runs={...b.state.payrollRuns,[month+':branch-main']:{locked:true,month,branch:'branch-main',payDate:month+'-25',rows:[{employeeId:A}],at:new Date().toISOString(),revision:1}};
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);d.payrollRuns=runs;await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
b=await st('boss');r=await put({...b.state,advances:[]},b.version);ok('locked month advance cannot be removed',r.status,400);
r=await put({...b.state,advances:[adv,{...adv,id:'adv2',amount:1000}]},b.version);ok('locked month advance cannot be added',r.status,400);
console.log('PASS: 가불·선지급.');
await closeAll();
