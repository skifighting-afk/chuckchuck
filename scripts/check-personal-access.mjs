import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env,DB=env.DB;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function call(user,path='/api/store',body,method){const r=await api(new Request('https://qa.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'개인 화면 검수',branchName:'본점',ownerName:'가상대표',plan:'multi',storeSlots:2,acknowledged:true,dpaAgreed:true});
const owner=(await call('boss')).body;
await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:owner.version});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['self','본인검수'],['peer','타인검수'],['foreign','다른지점검수']]){
 await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});
 const j=(await call('boss','/api/staff-join')).body;
 await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,version:j.version});
}
const read=async()=>JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);
const save=d=>q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
let d=await read();const [a,b,c]=['self','peer','foreign'].map(u=>d._members.find(m=>m.userId===id(u)).employeeId);
d.branches.push({id:'foreign-branch',name:'다른지점검수',address:''});d.employees.find(e=>e.id===c).branchId='foreign-branch';
for(const e of d.employees){e.status='재직';e.notes='사장전용메모';e.wage=13000;}
d.shifts=[a,b,c].map((id,i)=>({id:'shift-'+i,employeeId:id,date:'2026-09-23',start:'09:00',end:'18:00',breakMinutes:60}));
d.attendance=[a,b,c].map((id,i)=>({id:'attendance-'+i,employeeId:id,start:'2026-09-23T00:00:00.000Z',end:'2026-09-23T09:00:00.000Z',breakMinutes:60,breakStart:null}));
d.requests=d.attendance.map((row,i)=>({id:'request-'+i,before:row,after:{...row,end:'2026-09-23T09:30:00.000Z'},actor:{id:['self','peer','foreign'][i],name:['본인検수','타인검수','다른지점검수'][i]},reason:'시간 정정',status:'승인 대기'}));
d.adjustments=Object.fromEntries([a,b,c].map(id=>['2026-09:'+id,{earnings:[],deductions:[],note:'개별 조정'}]));
const payRows=d.employees.map(e=>({employeeId:e.id,name:e.name,net:104000,gross:104000,deduction:0,earnings:[],deductions:[]}));
d.payrollRuns={'2026-09:branch-main':{month:'2026-09',branch:'branch-main',locked:true,payDate:'2026-09-25',rows:payRows,actor:{name:'사장내부정보'},extra:'타인검수'},draft:{month:'2026-10',branch:'branch-main',locked:false,rows:payRows}};
d.legacy={employees:d.employees};d.settings.accountantEmail='private-accountant@example.invalid';
d._operations={leaves:d.employees.map((e,i)=>({id:'leave-'+i,employeeId:e.id,name:e.name,status:'승인 대기'})),notices:[{id:'n1',title:'본점 공지',body:'내 매장 공지',branchId:'branch-main',reads:[],author:'대표'},{id:'n2',title:'전체 공지',body:'전체 매장 공지',branchId:'all',reads:[],author:'대표'},{id:'n3',title:'다른지점검수',body:'비공개',branchId:'foreign-branch',reads:[],author:'대표'}]};
await save(d);
let self=(await call('self')).body;
ok('employee record contains only self',self.state.employees.map(e=>e.id),[a]);
ok('own schedule retained, colleagues excluded',self.state.shifts.map(s=>s.employeeId),[a]);
ok('own attendance retained',self.state.attendance.map(s=>s.employeeId),[a]);
ok('own request retained',self.state.requests.map(s=>s.before.employeeId),[a]);
ok('own wage adjustments only',Object.keys(self.state.adjustments),['2026-09:'+a]);
ok('own confirmed payslip retained',self.state.payrollRuns['2026-09:branch-main'].rows.map(r=>r.employeeId),[a]);
ok('unconfirmed payroll hidden',!self.state.payrollRuns.draft);
ok('private payroll metadata omitted',!self.state.payrollRuns['2026-09:branch-main'].extra);
ok('legacy and internal notes omitted',!self.state.legacy&&self.state.employees[0].notes==='');
ok('other employee identities absent from complete response',!JSON.stringify(self).includes(b)&&!JSON.stringify(self).includes(c)&&!JSON.stringify(self).includes('타인검수'));
ok('accountant information and owner audit absent',!JSON.stringify(self).includes('private-accountant')&&self.audit.length===0&&self.outbox.length===0);
const forged=(await call('self','/api/store?role=owner&selfId='+b+'&employeeId='+b+'&branch=foreign-branch')).body;
ok('query parameters cannot change identity',forged.state.employees.map(e=>e.id),[a]);
ok('anonymous access blocked',(await call('')).status,401);
ok('employee cannot read manager endpoint',(await call('self','/api/manager')).status,403);
ok('employee cannot change another clock record',(await call('self','/api/store',{action:'attendance',employeeId:b,kind:'in',version:self.version})).status,403);
ok('employee cannot request another record correction',(await call('self','/api/store',{action:'request',id:'attendance-1',version:self.version})).status,403);
ok('employee cannot replace store state',(await call('self','/api/store',{state:self.state,version:self.version},'PUT')).status,403);
const ops=(await call('self','/api/operations')).body;
ok('leave portal contains own employee only',ops.employees.map(e=>e.id),[a]);
ok('leave portal contains own leave only',ops.leaves.map(l=>l.employeeId),[a]);
ok('own-branch and whole-store notices remain',ops.notices.map(x=>x.id),['n1','n2']);
ok('owner retains all staff',(await call('boss')).body.state.employees.length,3);
ok('owner retains all schedules',(await call('boss')).body.state.shifts.length,3);
// Check the same projection after a successful write, not just the GET path.
d=await read();d.payrollRuns={};d.requests=[];d._attendanceQr={'branch-main':'synthetic-qr'};await save(d);
self=(await call('self')).body;
const clock=await call('self','/api/store',{action:'attendance',employeeId:a,kind:'in',qrToken:'synthetic-qr',version:self.version});
ok('own QR attendance still records',clock.status,200);
ok('mutation response also excludes colleagues',clock.body.state.employees.map(e=>e.id),[a]);
// Personal manager screens are own-only; delegated branch work stays separate.
d=await read();d.employees.find(e=>e.id===a).access='중간관리자';d.employees.find(e=>e.id===a).managerPermissions=['schedule'];await save(d);
const personalManager=(await call('self')).body;
ok('manager personal view stays own-only',personalManager.state.employees.map(e=>e.id),[a]);
const manager=(await call('self','/api/manager')).body;
ok('delegated manager sees assigned branch schedules',manager.shifts.map(s=>s.employeeId).sort(),[a,b].sort());
ok('delegated manager cannot see foreign branch',!JSON.stringify(manager).includes(c));
ok('manager has no other employee pay data',!JSON.stringify(manager).includes('wage'));
ok('manager personal endpoint cannot correct colleague',(await call('self','/api/store',{action:'request',id:'attendance-1',version:personalManager.version})).status,403);
d=await read();d.employees.find(e=>e.id===a).managerPermissions=[];await save(d);
ok('revoked schedule permission removes branch schedules',(await call('self','/api/manager')).body.shifts,[]);
// 작업 059: 모든 서버 경로 전수 점검 — 직원·외부인·익명이 남의 개인정보를 받지 못하고, 사장님 전용 동작을 못 한다.
{
 d=await read();const peerEmp=d.employees.find(e=>e.id===b);peerEmp.phone='010-PEER-0000';peerEmp.address='타인주소비밀';peerEmp.wage=77777;peerEmp.email='peer-secret@example.invalid';await save(d);
 await call('stranger','/api/account',{action:'onboard',storeName:'남의가게',branchName:'본점',ownerName:'남사장',plan:'free',acknowledged:true,dpaAgreed:true});
 const secrets=['010-PEER-0000','타인주소비밀','peer-secret@example.invalid','사장전용메모','private-accountant@example.invalid','사장내부정보',b,c];
 const routes=['/api/store','/api/account','/api/operations','/api/documents','/api/documents?kind=payslip','/api/contracts','/api/manager','/api/staff-join','/api/evidence?leave=leave-1','/api/evidence?leave=leave-0','/api/admin','/api/auth','/api/join'];
 for(const route of routes){
  const anon=await call('',route);
  if(route!=='/api/auth')ok(`anonymous blocked: ${route}`,[401,403,404,405].includes(anon.status));
  for(const who of ['self','stranger','outsider']){
   const r=await call(who,route);const text=JSON.stringify(r.body);
   // 위임받은 매니저는 같은 지점 직원의 이름·ID만 받는다(근무표 배정용). 연락처·주소·임금·다른 지점 직원은 안 된다.
   const allowed=route==='/api/manager'&&who==='self'?[b]:[];
   ok(`${who} sees no colleague secrets: ${route}`,secrets.filter(x=>text.includes(x)&&!allowed.includes(x)),[]);
  }
 }
 const ownerOnly=[['/api/store',{action:'finalize',month:'2026-10',branch:'branch-main',payDate:'2026-10-25'}],['/api/store',{action:'reopen',key:'2026-09:branch-main',reason:'x'}],['/api/store',{action:'invite',id:b}],['/api/store',{action:'attendanceQr',branchId:'branch-main'}],['/api/staff-join',{action:'code',branchId:'branch-main'}],['/api/documents',{action:'send',runKey:'2026-09:branch-main',employeeId:b}],['/api/account',{action:'changePlan',plan:'multi'}],['/api/contracts',{action:'create',employeeId:b,text:'x'.repeat(300),consent:true,name:'x'}]];
 for(const [route,body] of ownerOnly){
  // 직원(self)은 사장님 전용 동작을 못 한다. 다른 가게 사장님(stranger)은 자기 가게 설정은 바꿀 수 있지만, 이 가게의 직원·급여를 건드리는 동작은 실패해야 한다.
  const targetsThisStore=JSON.stringify(body).includes(b)||JSON.stringify(body).includes('2026-09:branch-main');
  for(const who of targetsThisStore?['self','stranger']:['self']){const r=await call(who,route,body);ok(`${who} cannot run owner action ${body.action} on ${route}`,r.status>=400);}
 }
 const after=JSON.stringify(await read());ok('owner data unchanged by refused actions',after.includes('010-PEER-0000')&&!after.includes('"locked":true,"month":"2026-10"'));
}
// 작업 071: 데이터 내보내기 — 사장님만, 내부 비밀값 제외
{
 const r=await api(new Request('https://qa.local/api/export',{headers:{origin:'https://qa.local',...(await headersFor('boss'))}}),env);
 ok('owner can export store data',r.status,200);
 const exp=await r.json();
 ok('export has store, contracts, payslips',!!exp.store&&Array.isArray(exp.contracts)&&Array.isArray(exp.payslips));
 ok('export omits QR tokens and invite hashes',!('_attendanceQr' in exp.store)&&!('_invitations' in exp.store));
 ok('export filename is set',/attachment; filename="chukchuk-export-\d{4}-\d{2}-\d{2}\.json"/.test(r.headers.get('content-disposition')));
 for(const who of ['self','stranger','outsider','']){const x=await api(new Request('https://qa.local/api/export',{headers:{origin:'https://qa.local',...(await headersFor(who))}}),env);ok(`${who||'anonymous'} cannot export this store`,x.status===200?!JSON.stringify(await x.json()).includes('010-PEER-0000'):true);}
}
d=await read();d.employees.find(e=>e.id===a).status='퇴사';await save(d);
ok('retired employee loses personal access',(await call('self')).status,403);
console.log(`${n}/${n} personal access checks passed`);
await closeAll();
