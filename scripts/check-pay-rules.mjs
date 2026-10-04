// 법정수당·4대보험 자동 계산 점검. 기대값은 손으로 계산해 둔 값이다.
import assert from 'node:assert/strict';
import {allowances,insuranceLines,splitRecord,monday} from '../lib/pay-rules.ts';
import {calculate,normalizeTeam} from '../dist/server/team-model.js';
import {payslipText,payslipMissing,employeeNumber} from '../lib/payslip.ts';
import {wageLedger,ledgerCsv,csvCell} from '../dist/server/wage-ledger.js';

let n=0;const ok=(name,v)=>{assert.ok(v,name);console.log(`PASS ${++n}. ${name}`)};
const kst=(day,hm)=>new Date(`${day}T${hm}:00+09:00`).toISOString();
const shift=(day,s,e,brk=60)=>{const start=kst(day,s);let end=kst(day,e);if(end<=start)end=new Date(+new Date(end)+86400000).toISOString();return {start,end,breakMinutes:brk}};
const days=(from,to,weekdays)=>{const out=[];for(let d=new Date(from+'T00:00:00Z');d<=new Date(to+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1)){const w=(d.getUTCDay()+6)%7;if(weekdays.includes(w))out.push(d.toISOString().slice(0,10))}return out};

// 1) 야간 나누기: 18:00~02:30, 휴게 60분 → 실근무 7.5h, 야간 270분 × (450/510) = 3.97h
const r1=splitRecord(shift('2026-09-07','18:00','02:30'));
ok('overnight shift worked hours',Math.abs(r1.worked-7.5)<1e-9);
ok('night hours prorated by break',Math.abs(r1.night-270*450/510/60)<1e-9);
ok('week starts on Monday',monday('2026-09-06')==='2026-08-31'&&monday('2026-09-07')==='2026-09-07');

// 2) 2026년 9월 월~목 18:00~02:30 (18일, 주 30시간), 시급 14,000원
const sep=days('2026-09-01','2026-09-30',[0,1,2,3]).map(d=>shift(d,'18:00','02:30'));
ok('september has 18 Mon-Thu shifts',sep.length===18);
const five=allowances(sep,'2026-09',14000,true);
const juhu=five.lines.find(l=>l.name==='주휴수당');
// 9/6 주(화~목 22.5h)=63,000 + 9/13·9/20·9/27 주(30h)=84,000×3. 9/28 주는 일요일이 10/4라 10월에 지급.
ok('weekly holiday pay by weeks ending in month',juhu.amount===63000+84000*3);
const night=five.lines.find(l=>l.name==='야간근로 가산');
ok('night premium for 5+ workplaces',night.amount===Math.round(18*270*450/510/60*14000*0.5));
ok('no overtime under 8h/day and 40h/week',!five.lines.some(l=>l.name==='연장근로 가산'));
const small=allowances(sep,'2026-09',14000,false);
ok('small workplace: weekly holiday pay still applies',small.lines.find(l=>l.name==='주휴수당').amount===315000);
ok('small workplace: no night premium, with a note',!small.lines.some(l=>l.name==='야간근로 가산')&&small.notes.length===1);

// 3) 연장: 월~토 9~18시(8h) → 주 48h, 하루 초과 0 → 주 초과 8h
const six=days('2026-09-07','2026-09-12',[0,1,2,3,4,5]).map(d=>shift(d,'09:00','18:00'));
const ot=allowances(six,'2026-09',10320,true).lines.find(l=>l.name==='연장근로 가산');
ok('weekly overtime beyond 40h',ot.amount===Math.round(8*10320*0.5));
// 하루 9~21시(휴게 60) = 11h → 하루 초과 3h, 주 11h라 주 초과 없음
const long=allowances([shift('2026-09-08','09:00','21:00')],'2026-09',10320,true).lines.find(l=>l.name==='연장근로 가산');
ok('daily overtime beyond 8h',long.amount===Math.round(3*10320*0.5));
// 둘 다: 월~금 9~20시(10h) → 하루 초과 2h×5=10h, 남은 40h는 주 40h를 넘지 않음 → 10h
const both=allowances(days('2026-09-07','2026-09-11',[0,1,2,3,4]).map(d=>shift(d,'09:00','20:00')),'2026-09',10320,true).lines.find(l=>l.name==='연장근로 가산');
ok('daily and weekly overtime not double counted',both.amount===Math.round(10*10320*0.5));
ok('under 15h a week: no weekly holiday pay',!allowances([shift('2026-09-08','09:00','18:00')],'2026-09',10320,true).lines.some(l=>l.name==='주휴수당'));

