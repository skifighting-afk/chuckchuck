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
ok('base + weekly holiday + 추석(9/24) holiday + night premium in earnings',row.earnings.map(x=>x.name).join(',')==='기본급,주휴수당,휴일근로 가산,야간근로 가산');
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

// 작업 025: 휴일근로 가산(5명 이상) — 8시간 이내 50%, 초과 100%, 연장과 겹쳐 세지 않음
{
 const {holidaysFor}=await import('../lib/holidays.ts');
 const k=(d,hm)=>new Date(`${d}T${hm}:00+09:00`).toISOString();
 const rec=[{start:k('2026-10-09','09:00'),end:k('2026-10-09','20:00'),breakMinutes:60}]; // 한글날 10시간
 const h=holidaysFor(2026,true);
 let a=allowances(rec,'2026-10',10000,true,'mon',h);const line=a.lines.find(l=>l.name==='휴일근로 가산');
 ok('holiday 10h = 8h×50% + 2h×100%',line&&line.amount===8*10000*0.5+2*10000&&line.formula.includes('한글날'));
 ok('holiday hours not also counted as overtime',!a.lines.some(l=>l.name==='연장근로 가산'));
 a=allowances(rec,'2026-10',10000,false,'mon',holidaysFor(2026,false));ok('under 5: no holiday premium + note',!a.lines.length&&a.notes.some(n=>n.includes('휴일')));
 ok('labor day is a holiday even under 5',holidaysFor(2026,false).has('2026-05-01')&&!holidaysFor(2026,false).has('2026-10-09'));
 ok('2026 has 21 public holiday entries incl. 6/3 election',holidaysFor(2026,true).size===22&&holidaysFor(2026,true).get('2026-06-03')==='전국동시지방선거');
 console.log('PASS: 휴일근로 가산.');
}

// 작업 026: 주휴 개근 판단
{
 const k=(d,hm)=>new Date(`${d}T${hm}:00+09:00`).toISOString();
 const t=normalizeTeam(null);delete t.legacy;t.adjustments={};t.payrollRuns={};
 const e=t.employees[0];Object.assign(e,{payType:'시급',wage:10000,autoPay:true,taxMode:'직접 입력'});t.employees=[e];
 // 2026-09-07(월)~09-11(금) 근무표 5일, 4시간씩. 하루(09-09) 결근.
 const days=['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11'];
 t.shifts=days.map((d,i)=>({id:'s'+i,employeeId:e.id,date:d,start:'09:00',end:'13:00',breakMinutes:0}));
 t.attendance=days.filter(d=>d!=='2026-09-09').map((d,i)=>({id:'a'+i,employeeId:e.id,start:k(d,'09:00'),end:k(d,'13:00'),breakMinutes:0,breakStart:null}));
 // 16시간이라 원래 주휴 대상
 let row=calculate(t,'2026-09').find(r=>r.employeeId===e.id);
 ok('absent week: no 주휴 + week listed',!row.earnings.some(x=>x.name==='주휴수당')&&row.juhuSkipped.includes('2026-09-07')&&row.warnings.some(w=>w.includes('개근')));
 t.adjustments['2026-09:'+e.id]={earnings:[],deductions:[],note:'',juhuKeep:['2026-09-07']};
 row=calculate(t,'2026-09').find(r=>r.employeeId===e.id);ok('owner can accept as 개근',row.earnings.some(x=>x.name==='주휴수당'));
 t.adjustments={};t.approvedLeaves=[{employeeId:e.id,start:'2026-09-09',end:'2026-09-09'}];
 row=calculate(t,'2026-09').find(r=>r.employeeId===e.id);ok('approved leave day is not absence',row.earnings.some(x=>x.name==='주휴수당'));
 console.log('PASS: 주휴 개근 판단.');
}

// 작업 027: 일급·월급 통상시급
{
 const {ordinaryHourly}=await import('../dist/server/team-model.js');
 ok('monthly 40h → 209h',ordinaryHourly({payType:'월급',wage:2156880,weeklyHours:40,contract:{}}).hourly===Math.round(2156880/209));
 ok('daily wage ÷ contract hours',ordinaryHourly({payType:'일급',wage:96000,weeklyHours:40,contract:{start:'09:00',end:'18:00',breakMinutes:60}}).hourly===12000);
 const k=(d,hm)=>new Date(`${d}T${hm}:00+09:00`).toISOString();
 const t=normalizeTeam(null);delete t.legacy;t.adjustments={};t.payrollRuns={};t.shifts=[];t.settings.fivePlus=true;
 const e=t.employees[0];Object.assign(e,{payType:'월급',wage:2090000,weeklyHours:40,autoPay:true,taxMode:'직접 입력'});t.employees=[e];
 t.attendance=[{id:'m1',employeeId:e.id,start:k('2026-09-07','09:00'),end:k('2026-09-07','21:00'),breakMinutes:60,breakStart:null}];
 const row=calculate(t,'2026-09').find(r=>r.employeeId===e.id);
 ok('monthly worker overtime 3h at 통상시급 10,000',row.earnings.some(x=>x.name==='연장근로 가산'&&x.amount===3*10000*0.5&&x.formula.includes('통상시급')));
 ok('monthly wage already includes 주휴',!row.earnings.some(x=>x.name==='주휴수당'));
 console.log('PASS: 일급·월급 통상시급.');
}

