// 작업 049: 대타·교대 — 직원끼리 구하고 사장님은 승인만
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function call(user,path,body){const r=await api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'대타 검수',branchName:'본점',ownerName:'가상대표',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;
await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['amy','에이미'],['ben','벤'],['cat','캣'],['far','다른지점']]){
 await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});
 const j=(await call('boss','/api/staff-join')).body;
 await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version});
}
const read=async()=>JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);
const save=d=>q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
let d=await read();const [A,B,C,F]=['amy','ben','cat','far'].map(u=>d._members.find(m=>m.userId===id(u)).employeeId);
d.branches.push({id:'b2',name:'2호점',address:''});d.employees.find(e=>e.id===F).branchId='b2';for(const e of d.employees)e.status='재직';
const day=k=>{const t=new Date(Date.now()+9*3600000+k*86400000);return t.toISOString().slice(0,10)};
d.shifts=[{id:'sa',employeeId:A,date:day(3),start:'09:00',end:'13:00',breakMinutes:0},{id:'sb',employeeId:B,date:day(4),start:'14:00',end:'18:00',breakMinutes:0},{id:'sc',employeeId:C,date:day(3),start:'10:00',end:'12:00',breakMinutes:0},{id:'old',employeeId:A,date:day(-2),start:'09:00',end:'13:00',breakMinutes:0}];
await save(d);
const ops=(u,b)=>call(u,'/api/operations',b&&{...b,version:b.version});
let me=(await ops('amy')).body;
ok('employee sees only own upcoming shifts',me.myShifts.map(s=>s.id),['sa']);
ok('colleagues exclude self and other branch',me.colleagues.map(c=>c.id).sort(),[B,C].sort());
ok('past shift rejected',(await ops('amy',{action:'requestSwap',version:me.version,shiftId:'old',kind:'대타',reason:'일정'})).status,400);
ok('cannot request others shift',(await ops('amy',{action:'requestSwap',version:me.version,shiftId:'sb',kind:'대타',reason:'일정'})).status,403);
let r=await ops('amy',{action:'requestSwap',version:me.version,shiftId:'sa',kind:'대타',reason:'병원 예약'});ok('open 대타 request',r.status,200);let w=r.body.swaps[0];ok('status 구하는 중',w.status,'구하는 중');
ok('duplicate blocked',(await ops('amy',{action:'requestSwap',version:r.body.version,shiftId:'sa',kind:'대타',reason:'또'})).status,409);
ok('other branch cannot see it',(await ops('far')).body.swaps.length,0);
let c=(await ops('cat')).body;ok('overlapping colleague blocked',(await ops('cat',{action:'acceptSwap',version:c.version,id:w.id})).status,409);
ok('requester cannot take own',(await ops('amy',{action:'acceptSwap',version:c.version,id:w.id})).status,400);
let b=(await ops('ben')).body;r=await ops('ben',{action:'acceptSwap',version:b.version,id:w.id});ok('ben accepts',r.status,200);ok('waiting approval',r.body.swaps[0].status,'승인 대기');
ok('employee cannot approve',(await ops('ben',{action:'reviewSwap',version:r.body.version,id:w.id,approve:true})).status,403);
let o=(await ops('boss')).body;r=await ops('boss',{action:'reviewSwap',version:o.version,id:w.id,approve:true,comment:''});ok('owner approves',r.status,200);
d=await read();ok('shift moved to ben',d.shifts.find(s=>s.id==='sa').employeeId,B);ok('audit logged',d._audit.at(-1).action,'대타 승인');
// 교대: 캣이 벤에게 지정 요청 → 벤이 내 근무로 교대 → 승인 시 서로 바뀜
c=(await ops('cat')).body;r=await ops('cat',{action:'requestSwap',version:c.version,shiftId:'sc',kind:'교대',targetId:B,reason:'시험'});ok('targeted 교대',r.status,200);w=r.body.swaps.at(-1);
ok('non-target cannot accept',(await ops('amy',{action:'acceptSwap',version:r.body.version,id:w.id,myShiftId:'x'})).status,403);
b=(await ops('ben')).body;ok('교대 needs my shift',(await ops('ben',{action:'acceptSwap',version:b.version,id:w.id})).status,400);
ok('ben already works sa at overlapping time',(await ops('ben',{action:'acceptSwap',version:b.version,id:w.id,myShiftId:'sb'})).status,409);
// sa(09-13)를 맡은 벤은 sc(10-12)와 겹친다 → sa를 다른 날로 옮겨서 다시
d=await read();d.shifts.find(s=>s.id==='sa').date=day(5);await save(d);
b=(await ops('ben')).body;r=await ops('ben',{action:'acceptSwap',version:b.version,id:w.id,myShiftId:'sb'});ok('ben accepts 교대',r.status,200);
// 승인 전에 근무가 바뀌면 승인 거부
d=await read();d.shifts.find(s=>s.id==='sc').start='10:30';await save(d);
o=(await ops('boss')).body;ok('changed shift cannot be approved',(await ops('boss',{action:'reviewSwap',version:o.version,id:w.id,approve:true})).status,409);
d=await read();d.shifts.find(s=>s.id==='sc').start='10:00';await save(d);
o=(await ops('boss')).body;r=await ops('boss',{action:'reviewSwap',version:o.version,id:w.id,approve:true});ok('owner approves 교대',r.status,200);
d=await read();ok('shifts exchanged',[d.shifts.find(s=>s.id==='sc').employeeId,d.shifts.find(s=>s.id==='sb').employeeId],[B,C]);
// 사장님이 직접 지정, 취소
o=(await ops('boss')).body;r=await ops('boss',{action:'requestSwap',version:o.version,shiftId:'sb',kind:'대타',reason:'인원 조정'});w=r.body.swaps.at(-1);
ok('owner assigns',(await ops('boss',{action:'acceptSwap',version:r.body.version,id:w.id,employeeId:A})).status,200);
o=(await ops('boss')).body;ok('owner cancels',(await ops('boss',{action:'cancelSwap',version:o.version,id:w.id})).body.swaps.at(-1).status,'취소');
d=await read();ok('cancel leaves shift unchanged',d.shifts.find(s=>s.id==='sb').employeeId,C);
console.log('PASS: 대타·교대 요청·수락·승인·충돌 차단.');
await closeAll();