// 4) 4대보험 근로자 부담분 (2026): 2,000,000원
const all={국민연금:{status:'가입'},건강보험:{status:'가입'},장기요양:{status:'가입'},고용보험:{status:'가입'},산재보험:{status:'가입'}};
const ins=Object.fromEntries(insuranceLines(2000000,2026,all).map(l=>[l.name,l.amount]));
ok('pension 4.75%',ins['국민연금']===95000);
ok('health 3.595%',ins['건강보험']===71900);
ok('long-term care 13.14% of health premium, floored to 10 won',ins['장기요양보험']===9440);
ok('employment 0.9%',ins['고용보험']===18000);
ok('only enrolled insurances are deducted',insuranceLines(2000000,2026,{...all,국민연금:{status:'적용 제외'}}).every(l=>l.name!=='국민연금'));

// 5) 급여 계산에 연결: 자동 계산을 켠 시급 직원
const team=normalizeTeam(null);
team.settings.fivePlus=true;
const e=team.employees[0];Object.assign(e,{payType:'시급',wage:14000,autoPay:true,income:'근로소득',taxMode:'4대보험 자동',insurances:all});
team.attendance=sep.map((a,i)=>({id:'a'+i,employeeId:e.id,...a,breakStart:null}));team.adjustments={};
const row=calculate(team,'2026-09').find(x=>x.employeeId===e.id);
ok('base + weekly holiday + night premium in earnings',row.earnings.map(x=>x.name).join(',')==='기본급,주휴수당,야간근로 가산');
ok('insurance deductions added',['국민연금','건강보험','장기요양보험','고용보험'].every(n=>row.deductions.some(d=>d.name===n)));
{const it=row.deductions.find(d=>d.name==='근로소득세'),lt=row.deductions.find(d=>d.name==='지방소득세');const g=row.gross;ok('income tax from 간이세액표 when salary is above the 0원 band',g<770000?!it:(!!it&&lt.amount===Math.floor(it.amount*0.1/10)*10&&it.formula.includes('간이세액표')));}
team.adjustments['2026-09:'+e.id]={earnings:[{name:'주휴수당',amount:300000,formula:'사장님 직접 입력'}],deductions:[],note:''};
const manual=calculate(team,'2026-09').find(x=>x.employeeId===e.id);
ok('manual entry replaces the automatic line',manual.earnings.filter(x=>x.name==='주휴수당').length===1&&manual.earnings.find(x=>x.name==='주휴수당').amount===300000);
Object.assign(e,{autoPay:false,taxMode:'직접 입력'});team.adjustments={};
ok('automatic calculation is off by default behaviour',calculate(team,'2026-09').find(x=>x.employeeId===e.id).earnings.length===1);
e.wage=9000;ok('below minimum wage warning',calculate(team,'2026-09').find(x=>x.employeeId===e.id).warnings.some(w=>w.includes('최저시급')));
// 6) 임금명세서 기재사항 (근로기준법 시행령 제27조의2)
Object.assign(e,{wage:14000,autoPay:true,taxMode:'4대보험 자동'});team.adjustments={};
const slipRow=calculate(team,'2026-09').find(x=>x.employeeId===e.id);
const slip=payslipText('척척식당','2026-09','2026-10-10',slipRow);
ok('payslip has every required item',payslipMissing(slip).length===0);
ok('payslip shows employee number',slip.includes('직원번호: '+employeeNumber(e.id))&&employeeNumber('3fa9c1d2-77ab-4e10-9c3e-aa11bb22cc33')==='3FA9C1D2');
ok('night premium line carries its hours',/^야간근로 가산: .*\d+\.\d+시간/m.test(slip));
ok('missing items are detected',payslipMissing(slip.replace(/^직원번호: .*$/m,'')).includes('직원번호'));
console.log('PASS: 법정수당(주휴·연장·야간)·4대보험 자동 계산.');
// 작업 047: 휴게시간 법정 기준(근로기준법 제54조)
const {shiftBreakIssue,attendanceBreakShortfalls,requiredBreak}=await import('../lib/labor-checks.ts');
ok('8h work needs 60 min break',requiredBreak(480)===60&&requiredBreak(479)===30&&requiredBreak(239)===0);
ok('9-18 with 60 min break is fine',shiftBreakIssue('09:00','18:00',60)===null);
ok('9-17:30 with 30 min break is short (8h work)',/60분/.test(shiftBreakIssue('09:00','17:30',30)||''));
ok('overnight 22-03 without break is short (5h work)',/30분/.test(shiftBreakIssue('22:00','03:00',0)||''));
ok('3h shift needs no break',shiftBreakIssue('10:00','13:00',0)===null);
ok('attendance shortfalls counted',attendanceBreakShortfalls([shift('2026-09-07','09:00','18:00',0),shift('2026-09-08','09:00','18:00',60),{start:'x',end:null,breakMinutes:0}])===1);
team.attendance=[{id:'b1',employeeId:e.id,...shift('2026-09-07','09:00','18:00',0),breakStart:null}];team.adjustments={};
ok('payroll warns about short breaks',calculate(team,'2026-09').find(x=>x.employeeId===e.id).warnings.some(w=>w.includes('휴게시간')));
console.log('PASS: 휴게시간 법정 기준 경고.');
// 작업 036: 근로계약서 필수 기재사항
const {contractMissing}=await import('../lib/labor-checks.ts');
const full={wage:10320,payType:'시급',payDay:10,employment:'기간의 정함 없음',weeklyHours:20,phone:'010-0000-0000',email:'a@b.kr',contract:{workplace:'본점',duties:'홀 서빙',workDays:'월~금',start:'09:00',end:'13:00',holiday:'매주 일요일',leave:'근로기준법에 따름',paymentMethod:'계좌 이체',employer:'김사장'}};
ok('complete contract has nothing missing',contractMissing(full).length===0);
ok('missing duties and holiday are named',contractMissing({...full,contract:{...full.contract,duties:'',holiday:' '}}).join()==='휴일(주휴일),종사 업무');
ok('fixed-term needs an end date',contractMissing({...full,employment:'기간제',endDate:''}).includes('근로계약기간(종료일)'));
ok('part-time needs weekly hours',contractMissing({...full,employment:'단시간',weeklyHours:0}).includes('주 소정근로시간'));
console.log('PASS: 근로계약서 필수 기재사항 검사.');
// 작업 037: 연소자 보호 (근로기준법 제64·66·69·70조)
const {minorIssues,ageAt}=await import('../lib/labor-checks.ts');
ok('age from birth month',ageAt('2009-11','2026-10-04')===16&&ageAt('2008-10','2026-10-04')===18&&ageAt('',' ')===null);
ok('adults get no minor warnings',minorIssues({birthMonth:'1990-01'},[],'2026-09-01').length===0);
ok('minor without documents is reminded',minorIssues({birthMonth:'2010-03'},[],'2026-09-01').some(w=>w.includes('제66조')));
ok('under 15 needs an employment permit',minorIssues({birthMonth:'2012-05',minorDocs:true},[],'2026-09-01').some(w=>w.includes('취직인허증')));
const teen=[shift('2026-09-07','09:00','18:00',60),shift('2026-09-08','18:00','23:00',0)];
const iss=minorIssues({birthMonth:'2010-03',minorDocs:true},teen,'2026-09-01');
ok('minor 8h day flagged',iss.some(w=>w.includes('하루 7시간')));
ok('minor night work flagged',iss.some(w=>w.includes('밤 10시')));
ok('documents checked: no document warning',!iss.some(w=>w.includes('제66조')));
console.log('PASS: 18세 미만 직원 보호 점검.');
// 작업 030: 요율 연간 갱신 경고
const {hasRatesFor}=await import('../lib/pay-rules.ts');
const now=new Date(Date.now()+9*3600000),thisYear=now.getUTCFullYear();
ok('this year rates are registered (update lib/pay-rules.ts RATES — see docs/RATES-UPDATE.md)',hasRatesFor(thisYear));
if(now.getUTCMonth()===11&&!hasRatesFor(thisYear+1))console.log(`WARN: ${thisYear+1}년 최저임금·4대보험 요율을 lib/pay-rules.ts에 추가해야 해요 (docs/RATES-UPDATE.md).`);
team.attendance=[];Object.assign(e,{wage:20000,payType:'시급',taxMode:'직접 입력'});
ok('unregistered year warns on payroll',calculate(team,'2099-01').find(x=>x.employeeId===e.id).warnings.some(w=>w.includes('2099년')));
console.log('PASS: 요율 연간 갱신 경고.');

