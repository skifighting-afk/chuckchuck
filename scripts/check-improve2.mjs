// 개선 2차 묶음 검사: 순수 계산(lib/improve2.ts) + 서버(직원 알림 시간·쉬고 싶은 날·임시 마감·기록 메모·직원에게 숨길 칸·화면 오류 보고) + 알림 점검
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
import * as I from '../lib/improve2.ts';
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
const K=(d,t)=>Date.parse(`${d}T${t}:00+09:00`),iso=(d,t)=>new Date(K(d,t)).toISOString();
// ── 순수 계산
const day='2026-09-07';// 월요일
const emp=[{id:'a',name:'에이미',branchId:'b',payType:'시급',wage:10000,joined:'2025-09-01',extra:{maxWeek:10}},{id:'c',name:'찰리',branchId:'b',payType:'시급',wage:12000,joined:'2026-08-01'}];
ok('B005 break ends in 5 min',I.workAlerts({employees:emp,attendance:[{id:'x',employeeId:'a',start:iso(day,'09:00'),end:null,breakMinutes:0,breakStart:iso(day,'12:00'),breakPlan:30}]},K(day,'12:26')).map(a=>a.key),['breakend:x:'+iso(day,'12:00')]);
ok('B006 no break after 4h → staff + owner',I.workAlerts({employees:emp,attendance:[{id:'y',employeeId:'a',start:iso(day,'09:00'),end:null,breakMinutes:0}]},K(day,'13:10')).map(a=>a.to),['a','owner']);
ok('B006 silent once rested',I.workAlerts({employees:emp,attendance:[{id:'y',employeeId:'a',start:iso(day,'09:00'),end:null,breakMinutes:30}]},K(day,'13:10')).length,0);
ok('B014 16h open record',I.workAlerts({employees:emp,attendance:[{id:'z',employeeId:'a',start:iso(day,'06:00'),end:null,breakMinutes:30}]},K(day,'22:30')).some(a=>a.key==='long:z'),true);
const list=[{key:'noshow:1',to:'owner',kind:'noshow'},{key:'clockout-owner:2',to:'owner',kind:'clockout'},{key:'clockout:2',to:'a',kind:'clockout'}];
ok('B015 digest drops owner per-event alerts',I.digestFilter(list,true).map(a=>a.key),['clockout:2']);ok('B015 off keeps all',I.digestFilter(list,false).length,3);
const g=I.dailyDigest({employees:emp,shifts:[{id:'s1',employeeId:'a',date:day,start:'09:00',end:'18:00'},{id:'s2',employeeId:'c',date:day,start:'10:00',end:'15:00'}],attendance:[{id:'r',employeeId:'a',start:iso(day,'09:20'),end:iso(day,'18:00'),breakMinutes:60}]},K(day,'21:00'));
ok('B015 digest text',g.title+' / '+g.body,'오늘 출퇴근 요약 · 1명 출근 / 지각 1명 · 기록 없음 1명(찰리)');
ok('B035 ack reminder after 24h',I.scheduleAckReminders({employees:emp,shifts:[{id:'s',employeeId:'a',date:'2026-09-08',start:'09:00',end:'12:00'}],publishedWeeks:{'b:2026-09-07':{at:iso('2026-09-05','10:00'),acks:{}}}},K('2026-09-06','11:00')).map(a=>a.to),['a']);
ok('B035 acked → none',I.scheduleAckReminders({employees:emp,shifts:[{id:'s',employeeId:'a',date:'2026-09-08',start:'09:00',end:'12:00'}],publishedWeeks:{'b:2026-09-07':{at:iso('2026-09-05','10:00'),acks:{a:'x'}}}},K('2026-09-06','11:00')).length,0);
ok('B058 only in December',I.minWageNotice({employees:emp},K('2026-11-30','10:00'),11000).length,0);
ok('B058 december lists low wage',I.minWageNotice({employees:emp},K('2026-12-01','10:00'),11000)[0].title,'내년 최저임금보다 낮은 시급 직원 1명');
ok('B058 no next-year rate → silent',I.minWageNotice({employees:emp},K('2026-12-01','10:00'),undefined).length,0);
ok('B090 visa 30 days',I.visaAlerts({employees:[{...emp[0],extra:{visaUntil:'2026-10-07'}}]},K(day,'10:00')).length,1);
ok('B101 staff pref first',I.beforeMinutesOf({extra:{beforeMin:30}},{more:{beforeMinutes:120}}),30);ok('B101 store default',I.beforeMinutesOf({},{more:{beforeMinutes:120}}),120);ok('B101 off',I.beforeMinutesOf({extra:{beforeMin:0}},{}),0);
const p=I.punctuality([{id:'1',employeeId:'a',date:'2026-09-01',start:'09:00',end:'18:00'},{id:'2',employeeId:'a',date:'2026-09-02',start:'09:00',end:'18:00'}],[{id:'r1',employeeId:'a',start:iso('2026-09-01','09:10'),end:iso('2026-09-01','18:00'),breakMinutes:60},{id:'r2',employeeId:'a',start:iso('2026-09-02','08:50'),end:iso('2026-09-02','17:00'),breakMinutes:60}],'a','2026-09',5,K(day,'10:00'));
ok('B010·B018 punctuality',p,{late:1,early:1,count:2,avg:0});ok('B018 habit text',I.habitText(-8,3),'평균 8분 일찍 와요');
const cm=I.copyMonth([{id:'1',employeeId:'a',date:'2026-09-07',start:'09:00',end:'12:00'},{id:'2',employeeId:'a',date:'2026-09-29',start:'09:00',end:'12:00'}],'2026-09',new Set(['a']),()=>'n');
ok('B022 copy month to same nth weekday',cm.shifts.map(s=>s.date),['2026-10-05']);ok('B022 missing 5th week skipped',cm.skipped,1);
ok('B023·B034 week load over max',I.weekLoad([{id:'1',employeeId:'a',date:day,start:'09:00',end:'21:00',breakMinutes:60}],emp,day)[0],{id:'a',name:'에이미',hours:11,max:10,over:true,juhu:false,over40:false});
ok('B024 weekend count',I.weekendCount([{id:'1',employeeId:'c',date:'2026-09-12',start:'09:00',end:'12:00'}],emp,'2026-09')[0],{id:'c',name:'찰리',n:1});
ok('B027 break suggestion',[I.suggestedBreak('09:00','13:00'),I.suggestedBreak('09:00','14:00'),I.suggestedBreak('09:00','18:00')],[0,30,60]);
ok('B032 shift kind',[I.shiftKind({start:'09:00',end:'14:00'}),I.shiftKind({start:'12:00',end:'17:00'}),I.shiftKind({start:'17:00',end:'22:00'})],['오픈','미들','마감']);
ok('B033 candidates exclude busy & over max',I.fillCandidates([{id:'1',employeeId:'c',date:day,start:'11:00',end:'13:00'},{id:'2',employeeId:'a',date:'2026-09-08',start:'09:00',end:'17:00'}],emp,day,'10:00','14:00',{},day).map(x=>x.id),[]);
ok('B033 available first',I.fillCandidates([],emp,day,'10:00','14:00',{c:{slots:[{weekday:1,start:'09:00',end:'18:00'}]}},day).map(x=>x.id),['c','a']);
ok('B038 changed cells',I.changedCells([{id:'1',employeeId:'a',date:day,start:'09:00',end:'12:00'}],[{id:'1',employeeId:'a',date:day,start:'10:00',end:'12:00'}]).added,['1']);
ok('B040 grid header + rows',I.scheduleGrid([{id:'1',employeeId:'a',date:day,start:'09:00',end:'12:00'}],emp,day,'2026-09-08').map(r=>r.length),[4,4,4]);
ok('B039 holiday premium 5+',I.holidayPremium({start:'09:00',end:'19:00',breakMinutes:60},10000,true),50000);ok('B039 under 5 none',I.holidayPremium({start:'09:00',end:'19:00'},10000,false),0);
ok('B046 rounding',[I.roundPay(12345.6,1),I.roundPay(12345,10),I.roundPay(12399,100)],[12346,12340,12300]);
ok('B055 transfer check',I.transferCheck([100,200],[100,250]),{slips:300,file:350,ok:false,diff:50});
ok('B067 durunuri',I.durunuri(2000000,5),Math.round(2000000*0.0565*0.8));ok('B067 10+ none',I.durunuri(2000000,10),0);
ok('B069 pay period 16th',I.payPeriod('2026-09',16),{from:'2026-08-16',to:'2026-09-15'});ok('B069 default',I.payPeriod('2026-02'),{from:'2026-02-01',to:'2026-02-28'});
ok('B070 payday next month',I.payDayLeft('2026-09-20',10),{date:'2026-10-10',left:20});ok('B070 short month',I.payDayLeft('2026-02-01',31).date,'2026-02-28');
ok('B073 readiness',I.readiness({contract:{status:'체결 완료'},healthCertUntil:'2027-01-01'},day).done,2);
ok('B086 missing info',I.missingInfo({phone:'010',payType:'시급'}),['계좌','생년월','비상 연락처']);
ok('B079 tenure',[I.tenureBadge('2026-06-07',day)?.label,I.tenureBadge('2025-09-07',day)?.label,I.tenureBadge('2026-08-01',day)],['3개월','1년 근속',null]);
ok('B088 history months',I.workHistory({...emp[0]},[],[{id:'r',employeeId:'a',start:iso(day,'09:00'),end:iso(day,'13:00'),breakMinutes:0}]).months,[{month:'2026-09',days:1,hours:4}]);
ok('B092 until next',I.untilNext([{id:'1',employeeId:'a',date:day,start:'12:00',end:'15:00'}],'a',K(day,'10:30')).text,'1시간 30분 뒤');
ok('B133 weekday cost',I.weekdayCost([{id:'r',employeeId:'a',start:iso(day,'09:00'),end:iso(day,'13:00'),breakMinutes:0}],emp,'2026-09')[1],{wd:1,cost:40000,hours:4,perDay:40000});
ok('B132 ratio over target',I.ratioState(30,100,25),{pct:30,over:true});
ok('B136 swap trend',I.swapTrend([{at:'2026-09-02T00:00:00Z',status:'승인'},{at:'2026-09-03T00:00:00Z',status:'반려'}],['2026-09']),[{month:'2026-09',n:1}]);
ok('B140 yoy',I.yearOverYear({'2025-09:b':{locked:true,month:'2025-09',rows:[{gross:100}]},'2026-09:b':{locked:true,month:'2026-09',rows:[{gross:150}]}},'2026-09').pct,50);
ok('B151 late memo rule once a month',[I.lateMemoRule({name:'a'},3,'2026-09'),I.lateMemoRule({name:'a',extra:{memo:'2026-09 지각 3번(자동 기록)'}},4,'2026-09')],['2026-09 지각 3번(자동 기록)',null]);
ok('B153 repeats due',I.repeatsDue([{id:'1',title:'청소',every:'week',weekday:1},{id:'2',title:'재고',every:'month',day:7},{id:'3',title:'x',every:'week',weekday:2}],day).map(r=>r.id),['1','2']);
ok('B158 slash',[I.expandSlash('/급여'),I.expandSlash('그냥 질문')],['이번 달 인건비 얼마야?','그냥 질문']);
ok('B188 referral code stable',I.referralCode('owner-1')===I.referralCode('owner-1')&&/^[A-Z2-9]{8}$/.test(I.referralCode('owner-1')),true);
ok('B196 scrub',I.scrubError('fail a@b.co 010-1234-5678 900101-1234567 token=abc'),'fail [이메일] [전화] [번호] token=[숨김]');
ok('B200 secret patterns',I.findSecrets('ghp_'+'a'.repeat(36)+' AKIA'+'A'.repeat(16)),['GitHub 토큰','AWS 키']);ok('B200 clean text',I.findSecrets('const x=1'),[]);
// ── 2묶음 순수 계산
ok('B065 budget 90%',I.budgetAlert({employees:emp,shifts:[{id:'1',employeeId:'a',date:'2026-09-08',start:'09:00',end:'19:00'}],settings:{laborBudget:105000}},K('2026-09-10','10:00')).map(a=>a.key),['budget:2026-09:90']);
ok('B065 no budget',I.budgetAlert({employees:emp,shifts:[],settings:{}},K(day,'10:00')).length,0);
ok('B050 daily worker rows',I.dailyWorkerReport([{...emp[0],employment:'일용'}],[{id:'r',employeeId:'a',start:iso(day,'09:00'),end:iso(day,'13:00'),breakMinutes:0}],'2026-09')[1],['에이미','','7',1,4,40000]);
ok('B044 pay calendar',I.payCalendar([{...emp[0],payDay:10},{...emp[1],payDay:10}],'2026-09-07',1),[{date:'2026-09-10',names:['에이미','찰리']}]);
ok('B054 account changed after last pay',I.accountChangedSince([{employeeId:'a',type:'profile',status:'반영함',changes:{bankAccount:'1'},answeredAt:'2026-09-05T00:00:00Z',at:'x'}],{'r':{locked:true,at:'2026-09-01T00:00:00Z',rows:[{employeeId:'a'}]}},'a'),true);
ok('B054 paid since',I.accountChangedSince([{employeeId:'a',type:'profile',status:'반영함',changes:{bankAccount:'1'},answeredAt:'2026-09-05T00:00:00Z',at:'x'}],{'r':{locked:true,at:'2026-09-10T00:00:00Z',rows:[{employeeId:'a'}]}},'a'),false);
ok('B052 progress',I.progressOf([{ok:true},{ok:false}]),{done:1,total:2,pct:50});
ok('B152 friday reminder',I.nextWeekReminder({branches:[{id:'b',name:'본점'}],employees:emp,shifts:[],publishedWeeks:{}},K('2026-09-11','16:00')).map(a=>a.key),['nextweek:b:2026-09-14']);
ok('B152 published → none',I.nextWeekReminder({branches:[{id:'b',name:'본점'}],employees:emp,shifts:[],publishedWeeks:{'b:2026-09-14':{at:'x',acks:{}}}},K('2026-09-11','16:00')).length,0);
ok('B152 not friday',I.nextWeekReminder({branches:[{id:'b',name:'본점'}],employees:emp,shifts:[]},K('2026-09-10','16:00')).length,0);
// ── 3묶음
ok('B020 no shift hint',I.clockInHint([],K(day,'09:00')).startsWith('오늘 근무표에 없는'),true);
ok('B020 too early hint',I.clockInHint([{date:day,start:'12:00',end:'18:00'}],K(day,'09:30')).startsWith('근무 시작(12:00)까지 2시간 30분'),true);
ok('B020 on time no hint',I.clockInHint([{date:day,start:'10:00',end:'18:00'}],K(day,'09:30')),'');
ok('B020 after end hint',I.clockInHint([{date:day,start:'10:00',end:'18:00'}],K(day,'19:00')).includes('이미 끝난'),true);
{const {explainPay}=await import('../lib/pay-explain.ts');ok('B056 juhu skipped reason',explainPay({gross:100,deduction:0,net:100,juhuSkipped:['2026-09-07'],payType:'시급'}).some(t=>t.includes('9/7 시작 주는')),true);
 ok('B056 no juhu reason',explainPay({gross:100,deduction:0,net:100,hours:10,payType:'시급',earnings:[{name:'기본급',amount:100}]}).some(t=>t.includes('주휴수당이 없어요')),true);}