// 작업 028: 상시 근로자 수
{
 const {headcount,lastMonthWindow}=await import('../lib/headcount.ts');
 const k=(d)=>new Date(`${d}T09:00:00+09:00`).toISOString();
 const att=(d,n)=>Array.from({length:n},(_,i)=>({employeeId:'e'+i,start:k(d)}));
 // 10일 가동: 6명 6일 + 3명 4일 → 연인원 48 ÷ 10 = 4.8명, 5명 이상인 날 6일(1/2 이상) → 5명 이상
 let a=[...['01','02','03','04','05','06'].flatMap(d=>att('2026-09-'+d,6)),...['07','08','09','10'].flatMap(d=>att('2026-09-'+d,3))];
 let h=headcount(a,'2026-09-01','2026-10-01');ok('average 4.8 but 5+ days ≥ half → 5명 이상',h.average===4.8&&h.fivePlus);
 a=[...['01','02','03','04'].flatMap(d=>att('2026-09-'+d,7)),...['05','06','07','08','09','10'].flatMap(d=>att('2026-09-'+d,4))];
 h=headcount(a,'2026-09-01','2026-10-01');ok('average 5.2 but under-5 days ≥ half → 5명 미만',h.average===5.2&&!h.fivePlus);
 ok('window is previous month',JSON.stringify(lastMonthWindow('2026-10-05'))===JSON.stringify({from:'2026-09-05',to:'2026-10-05'}));
 console.log('PASS: 상시 근로자 수.');
}

// 작업 029: 연차 자동 발생(근로기준법 제60조)
{
 const {annualLeave,leaveBalanceFor,unusedLeavePay}=await import('../dist/server/annual-leave.js');
 const e={joined:'2026-01-15',weeklyHours:40};
 ok('5명 미만은 미적용',!annualLeave(e,'2026-10-05',false).eligible);
 ok('주 15시간 미만 미적용',!annualLeave({...e,weeklyHours:14},'2026-10-05',true).eligible);
 ok('1년 미만: 개근 개월마다 1일 (1/15 입사 → 10/5까지 8일)',annualLeave(e,'2026-10-05',true).earned===8);
 ok('입사 1개월 되는 날 1일 발생',annualLeave(e,'2026-02-14',true).earned===0&&annualLeave(e,'2026-02-15',true).earned===1);
 ok('1년 미만 최대 11일',annualLeave(e,'2027-01-14',true).earned===11);
 const y1=annualLeave(e,'2027-01-15',true);ok('1년 되는 날 15일 추가(월 개근분 11일은 각 1년 동안 유효)',y1.earned===26&&y1.grants.filter(g=>g.kind==='월 개근').length===11);
 ok('월 개근분은 발생 1년 뒤 소멸',annualLeave(e,'2027-02-15',true).earned===15+10);
 ok('3년차 16일',annualLeave({joined:'2020-03-01',weeklyHours:40},'2023-03-01',true).earned===16);
 ok('21년차 25일 상한',annualLeave({joined:'2000-03-01',weeklyHours:40},'2026-03-01',true).earned===25);
 ok('주 20시간은 비례(1년차 7.5일)',annualLeave({joined:'2025-03-01',weeklyHours:20},'2026-03-01',true).grants.find(g=>g.kind==='1년 근속').days===7.5);
 ok('말일 입사: 1/31 → 2/28 발생',annualLeave({joined:'2026-01-31',weeklyHours:40},'2026-02-28',true).earned===1);
 ok('다음 발생 예정',JSON.stringify(annualLeave(e,'2026-10-05',true).next)===JSON.stringify({at:'2026-10-15',days:1}));
 const b=leaveBalanceFor(e,[{kind:'연차',status:'승인',start:'2026-05-01',days:2},{kind:'연차',status:'반려',start:'2026-06-01',days:1},{kind:'무급휴가',status:'승인',start:'2026-06-02',days:1}],'2026-10-05',true);
 ok('승인된 연차만 차감',b.used===2&&b.remaining===6);
 ok('퇴사자는 퇴사일 기준',annualLeave({...e,status:'퇴사',endDate:'2026-04-20'},'2026-10-05',true).earned===3);
 ok('미사용 연차수당 = 일수 × 8시간 × 통상시급',unusedLeavePay(6,10320)===495360);
 console.log('PASS: 연차 자동 발생.');
}

