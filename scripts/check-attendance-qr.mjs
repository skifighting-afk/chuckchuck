import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
// Each synthetic request happens one second later, rather than depending on machine speed.
const RealDate=Date;let clock=RealDate.now();globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
const {env,headersFor}=await authedTest();
async function call(user,route,body,method){clock+=1000;const r=await api(new Request('https://qa.local'+route,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
let failures=0,n=0;function test(name,value){n++;console.log(`${value?'PASS':'FAIL'} ${n}. ${name}`);if(!value)failures++;}
await call('owner','/api/account',{action:'onboard',storeName:'검수',branchName:'본점',ownerName:'대표',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
let state=(await call('owner','/api/store')).data;
// Use real join API for a linked synthetic employee.
await call('owner','/api/staff-join',{action:'code',branchId:'branch-main',version:state.version});
let j=(await call('owner','/api/staff-join')).data;
await call('staff','/api/staff-join',{action:'apply',code:j.codes[0].code,name:'가상직원',phone:'01000000000'});
j=(await call('owner','/api/staff-join')).data;await call('owner','/api/staff-join',{action:'review',id:j.requests[0].id,approve:true,payType:'시급',wage:10320,version:j.version});
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
{const stale=(await call('staff','/api/store')).data.version;state=await get();await call('owner','/api/store',{action:'attendanceQr',branchId:'b2',version:state.version});
 test('출퇴근은 화면 버전이 오래돼도 기록됨(동시에 여러 직원이 찍는 경우)',(await call('staff','/api/store',{action:'attendance',kind:'in',employeeId:eid,qrToken:token,version:stale})).status===200);
 test('다른 작업은 오래된 버전이면 여전히 막힘',(await call('owner','/api/store',{action:'attendanceQr',branchId:'b2',version:stale})).status===409);}
test('duplicate in blocked',(await attendance('in',token)).status===400);
test('duplicate in blocked',(await attendance('in',token)).status===400);
test('clock out without QR blocked',(await attendance('out')).data.code==='QR_REQUIRED');
test('휴게 시작도 QR 필요(눌러 놓고 잊는 일 막기)',(await attendance('break')).data.code==='QR_REQUIRED');
test('QR 찍고 휴게 시작',(await attendance('break',token)).status===200);
test('휴게 끝도 QR 필요',(await attendance('resume')).data.code==='QR_REQUIRED');
test('QR 찍고 휴게 끝',(await attendance('resume',token)).status===200);
state=await get();test('normal save preserves QR',(await call('owner','/api/store',state,'PUT')).status===200);
test('valid QR clock out',(await attendance('out',token)).status===200);
state=await get();issued=await call('owner','/api/store',{action:'attendanceQr',branchId:'branch-main',version:state.version});
test('reopening QR keeps printed token',new URL(issued.data.attendanceQrUrl).searchParams.get('attendanceQr')===token);
state=await get();issued=await call('owner','/api/store',{action:'attendanceQr',branchId:'branch-main',rotate:true,version:state.version});
test('rotation invalidates old QR',(await attendance('in',token)).status===403);
test('rotated QR works',(await attendance('in',new URL(issued.data.attendanceQrUrl).searchParams.get('attendanceQr'))).status===200);
// 작업 044: 30초마다 바뀌는 QR
const rotated=new URL(issued.data.attendanceQrUrl).searchParams.get('attendanceQr');
state=await get();let dyn=await call('owner','/api/store',{action:'attendanceQr',branchId:'branch-main',mode:'dynamic',version:state.version});test('owner turns on moving QR',dyn.status===200&&dyn.data.qrModes['branch-main']==='dynamic');
test('employee cannot open live QR',(await call('staff','/api/qr-live?branch=branch-main')).status===403);
test('live QR not available for static branch',(await call('owner','/api/qr-live?branch=b2')).status===409);
let live=(await call('owner','/api/qr-live?branch=branch-main')).data;const liveToken=new URL(live.url).searchParams.get('attendanceQr');test('live token shape',/^L\.\d+\.[0-9a-f]{20}$/.test(liveToken)&&live.expiresIn>0&&live.expiresIn<=30);
test('printed QR rejected in moving mode',(await attendance('out',rotated)).status===403);
test('forged live token rejected',(await attendance('out',liveToken.slice(0,-1)+(liveToken.endsWith('0')?'1':'0'))).status===403);
test('live token works right away',(await attendance('out',liveToken)).status===200);
clock+=90000;test('live token photographed 90s ago rejected',(await attendance('in',liveToken)).status===403);
live=(await call('owner','/api/qr-live?branch=branch-main')).data;test('fresh live token works',(await attendance('in',new URL(live.url).searchParams.get('attendanceQr'))).status===200);
state=await get();await call('owner','/api/store',{action:'attendanceQr',branchId:'branch-main',mode:'static',version:state.version});
test('back to printed QR',(await attendance('out',rotated)).status===200);
await attendance('in',rotated);
test('owner manual correction path retained',(await attendance('out',undefined,'owner')).status===200);
// 지시서 2라운드 011·004: 사장님 직접 기록 추가, 퇴근 때 인정 시각 저장
{
 const iso=(m)=>new RealDate(clock-m*60000).toISOString();
 let st=await get();
 test('사유 없이는 저장 안 됨',(await call('owner','/api/store',{action:'manualAttendance',employeeId:eid,start:iso(600),end:iso(540),breakMinutes:0,reason:' ',version:st.version})).status===400);
 st=await get();test('직원은 직접 기록 추가 불가',(await call('staff','/api/store',{action:'manualAttendance',employeeId:eid,start:iso(600),end:iso(540),breakMinutes:0,reason:'x',version:(await call('staff','/api/store')).data.version})).status===403);
 st=await get();let r=await call('owner','/api/store',{action:'manualAttendance',employeeId:eid,start:iso(600),end:iso(540),breakMinutes:10,reason:'QR 고장',version:st.version});
 test('사장님 직접 기록은 바로 반영',r.status===200);
 st=await get();const added=st.state.attendance.find(a=>a.source==='owner');test('기록표에 사장님 입력 표시',!!added&&added.breakMinutes===10);
 test('변경 이력에 사장님 직접 입력과 사유',st.audit.some(a=>a.action==='사장님 직접 입력'&&a.reason==='QR 고장'));
 test('직원 화면에도 보임',(await call('staff','/api/store')).data.state.attendance.some(a=>a.id===added.id&&a.source==='owner'));
 test('인정 시각이 함께 저장됨',!!added.credit&&!!added.credit.rule);
 st=await get();test('겹치는 시간은 저장 안 됨',(await call('owner','/api/store',{action:'manualAttendance',employeeId:eid,start:iso(590),end:iso(560),breakMinutes:0,reason:'중복',version:st.version})).status===400);
}
console.log(`${n-failures}/${n} passed`);if(failures)process.exitCode=1;
globalThis.Date=RealDate;await closeAll();
