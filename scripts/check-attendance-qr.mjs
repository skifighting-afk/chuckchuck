import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
// Each synthetic request happens one second later, rather than depending on machine speed.
const RealDate=Date;let clock=RealDate.now();globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
const {env,headersFor}=await authedTest();
async function call(user,route,body,method){clock+=1000;const r=await api(new Request('https://qa.local'+route,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
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

let employee=(await call('staff','/api/store')).data;
const attendance=async(kind,qrToken,user='staff')=>{const d=(await call(user,'/api/store')).data;return call(user,'/api/store',{action:'attendance',kind,employeeId:eid,qrToken,version:d.version})};
test('clock in without QR blocked',(await attendance('in')).data.code==='QR_REQUIRED');
state=await get();let issued=await call('owner','/api/store',{action:'attendanceQr',branchId:'branch-main',version:state.version});
test('owner issues store QR',issued.status===200&&!!issued.data.attendanceQrUrl);
const token=new URL(issued.data.attendanceQrUrl).searchParams.get('attendanceQr');
employee=(await call('staff','/api/store')).data;
test('employee cannot fetch QR secret',!JSON.stringify(employee).includes(token));
test('employee cannot issue QR',(await call('staff','/api/store',{action:'attendanceQr',branchId:'branch-main',version:employee.version})).status===403);
test('forged QR blocked',(await attendance('in','invalid')).status===403);
state=await get();const foreign=await call('owner','/api/store',{action:'attendanceQr',branchId:'b2',version:state.version});
const other=new URL(foreign.data.attendanceQrUrl).searchParams.get('attendanceQr');
test('other branch QR blocked',(await attendance('in',other)).status===403);
test('valid QR clock in',(await attendance('in',token)).status===200);
test('duplicate in blocked',(await attendance('in',token)).status===400);
test('clock out without QR blocked',(await attendance('out')).data.code==='QR_REQUIRED');
test('break does not require QR',(await attendance('break')).status===200);
test('resume does not require QR',(await attendance('resume')).status===200);
state=await get();test('normal save preserves QR',(await call('owner','/api/store',state,'PUT')).status===200);
test('valid QR clock out',(await attendance('out',token)).status===200);
state=await get();issued=await call('owner','/api/store',{action:'attendanceQr',branchId:'branch-main',version:state.version});
test('reopening QR keeps printed token',new URL(issued.data.attendanceQrUrl).searchParams.get('attendanceQr')===token);
state=await get();issued=await call('owner','/api/store',{action:'attendanceQr',branchId:'branch-main',rotate:true,version:state.version});
test('rotation invalidates old QR',(await attendance('in',token)).status===403);
test('rotated QR works',(await attendance('in',new URL(issued.data.attendanceQrUrl).searchParams.get('attendanceQr'))).status===200);
test('owner manual correction path retained',(await attendance('out',undefined,'owner')).status===200);
console.log(`${n-failures}/${n} passed`);if(failures)process.exitCode=1;
globalThis.Date=RealDate;await closeAll();
