// 지시서 다음 묶음: 006 위치 확인 · 007 한 휴대폰 여러 명 · 005 연장 승인 · 015 휴게 구간 · 016·018·019 보조 함수
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
import {distM,geoCheck,sharedDevices,pendingOvertime,rowMatches,rangeRows,calCell,breakSpans} from '../lib/att-extras.ts';
import {creditFor,applyClock} from '../dist/server/team-model.js';
// 순수 함수
ok('distance ~111m per 0.001 lat',Math.abs(distM({lat:37.5,lng:127},{lat:37.501,lng:127})-111)<=2);
ok('geo off → null',geoCheck(undefined,{}),null);
ok('geo missing coords',geoCheck({lat:37.5,lng:127,radius:100,mode:'warn'},{}),{ok:false,m:-1});
ok('geo inside',geoCheck({lat:37.5,lng:127,radius:100,mode:'warn'},{lat:37.5005,lng:127}).ok,true);
ok('geo accuracy capped at 100m',geoCheck({lat:37.5,lng:127,radius:50,mode:'warn'},{lat:37.503,lng:127,acc:5000}).ok,false);
const day='2026-09-01',at=(h)=>new Date(Date.parse(`${day}T${h}:00+09:00`)).toISOString();
ok('shared device found',sharedDevices([{id:'1',employeeId:'a',start:at('09:00'),end:null,breakMinutes:0,device:'dev12345'},{id:'2',employeeId:'b',start:at('09:01'),end:null,breakMinutes:0,device:'dev12345'},{id:'3',employeeId:'c',start:at('09:02'),end:null,breakMinutes:0,device:'other123'}],day),[{device:'dev12345',employeeIds:['a','b']}]);
ok('same person twice is not shared',sharedDevices([{id:'1',employeeId:'a',start:at('09:00'),end:at('10:00'),breakMinutes:0,device:'dev12345'},{id:'2',employeeId:'a',start:at('11:00'),end:null,breakMinutes:0,device:'dev12345'}],day).length,0);
const sh=[{employeeId:'a',date:day,start:'09:00',end:'18:00'}],rec={employeeId:'a',start:at('09:00'),end:at('19:00')};
ok('approval rule caps at schedule before approval',creditFor(rec,sh,{earlyIn:'scheduled',lateOut:'approval',unit:1}).end,at('18:00'));
ok('approval rule pays actual after approval',creditFor({...rec,otApproved:{by:'x',at:at('20:00')}},sh,{earlyIn:'scheduled',lateOut:'approval',unit:1}).end,at('19:00'));
ok('pending overtime minutes',pendingOvertime({...rec,id:'1',breakMinutes:0,credit:{start:at('09:00'),end:at('18:00')}}),60);
ok('approved has no pending',pendingOvertime({...rec,id:'1',breakMinutes:0,credit:{start:at('09:00'),end:at('19:00')},otApproved:{by:'x',at:at('20:00')}}),0);
const c={start:at('09:00'),end:null,breakMinutes:0,breakStart:null};applyClock(c,'break',Date.parse(at('12:00')),30);applyClock(c,'out',Date.parse(at('18:00')));
ok('planned break kept as span',c.breaks,[{start:at('12:00'),end:at('12:30')}]);ok('break minutes',c.breakMinutes,30);
ok('break spans helper',breakSpans(c).length,1);
const c2={start:at('09:00'),end:null,breakMinutes:0,breakStart:null};applyClock(c2,'break',Date.parse(at('12:00')));applyClock(c2,'resume',Date.parse(at('12:20')));ok('manual break span',c2.breaks[0].end,at('12:20'));
ok('filter late',rowMatches([{kind:'지각'}],[],'지각'),true);ok('filter absent',rowMatches([{kind:'미출근'}],[],'결근·미출근'),true);ok('filter geo',rowMatches([{kind:'정상'}],[{geo:{ok:false,m:500}}],'위치 확인'),true);
ok('range rows header + 1',rangeRows([{id:'1',employeeId:'a',start:at('09:00'),end:at('18:00'),breakMinutes:60,breaks:[{start:at('12:00'),end:at('13:00')}]},{id:'2',employeeId:'z',start:at('09:00'),end:null,breakMinutes:0}],{a:'에이미'},day,day).length,2);
ok('range rows break text',rangeRows([{id:'1',employeeId:'a',start:at('09:00'),end:at('18:00'),breakMinutes:60,breaks:[{start:at('12:00'),end:at('13:00')}]}],{a:'에이미'},day,day)[1][5],'12:00–13:00');
ok('calendar worst status wins',calCell([{kind:'정상'},{kind:'지각'}]),{kind:'지각',mark:'지'});
// 서버: 위치·기기·연장 승인
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);
const A=d._members.find(m=>m.userId===id('amy')).employeeId;
d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);d._attendanceQr={'branch-main':'qr-secret-1'};d.branches[0].geo={lat:37.5,lng:127,radius:100,mode:'block'};await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
const st=async(u)=>(await call(u,'/api/store')).body;
let s=await st('amy');
ok('block mode: no location → 400',(await call('amy','/api/store',{action:'attendance',employeeId:A,kind:'in',qrToken:'qr-secret-1',device:'devAAAA1111',version:s.version})).status,400);
ok('block mode: far away → 400',(await call('amy','/api/store',{action:'attendance',employeeId:A,kind:'in',qrToken:'qr-secret-1',lat:37.6,lng:127,acc:10,version:s.version})).status,400);
ok('block mode: inside → 200',(await call('amy','/api/store',{action:'attendance',employeeId:A,kind:'in',qrToken:'qr-secret-1',lat:37.5003,lng:127,acc:10,device:'devAAAA1111',version:s.version})).status,200);
let b=await st('boss');let rec2=b.state.attendance.find(a=>a.employeeId===A&&!a.end);
ok('geo saved without coordinates',[rec2.geo.ok,typeof rec2.geo.m,'lat' in rec2.geo],[true,'number',false]);ok('device saved',rec2.device,'devAAAA1111');
// 경고 모드: 밖이어도 기록하고 표시
d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);d.branches[0].geo.mode='warn';await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
s=await st('amy');ok('staff clocks out',(await call('amy','/api/store',{action:'attendance',employeeId:A,kind:'out',qrToken:'qr-secret-1',version:s.version})).status,200);
s=await st('amy');ok('warn mode: far away still records',(await call('amy','/api/store',{action:'attendance',employeeId:A,kind:'in',qrToken:'qr-secret-1',lat:37.6,lng:127,acc:10,device:'not valid!',version:s.version})).status,200);
b=await st('boss');rec2=b.state.attendance.find(a=>a.employeeId===A&&!a.end);ok('warn mode flags',rec2.geo.ok,false);ok('invalid device not stored','device' in rec2,false);
// 연장 승인: 사장님만, 끝난 기록만
ok('open record cannot be approved',(await call('boss','/api/store',{action:'approveOvertime',id:rec2.id,version:b.version})).status,400);
const done=b.state.attendance.find(a=>a.employeeId===A&&a.end);
ok('staff cannot approve overtime',(await call('amy','/api/store',{action:'approveOvertime',id:done.id,version:(await st('amy')).version})).status,403);
ok('owner approves overtime',(await call('boss','/api/store',{action:'approveOvertime',id:done.id,version:b.version})).status,200);
b=await st('boss');ok('approval stored with name',!!b.state.attendance.find(a=>a.id===done.id).otApproved?.by,true);ok('audit logged',b.audit.some(x=>x.action==='연장근무 승인'),true);
ok('owner undoes approval',(await call('boss','/api/store',{action:'approveOvertime',id:done.id,undo:true,version:b.version})).status,200);
b=await st('boss');ok('approval removed',b.state.attendance.find(a=>a.id===done.id).otApproved,null);
console.log('PASS: 출퇴근 위치·기기·연장 승인·휴게 구간.');
await closeAll();
