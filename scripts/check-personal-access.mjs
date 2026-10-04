import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {api} from '../dist/server/index.js';
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE stores(owner TEXT PRIMARY KEY,data TEXT,version INTEGER,updated_at TEXT)');
const DB={prepare(sql){let args=[];return{bind(...a){args=a;return this},async first(){return db.prepare(sql).get(...args)},async all(){return{results:db.prepare(sql).all(...args)}},async run(){return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}};
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function call(user,path='/api/store',body,method){const r=await api(new Request('https://qa.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.invalid'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB});return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'개인 화면 검수',branchName:'본점',ownerName:'가상대표',plan:'multi',storeSlots:2,acknowledged:true});
const owner=(await call('boss')).body;
await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:owner.version});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['self','본인검수'],['peer','타인검수'],['foreign','다른지점검수']]){
 await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});
 const j=(await call('boss','/api/staff-join')).body;
 await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,version:j.version});
}
const read=()=>JSON.parse(db.prepare('SELECT data FROM stores WHERE owner=?').get('boss').data);
const save=d=>db.prepare('UPDATE stores SET data=?,version=version+1 WHERE owner=?').run(JSON.stringify(d),'boss');
let d=read();const [a,b,c]=['self','peer','foreign'].map(u=>d._members.find(m=>m.userId===u).employeeId);
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
save(d);
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
d=read();d.payrollRuns={};d.requests=[];d._attendanceQr={'branch-main':'synthetic-qr'};save(d);
self=(await call('self')).body;
const clock=await call('self','/api/store',{action:'attendance',employeeId:a,kind:'in',qrToken:'synthetic-qr',version:self.version});
ok('own QR attendance still records',clock.status,200);
ok('mutation response also excludes colleagues',clock.body.state.employees.map(e=>e.id),[a]);
// Personal manager screens are own-only; delegated branch work stays separate.
d=read();d.employees.find(e=>e.id===a).access='중간관리자';d.employees.find(e=>e.id===a).managerPermissions=['schedule'];save(d);
const personalManager=(await call('self')).body;
ok('manager personal view stays own-only',personalManager.state.employees.map(e=>e.id),[a]);
const manager=(await call('self','/api/manager')).body;
ok('delegated manager sees assigned branch schedules',manager.shifts.map(s=>s.employeeId).sort(),[a,b].sort());
ok('delegated manager cannot see foreign branch',!JSON.stringify(manager).includes(c));
ok('manager has no other employee pay data',!JSON.stringify(manager).includes('wage'));
ok('manager personal endpoint cannot correct colleague',(await call('self','/api/store',{action:'request',id:'attendance-1',version:personalManager.version})).status,403);
d=read();d.employees.find(e=>e.id===a).managerPermissions=[];save(d);
ok('revoked schedule permission removes branch schedules',(await call('self','/api/manager')).body.shifts,[]);
d=read();d.employees.find(e=>e.id===a).status='퇴사';save(d);
ok('retired employee loses personal access',(await call('self')).status,403);
console.log(`${n}/${n} personal access checks passed`);