// ── 서버
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env;
async function raw(user,path,body,method){return api(new Request('https://qa.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function call(user,path,body,method){const r=await raw(user,path,body,method);return{status:r.status,body:await r.json()}}
await call('i2boss','/api/account',{action:'onboard',storeName:'개선 검수',branchName:'본점',ownerName:'가상대표',plan:'pro',storeSlots:1,acknowledged:true,dpaAgreed:true});
let v=(await call('i2boss','/api/store')).body.version;await call('i2boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('i2boss','/api/staff-join')).body.codes[0].code;
await call('i2amy','/api/staff-join',{action:'apply',code,name:'에이미',phone:'01000000000'});{const j=(await call('i2boss','/api/staff-join')).body;await call('i2boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version})}
let st=(await call('i2boss','/api/store')).body;const A=st.state.employees[0].id;
// 사장님이 저장한 메모·태그·평가·체류 기간·매장 정보·반복 할 일은 저장되고, 직원 화면에는 메모가 안 보인다
const s1=structuredClone(st.state);s1.employees[0].extra={memo:'비밀 메모',tags:['학생'],reviews:[{at:new Date().toISOString(),text:'꼼꼼함'}],praise:[{at:new Date().toISOString(),text:'고마워요'}],visaUntil:'2027-01-01',maxWeek:14};
s1.branches[0].info={wifi:'store-wifi',wifiPw:'pw1234',supplies:'행주 — 싱크대 아래'};s1.repeats=[{id:'r1',title:'냉장고 청소',every:'week',weekday:1}];s1.events=[{id:'e1',date:'2026-12-24',title:'회식'}];s1.settings.more={beforeMinutes:30,digest:true,todayNote:{date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),text:'위생 점검'}};
const put=await call('i2boss','/api/store',{state:{...s1,attendance:[]},version:st.version},'PUT');ok('owner saves extra fields',put.status,200);
st=(await call('i2boss','/api/store')).body;ok('extra kept',st.state.employees[0].extra.memo,'비밀 메모');ok('branch info kept',st.state.branches[0].info.wifi,'store-wifi');ok('repeats kept',st.state.repeats.length,1);ok('settings.more kept',st.state.settings.more.digest,true);
let me=(await call('i2amy','/api/store')).body;ok('staff does not see owner memo/tags/reviews',Object.keys(me.state.employees[0].extra||{}).sort(),['praise']);ok('staff sees praise',me.state.employees[0].extra.praise[0].text,'고마워요');
ok('staff sees wifi',me.state.branches[0].info.wifi,'store-wifi');ok('staff sees today note only',Object.keys(me.state.settings.more),['todayNote']);ok('staff sees events',me.state.events.length,1);
// 직원 알림 시간·쉬고 싶은 날
ok('setPref bad value blocked',(await call('i2amy','/api/store',{action:'setPref',beforeMin:45,version:me.version})).status,400);
me=(await call('i2amy','/api/store')).body;ok('setPref ok',(await call('i2amy','/api/store',{action:'setPref',beforeMin:120,version:me.version})).status,200);
st=(await call('i2boss','/api/store')).body;ok('pref saved, memo intact',[st.state.employees[0].extra.beforeMin,st.state.employees[0].extra.memo],[120,'비밀 메모']);
const fut=new Date(Date.now()+9*3600000+5*86400000).toISOString().slice(0,10);me=(await call('i2amy','/api/store')).body;
ok('dayOffWish past blocked',(await call('i2amy','/api/store',{action:'dayOffWish',date:'2020-01-01',version:me.version})).status,400);
ok('dayOffWish ok',(await call('i2amy','/api/store',{action:'dayOffWish',date:fut,note:'시험',version:me.version})).status,200);
st=(await call('i2boss','/api/store')).body;ok('owner sees wish',st.state.dayOffWishes.map(w=>[w.employeeId,w.date,w.note]),[[A,fut,'시험']]);
me=(await call('i2amy','/api/store')).body;await call('i2amy','/api/store',{action:'dayOffWish',date:fut,version:me.version});st=(await call('i2boss','/api/store')).body;ok('second tap removes wish',st.state.dayOffWishes.length,0);
ok('staff cannot memo',(await call('i2amy','/api/store',{action:'attMemo',id:'x',memo:'y',version:me.version})).status,403);
// 임시 마감 · 메모
const startIso=new Date(Date.now()-6*3600000).toISOString();await q('INSERT INTO attendance_records(owner,id,employee_id,start_at,record) VALUES(?,?,?,?,?)',id('i2boss'),'att-open',A,startIso,JSON.stringify({id:'att-open',employeeId:A,start:startIso,end:null,breakMinutes:0,breakStart:null})).run();
st=(await call('i2boss','/api/store')).body;ok('autoClose future blocked',(await call('i2boss','/api/store',{action:'autoClose',id:'att-open',end:new Date(Date.now()+3600000).toISOString(),version:st.version})).status,400);
const endIso=new Date(Date.now()-2*3600000).toISOString();ok('autoClose ok',(await call('i2boss','/api/store',{action:'autoClose',id:'att-open',end:endIso,version:st.version})).status,200);
st=(await call('i2boss','/api/store')).body;let rec=st.state.attendance.find(a=>a.id==='att-open');ok('closed with flag',[rec.end,rec.autoClosed],[endIso,true]);
ok('attMemo ok',(await call('i2boss','/api/store',{action:'attMemo',id:'att-open',memo:'재고 정리',version:st.version})).status,200);
st=(await call('i2boss','/api/store')).body;ok('memo saved',st.state.attendance.find(a=>a.id==='att-open').memo,'재고 정리');
me=(await call('i2amy','/api/store')).body;ok('staff record hides memo','memo' in me.state.attendance.find(a=>a.id==='att-open'),false);
// 공지 댓글·반응·투표·첨부(B112·B113·B130·B114)
{const ops=async(user,b)=>{const v=(await call(user,'/api/operations')).body.version;return call(user,'/api/operations',{...b,version:v})};
 const pdf='data:application/pdf;base64,'+Buffer.from('%PDF-1.4 test').toString('base64');
 ok('post notice with poll+pdf',(await ops('i2boss',{action:'postNotice',title:'회식',body:'날짜 골라 주세요',branchId:'all',poll:['금','토'],file:{name:'안내.pdf',data:pdf}})).status,200);
 let n=(await call('i2amy','/api/operations')).body.notices.find(x=>x.title==='회식');ok('staff sees poll + file',[n.poll,n.file.name],[['금','토'],'안내.pdf']);
 ok('vote',(await ops('i2amy',{action:'voteNotice',id:n.id,option:1})).status,200);ok('bad vote',(await ops('i2amy',{action:'voteNotice',id:n.id,option:5})).status,400);
 ok('react',(await ops('i2amy',{action:'reactNotice',id:n.id,emoji:'👍'})).status,200);ok('bad emoji',(await ops('i2amy',{action:'reactNotice',id:n.id,emoji:'💩'})).status,400);
 ok('comment',(await ops('i2amy',{action:'commentNotice',id:n.id,text:'토요일 좋아요'})).status,200);
 n=(await call('i2boss','/api/operations')).body.notices.find(x=>x.title==='회식');ok('owner sees counts',[n.pollCounts,n.reactions['👍'].n,n.comments[0].name,n.comments[0].mine],[[0,1],1,'에이미',false]);
 ok('owner can delete comment',(await ops('i2boss',{action:'deleteComment',id:n.id,commentId:n.comments[0].id})).status,200);
 ok('bad pdf rejected',(await ops('i2boss',{action:'postNotice',title:'x',body:'y',branchId:'all',file:{name:'a.pdf',data:'data:text/html;base64,AAAA'}})).status,400);}
// 매뉴얼 사진 필수(B116) · 못 한 단계 인수인계(B117)
{const v=(await call('i2boss','/api/manual')).body.version;const r=await call('i2boss','/api/manual',{action:'save',title:'마감',category:'마감',branchId:'all',roles:[],steps:[{text:'바닥 청소'},{text:'전원 끄기'}],needPhoto:true,version:v});ok('save manual needPhoto',r.status,200);
 const m=(await call('i2amy','/api/manual')).body;const mm=m.manuals.find(x=>x.title==='마감');ok('photo required',(await call('i2amy','/api/manual',{action:'checkRun',id:mm.id,done:[0],version:m.version})).status,400);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';const m2=(await call('i2amy','/api/manual')).body;
 ok('check with photo',(await call('i2amy','/api/manual',{action:'checkRun',id:mm.id,done:[0],photo:{mime:'image/png',body:png},version:m2.version})).status,200);
 const d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('i2boss')).first()).data);ok('left steps handed over',d._storeLog.some(l=>l.kind==='인수인계'&&l.text.includes('2. 전원 끄기')),true);}
// 화면 오류 보고: 개인정보 지움, 1분 안 같은 글 하나만, 본사만 읽기
ok('client error needs origin',(await api(new Request('https://qa.local/api/client-error',{method:'POST',body:'{}'}),env)).status,403);
for(let i=0;i<2;i++)await raw('i2boss','/api/client-error',{kind:'error',message:'boom a@b.co',path:'/app?x=1'});
const errs=await q("SELECT message,path FROM client_errors WHERE message LIKE 'boom%'").all();ok('scrubbed + deduped',errs.results.map(r=>[r.message,r.path]),[['boom [이메일]','/app']]);
ok('non-HQ cannot read',(await call('i2boss','/api/client-error')).status,403);
// 알림 점검: 직원이 고른 근무 전 알림 시간과 바로 출근 주소
{const mod=await import('../dist/server/cron.js');const d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('i2boss')).first()).data);
 const now=Date.now(),kd=new Date(now+9*3600000).toISOString().slice(0,10),st2=new Date(now+90*60000+9*3600000).toISOString().slice(11,16),en=new Date(now+5*3600000+9*3600000).toISOString().slice(11,16);
 if(st2<en&&new Date(now+90*60000+9*3600000).toISOString().slice(0,10)===kd&&new Date(now+5*3600000+9*3600000).toISOString().slice(0,10)===kd){d.shifts=[{id:'sh-b',employeeId:A,date:kd,start:st2,end:en,breakMinutes:0}];d._alertsSent={};await q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(d),id('i2boss')).run();
  const sent=[];await mod.alertSweep(env,now,(u,m)=>sent.push(m));const b=sent.find(m=>m.kind==='before');ok('B101 2h before alert with clock link',[b?.title,b?.url],['2시간 뒤 근무가 있어요','/app?clock=1']);}
 else ok('B101 (skipped near midnight)',true);}
await closeAll();