// 작업 022: 임금대장
{
 const st={branches:[{id:'b1',name:'본점'},{id:'b2',name:'2호점'}],employees:[{id:'emp-aaaa1111',name:'김직원',joined:'2026-01-02',role:'홀',employment:'단시간',payType:'시급',wage:11000,birthMonth:'2000-05',contract:{duties:'서빙'}},{id:'emp-bbbb2222',name:'=HYPERLINK("x")',joined:'2026-02-01',role:'주방',payType:'월급',wage:2200000,contract:{}}],
  payrollRuns:{
   '2026-03:b1':{locked:true,month:'2026-03',branch:'b1',payDate:'2026-04-10',revision:2,at:'2026-04-01T00:00:00Z',rows:[{employeeId:'emp-aaaa1111',name:'김직원',hours:100.5,days:20,earnings:[{name:'기본급',amount:1105500,formula:'100.50시간 × 11,000원'},{name:'연장근로 가산',amount:22000,formula:'4.00시간(하루 8시간·주 40시간 초과) × 11,000원 × 50%'},{name:'야간근로 가산',amount:11000,formula:'2.00시간(22~06시) × 11,000원 × 50%'}],deductions:[{name:'고용보험',amount:10240,formula:'x'}],gross:1138500,deduction:10240,net:1128260}]},
   '2026-04:b2':{locked:false,month:'2026-04',branch:'b2',payDate:'2026-05-10',revision:1,rows:[{employeeId:'emp-bbbb2222',name:'=HYPERLINK("x")',hours:160,days:20,earnings:[{name:'기본급',amount:2200000,formula:'월급'}],deductions:[],gross:2200000,deduction:0,net:2200000}]},
   '2025-12:b1':{locked:true,month:'2025-12',branch:'b1',payDate:'2026-01-10',rows:[{employeeId:'emp-aaaa1111',name:'김직원',hours:10,days:2,earnings:[],deductions:[],gross:0,deduction:0,net:0}]}}};
 const all=wageLedger(st,'2026-01','2026-12');
 ok('ledger only includes requested period',all.length===2&&all.every(e=>e.month.startsWith('2026')));
 ok('ledger filters by branch',wageLedger(st,'2026-01','2026-12','b1').length===1);
 const a=all[0];
 ok('ledger has 시행령 27조 items',a.name==='김직원'&&a.number===employeeNumber('emp-aaaa1111')&&a.birthMonth==='2000-05'&&a.joined==='2026-01-02'&&a.duty.includes('서빙')&&a.payBasis==='시급 11,000원'&&a.days===20&&a.hours===100.5);
 ok('ledger extracts overtime and night hours',a.overtimeHours===4&&a.nightHours===2&&a.holidayHours===0);
 ok('ledger marks reopened month',all[1].status==='확정 해제 중'&&a.status==='확정'&&a.revision===2);
 const csv=ledgerCsv(all);
 ok('ledger csv has BOM and per-item columns',csv.startsWith('\uFEFF')&&csv.includes('"[지급] 연장근로 가산"')&&csv.includes('"[공제] 고용보험"')&&csv.includes('"10240"'));
 ok('ledger csv neutralizes formulas',!csv.includes(',"=HYPERLINK')&&csv.includes(`"'=HYPERLINK(""x"")"`));
 ok('csv cell escapes leading minus and quotes',csvCell('-1')==='"\'-1"'&&csvCell('a"b')==='"a""b"');
 console.log('PASS: 임금대장(근로기준법 제48조, 시행령 제27조).');
}

