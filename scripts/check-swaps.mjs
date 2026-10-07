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
// 작업 081 1단계: 근무표 그림자 테이블이 가게 데이터와 같은지
const drift=async()=>Number((await q('SELECT shift_mirror_drift(?) AS n',id('boss')).first()).n),mirrored=async()=>Number((await q('SELECT count(*) AS n FROM shift_records WHERE owner=?',id('boss')).first()).n);
d=await read();ok('mirror matches after swaps',[await drift(),await mirrored()],[0,d.shifts.length]);
d.shifts=d.shifts.filter(x=>x.id!=='old');await save(d);ok('mirror follows deletion',[await drift(),await mirrored()],[0,d.shifts.length]);
// 작업 050: 근무 가능 시간
me=(await ops('amy')).body;r=await ops('amy',{action:'setAvailability',version:me.version,slots:[{weekday:1,start:'09:00',end:'18:00'}],note:'평일 오전'});ok('employee submits availability',r.status,200);ok('own availability visible',Object.keys(r.body.availability),[A]);
ok('invalid time rejected',(await ops('amy',{action:'setAvailability',version:r.body.version,slots:[{weekday:9,start:'09:00',end:'18:00'}]})).status,400);
ok('colleague cannot see it',Object.keys((await ops('ben')).body.availability).length,0);
ok('owner sees it',(await ops('boss')).body.availability[A].note,'평일 오전');
// 작업 095: 공지 읽음 확인
o=(await ops('boss')).body;r=await ops('boss',{action:'postNotice',version:o.version,title:'본점 공지',body:'내일 휴무',branchId:'branch-main'});const nid=r.body.notices.at(-1).id;
ok('unread list names branch staff',r.body.notices.at(-1).unread.sort(),['벤','에이미','캣'].sort());
me=(await ops('amy')).body;await ops('amy',{action:'readNotice',version:me.version,id:nid});
const nn=(await ops('boss')).body.notices.find(x=>x.id===nid);ok('reader moves to read list',[nn.readers,nn.unread.includes('에이미')],[['에이미'],false]);
ok('staff do not see who read','readers' in (await ops('ben')).body.notices.find(x=>x.id===nid),false);
// 지시서 1라운드 C: 공지 대상·예약·다시 알리기, 휴가 승인 시 근무 자동 제외, 반려 사유 필수
{
 let x=await read();x.employees.find(e=>e.id===A).role='주방';x.employees.find(e=>e.id===B).role='홀';x.employees.find(e=>e.id===C).role='홀';await save(x);
 o=(await ops('boss')).body;r=await ops('boss',{action:'postNotice',version:o.version,title:'주방만',body:'냉장고 정리',branchId:'branch-main',target:{type:'role',roles:['주방']}});
 const kn=r.body.notices.at(-1);ok('업무별 공지: 받는 사람만 집계',[kn.audience,kn.unread],[1,['에이미']]);
 ok('대상 아닌 직원은 공지가 안 보임',(await ops('ben')).body.notices.some(n=>n.id===kn.id),false);
 ok('대상 직원은 보임',(await ops('amy')).body.notices.some(n=>n.id===kn.id),true);
 o=(await ops('boss')).body;r=await ops('boss',{action:'postNotice',version:o.version,title:'예약',body:'내일 아침',branchId:'branch-main',publishAt:new Date(Date.now()+86400000).toISOString()});
 const sn=r.body.notices.at(-1);ok('예약 공지는 사장님에게 예약으로',sn.scheduled,true);ok('예약 시각 전에는 직원에게 안 보임',(await ops('amy')).body.notices.some(n=>n.id===sn.id),false);
 o=(await ops('boss')).body;ok('지난 시각으로 예약 불가',(await ops('boss',{action:'postNotice',version:o.version,title:'x',body:'y',branchId:'branch-main',publishAt:new Date(Date.now()-3600000).toISOString()})).status,400);
 o=(await ops('boss')).body;r=await ops('boss',{action:'remindNotice',version:o.version,id:kn.id});ok('다시 알리기',[r.status,!!r.body.notices.find(n=>n.id===kn.id).remindedAt],[200,true]);
 o=(await ops('boss')).body;ok('10분 안에 또 알리기는 막음',(await ops('boss',{action:'remindNotice',version:o.version,id:kn.id})).status,429);
 me=(await ops('ben')).body;ok('직원은 다시 알리기 불가',(await ops('ben',{action:'remindNotice',version:me.version,id:kn.id})).status,403);
 // 휴가 승인 → 그 기간 근무가 근무표에서 빠짐
 x=await read();x.shifts.push({id:'lv1',employeeId:C,date:day(9),start:'10:00',end:'14:00',breakMinutes:0});x._account={...(x._account||{})};await save(x);
 me=(await ops('cat')).body;r=await ops('cat',{action:'requestLeave',version:me.version,employeeId:C,start:day(9),end:day(9),days:1,kind:'무급휴가',reason:'개인 사정'});ok('휴가 신청',r.status,200);
 const lid=r.body.leaves.at(-1).id;
 o=(await ops('boss')).body;ok('사장님은 근무 목록을 받아 영향 계산',o.shifts.some(s=>s.id==='lv1'),true);
 o=(await ops('boss')).body;ok('반려는 사유가 있어야',(await ops('boss',{action:'reviewLeave',version:o.version,id:lid,approve:false,comment:' '})).status,400);
 o=(await ops('boss')).body;r=await ops('boss',{action:'reviewLeave',version:o.version,id:lid,approve:true,comment:'승인'});ok('승인',r.status,200);
 ok('승인하면 그날 근무가 근무표에서 빠짐',(await read()).shifts.some(s=>s.id==='lv1'),false);
 ok('뺀 근무를 기록',r.body.leaves.find(l=>l.id===lid).removedShifts.map(s=>s.id),['lv1']);
}
await closeAll();