// 작업 050: 근무 가능 시간으로 근무표 초안
{
 const {draftFromAvailability}=await import('../lib/schedule-tools.ts');
 let k=0;const nid=()=>'d'+(++k);const W='2026-10-05';// 월요일
 const needs=[{weekday:1,start:'09:00',end:'15:00',count:2,breakMinutes:30},{weekday:2,start:'09:00',end:'15:00',count:1,breakMinutes:30},{weekday:6,start:'18:00',end:'02:00',count:1,breakMinutes:60}];
 const av={a:[{weekday:1,start:'08:00',end:'16:00'},{weekday:2,start:'09:00',end:'15:00'}],b:[{weekday:1,start:'09:00',end:'14:00'},{weekday:6,start:'17:00',end:'03:00'}],c:[{weekday:1,start:'09:00',end:'15:00'},{weekday:2,start:'09:00',end:'15:00'}]};
 const staff=[{id:'a',weeklyHours:40},{id:'b',weeklyHours:20},{id:'c',weeklyHours:5.5}];
 let r=draftFromAvailability(needs,av,W,[],staff,[],nid);
 ok('월요일 2명: 가능 시간을 다 덮는 a·c (b는 14시까지라 제외)',r.made.filter(x=>x.date==='2026-10-05').map(x=>x.employeeId).sort().join()==='a,c');
 ok('화요일: c는 주 5.5시간 상한이라 a',r.made.find(x=>x.date==='2026-10-06').employeeId==='a');
 ok('토요일 밤샘 근무도 가능 시간이 덮으면 배정',r.made.find(x=>x.date==='2026-10-10')?.employeeId==='b');
 ok('모두 채움',r.unfilled.length===0);
 r=draftFromAvailability(needs,av,W,[{id:'x',employeeId:'a',date:'2026-10-05',start:'09:00',end:'15:00',breakMinutes:30}],staff,[{employeeId:'c',start:'2026-10-05',end:'2026-10-05'}],nid);
 ok('이미 있는 근무는 인원에 포함, 휴가자는 제외 → 못 채운 1명',r.made.filter(x=>x.date==='2026-10-05').length===0&&r.unfilled[0].missing===1&&r.unfilled[0].date==='2026-10-05');
 ok('적게 일한 직원부터',draftFromAvailability([{weekday:2,start:'09:00',end:'15:00',count:1,breakMinutes:30}],av,W,[{id:'y',employeeId:'a',date:'2026-10-05',start:'09:00',end:'15:00',breakMinutes:30}],staff,[],nid).made[0].employeeId==='c');
 console.log('PASS: 근무 가능 시간 초안.');
}

