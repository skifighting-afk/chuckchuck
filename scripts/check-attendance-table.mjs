// 작업 045: 출퇴근 기록 별도 테이블 — 1만 건 한도 없음, 오래된 기록 보존, 화면에는 최근 기간만
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,sql,headersFor,id}=T,env=T.env;
let n=0;const ok=(label,v)=>{assert.ok(v,label);console.log(`${++n}. PASS ${label}`)};
async function call(user,path,body,method){const r=await api(new Request('https://qa.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,body:await r.json().catch(()=>null),raw:r}}
await call('boss','/api/account',{action:'onboard',storeName:'출퇴근 검수',branchName:'본점',ownerName:'가상대표',plan:'starter',acknowledged:true,dpaAgreed:true});
const DAY=86400000,now=Date.now();
// 직원 1명 + 기록 12,000건(예전 한도 1만 건 초과): 3년 전부터 오늘 전까지
let s=(await call('boss','/api/store')).body.state;
const emp={...s.employees[0]};
const read=async()=>JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);
let d=await read();
const e={id:'e-att',name:'출퇴근직원',email:'att@example.invalid',address:'',phone:'010-0000-0000',joined:'2023-01-02',branchId:'branch-main',role:'홀',access:'직원',managerPermissions:[],employment:'단시간',status:'재직',endDate:'',weeklyHours:20,payType:'시급',wage:11000,payDay:10,income:'근로소득',taxMode:'직접 입력',autoPay:false,birthMonth:'',minorDocs:false,taxReason:'',insurances:{},contract:{draftText:'',status:'작성 전',workplace:'본점',duties:'홀',workDays:'월',start:'09:00',end:'13:00',breakMinutes:0,holiday:'일',leave:'법정',paymentMethod:'계좌',additional:'',employer:'대표',signedAt:null,signedBy:null},leaveBalance:0,notes:''};
for(const k of ['국민연금','건강보험','장기요양','고용보험','산재보험'])e.insurances[k]={status:'확인 필요',reason:''};
d.employees=[e];
const recs=[];for(let i=0;i<12000;i++){const start=new Date(now-3*365*DAY+i*Math.floor(3*365*DAY/12000));recs.push({id:'a'+i,employeeId:'e-att',start:start.toISOString(),end:new Date(+start+2*3600000).toISOString(),breakMinutes:0,breakStart:null})}
d.attendance=recs;
await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
ok('12,000 records move into the attendance table',Number((await q('SELECT count(*)::int AS n FROM attendance_records WHERE owner=?',id('boss')).first()).n)===12000);
ok('store JSON no longer carries attendance',!('attendance' in await read()));
let g=await call('boss','/api/store');
const since=now-400*DAY;
ok('screen gets only the recent window',g.status===200&&g.body.state.attendance.length>0&&g.body.state.attendance.length<12000&&g.body.state.attendance.every(a=>Date.parse(a.start)>=since-DAY));
ok('window marker is not sent to the screen',!JSON.stringify(g.body).includes('_attendanceFrom'));
// 저장(PUT, 화면은 출퇴근을 보내지 않음)해도 기록이 그대로
s=g.body.state;s.settings.accountantName='세무사';
let r=await call('boss','/api/store',{state:{...s,attendance:[]},version:g.body.version},'PUT');
ok('save without attendance keeps every record',r.status===200&&Number((await q('SELECT count(*)::int AS n FROM attendance_records WHERE owner=?',id('boss')).first()).n)===12000);
r=await call('boss','/api/store',{state:{...s,attendance:[{...s.attendance[0],breakMinutes:99}]},version:r.body.version},'PUT');
ok('editing attendance through save is refused',r.status===400);
// 사장님 출근 기록: 새 기록 하나만 더해지고 오래된 기록은 남는다
g=await call('boss','/api/store');
r=await call('boss','/api/store',{action:'attendance',kind:'in',employeeId:'e-att',version:g.body.version});
ok('clock-in adds one record and keeps old ones',r.status===200&&Number((await q('SELECT count(*)::int AS n FROM attendance_records WHERE owner=?',id('boss')).first()).n)===12001);
ok('oldest record (3 years ago) still stored',!!(await q("SELECT 1 AS x FROM attendance_records WHERE owner=? AND id='a0'",id('boss')).first()));
r=await call('boss','/api/store',{action:'attendance',kind:'out',employeeId:'e-att',version:r.body.version});
// 오래된 달(창 밖) 급여도 그 달 기록으로 계산한다
const old=new Date(now-600*DAY+9*3600000).toISOString().slice(0,7);
r=await call('boss','/api/store',{action:'finalize',month:old,branch:'branch-main',payDate:old+'-25',version:r.body.version});
ok('finalize for a month outside the window uses that month\'s records',r.status===200&&r.body.state.payrollRuns[old+':branch-main'].rows[0].hours>0);
ok('records outside the window survive the save',Number((await q('SELECT count(*)::int AS n FROM attendance_records WHERE owner=?',id('boss')).first()).n)===12001);
// 임금 0원인 직원이 일한 달은 확정하지 않는다
{const dd=await read();dd.employees[0].wage=0;await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(dd),id('boss')).run();
 const g2=await call('boss','/api/store');const m=new Date(now-30*DAY+9*3600000).toISOString().slice(0,7);
 const z=await call('boss','/api/store',{action:'finalize',month:m,branch:'branch-main',payDate:m+'-25',version:g2.body.version});
 ok('payroll with a zero-wage worker is refused',z.status===400&&z.body.error.includes('임금이 0원'));}
// 내려받기에는 전체 기록
const ex=await call('boss','/api/export');
ok('export includes every attendance record',ex.status===200&&ex.body.store.attendance.length===12001&&!('_attendanceFrom' in ex.body.store));
// 탈퇴 정리 때 함께 삭제
await sql`select purge_store(${id('boss')})`;
ok('store purge removes attendance records',Number((await q('SELECT count(*)::int AS n FROM attendance_records WHERE owner=?',id('boss')).first()).n)===0);
console.log(`${n}/${n} passed`);
await closeAll();
