// 지시서 다음: 086 달력 구독 · 087 기록 가져오기 · 085 근로감독 묶음
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
import {parseHistory,toDate,toTime,toRecord} from '../lib/history-import.ts';
import {inspectionSheets} from '../lib/inspection.ts';
ok('excel serial date',toDate('46296'),'2026-10-01');ok('dotted date',toDate('2026.9.3'),'2026-09-03');ok('excel time fraction',toTime('0.375'),'09:00');ok('오후 time',toTime('오후 6:30'),'18:30');
const emps=[{id:'e1',name:'김 하늘'}];
let h=parseHistory([['이름','날짜','출근','퇴근','휴게'],['김하늘','2026-09-01','09:00','18:00','60'],['없는사람','2026-09-01','09:00','18:00','0'],['김하늘','2026-09-02','22:00','06:00','30']],emps);
ok('attendance kind',h.kind,'출퇴근');ok('2 items + 1 problem',[h.items.length,h.problems.length],[2,1]);
ok('overnight record',toRecord(h.items[1]).end,'2026-09-02T21:00:00.000Z');
h=parseHistory([['성명','근무일','시작','끝'],['김하늘','2026/09/05','10:00','15:00']],emps);ok('shift kind',[h.kind,h.items[0].start],['근무표','10:00']);
h=parseHistory([['이름','급여월','총지급','공제','실수령'],['김하늘','2026년 8월','1,500,000','120,000','1,380,000']],emps);ok('pay kind',[h.kind,h.items[0].month,h.items[0].net],['지난 급여','2026-08',1380000]);
ok('unknown header',parseHistory([['a','b']],emps).kind,null);
const st=async(u)=>(await call(u,'/api/store')).body;
let b=await st('boss');const A=b.state.employees.find(e=>e.name==='에이미').id;
ok('staff cannot import',(await call('amy','/api/store',{action:'importAttendance',items:[],version:(await st('amy')).version})).status,403);
let r=await call('boss','/api/store',{action:'importAttendance',items:[{employeeId:A,date:'2026-09-01',start:'09:00',end:'18:00',breakMinutes:60},{employeeId:A,date:'2026-09-01',start:'10:00',end:'12:00',breakMinutes:0},{employeeId:'nobody',date:'2026-09-02',start:'09:00',end:'10:00',breakMinutes:0}],source:'old.xlsx',version:b.version});
ok('import adds and skips',[r.status,r.body.importResult?.added,r.body.importResult?.skipped],[200,1,2]);
b=await st('boss');ok('imported as owner input',b.state.attendance.some(a=>a.employeeId===A&&a.source==='owner'&&a.start==='2026-09-01T00:00:00.000Z'),true);ok('audit import',b.audit.some(x=>x.action==='데이터 가져오기'),true);
// 086 달력 구독
ok('owner has no calendar',(await call('boss','/api/ics',{action:'on'})).status,403);
r=await call('amy','/api/ics',{action:'on'});ok('staff makes feed',[r.status,/\/api\/ics\?t=[a-f0-9]{48}$/.test(r.body.url),r.body.webcal.startsWith('webcal:')],[200,true,true]);
const tok=new URL(r.body.url).searchParams.get('t');
let f=await api(new Request('https://qa.local/api/ics?t='+tok),env);ok('feed is public calendar',[f.status,f.headers.get('content-type').startsWith('text/calendar'),(await f.text()).includes('BEGIN:VCALENDAR')],[200,true,true]);
r=await call('amy','/api/ics',{action:'on'});f=await api(new Request('https://qa.local/api/ics?t='+tok),env);ok('new link revokes old',f.status,404);
await call('amy','/api/ics',{action:'off'});f=await api(new Request('https://qa.local/api/ics?t='+new URL(r.body.url).searchParams.get('t')),env);ok('off revokes',f.status,404);
ok('bad token',(await api(new Request('https://qa.local/api/ics?t=zz'),env)).status,404);
// 085 근로감독 묶음
const ex=(await call('boss','/api/export')).body;const ins=inspectionSheets(ex);
ok('inspection sheets',ins.sheets.map(s=>s.name),['근로자 명부','근로계약 현황','임금대장','임금명세서 교부','출퇴근 원본','휴가','서명 서류','의무교육']);
ok('attendance in bundle',ins.counts['출퇴근 원본']>=1,true);ok('roster has staff',ins.counts['근로자 명부']>=2,true);
console.log('PASS: 달력 구독·기록 가져오기·근로감독 묶음.');
await closeAll();