// PDF 저장(이미지 페이지 → A4 PDF)
{
 const {imagesToPdf}=await import('../lib/pdf.ts');
 const jpeg=new Uint8Array([0xff,0xd8,0xff,0xd9]);const out=new TextDecoder('latin1').decode(imagesToPdf([{jpeg,width:1240,height:1754},{jpeg,width:1240,height:1754}],'합본'));
 ok('PDF header/trailer',out.startsWith('%PDF-1.4')&&out.trimEnd().endsWith('%%EOF'));
 ok('two pages',(out.match(/\/Type \/Page /g)||[]).length===2&&out.includes('/Count 2'));
 const xref=Number(out.match(/startxref\n(\d+)/)[1]);ok('startxref points to xref',out.slice(xref,xref+4)==='xref');
 const offs=[...out.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map(m=>Number(m[1]));ok('every xref offset points to its object',offs.every((o,i)=>out.slice(o).startsWith((i+1)+' 0 obj')));
 ok('empty input refused',(()=>{try{imagesToPdf([]);return false}catch{return true}})());
 console.log('PASS: PDF 저장.');
}

// 작업 096·097·035: 오늘 할 일, 월말 마감 체크리스트, 지급일 경고
{
 const {todayTasks,monthChecklist,payDateIssue}=await import('../dist/server/close-check.js');
 const s=normalizeTeam(null);const e0=s.employees[0],e1=s.employees[1],b=e0.branchId;
 for(const e of s.employees){e.status='재직';e.contract.status='체결 완료';e.income='근로소득';for(const k of Object.keys(e.insurances))e.insurances[k]={status:'가입',reason:''};e.payType='시급';e.wage=11000;e.email='x'+e.id+'@ex.invalid';}
 s.attendance=[{id:'a1',employeeId:e0.id,start:'2026-10-03T00:00:00.000Z',end:null,breakMinutes:0,breakStart:null}];
 s.requests=[{id:'r',status:'승인 대기',before:{id:'a1',employeeId:e1.id,start:'2026-10-02T00:00:00.000Z'},after:{start:'2026-10-02T00:00:00.000Z'}}];
 e1.contract.status='서명 대기';e1.endDate='2026-10-20';
 const t=todayTasks(s,b,'2026-10-05',{pendingLeaves:2,pendingSwaps:1,unsentPayslips:3});const c=k=>t.find(x=>x.key===k)?.count||0;
 ok('오늘 할 일: 정정·휴가·대타·퇴근 누락·계약·명세서·만료',c('corrections')===1&&c('leaves')===2&&c('swaps')===1&&c('clockout')===1&&c('contracts')===1&&c('payslips')===3&&c('ending')===1);
 ok('오늘 출근 중인 사람은 퇴근 누락이 아님',todayTasks(s,b,'2026-10-03').every(x=>x.key!=='clockout'));
 ok('0건 항목은 숨김',todayTasks(s,b,'2026-10-05').every(x=>x.count>0));
 e0.wage=10000;const m=monthChecklist(s,b,'2026-10','2026-10-08',{pendingLeavesInMonth:1});const g=k=>m.find(x=>x.key===k);
 ok('마감: 퇴근 누락·정정·휴가·최저시급·계약 확인 필요',!g('clockout').ok&&!g('corrections').ok&&!g('leaves').ok&&!g('minwage').ok&&g('minwage').detail.includes(e0.name)&&!g('contract').ok&&g('insurance').ok);
 ok('마감: 지급일 평일이면 통과',g('paydate').ok);
 ok('지급일 토요일 경고',payDateIssue('2026-10-10').includes('토요일'));
 ok('지급일 공휴일(개천절) 경고',payDateIssue('2026-10-09').includes('한글날')||payDateIssue('2026-10-03').includes('개천절'));
 ok('지급일 평일은 문제 없음',payDateIssue('2026-10-08')==='');
 console.log('PASS: 오늘 할 일·월말 마감·지급일.');
}

// 작업 033: 사장님 부담 4대보험
{
 const {employerInsurance}=await import('../dist/server/employer-insurance.js');
 const all={국민연금:{status:'가입'},건강보험:{status:'가입'},장기요양:{status:'가입'},고용보험:{status:'가입'}};
 const r=employerInsurance({gross:2200000,earnings:[{amount:200000,taxFree:true},{amount:2000000}]},{income:'근로소득',insurances:all},'2026-10',0.007);const g=n=>r.lines.find(l=>l.name===n)?.amount;
 ok('비과세 제외 기준 200만원',r.base===2000000);
 ok('국민연금 사장님 = 근로자와 같은 4.75%',g('국민연금')===95000);
 ok('건강보험 3.595%, 장기요양 13.14%',g('건강보험')===71900&&g('장기요양보험')===Math.floor(71900*0.1314/10)*10);
 ok('고용보험 0.9% + 0.25%',g('고용보험')===23000);
 ok('산재 업종 요율',g('산재보험')===14000);
 ok('사업소득은 사장님 부담 없음',employerInsurance({gross:1000000,earnings:[]},{income:'사업소득',insurances:all},'2026-10',0.007).total===0);
 ok('미가입 보험은 제외, 산재는 가입 여부와 무관',employerInsurance({gross:1000000,earnings:[]},{income:'근로소득',insurances:{}},'2026-10',0.007).lines.map(l=>l.name).join()==='산재보험');
 console.log('PASS: 사장님 부담 4대보험.');
}

// 작업 034: 월급 직원 중도 입·퇴사 일할
{
 const s=normalizeTeam(null);const e=s.employees[0];Object.assign(e,{status:'재직',payType:'월급',wage:3100000,joined:'2026-10-11',autoPay:false,taxMode:'직접 입력'});s.employees=[e];s.shifts=[];s.attendance=[];
 let r=calculate(s,'2026-10')[0];const base=r.earnings[0];
 ok('10/11 입사: 31일 중 21일',base.amount===Math.round(3100000*21/31)&&base.formula.includes('재직 21일/31일')&&base.formula.includes('2026-10-11 입사'));
 Object.assign(e,{joined:'2026-01-01',status:'퇴사',endDate:'2026-10-15'});r=calculate(s,'2026-10')[0];
 ok('10/15 퇴사: 15일',r&&r.earnings[0].amount===1500000&&r.earnings[0].formula.includes('2026-10-15 퇴사'));
 Object.assign(e,{status:'재직',endDate:''});r=calculate(s,'2026-10')[0];ok('만근은 월급 그대로',r.earnings[0].amount===3100000&&!r.earnings[0].formula.includes('재직'));
 console.log('PASS: 중도 입·퇴사 일할.');
}

// 작업 054: 직원 일괄 등록
{
 const {parseBulk}=await import('../dist/server/bulk-members.js');const {teamSchema}=await import('../dist/server/team-model.js');
 const text=['이름\t연락처\t이메일\t입사일\t급여형태\t급여\t주 소정시간\t직무','김민지\t010-1\tMinji@Ex.com\t2026.10.5\t시급\t10,320원\t20\t홀','박준호\t010-2\tjun@ex.com\t\t월급\t2500000\t\t주방','\t\t\t\t\t\t\t','이서연\t\tminji@ex.com\t2026-13-01\t연봉\tabc\t90\t사장','최현우\t010-3\told@ex.com\t\t\t11000'].join('\n');
 const r=parseBulk(text,'branch-main',['OLD@ex.com'],{workplace:'점검식당',employer:'김사장'});
 ok('제목 줄·빈 줄 건너뜀',r.length===4&&r[0].line===2);
 ok('날짜·금액 정리, 이메일 소문자',r[0].member.joined==='2026-10-05'&&r[0].member.wage===10320&&r[0].member.email==='minji@ex.com');
 ok('월급 기본 40시간·정규직',r[1].member.weeklyHours===40&&r[1].member.employment==='기간의 정함 없음'&&r[1].member.role==='주방');
 ok('여러 오류를 한 줄에 모두 알려 줌',r[2].errors.length>=5&&r[2].errors.some(e=>e.includes('이메일')));
 ok('기존 직원 이메일 중복 차단',r[3].errors.some(e=>e.includes('이미 등록')));
 ok('근무장소·사업주 채움',r[0].member.contract.workplace==='점검식당'&&r[0].member.contract.employer==='김사장');
 ok('이메일·연락처 필수',parseBulk('누구\t\t\t\t시급\t10320','b').at(0).errors.length===2);
 const st=normalizeTeam(null);st.employees=[...st.employees,...r.filter(x=>x.member).map(x=>x.member)];ok('등록 결과가 저장 검사를 통과',teamSchema.safeParse(st).success);
 console.log('PASS: 직원 일괄 등록.');
}

// 작업 079: 연락처 가리기
{
 const {maskPhone,maskEmail,maskAddress}=await import('../lib/mask.ts');
 ok('휴대폰 가운데 가림',maskPhone('010-1234-5678')==='010-****-5678'&&maskPhone('01012345678')==='010-****-5678');
 ok('이메일 앞 한 글자만',maskEmail('minji@example.com')==='m•••@example.com');
 ok('주소는 시·구까지만',maskAddress('서울시 마포구 월드컵로 1 101호')==='서울시 마포구 •••');
 ok('빈 값은 빈 값',maskPhone('')===''&&maskEmail('')==='');
 console.log('PASS: 연락처 가리기.');
}

// 작업 065·067·068·069: 체험 안내·차액·환불·사업자번호
{
 const {trialNotice,changeQuote,refundQuote,validBizNo}=await import('../lib/plans.ts');
 const now=Date.parse('2026-10-05T00:00:00Z'),acct=d=>({plan:'basic',status:'trialing',trialEndsAt:new Date(now+d*86400000).toISOString()});
 ok('체험 10일 남음은 안내 없음',trialNotice(acct(10),now).level===null);
 ok('7일 전 안내',trialNotice(acct(7),now).level==='7d'&&trialNotice(acct(7),now).daysLeft===7);
 ok('1일 전 안내',trialNotice(acct(0.5),now).level==='1d');
 ok('체험 끝',trialNotice(acct(-1),now).level==='ended');
 const q=changeQuote({plan:'basic',slots:1,months:1},{plan:'pro',slots:1,months:1},'2026-10-01',Date.parse('2026-10-16T00:00:00Z'));
 ok('월 중간 프로 전환: 남은 16일분 차액',q.totalDays===31&&q.daysLeft===16&&q.diff===Math.round((14900-9900)/31*16/10)*10);
 ok('내리면 차감(음수)',changeQuote({plan:'pro',slots:3,months:1},{plan:'basic',slots:1,months:1},'2026-10-01',Date.parse('2026-10-16T00:00:00Z')).diff<0);
 const r=refundQuote(143040,12,'2026-01-01',Date.parse('2026-04-01T00:00:00Z'));
 ok('12개월 중 90일 사용 환불',r.usedDays===90&&r.totalDays===365&&r.refund===Math.floor((143040-143040*90/365)/10)*10);
 ok('기간 다 쓰면 환불 0',refundQuote(9900,1,'2026-01-01',Date.parse('2026-03-01T00:00:00Z')).refund===0);
 ok('사업자번호 검증',validBizNo('123-45-67891')&&!validBizNo('123-45-67892')&&!validBizNo('12345'));
 console.log('PASS: 체험 안내·차액·환불·사업자번호.');
}

// 작업 100: 도움말 30개
{
 const {FAQ}=await import('../dist/server/faq.js');
 {const all=FAQ.flatMap(g=>g.items);ok('질문 30개',all.length===30);ok('질문 중복 없음',new Set(all.map(i=>i.q)).size===30);ok('답이 모두 있음',all.every(i=>i.a.length>20));console.log('PASS: 도움말.');}
}

// 작업 088: 급여 모듈 커버리지 보강 — 저장 검사·옛 데이터 변환·계약서 문구·퇴직금·통상시급 경계
{
 const tm=await import('../dist/server/team-model.js');
 const fresh=()=>{const s=tm.normalizeTeam(null);for(const e of s.employees){e.status='재직';e.income='근로소득';e.email='m'+e.id+'@ex.invalid'}return s};
 const issue=(mut)=>{const s=fresh();mut(s);const r=tm.teamSchema.safeParse(s);return r.success?'':r.error.issues.map(i=>i.message).join('|')};
 ok('통과 기준 데이터',issue(()=>{})==='');
 ok('중복 직원',issue(s=>s.employees.push({...s.employees[0]})).includes('중복된 항목'));
 ok('3.3%는 사업소득만',issue(s=>{s.employees[0].taxMode='사업소득 3.3%'}).includes('사업소득 여부'));
 ok('4대보험 자동은 근로소득만',issue(s=>{s.employees[0].taxMode='4대보험 자동';s.employees[0].income='사업소득'}).includes('근로소득 직원에게만'));
 ok('공제 없음은 근거 필요',issue(s=>{s.employees[0].taxMode='공제 없음·근거 확인';s.employees[0].taxReason=''}).includes('근거'));
 ok('없는 지점',issue(s=>{s.employees[0].branchId='nope'}).includes('소속 지점'));
 ok('보험 제외는 사유 필요',issue(s=>{s.employees[0].insurances['고용보험']={status:'적용 제외',reason:''}}).includes('제외 사유'));
 ok('이메일 중복',issue(s=>{s.employees[1].email=s.employees[0].email.toUpperCase()}).includes('이메일이 중복'));
 ok('없는 직원의 근무',issue(s=>{s.shifts=[{id:'x',employeeId:'ghost',date:'2026-10-05',start:'09:00',end:'10:00',breakMinutes:0}]}).includes('직원 정보'));
 ok('동시에 두 번 출근',issue(s=>{const id=s.employees[0].id;s.attendance=[{id:'a',employeeId:id,start:'2026-10-05T00:00:00.000Z',end:null,breakMinutes:0,breakStart:null},{id:'b',employeeId:id,start:'2026-10-05T01:00:00.000Z',end:null,breakMinutes:0,breakStart:null}]}).includes('이미 출근'));
 ok('잘못된 날짜 거부',issue(s=>{s.employees[0].joined='2026-02-30'})!=='');
 ok('휴게가 근무보다 긴 근무 거부',issue(s=>{s.shifts=[{id:'x',employeeId:s.employees[0].id,date:'2026-10-05',start:'09:00',end:'10:00',breakMinutes:90}]})!=='');
 const legacy=tm.normalizeTeam({store:{name:'옛 가게',branch:'본점'},employees:[{id:'o1',name:'옛 직원',role:'홀',type:'정직원',wage:12000,phone:'',joined:'2025-01-01',income:'근로소득',contractText:'기존 약정'}],shifts:[],attendance:[],adjustments:{'2025-12:o1':{allowance:30000,deduction:5000,note:'연말'}}});
 ok('옛 데이터 변환: 수당·공제·메모 보존',legacy.adjustments['2025-12:o1'].earnings[0].amount===30000&&legacy.adjustments['2025-12:o1'].deductions[0].amount===5000&&legacy.employees[0].weeklyHours===40&&legacy.employees[0].contract.additional==='기존 약정');
 ok('이미 새 형식이면 그대로 검사',tm.normalizeTeam(fresh()).schemaVersion===2);
 const s=fresh(),e=s.employees[0];e.contract.employer='김사장';e.contract.workplace='본점';
 ok('표준 계약서 문구에 핵심 조건',['근로자: '+e.name,'사용자: 김사장','미체결'].every(t=>tm.contractText(s,e).includes(t)));
 e.contract.draftText='직접 쓴 계약서';e.contract.signedAt='2026-10-01T00:00:00Z';e.contract.signedBy='앱 전자서명: 김직원 / 문서 1';
 ok('직접 쓴 계약서 + 전자서명 기록',tm.contractText(s,e).startsWith('직접 쓴 계약서')&&tm.contractText(s,e).includes('전자서명 기록'));
 ok('빠진 항목 목록',tm.missing({...e,email:'',phone:''}).includes('이메일')&&tm.missing({...e,email:'',phone:''}).includes('연락처'));
 const r1=tm.retirement({...e,joined:'2024-10-01',weeklyHours:20,employment:'단시간'},'2026-10-01',3000000,92,100000);
 ok('퇴직금: 1년 이상·주 15시간 이상이면 대상, 평균임금과 통상임금 중 큰 값',r1.eligible&&r1.daily===Math.max(3000000/92,100000)&&r1.estimate===Math.round(r1.daily*30*730/365));
 ok('퇴직금: 1년 미만·독립 용역은 대상 아님',!tm.retirement({...e,joined:'2026-01-01'},'2026-10-01',1,1,1).eligible&&!tm.retirement({...e,joined:'2020-01-01',employment:'독립 용역'},'2026-10-01',1,1,1).eligible);
 ok('통상시급: 일급인데 근무시간 없음',tm.ordinaryHourly({payType:'일급',wage:100000,weeklyHours:40,contract:{start:'',end:'',breakMinutes:0}}).hourly===0);
 ok('통상시급: 월급인데 주 소정시간 0',tm.ordinaryHourly({payType:'월급',wage:2000000,weeklyHours:0,contract:{start:'09:00',end:'18:00',breakMinutes:60}}).hourly===0);
 ok('통상시급: 월급 주 40시간 = 월급 ÷ 209시간',tm.ordinaryHourly({payType:'월급',wage:2090000,weeklyHours:40,contract:{start:'09:00',end:'18:00',breakMinutes:60}}).hourly===Math.round(2090000/Math.round((40+8)*4.345)));
 // 사업소득 3.3%, 일급 수습, 지정 주휴일
 const t=fresh(),w=t.employees[0];Object.assign(w,{income:'사업소득',taxMode:'사업소득 3.3%',payType:'시급',wage:20000,autoPay:false});t.employees=[w];t.shifts=[];
 t.attendance=[{id:'x1',employeeId:w.id,start:'2026-10-05T00:00:00.000Z',end:'2026-10-05T05:00:00.000Z',breakMinutes:0,breakStart:null}];
 let row=tm.calculate(t,'2026-10')[0];ok('사업소득 3.3% 원천징수',row.deductions.some(d=>d.name==='사업소득 원천징수'&&d.amount===Math.floor(row.gross*0.033)));
 Object.assign(w,{income:'근로소득',taxMode:'직접 입력',payType:'일급',wage:100000,joined:'2026-10-01',employment:'기간의 정함 없음',probation:{months:3,rate:0.9}});
 row=tm.calculate(t,'2026-10')[0];ok('일급 수습 감액 계산식',row.earnings[0].formula.includes('수습')&&row.earnings[0].amount===90000);
 Object.assign(w,{payType:'시급',wage:12000,autoPay:true,weeklyHours:20,weeklyHoliday:1,probation:undefined});t.settings.fivePlus=true;
 row=tm.calculate(t,'2026-10')[0];ok('지정 주휴일(월) 근무는 휴일 가산',row.earnings.some(l=>l.name.includes('휴일')));
 console.log('PASS: 급여 모듈 경계 사례.');
}

// 작업 088: 손서명 이미지 검사 경계
{
 const {checkDrawing}=await import('../lib/signature-image.ts');
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
 ok('비어 있으면 손서명 없음',checkDrawing(undefined).ok&&checkDrawing('').value===null);
 ok('PNG만',checkDrawing(png).ok&&!checkDrawing('data:image/jpeg;base64,/9j/4AAQ').ok&&!checkDrawing(123).ok);
 ok('base64 문자 검사',!checkDrawing('data:image/png;base64,@@@@').ok);
 ok('PNG 머리 검사',!checkDrawing('data:image/png;base64,'+btoa('GIF89a-not-png')).ok);
 ok('크기 제한',!checkDrawing('data:image/png;base64,'+'A'.repeat(60004)).ok);
 console.log('PASS: 손서명 이미지 검사.');
}

// 작업 088: 세액표가 없는 해는 가장 가까운 이전 표(없으면 2026) 사용
{
 const {incomeTax}=await import('../dist/server/income-tax.js');
 ok('2027년은 2026 표',incomeTax(3000000,2027,1).incomeTax===incomeTax(3000000,2026,1).incomeTax);
 ok('2024년(표 없음)도 2026 표',incomeTax(3000000,2024,1).incomeTax===incomeTax(3000000,2026,1).incomeTax);
 console.log('PASS: 세액표 연도 대체.');
}

// 작업 093: 알림톡 템플릿·발송 뼈대
{
 const {TEMPLATES,renderTemplate,sendAlimtalk}=await import('../lib/alimtalk.ts');
 ok('템플릿 6종, 변수 모두 본문에 있음',Object.values(TEMPLATES).length===6&&Object.values(TEMPLATES).every(t=>t.vars.every(v=>t.text.includes('#{'+v+'}'))));
 ok('변수 채우기',renderTemplate('CLOCKOUT_MISSING',{이름:'김민지',날짜:'10월 4일'}).startsWith('김민지님, 10월 4일'));
 ok('변수 빠지면 오류',(()=>{try{renderTemplate('PAYSLIP_SENT',{이름:'a'});return false}catch{return true}})());
 ok('키가 없으면 보내지 않음',(await sendAlimtalk({},'01012345678','CONTRACT_SIGN',{이름:'a',가게:'b'})).status==='not_configured');
 let sent=null;const env={KAKAO_SENDER_KEY:'k',ALIMTALK_API_KEY:'x',ALIMTALK_ENDPOINT:'https://example.invalid/send'};
 ok('잘못된 번호 거부',(await sendAlimtalk(env,'02-123','CONTRACT_SIGN',{이름:'a',가게:'b'},async()=>{throw Error('no')})).status==='invalid_phone');
 ok('설정되면 대행사로 전송',(await sendAlimtalk(env,'010-1234-5678','CONTRACT_SIGN',{이름:'a',가게:'b'},async(u,o)=>{sent=JSON.parse(o.body);return new Response('{}',{status:200})})).status==='accepted'&&sent.to==='01012345678'&&sent.templateCode==='CONTRACT_SIGN');
 console.log('PASS: 알림톡 뼈대.');
}

// 작업 043: 2025 개정 표준 근로계약서 항목
{
 const {standardContractDraft}=await import('../dist/server/contract-template.js');
 const s=normalizeTeam(null),e=s.employees[0];Object.assign(e,{employment:'기간의 정함 없음',weeklyHours:40,endDate:''});e.contract={...e.contract,workDays:'월, 화, 수, 목, 금',holiday:'주휴일: 매주 일요일',employer:'김사장'};
 let t=standardContractDraft(s,e);
 ok('정규 서식 제목·근로개시일',t.includes('표준근로계약서(기간의 정함이 없는 경우)')&&t.includes('1. 근로개시일'));
 ok('2025 추가 문구: 공휴일·근로자의 날',t.includes('공휴일(대체공휴일 포함)은 근로기준법이 정하는 바에 따르며, 근로자의 날은 유급휴일로 함'));
 ok('임금지급일 휴일 전날·교부 제17조·사회보험 원칙',t.includes('(휴일의 경우는 전날 지급)')&&t.includes('근로기준법 제17조 이행')&&t.includes('적용(가입)을 원칙으로 함'));
 ok('1일 시간 계산(주 40시간 ÷ 5일)',t.includes('(1일 8시간, 1주 40시간)'));
 Object.assign(e,{endDate:'2027-03-31'});ok('기간제 서식',standardContractDraft(s,e).includes('기간의 정함이 있는 경우')&&standardContractDraft(s,e).includes('1. 근로계약기간'));
 Object.assign(e,{employment:'단시간',weeklyHours:20,endDate:''});t=standardContractDraft(s,e);ok('단시간 서식: 요일별 근로시간',t.includes('단시간근로자 표준근로계약서')&&t.includes('(월)요일 · 업무 시작'));
 Object.assign(e,{birthMonth:'2010-01'});t=standardContractDraft(s,e);ok('연소근로자 서식: 7시간·35시간, 가족관계증명서, 제67조',t.includes('연소근로자(18세 미만인 자)')&&t.includes('1주에 35시간')&&t.includes('가족관계기록사항')&&t.includes('제67조'));
 console.log('PASS: 2025 표준 근로계약서.');
}

// 작업 011: 국세청 사업자 상태조회
{
 const {checkBusiness}=await import('../dist/server/nts.js');
 const reply=(row,status=200)=>async(url,o)=>{reply.last={url,body:JSON.parse(o.body)};return new Response(JSON.stringify({data:row?[row]:[]}),{status})};
 ok('키가 없으면 미확인',(await checkBusiness('123-45-67891',{})).status==='미확인');
 ok('형식이 틀리면 미확인',(await checkBusiness('123',{NTS_API_KEY:'k'},reply({}))).status==='미확인');
 let r=await checkBusiness('123-45-67891',{NTS_API_KEY:'k'},reply({b_no:'1234567891',b_stt_cd:'01',tax_type:'부가가치세 일반과세자'}));
 ok('계속사업자',r.status==='계속사업자'&&reply.last.body.b_no[0]==='1234567891'&&reply.last.url.includes('nts-businessman/v1/status'));
 ok('휴업·폐업',(await checkBusiness('1234567891',{NTS_API_KEY:'k'},reply({b_stt_cd:'02'}))).status==='휴업자'&&(await checkBusiness('1234567891',{NTS_API_KEY:'k'},reply({b_stt_cd:'03'}))).status==='폐업자');
 ok('등록되지 않은 번호',(await checkBusiness('1234567891',{NTS_API_KEY:'k'},reply({b_stt_cd:'',tax_type:'국세청에 등록되지 않은 사업자등록번호입니다.'}))).status==='등록되지 않음');
 ok('조회 실패도 가입은 막지 않음(미확인)',(await checkBusiness('1234567891',{NTS_API_KEY:'k'},reply(null,500))).status==='미확인'&&(await checkBusiness('1234567891',{NTS_API_KEY:'k'},async()=>{throw Error('x')})).status==='미확인');
 console.log('PASS: 사업자 상태조회.');
}
