import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {api} from '../dist/server/index.js';
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE stores(owner TEXT PRIMARY KEY,data TEXT,version INTEGER,updated_at TEXT)');
const DB={prepare(sql){let a=[];return {bind(...v){a=v;return this},async first(){return db.prepare(sql).get(...a)},async all(){return {results:db.prepare(sql).all(...a)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...a).changes)}}}}}};
async function call(user,route,body,method){const r=await api(new Request('https://qa.local'+route,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local','oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.invalid'},...(body?{body:JSON.stringify(body)}:{})}),{DB});return {status:r.status,data:await r.json()}}
let failures=0,n=0;function test(name,value){n++;console.log(`${value?'PASS':'FAIL'} ${n}. ${name}`);if(!value)failures++;}
await call('owner','/api/account',{action:'onboard',storeName:'검수',branchName:'본점',ownerName:'대표',plan:'multi',storeSlots:2,acknowledged:true});
let state=(await call('owner','/api/store')).data;
// Use real join API for a linked synthetic employee.
await call('owner','/api/staff-join',{action:'code',branchId:'branch-main',version:state.version});
let j=(await call('owner','/api/staff-join')).data;
await call('staff','/api/staff-join',{action:'apply',code:j.codes[0].code,name:'가상직원',phone:'01000000000'});
j=(await call('owner','/api/staff-join')).data;await call('owner','/api/staff-join',{action:'review',id:j.requests[0].id,approve:true,version:j.version});
const get=async()=> (await call('owner','/api/store')).data;
state=await get();const eid=state.state.employees[0].id;
state.state.branches.push({id:'b2',name:'두번째',address:''});
test('branch save',(await call('owner','/api/store',state,'PUT')).status===200);
state=await get();const bad=structuredClone(state);bad.state.shifts.push({id:'bad',employeeId:eid,date:'2026-02-31',start:'09:00',end:'18:00',breakMinutes:60});
test('impossible schedule date rejected',(await call('owner','/api/store',bad,'PUT')).status===400);
// Restore isolated fixture directly between invalid-payload cases.
let raw=JSON.parse(db.prepare('SELECT data FROM stores').get().data);raw.shifts=[];db.prepare('UPDATE stores SET data=?').run(JSON.stringify(raw));
state=await get();test('impossible payroll paydate rejected',(await call('owner','/api/store',{action:'finalize',month:'2026-09',branch:'branch-main',payDate:'2026-02-31',version:state.version})).status===400);
raw=JSON.parse(db.prepare('SELECT data FROM stores').get().data);raw.payrollRuns={'2026-09:b2':{month:'2026-09',branch:'b2',locked:true,payDate:'2026-09-25',rows:[],at:'2026-09-23T00:00:00Z'},'2026-09:branch-main':{month:'2026-09',branch:'branch-main',locked:true,payDate:'2026-09-25',rows:[{employeeId:eid,name:'가상직원',net:100,gross:100,deduction:0,earnings:[],deductions:[]}],at:'2026-09-23T00:00:00Z'}};
db.prepare('UPDATE stores SET data=?').run(JSON.stringify(raw));
let staff=(await call('staff','/api/store')).data;
test('unrelated branch payroll metadata absent',!staff.state.payrollRuns['2026-09:b2']);
test('own confirmed payslip preserved',staff.state.payrollRuns['2026-09:branch-main']?.rows[0]?.net===100);
raw.payrollRuns={};raw.employees[0].status='퇴사';db.prepare('UPDATE stores SET data=?').run(JSON.stringify(raw));
state=await get();test('retired employee clock in blocked',(await call('owner','/api/store',{action:'attendance',employeeId:eid,kind:'in',version:state.version})).status===400);
test('retired account denied',(await call('staff','/api/store')).status===403);
console.log(`${n-failures}/${n} passed`);if(failures)process.exitCode=1;