// 작업 098: 근로기준 안내가 급여 계산 요율과 같은 숫자를 쓰는지
{
 const {laborGuide,laborSources,LABOR_GUIDE_YEAR}=await import('../dist/server/labor-guide.js');
 const {RATES}=await import('../lib/pay-rules.ts');const r=RATES[LABOR_GUIDE_YEAR];
 const text=laborGuide.map(x=>x.join(' ')).join('\n');
 ok('guide year has registered rates',!!r);
 ok('guide shows the same minimum wage as payroll',text.includes(r.minimumWage.toLocaleString('ko-KR')+'원'));
 ok('guide shows monthly minimum (209h)',text.includes((r.minimumWage*209).toLocaleString('ko-KR')+'원'));
 ok('guide shows the same insurance rates as payroll',['4.75%','3.595%','13.14%','0.9%'].every(v=>text.includes(v))&&Math.abs(r.pension-0.0475)<1e-9);
 ok('every guide item links an official https source',laborGuide.every(x=>/^https:\/\/(www\.)?([a-z0-9]+\.)*(go\.kr|or\.kr)\//.test(laborSources[x[3]]||'')));
 console.log('PASS: 근로기준 안내 숫자·출처.');
}

// 작업 032: 인건비 계산기(손으로 계산한 값)
{
 const {estimateLabor}=await import('../dist/server/labor-estimate.js');
 let e=estimateLabor({wage:10320,dailyHours:5,days:4,year:2026});
 ok('calc weekly hours and 주휴 (20h → 4h)',e.weeklyHours===20&&e.juhuEligible&&e.juhuHours===4&&e.week.base===206400&&e.week.juhu===41280&&e.week.total===247680);
 ok('calc monthly = week × 4.345',e.month.gross===Math.round(247680*4.345));
 e=estimateLabor({wage:10320,dailyHours:3,days:4,year:2026});ok('under 15h no 주휴',!e.juhuEligible&&e.week.juhu===0);
 e=estimateLabor({wage:12000,dailyHours:10,days:5,nightHours:4,fivePlus:true,year:2026});
 ok('5+ overtime (2h×5 + 0) and night 50%',e.week.overtime===10*12000*0.5&&e.week.night===4*12000*0.5&&e.juhuHours===8);
 e=estimateLabor({wage:12000,dailyHours:10,days:5,nightHours:4,fivePlus:false,year:2026});ok('under 5 no premiums',e.week.overtime===0&&e.week.night===0);
 e=estimateLabor({wage:10320,dailyHours:8,days:5,deduction:'insurance',industrialRate:0.009,year:2026});
 const g=e.month.gross;ok('employee insurance uses payroll rates',e.deductions.pension===Math.floor(g*0.0475/10)*10&&e.deductions.employment===Math.floor(g*0.009/10)*10&&e.deductions.care===Math.floor(e.deductions.health*0.1314/10)*10);
 ok('employer adds stability 0.25% and industrial',e.employer.employment===Math.floor(g*0.0115/10)*10&&e.employer.industrial===Math.floor(g*0.009/10)*10&&e.month.laborCost===g+e.month.employerInsurance);
 e=estimateLabor({wage:10320,dailyHours:3,days:4,deduction:'insurance',year:2026});ok('under 60h/month pension·health excluded',e.pensionHealthExcluded&&e.deductions.pension===0&&e.deductions.employment>0);
 e=estimateLabor({wage:10320,dailyHours:5,days:4,deduction:'3.3',year:2026});ok('3.3% = 3% + 0.3% each floored',e.deductions.tax33===Math.floor(e.month.gross*0.03/10)*10+Math.floor(e.month.gross*0.003/10)*10);
 ok('below minimum wage flagged',estimateLabor({wage:9000,dailyHours:5,days:4,year:2026}).belowMinimum);
 console.log('PASS: 인건비 계산기.');
}

// 작업 048: 근무표 반복·복사·템플릿
{
 const {repeatShifts,copyWeek,weekToTemplate,applyTemplate,findShiftConflict,MAX_REPEAT}=await import('../lib/schedule-tools.ts');
 let n=0;const id=()=>'n'+(n++);
 const base={employeeId:'e1',start:'09:00',end:'14:00',breakMinutes:30};
 const existing=[{id:'x',employeeId:'e1',date:'2026-10-07',start:'10:00',end:'12:00',breakMinutes:0}];
 let p=repeatShifts(base,'2026-10-05',[1,3,5],1,existing,id);// 월·수·금, 2026-10-05는 월요일
 ok('repeat counts Mon/Wed/Fri for one month',p.made.length+p.skipped.length===14&&p.made.every(s=>[1,3,5].includes(new Date(s.date+'T00:00:00Z').getUTCDay())));
 ok('repeat skips day with overlapping shift',p.skipped.includes('2026-10-07')&&!p.made.some(s=>s.date==='2026-10-07'));
 ok('repeat never exceeds cap',repeatShifts(base,'2026-01-01',[0,1,2,3,4,5,6],24,[],id).made.length===MAX_REPEAT);
 ok('repeated shifts do not conflict',findShiftConflict([...existing,...p.made])===null);
 const week=[{id:'a',employeeId:'e1',date:'2026-09-28',start:'09:00',end:'14:00',breakMinutes:30},{id:'b',employeeId:'e2',date:'2026-10-02',start:'22:00',end:'06:00',breakMinutes:60}];
 let c=copyWeek([...week,...existing],'2026-09-28','2026-10-05',id);
 ok('copy week moves dates by 7 days',c.made.map(s=>s.date).sort().join()==='2026-10-05,2026-10-09');
 c=copyWeek([...week,{id:'y',employeeId:'e2',date:'2026-10-09',start:'23:00',end:'23:30',breakMinutes:0}],'2026-09-28','2026-10-05',id);
 ok('copy week skips overlapping overnight shift',c.skipped.length===1&&c.made.length===1);
 const t=weekToTemplate(week,'2026-09-28');ok('template keeps weekday',t.length===2&&t[0].weekday===1&&t[1].weekday===5);
 const a=applyTemplate(t,'2026-10-12',[],new Set(['e1']),id);ok('template applies only to active employees',a.made.length===1&&a.made[0].date==='2026-10-12');
 ok('conflict finder sees overnight overlap',!!findShiftConflict([{id:'1',employeeId:'e',date:'2026-10-01',start:'22:00',end:'06:00',breakMinutes:0},{id:'2',employeeId:'e',date:'2026-10-02',start:'05:00',end:'09:00',breakMinutes:0}]));
 console.log('PASS: 근무표 반복·복사·템플릿.');
}

// 작업 046: 지각·조퇴·미출근·예정 외 출근
{
 const {checkDay,summarize}=await import('../lib/attendance-check.ts');
 const iso=(d,hm)=>new Date(`${d}T${hm}:00+09:00`).toISOString();
 const shifts=[{id:'s1',employeeId:'a',date:'2026-10-05',start:'09:00',end:'14:00'},{id:'s2',employeeId:'b',date:'2026-10-05',start:'10:00',end:'15:00'},{id:'s3',employeeId:'c',date:'2026-10-05',start:'22:00',end:'06:00'},{id:'s4',employeeId:'d',date:'2026-10-05',start:'09:00',end:'13:00'}];
 const att=[{id:'1',employeeId:'a',start:iso('2026-10-05','09:12'),end:iso('2026-10-05','13:40')},{id:'2',employeeId:'b',start:iso('2026-10-05','10:03'),end:iso('2026-10-05','15:02')},{id:'3',employeeId:'c',start:iso('2026-10-05','21:58'),end:iso('2026-10-06','06:00')},{id:'4',employeeId:'e',start:iso('2026-10-05','11:00'),end:null}];
 const now=Date.parse('2026-10-06T12:00:00+09:00');
 let f=checkDay('2026-10-05',shifts,att,'normal',now);const k=x=>f.filter(y=>y.employeeId===x).map(y=>y.kind+(y.minutes??'')).join();
 ok('late 12m and early 20m flagged',k('a')==='지각12,조퇴20');
 ok('within 5m tolerance is normal',k('b')==='');
 ok('overnight shift matched',k('c')==='');
 ok('no record after shift end = 미출근',k('d')==='미출근');
 ok('record without shift = 예정 외 출근',k('e')==='예정 외 출근');
 f=checkDay('2026-10-05',shifts,att,'lenient',now);ok('lenient 10m still flags 12m late',f.some(x=>x.employeeId==='a'&&x.kind==='지각'));
 f=checkDay('2026-10-05',shifts,att,'strict',now);ok('strict flags 3m late',f.some(x=>x.employeeId==='b'&&x.kind==='지각'&&x.minutes===3));
 ok('future shift not yet 미출근',!checkDay('2026-10-05',shifts,[],'normal',Date.parse('2026-10-05T08:00:00+09:00')).some(x=>x.kind==='미출근'));
 ok('summary counts',summarize(checkDay('2026-10-05',shifts,att,'normal',now)).지각===1);
 console.log('PASS: 지각·조퇴·미출근 표시.');
}

// 주 시작요일(일요일) 설정: 일~토로 묶어 주휴 계산
{
 const kst2=(day,hm)=>new Date(`${day}T${hm}:00+09:00`).toISOString();
 // 2026-10-04(일) 8시간, 10-05(월)~10-08(목) 각 2시간 → 월요일 시작이면 두 주로 갈려 각 15시간 미만, 일요일 시작이면 한 주 16시간
 const recs=[['2026-10-04','09:00','17:00'],...['05','06','07','08'].map(d=>['2026-10-'+d,'09:00','11:00'])].map(([d,s,e])=>({start:kst2(d,s),end:kst2(d,e),breakMinutes:0}));
 const mon=allowances(recs,'2026-10',10320,false,'mon').lines.find(l=>l.name==='주휴수당');
 const sun=allowances(recs,'2026-10',10320,false,'sun').lines.find(l=>l.name==='주휴수당');
 ok('week start Monday splits the week (no 주휴)',!mon);
 ok('week start Sunday groups Sun–Sat (주휴 16h)',sun&&sun.amount===Math.round(16/40*8*10320));
 console.log('PASS: 주 시작요일.');
}

// 수습 감액·비과세 수당
{
 const {newMember,probation}=await import('../dist/server/team-model.js');
 const kst3=(day,hm)=>new Date(`${day}T${hm}:00+09:00`).toISOString();
 const t=normalizeTeam(null);delete t.legacy;t.employees=[];t.attendance=[];t.shifts=[];t.adjustments={};t.payrollRuns={};
 const m={...newMember(),id:'p1',name:'수습',joined:'2026-09-15',employment:'기간의 정함 없음',payType:'시급',wage:11000,autoPay:false,taxMode:'직접 입력',status:'재직',probation:{months:1,rate:0.9}};
 t.employees=[m];
 t.attendance=[['2026-10-10'],['2026-10-20']].map(([d],i)=>({id:'pa'+i,employeeId:'p1',start:kst3(d,'09:00'),end:kst3(d,'13:00'),breakMinutes:0,breakStart:null}));
 let row=calculate(t,'2026-10').find(r=>r.employeeId==='p1');
 ok('probation 90% only before end date (10-15)',row.earnings[0].amount===Math.round(4*11000*0.9+4*11000)&&probation(m).until==='2026-10-15');
 t.attendance[0].start=kst3('2026-10-10','09:00');t.employees[0].joined='2026-10-01';
 row=calculate(t,'2026-10').find(r=>r.employeeId==='p1');
 ok('all hours inside probation at 90%',row.earnings[0].amount===Math.round(8*11000*0.9)&&row.earnings[0].formula.includes('수습'));
 t.employees[0]={...t.employees[0],employment:'기간제',endDate:'2026-12-31'};row=calculate(t,'2026-10').find(r=>r.employeeId==='p1');
 ok('contract under 1 year: no probation discount + warning',row.earnings[0].amount===8*11000&&row.warnings.some(w=>w.includes('1년 이상')));
 t.employees[0]={...t.employees[0],employment:'기간의 정함 없음',probation:{months:1,rate:0.9,simpleLabor:true}};row=calculate(t,'2026-10').find(r=>r.employeeId==='p1');
 ok('simple labor: no probation discount',row.earnings[0].amount===8*11000&&row.warnings.some(w=>w.includes('단순노무')));
 // 비과세 식대는 4대보험 기준에서 빠진다
 t.employees[0]={...t.employees[0],probation:undefined,taxMode:'4대보험 자동',income:'근로소득',insurances:Object.fromEntries(['국민연금','건강보험','장기요양','고용보험','산재보험'].map(n=>[n,{status:'가입',reason:''}]))};
 t.adjustments['2026-10:p1']={earnings:[{name:'식대',amount:200000,formula:'월 정액',taxFree:true}],deductions:[],note:''};
 row=calculate(t,'2026-10').find(r=>r.employeeId==='p1');
 const pension=row.deductions.find(d=>d.name==='국민연금');
 ok('tax-free meal excluded from insurance base (pension floor 410,000 from 2026-07)',pension.amount===Math.floor(Math.max(410000,Math.floor((row.gross-200000)/1000)*1000)*0.0475/10)*10&&row.gross===8*11000+200000&&pension.formula.includes('하한'));
 t.adjustments['2026-10:p1'].earnings[0].amount=250000;row=calculate(t,'2026-10').find(r=>r.employeeId==='p1');
 ok('tax-free over 200,000 warns',row.warnings.some(w=>w.includes('비과세')));
 console.log('PASS: 수습 감액·비과세 수당.');
}

// 작업 023: 근로소득 간이세액표(2026.2.27 개정) 표 값 그대로
{
 const {incomeTax}=await import('../dist/server/income-tax.js');
 ok('3,000천원 1명 = 74,350 / 지방 7,430',incomeTax(3000000,2026,1).incomeTax===74350&&incomeTax(3000000,2026,1).localTax===7430);
 ok('3,010천원 3명 = 31,940 (같은 구간)',incomeTax(3010000,2026,3).incomeTax===31940);
 ok('5,000천원 2명 = 306,710',incomeTax(5000000,2026,2).incomeTax===306710);
 ok('월 76만원 이하는 0',incomeTax(760000,2026,1).incomeTax===0);
 ok('자녀 1명 20,830 공제',incomeTax(5000000,2026,2,1).incomeTax===306710-20830);
 ok('자녀 3명 45,830+33,330 공제',incomeTax(5000000,2026,4,3).incomeTax===Math.floor((219100-45830-33330)/10)*10);
 ok('80% 선택',incomeTax(3000000,2026,1,0,80).incomeTax===Math.floor(74350*0.8/10)*10);
 ok('1천만원 정확히 = 표 맨 끝 값',incomeTax(10000000,2026,1).incomeTax===1507400);
 ok('1,200만원(1천만원 초과 구간) = 기준 + 2백만×98%×35% + 25,000',incomeTax(12000000,2026,1).incomeTax===Math.floor((1507400+25000+2000000*0.98*0.35)/10)*10);
 ok('가족 12명 = 11명 − (10명−11명)',incomeTax(10000000,2026,12).incomeTax===Math.floor((960840-(990840-960840))/10)*10);
 console.log('PASS: 근로소득 간이세액표.');
}

// 작업 024: 국민연금 상·하한(7월 변경), 건강보험 본인 상한
{
 const all2=Object.fromEntries(['국민연금','건강보험','장기요양','고용보험'].map(n=>[n,{status:'가입'}]));
 const p=(g,m)=>insuranceLines(g,2026,all2,m).find(l=>l.name==='국민연금').amount;
 ok('pension floor 400,000 before July 2026',p(300000,'2026-06')===Math.floor(400000*0.0475/10)*10);
 ok('pension floor 410,000 from July 2026',p(300000,'2026-07')===Math.floor(410000*0.0475/10)*10);
 ok('pension cap 6,370,000 / 6,590,000',p(9000000,'2026-06')===Math.floor(6370000*0.0475/10)*10&&p(9000000,'2026-08')===Math.floor(6590000*0.0475/10)*10);
 ok('pension base truncates below 1,000',p(2345678,'2026-08')===Math.floor(2345000*0.0475/10)*10);
 ok('health employee cap 4,591,740',insuranceLines(200000000,2026,all2,'2026-08').find(l=>l.name==='건강보험').amount===4591740);
 console.log('PASS: 4대보험 상·하한.');
}
