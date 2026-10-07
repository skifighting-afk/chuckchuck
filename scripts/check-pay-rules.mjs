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
const e=team.employees[0];Object.assign(e,{payType:'시급',wage:14000,autoPay:true,income:'근로소득',taxMode:'4대보험 자동',insurances:all,weeklyHours:40,employment:'기간의 정함 없음'});
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
 ok('no record after shift end = 결근',k('d')==='결근');
 ok('record without shift = 예정 외 출근',k('e')==='예정 외 출근');
 f=checkDay('2026-10-05',shifts,att,'lenient',now);ok('lenient 10m still flags 12m late',f.some(x=>x.employeeId==='a'&&x.kind==='지각'));
 f=checkDay('2026-10-05',shifts,att,'strict',now);ok('strict flags 3m late',f.some(x=>x.employeeId==='b'&&x.kind==='지각'&&x.minutes===3));
 ok('future shift not yet 미출근',!checkDay('2026-10-05',shifts,[],'normal',Date.parse('2026-10-05T08:00:00+09:00')).some(x=>x.kind==='미출근'||x.kind==='결근'));
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
 e0.healthCertUntil='2026-10-30';ok('보건증 30일 안 만료는 오늘 할 일',todayTasks(s,b,'2026-10-05').find(x=>x.key==='healthCert')?.count===1);e0.healthCertUntil='2026-12-30';ok('보건증 만료가 멀면 표시 안 함',!todayTasks(s,b,'2026-10-05').some(x=>x.key==='healthCert'));e0.healthCertUntil='';
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
 {const all=FAQ.flatMap(g=>g.items);ok('질문 30개 이상',all.length>=30);ok('질문 중복 없음',new Set(all.map(i=>i.q)).size===all.length);ok('답이 모두 있음',all.every(i=>i.a.length>20));console.log('PASS: 도움말.');}
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
 ok('템플릿 8종, 변수 모두 본문에 있음',Object.values(TEMPLATES).length===8&&Object.values(TEMPLATES).every(t=>t.vars.every(v=>t.text.includes('#{'+v+'}'))));
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
// 작업 013·014·015: 운영자 정보와 약관·개인정보 처리방침
{
 const {TERMS,PRIVACY,legalMarkdown}=await import('../dist/server/legal-docs.js');
 const {LEGAL}=await import('../lib/legal.ts');
 const {operatorLines,operatorMissing,formatBizNo,ftcLink,OPERATOR}=await import('../lib/operator.ts');
 const {readFileSync}=await import('node:fs');
 ok('약관·방침 판이 동의 판과 같음',TERMS.version===LEGAL.terms.version&&PRIVACY.version===LEGAL.privacy.version);
 ok('docs/legal 문서가 코드와 같음(node scripts/legal-md.mjs)',readFileSync('docs/legal/terms.md','utf8')===legalMarkdown(TERMS)&&readFileSync('docs/legal/privacy.md','utf8')===legalMarkdown(PRIVACY));
 ok('이전 판 목록에 지금 판이 있음',TERMS.history.some(h=>h.version===TERMS.version)&&PRIVACY.history.some(h=>h.version===PRIVACY.version));
 ok('처리위탁 조항은 #processing',PRIVACY.sections.some(s=>s.id==='processing'));
 const text=JSON.stringify(PRIVACY.sections);
 for(const w of ['Supabase','Resend','국외 이전','보호책임자','휴가 증빙','결제 기록','118','제3자 제공','파기 절차','파기 방법','자동화된 결정','쿠키','안전성 확보','privacy@supabase.com','거부 방법'])ok('개인정보 처리방침에 '+w,text.includes(w));
 ok('검토 전이면 표시',!TERMS.reviewed?legalMarkdown(TERMS).includes('법률 검토 전'):true);
 ok('운영자 정보 9줄, 빈 값은 확인 필요',operatorLines().length===9&&operatorLines({...OPERATOR,company:''}).some(([k,v])=>k==='상호'&&v==='확인 필요'));
 ok('빠진 항목 목록',operatorMissing({...OPERATOR,company:'척척',representative:''}).includes('대표자')&&!operatorMissing({...OPERATOR,company:'척척'}).includes('상호'));
 ok('사업자번호 표기·공정위 링크',formatBizNo('1234567891')==='123-45-67891'&&ftcLink('123-45-67891').endsWith('wrkr_no=1234567891')&&ftcLink('')==='');
 console.log('PASS: 운영자 정보·약관·개인정보 처리방침.');
}
// 가이드 19: 홈페이지 요금이 앱 요금과 같은지
{
 const {plans,CONTRACT_EXTRA_PRICE}=await import('../lib/plans.ts');
 const {readFileSync}=await import('node:fs');
 const site=readFileSync('homepage/src/mocks/site.ts','utf8');
 const tiers=id=>JSON.stringify(plans[id].tiers).replace(/\s/g,'');
 const m=k=>(site.match(new RegExp(k+':\\s*(\\[\\[[^\\n]*?\\]\\])'))||[])[1]?.replace(/\s/g,'');
 ok('홈페이지 베이직 요금 = 앱',m('basic')===tiers('basic'));
 ok('홈페이지 프로 요금 = 앱',m('pro')===tiers('pro'));
 ok('홈페이지 지점 추가 요금 = 앱',site.includes(`EXTRA_PER_BRANCH = ${plans.pro.extraPerBranch};`));
 ok('홈페이지 계약서 추가 요금 = 앱',site.includes(`CONTRACT_EXTRA_PRICE = ${CONTRACT_EXTRA_PRICE};`));
 ok('홈페이지에 예전 요금제 이름 없음',!/사장님5|사장님10|여러매장 요금|VAT 별도|14일 동안/.test(readFileSync('homepage/src/pages/pricing/page.tsx','utf8')+site));
 ok('홈페이지가 예전 임시 주소를 가리키지 않음',!site.includes('chatgpt.site'));
 console.log('PASS: 홈페이지 요금 = 앱 요금.');
}
// 가이드 27: 2027년 요율
{
 const {RATES,pendingRates,insuranceLines}=await import('../lib/pay-rules.ts');
 const {calculate,normalizeTeam}=await import('../dist/server/team-model.js');
 const r=RATES[2027];
 ok('2027 최저임금 10,700원',r.minimumWage===10700);
 ok('2027 국민연금 근로자 5%',r.pension===0.05);
 ok('2027 건강보험 동결 3.595%',r.health===0.03595);
 const all={국민연금:{status:'가입'},건강보험:{status:'가입'},고용보험:{status:'가입'}};
 const L=insuranceLines(2000000,2027,all,'2027-01'),amt=n=>L.find(l=>l.name===n)?.amount;
 ok('2027 국민연금 200만원 → 100,000',amt('국민연금')===100000);
 ok('2027 건강보험 200만원 → 71,900',amt('건강보험')===71900);
 ok('2027 고용보험 200만원 → 18,000',amt('고용보험')===18000);
 ok('2027 장기요양은 아직 미발표로 표시',pendingRates(2027).includes('장기요양보험')&&pendingRates(2026).length===0);
 const now=new Date(),y=now.getUTCFullYear(),p=pendingRates(y);
 ok(`${y}년 미발표 요율이 1월 31일 넘게 남아 있지 않음 (docs/RATES-UPDATE.md)`,!(p.length&&(now.getUTCMonth()>0)));
 if(p.length||pendingRates(y+1).length)console.log(`WARN: 미발표 요율 — ${y}: ${p.join(',')||'없음'} / ${y+1}: ${pendingRates(y+1).join(',')||'없음'}. 발표되면 lib/pay-rules.ts RATES를 고치고 pending에서 빼세요.`);
 const {newMember}=await import('../dist/server/team-model.js');
 const t=normalizeTeam(null);delete t.legacy;t.shifts=[];t.adjustments={};t.payrollRuns={};
 t.employees=[{...newMember(),id:'e1',name:'가',joined:'2026-01-01',payType:'시급',wage:10500,autoPay:false,taxMode:'직접 입력',status:'재직'}];
 t.attendance=[{id:'a1',employeeId:'e1',start:'2026-12-01T00:00:00Z',end:'2026-12-01T04:00:00Z',breakMinutes:0,breakStart:null},{id:'a2',employeeId:'e1',start:'2026-11-03T00:00:00Z',end:'2026-11-03T04:00:00Z',breakMinutes:0,breakStart:null}];
 const dec=calculate(t,'2026-12').find(x=>x.employeeId==='e1');
 ok('12월에 다음 해 최저임금 미리 경고',dec.warnings.some(w=>w.includes('2027년 1월부터 최저시급이 10,700원')));
 ok('11월에는 미리 경고 안 함',!calculate(t,'2026-11').find(x=>x.employeeId==='e1').warnings.some(w=>w.includes('1월부터 최저시급')));
 console.log('PASS: 2027년 요율.');
}
// 가이드 28: 명세서 필수 기재사항을 확정·발송 때 막기
{
 const {payslipProblems,payslipText,payslipMissing}=await import('../lib/payslip.ts');
 const base={employeeId:'e1',name:'가',hours:10,days:2,gross:107000,deduction:0,net:107000,deductions:[]};
 const good={...base,earnings:[{name:'기본급',amount:107000,formula:'10시간 × 10,700원'}]};
 ok('정상 명세서는 문제 없음',payslipProblems('가게','2027-01','2027-02-10',[good]).length===0);
 const manualNight={...base,earnings:[...good.earnings,{name:'야간수당',amount:5000,formula:''}]};
 const p=payslipProblems('가게','2027-01','2027-02-10',[manualNight]);
 ok('계산 근거 없는 야간수당은 확정 전에 걸림',p.length===1&&p[0].missing.some(m=>m.includes('야간')));
 const bonus={...base,earnings:[...good.earnings,{name:'명절 상여',amount:50000,formula:''}]};
 ok('고정 상여는 계산방법 없어도 됨',payslipProblems('가게','2027-01','2027-02-10',[bonus]).length===0);
 ok('빈 계산방법은 "(계산방법: )"로 찍지 않음',!payslipText('가게','2027-01','2027-02-10',bonus).includes('(계산방법: )'));
 ok('지급일 없으면 걸림',payslipMissing(payslipText('가게','2027-01','',good)).includes('임금지급일'));
 console.log('PASS: 명세서 필수 기재사항 확정·발송 점검.');
}
// 가이드 30: 약한 신호에서 출퇴근 다시 보내기
{
 const {sendWithRetry,RETRY_DELAYS_MS}=await import('../lib/retry.ts');
 const noWait=async()=>{};
 let n=0;let r=await sendWithRetry(async()=>{n++;if(n<3)throw new TypeError('Failed to fetch');return {ok:true,status:200}},{kind:'in',wait:noWait});
 ok('인터넷 오류 두 번 뒤 성공',r.ok&&r.retried===2);
 n=0;r=await sendWithRetry(async()=>{n++;if(n===1)throw new TypeError('x');return {ok:false,status:400,error:'이미 출근한 직원입니다.'}},{kind:'in',wait:noWait});
 ok('다시 보냈는데 이미 출근 → 앞 요청이 저장된 것으로 성공',r.ok&&r.alreadyDone);
 n=0;r=await sendWithRetry(async()=>{n++;return {ok:false,status:400,error:'이미 출근한 직원입니다.'}},{kind:'in',wait:noWait});
 ok('첫 요청부터 이미 출근이면 실패로 알림',!r.ok&&n===1);
 n=0;r=await sendWithRetry(async()=>{n++;return {ok:false,status:403,error:'QR'}},{kind:'in',wait:noWait});
 ok('QR 오류(403)는 다시 보내지 않음',!r.ok&&n===1);
 n=0;r=await sendWithRetry(async()=>{n++;return {ok:false,status:503}},{kind:'out',wait:noWait});
 ok('계속 실패하면 포기 표시',r.gaveUp&&n===RETRY_DELAYS_MS.length+1);
 ok('다시 보내기는 움직이는 QR 유효시간(60초) 안에 끝남',RETRY_DELAYS_MS.reduce((a,b)=>a+b,0)<50000);
 console.log('PASS: 출퇴근 다시 보내기.');
}
// 가이드 89: 2027년 공휴일
{
 const {holidaysFor,hasHolidaysFor,PUBLIC_HOLIDAYS}=await import('../lib/holidays.ts');
 ok('2027 공휴일 등록',hasHolidaysFor(2027)&&PUBLIC_HOLIDAYS[2027].length===23);
 const h=holidaysFor(2027,true);
 ok('2027 설날 대체공휴일 2/9, 추석 9/15',h.get('2027-02-09')?.includes('대체')&&h.get('2027-09-15')==='추석');
 ok('노동절은 5명 미만도 유급휴일, 대체공휴일(5/3)은 5명 이상만',holidaysFor(2027,false).has('2027-05-01')&&!holidaysFor(2027,false).has('2027-05-03')&&h.has('2027-05-03'));
 const now=new Date(),y=now.getUTCFullYear();
 ok(`${y}년 공휴일이 등록돼 있음 (lib/holidays.ts)`,hasHolidaysFor(y));
 if(now.getUTCMonth()>=10&&!hasHolidaysFor(y+1))console.log(`WARN: ${y+1}년 공휴일을 lib/holidays.ts에 추가해야 해요.`);
 console.log('PASS: 2027년 공휴일.');
}
// 가이드 70: 근무표 달력 파일
{
 const {shiftsToIcs}=await import('../lib/ics.ts');
 const t=shiftsToIcs('척척식당',[{id:'s1',date:'2026-10-06',start:'09:00',end:'15:00'},{id:'s2',date:'2026-10-07',start:'22:00',end:'06:00',place:'본점, 1층'}],new Date('2026-10-05T00:00:00Z'));
 ok('달력 파일 형식',t.startsWith('BEGIN:VCALENDAR\r\n')&&t.trim().endsWith('END:VCALENDAR')&&(t.match(/BEGIN:VEVENT/g)||[]).length===2);
 ok('한국 시간으로 시작·끝',t.includes('DTSTART;TZID=Asia/Seoul:20261006T090000')&&t.includes('DTEND;TZID=Asia/Seoul:20261006T150000'));
 ok('밤샘 근무는 다음 날 끝',t.includes('DTEND;TZID=Asia/Seoul:20261008T060000'));
 ok('쉼표는 이스케이프',t.includes('LOCATION:본점\\, 1층'));
 console.log('PASS: 근무표 달력 파일.');
}
// 가이드 81: 근무표 가산수당 미리 보기
{
 const {premiumPreview}=await import('../lib/schedule-tools.ts');
 const sh=(id,date,start,end,brk=60)=>({id:id+date,employeeId:id,date,start,end,breakMinutes:brk});
 const week=['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'];
 const shifts=[...week.map(d=>sh('a',d,'09:00','19:00')),sh('b','2026-10-06','20:00','02:00',0),sh('c','2026-10-07','09:00','13:00',0)];
 const p=premiumPreview(shifts,'2026-10-05',{a:'가',b:'나',c:'다'}),g=id=>p.find(x=>x.employeeId===id);
 ok('하루 9시간×5일 = 연장 5시간(주 45시간과 같음, 겹쳐 세지 않음)',g('a').overtime===5&&g('a').total===45);
 ok('20~02시 근무 = 야간 4시간',g('b').night===4&&g('b').overtime===0);
 ok('가산 없는 직원은 목록에서 빠짐',!g('c'));
 ok('다음 주 근무는 세지 않음',premiumPreview([sh('a','2026-10-12','22:00','06:00',0)],'2026-10-05',{}).length===0);
 console.log('PASS: 근무표 가산수당 미리 보기.');
}
// 가이드 77: 인건비 예산
{
 const {budgetStatus,plannedLabor,todayTasks}=await import('../dist/server/close-check.js');
 const t=normalizeTeam(null);delete t.legacy;const e=t.employees[0];e.payType='시급';e.wage=10000;e.status='재직';
 t.employees=[e];t.shifts=[{id:'s1',employeeId:e.id,date:'2026-10-06',start:'09:00',end:'19:00',breakMinutes:60}];
 ok('예상 인건비 = 근무표 9시간 × 시급',plannedLabor(t,e.branchId,'2026-10')===90000);
 ok('예산 없으면 표시 안 함',budgetStatus(t,e.branchId,'2026-10')===null);
 t.settings.laborBudget=95000;const b=budgetStatus(t,e.branchId,'2026-10');
 ok('예산 90% 넘으면 경고',b.near&&!b.over&&todayTasks(t,e.branchId,'2026-10-05').some(x=>x.key==='budget'));
 t.settings.laborBudget=200000;ok('예산 여유 있으면 오늘 할 일 없음',!todayTasks(t,e.branchId,'2026-10-05').some(x=>x.key==='budget'));
 console.log('PASS: 인건비 예산.');
}
// 가이드 87: 재직·경력증명서
{
 const {certificateText}=await import('../lib/certificate.ts');
 const e={name:'김예시',joined:'2025-03-02',status:'재직',role:'홀',employment:'단시간',birthMonth:'2000-07'};
 const t=certificateText('재직',{name:'척척식당',owner:'김사장'},e,'2026-10-05','은행 제출');
 ok('재직증명서: 이름·기간·업무·용도·발급일',t.startsWith('재직증명서')&&t.includes('2025년 3월 2일 ~ 현재')&&t.includes('담당 업무 : 홀')&&t.includes('용도 : 은행 제출')&&t.includes('2026년 10월 5일'));
 ok('생년월만, 주민번호 칸 없음',t.includes('생년월 : 2000년 7월')&&!t.includes('주민'));
 const left={...e,status:'퇴사',endDate:'2026-08-31'};
 ok('퇴사자는 경력증명서로 기간 끝 표시',certificateText('경력',{name:'척척식당',owner:'김사장'},left,'2026-10-05').includes('2025년 3월 2일 ~ 2026년 8월 31일'));
 let threw=false;try{certificateText('재직',{name:'a',owner:'b'},left,'2026-10-05')}catch{threw=true}
 ok('퇴사자 재직증명서는 막음',threw);
 console.log('PASS: 재직·경력증명서.');
}
// 가이드 78: 퇴사 정리
{
 const {offboardingChecklist,offboardingText}=await import('../lib/offboarding.ts');
 const ins={국민연금:{status:'가입'},건강보험:{status:'가입'},고용보험:{status:'가입'},산재보험:{status:'가입'}};
 const c=offboardingChecklist({name:'가',joined:'2025-03-01',weeklyHours:20,insurances:ins},'2026-12-31');
 ok('퇴직일은 마지막 근무 다음 날',c.retire==='2027-01-01');
 ok('1년·주15시간 이상이면 퇴직금 14일 안 지급',c.severance&&c.items.find(x=>x.title==='퇴직금 지급').due==='2027-01-15');
 ok('국민연금·고용보험 상실신고는 다음 달 15일',c.items.find(x=>x.title.startsWith('국민연금')).due==='2027-02-15');
 ok('건강보험 상실신고 14일',c.items.find(x=>x.title.startsWith('건강보험')).due==='2027-01-15');
 const short=offboardingChecklist({name:'나',joined:'2026-06-01',weeklyHours:30,insurances:{}},'2026-10-31');
 ok('1년 미만은 퇴직금 대상 아님, 보험 미가입이면 신고 항목 없음',!short.severance&&!short.items.some(x=>x.title.includes('상실')));
 ok('문서로 만들기',offboardingText({name:'가',joined:'2025-03-01',weeklyHours:20,insurances:ins},'2026-12-31').includes('가 퇴사 정리'));
 console.log('PASS: 퇴사 정리.');
}
// 가이드 88: 한 달 근태 요약
{
 const {monthPatterns}=await import('../lib/attendance-check.ts');
 const sh=(d)=>({id:'s'+d,employeeId:'e',date:d,start:'09:00',end:'15:00'});
 const at=(d,s,e)=>({id:'a'+d,employeeId:'e',start:`${d}T${s}:00+09:00`,end:`${d}T${e}:00+09:00`});
 const shifts=['2026-09-07','2026-09-14','2026-09-21','2026-09-22'].map(sh);
 const att=[at('2026-09-07','09:20','15:00'),at('2026-09-14','09:15','15:00'),at('2026-09-21','09:00','15:00')];
 const p=monthPatterns('2026-09',shifts,att,'normal',Date.parse('2026-10-05T00:00:00Z'))[0];
 ok('지각 2번 35분, 결근 1번',p.지각===2&&p.lateMinutes===35&&p.결근===1);
 ok('같은 요일(월) 반복 표시',p.repeatDay==='월');
 console.log('PASS: 한 달 근태 요약.');
}
// 가이드 65·66: 신고 자료
{
 const {withholdingSummary,insuranceChanges,filingCsv}=await import('../lib/tax-filing.ts');
 const ins={국민연금:{status:'가입'},건강보험:{status:'가입'},고용보험:{status:'가입'}};
 const emps=[{id:'a',name:'가',joined:'2026-10-05',status:'재직',taxMode:'4대보험 자동',income:'근로소득',weeklyHours:40,wage:2500000,payType:'월급',role:'홀',insurances:ins},
  {id:'b',name:'나',joined:'2025-01-01',endDate:'2026-10-20',status:'퇴사',taxMode:'사업소득 3.3%',income:'사업소득',weeklyHours:10,wage:12000,payType:'시급',role:'주방',insurances:{}}];
 const rows=[{employeeId:'a',name:'가',gross:2500000,deductions:[{name:'근로소득세',amount:31000},{name:'지방소득세',amount:3100}]},{employeeId:'b',name:'나',gross:480000,deductions:[]}];
 const w=withholdingSummary(rows,emps);
 ok('A01 근로소득 1명·소득세 합계',w[0].code==='A01'&&w[0].people===1&&w[0].incomeTax===31000&&w[0].localTax===3100);
 ok('A25 사업소득 3% + 지방 0.3%',w[1].code==='A25'&&w[1].incomeTax===14400&&w[1].localTax===1440);
 const c=insuranceChanges(emps,'2026-10');
 ok('그달 입사는 취득, 그달 퇴사는 상실',c.acquire.map(x=>x.name).join()==='가'&&c.lose.map(x=>x.name).join()==='나'&&c.acquire[0].monthlyPay===2500000);
 const csv=filingCsv('2026-10',rows,emps);
 ok('CSV에 주민번호는 빈칸(직접 기입)',csv.includes('주민등록번호(직접 기입)')&&csv.includes('A01 근로소득 간이세액'));
 console.log('PASS: 신고 자료.');
}
// 가이드 55: 업종별 매뉴얼 예시
{
 const {starterManuals}=await import('../lib/industry-starter.ts');
 const c=starterManuals('cafe','2026-10-05T00:00:00Z');
 ok('카페는 오픈·마감 예시 2개, 모든 지점에 보임',c.length===2&&c[0].title.includes('(예시)')&&c.every(m=>m.branchId==='all'&&m.steps.length>=3));
 ok('업종을 안 고르면 기본 예시',starterManuals(null).length===2&&starterManuals('unknown').length===2);
 console.log('PASS: 업종별 매뉴얼 예시.');
}
// 가이드 79: 연간 합계
{
 const {yearSummary,yearSummaryCsv}=await import('../lib/year-summary.ts');
 const row=(g,tax)=>({employeeId:'e',name:'가',gross:g,net:g-tax-9000,earnings:[{name:'기본급',amount:g-100000},{name:'식대',amount:100000,taxFree:true}],deductions:[{name:'국민연금',amount:9000},{name:'근로소득세',amount:tax}]});
 const runs={'2026-01:m':{locked:true,month:'2026-01',rows:[row(2000000,20000)]},'2026-02:m':{locked:true,month:'2026-02',rows:[row(2100000,22000)]},'2026-03:m':{locked:false,month:'2026-03',rows:[row(9999999,1)]},'2025-12:m':{locked:true,month:'2025-12',rows:[row(1,1)]}};
 const y=yearSummary(runs,'2026')[0];
 ok('확정한 그해 달만 더함',y.months.join()==='2026-01,2026-02'&&y.gross===4100000);
 ok('비과세·과세 대상 나눔',y.taxFree===200000&&y.taxable===3900000);
 ok('공제 항목별 합계',y['국민연금']===18000&&y['근로소득세']===42000);
 ok('CSV 머리말',yearSummaryCsv(runs,'2026').includes('2026년 연간 급여 합계'));
 console.log('PASS: 연간 급여 합계.');
}
// 급여 계산 점검: 단시간 근로자 소정근로시간 초과 가산, 장기요양 정확한 비율
{
 const {allowances,RATES}=await import('../lib/pay-rules.ts');
 const kst=(d,hm)=>new Date(`${d}T${hm}:00+09:00`).toISOString();
 const rec=(d,s,e)=>({start:kst(d,s),end:kst(d,e),breakMinutes:0});
 // 주 20시간 계약, 5일 × 5시간 = 25시간 → 5시간 초과(가산 50%)
 const recs=['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11'].map(d=>rec(d,'10:00','15:00'));
 const pt=allowances(recs,'2026-09',10320,true,'mon',new Map(),new Set(),20).lines.find(l=>l.name==='연장근로 가산');
 ok('단시간(주 20시간 계약) 25시간 근무: 5시간 × 50% 가산',pt&&pt.amount===Math.round(5*10320*0.5)&&pt.formula.includes('단시간'));
 ok('5명 미만이면 단시간 초과 가산 없음',!allowances(recs,'2026-09',10320,false,'mon',new Map(),new Set(),20).lines.some(l=>l.name==='연장근로 가산'));
 ok('계약 40시간이면 25시간은 가산 없음',!allowances(recs,'2026-09',10320,true).lines.some(l=>l.name==='연장근로 가산'));
 ok('장기요양 = 건강보험료 × 0.9448/7.19',Math.abs(RATES[2026].care-0.131404)<0.000001);
 const jh=allowances(recs,'2026-09',10320,true,'mon',new Map(),new Set(),20).lines.find(l=>l.name==='주휴수당');
 ok('주휴는 계약 20시간 기준(25시간 일해도 20/40×8)',jh&&jh.amount===Math.round(20/40*8*10320));
 console.log('PASS: 급여 계산 점검(단시간 초과·장기요양).');
}
// 새 홈: 오늘 근무 막대
{
 const {todayBoard}=await import('../dist/server/close-check.js');
 const {checkDay}=await import('../lib/attendance-check.ts');
 const t=normalizeTeam(null);delete t.legacy;const [a]=t.employees;const mk=(id,name)=>({...a,id,name});
 t.employees=[mk('e1','가'),mk('e2','나'),mk('e3','다'),mk('e4','라')];const d='2026-10-05',iso=(h)=>new Date(Date.parse(d+'T'+h+':00+09:00')).toISOString();
 t.shifts=[{id:'s1',employeeId:'e1',date:d,start:'09:00',end:'15:00',breakMinutes:0},{id:'s2',employeeId:'e2',date:d,start:'11:00',end:'18:00',breakMinutes:0},{id:'s3',employeeId:'e3',date:d,start:'17:00',end:'02:00',breakMinutes:0},{id:'s4',employeeId:'e4',date:d,start:'10:00',end:'13:00',breakMinutes:0}];
 t.attendance=[{id:'a1',employeeId:'e1',start:iso('08:56'),end:null,breakMinutes:0},{id:'a2',employeeId:'e2',start:iso('11:20'),end:null,breakMinutes:0}];
 const now=Date.parse(d+'T14:10:00+09:00'),f=checkDay(d,t.shifts,t.attendance,'normal',now),b=todayBoard(t,a.branchId,d,f,now),st=id=>b.rows.find(r=>r.employeeId===id);
 ok('근무 중',st('e1').status==='working'&&b.working===2);
 ok('늦게 온 사람은 늦음과 분',st('e2').status==='late'&&st('e2').label==='20분 늦음');
 ok('아직 안 온 사람은 예정',st('e3').status==='planned'&&b.left===1);
 ok('끝난 근무에 기록 없으면 미출근',st('e4').status==='missed'&&b.attention===2);
 ok('자정 넘는 근무는 26시까지 그림',st('e3').to===26&&b.hi>=26&&b.lo<=9);
 ok('지금 위치 표시',Math.abs(b.now-(14+10/60))<0.01);
 t.employees.push(mk('e5','마'),mk('e6','바'));t.shifts.push({id:'s6',employeeId:'e6',date:d,start:'08:00',end:'10:00',breakMinutes:0});
 t.attendance.push({id:'a5',employeeId:'e5',start:iso('12:00'),end:null,breakMinutes:0},{id:'a6',employeeId:'e6',start:iso('07:58'),end:iso('10:01'),breakMinutes:0},{id:'a7',employeeId:'e5',start:iso('07:00'),end:iso('07:30'),breakMinutes:0});
 const f2=checkDay(d,t.shifts,t.attendance,'normal',now),b2=todayBoard(t,a.branchId,d,f2,now);
 ok('근무표 없는 출근도 막대로',b2.rows.some(r=>r.employeeId==='e5'&&r.status==='extra'&&r.label.includes('근무 중')));
 ok('근무표 없이 왔다 간 기록',b2.rows.some(r=>r.employeeId==='e5'&&r.status==='done'&&r.to>r.from));
 ok('퇴근한 사람은 퇴근 시각',b2.rows.find(r=>r.employeeId==='e6').label==='퇴근 10:01'&&b2.lo<=7);
 const late=todayBoard(t,a.branchId,d,f2,Date.parse(d+'T23:59:00+09:00'));ok('밤에는 지금 표시가 범위 밖이면 없음',late.now===null||late.now<=late.hi);
 console.log('PASS: 홈 오늘 근무 막대.');
}
// 지시서 1라운드 A: 근무표와 맞는 출근은 '예정 외'가 아니고, 화면·비서·홈 숫자가 같다
{
 const {todayBoard}=await import('../dist/server/close-check.js');
 const {checkDay}=await import('../lib/attendance-check.ts');
 const {assistantBrief}=await import('../dist/server/assistant.js');
 const t=normalizeTeam(null);delete t.legacy;const [a]=t.employees;const mk=(id,name)=>({...a,id,name});
 t.employees=[mk('k1','김예시'),mk('k2','박샘플'),mk('k3','이체험')];const d='2026-10-06',iso=(h)=>new Date(Date.parse(d+'T'+h+':00+09:00')).toISOString(),now=Date.parse(d+'T14:00:00+09:00');
 t.shifts=[{id:'s1',employeeId:'k1',date:d,start:'09:00',end:'15:00',breakMinutes:60},{id:'s2',employeeId:'k2',date:d,start:'13:00',end:'21:00',breakMinutes:60},{id:'s3',employeeId:'k3',date:d,start:'10:00',end:'19:00',breakMinutes:60}];
 // 김예시가 근무 중간에 퇴근했다가 다시 출근(체험 화면에서 퇴근→출근 누름)
 t.attendance=[{id:'a1',employeeId:'k1',start:iso('09:00'),end:iso('12:00'),breakMinutes:0},{id:'a1b',employeeId:'k1',start:iso('12:30'),end:null,breakMinutes:0},{id:'a2',employeeId:'k2',start:iso('13:00'),end:null,breakMinutes:0},{id:'a3',employeeId:'k3',start:iso('10:00'),end:null,breakMinutes:0}];
 const f=checkDay(d,t.shifts,t.attendance,'normal',now);
 ok('A1 근무표대로 출근한 날은 확인 권장 0건(중간에 다시 출근해도)',f.length===0);
 const b=todayBoard(t,a.branchId,d,f,now),ids=b.rows.map(r=>r.employeeId);
 ok('A3 한 직원은 한 줄',new Set(ids).size===ids.length&&ids.length===3);
 ok('A3 제목과 일하는 중 숫자가 같음',b.working===new Set(b.rows.filter(r=>['working','late','extra'].includes(r.status)).map(r=>r.employeeId)).size&&b.working===3);
 const brief=assistantBrief(t,a.branchId,'출퇴근 기록',d,now);
 ok('A2 문제 없으면 비서도 문제 없음',brief.some(x=>x.text.includes('출퇴근 문제가 없어요')));
 t.employees.push(mk('k4','정가상'));t.attendance.push({id:'a4',employeeId:'k4',start:iso('11:00'),end:null,breakMinutes:0});
 const f2=checkDay(d,t.shifts,t.attendance,'normal',now),brief2=assistantBrief(t,a.branchId,'출퇴근 기록',d,now);
 ok('A1 근무표에 없는 직원이 출근하면 확인 권장 1건',f2.length===1&&f2[0].kind==='예정 외 출근'&&f2[0].employeeId==='k4');
 ok('A2 비서도 같은 건수와 이름',brief2.some(x=>x.text.includes('확인 권장 1건')&&x.text.includes('정가상')));
 console.log('PASS: 지시서 1라운드 A (A1~A3).');
}
// 지시서 1라운드 B: 월간 근무표에서 근무 옮기기 규칙
{
 const {moveShift,moveBlockReason,moveMessage}=await import('../lib/schedule-move.ts');
 const t=normalizeTeam(null);delete t.legacy;const [a]=t.employees;
 t.employees=[{...a,id:'m1',name:'김예시'},{...a,id:'m2',name:'박샘플'}];
 t.shifts=[{id:'x1',employeeId:'m1',date:'2026-10-08',start:'09:00',end:'15:00',breakMinutes:60},{id:'x2',employeeId:'m1',date:'2026-10-10',start:'12:00',end:'18:00',breakMinutes:0},{id:'x3',employeeId:'m2',date:'2026-10-09',start:'09:00',end:'15:00',breakMinutes:0},{id:'x4',employeeId:'m1',date:'2026-10-11',start:'22:00',end:'02:00',breakMinutes:0}];
 const r=moveShift(t,'x1','2026-10-09');
 ok('옮기면 날짜만 바뀌고 직원·시간·휴게 그대로',!r.reason&&JSON.stringify({...r.shifts.find(x=>x.id==='x1'),date:'2026-10-08'})===JSON.stringify(t.shifts[0])&&r.shifts.find(x=>x.id==='x1').date==='2026-10-09');
 ok('다른 직원이 같은 시간에 일해도 옮길 수 있음',!moveBlockReason(t,t.shifts[0],'2026-10-09'));
 ok('같은 직원 시간이 겹치는 날은 막고 이유',moveShift(t,'x1','2026-10-10').reason?.includes('겹쳐')&&moveShift(t,'x1','2026-10-10').shifts===t.shifts);
 ok('자정 넘는 근무와 다음 날 아침 겹침도 막음',!!moveBlockReason(t,{...t.shifts[0],start:'01:00',end:'05:00'},'2026-10-12'));
 t.approvedLeaves=[{employeeId:'m1',start:'2026-10-13',end:'2026-10-14'}];
 ok('승인된 휴가일은 막음',moveBlockReason(t,t.shifts[0],'2026-10-14')?.includes('휴가'));
 t.payrollRuns={'2026-09:branch-main':{locked:true,month:'2026-09',rows:[{employeeId:'m1'}]}};
 ok('확정된 급여월로는 옮길 수 없음',moveBlockReason(t,t.shifts[0],'2026-09-30')?.includes('확정'));
 ok('다른 직원은 그 달 확정과 무관',!moveBlockReason(t,{...t.shifts[2]},'2026-09-30'));
 ok('되돌리기 문구',moveMessage('김예시','2026-10-08','2026-10-09')==='김예시 10월 8일 → 9일로 옮겼어요'&&moveMessage('김예시','2026-10-31','2026-11-02')==='김예시 10월 31일 → 11월 2일로 옮겼어요');
 console.log('PASS: 지시서 1라운드 B (근무 옮기기 규칙).');
}
{
 const {manualVisibleTo,filterManuals,staffState}=await import('../lib/manual-view.ts');
 const ms=[{id:'1',title:'마감 순서',branchId:'all',category:'마감',roles:['홀'],steps:[{text:'의자'}],createdAt:'2026-10-01',updatedAt:'2026-10-05'},{id:'2',title:'커피 머신',branchId:'all',category:'기기',roles:[],steps:[{text:'예열 15분'}],createdAt:'2026-10-01',updatedAt:'2026-10-01'}];
 ok('주방 직원에겐 홀 전용 안 보임',!manualVisibleTo(ms[0],{branchId:'b',role:'주방'})&&manualVisibleTo(ms[1],{branchId:'b',role:'주방'}));
 ok('분류 칩',filterManuals(ms,'마감','').map(m=>m.id).join()==='1');ok('검색은 단계 글에서도',filterManuals(ms,'전체','예열').map(m=>m.id).join()==='2');
 ok('바뀜·새·확인함',staffState({...ms[0],read:false})==='바뀜'&&staffState({...ms[1],read:false})==='새 매뉴얼'&&staffState({...ms[1],read:true})==='확인함');
 console.log('PASS: 지시서 1라운드 D (매뉴얼 규칙).');
}
// 지시서 2라운드 003·004: 상태 배지와 인정 시간
{
 const {dayRows,checkDay}=await import('../lib/attendance-check.ts');
 const tm=await import('../dist/server/team-model.js');
 const d='2026-10-06',iso=(hm)=>new Date(`${d}T${hm}:00+09:00`).toISOString(),T=(hm)=>Date.parse(`${d}T${hm}:00+09:00`);
 const sh=[{id:'s1',employeeId:'a',date:d,start:'10:00',end:'18:00'},{id:'s2',employeeId:'b',date:d,start:'13:00',end:'18:00'}];
 const st=(att,now,leaves=[])=>dayRows(d,sh,att,'normal',now,leaves).map(r=>r.employeeId+':'+r.statuses.map(x=>x.kind+(x.minutes??'')).join('+')).join(' ');
 ok('허용 5분: 10:05 출근은 정상',st([{id:'1',employeeId:'a',start:iso('10:05'),end:null}],T('13:00')).startsWith('a:정상'));
 ok('10:06 출근은 지각 6분',st([{id:'1',employeeId:'a',start:iso('10:06'),end:null}],T('13:00')).startsWith('a:지각6'));
 ok('예정 13:00, 지금 13:25, 기록 없음 → 미출근 25분',st([],T('13:25')).includes('b:미출근25'));
 ok('예정 끝이 지나도 기록 없으면 결근',st([],T('18:30')).includes('b:결근'));
 ok('승인된 휴가일은 결근 아님',st([],T('18:30'),[{employeeId:'b',start:d,end:d}]).includes('b:휴가'));
 ok('퇴근 안 찍고 끝+허용 지나면 미퇴근',st([{id:'1',employeeId:'a',start:iso('10:00'),end:null}],T('18:20')).startsWith('a:미퇴근20'));
 ok('조퇴 + 지각 한 줄에 두 개',st([{id:'1',employeeId:'a',start:iso('10:20'),end:iso('17:00')}],T('19:00')).startsWith('a:지각20+조퇴60'));
 ok('휴게 중',st([{id:'1',employeeId:'a',start:iso('10:00'),end:null,breakStart:iso('12:00')}],T('12:10')).startsWith('a:휴게 중'));
 ok('근무표에 없는 출근은 예정 외',st([{id:'9',employeeId:'z',start:iso('11:00'),end:null}],T('12:00')).includes('z:예정 외'));
 ok('확인 권장도 같은 판정',checkDay(d,sh,[],'normal',T('13:25')).map(f=>f.employeeId+f.kind+f.minutes).join()==='a미출근205,b미출근25');
 // 004 인정 시간
 const r1=tm.creditFor({employeeId:'a',start:iso('09:50'),end:iso('18:00')},sh,{earlyIn:'scheduled',lateOut:'actual',unit:1});
 ok('예정 10:00, 09:50 출근 → 인정 출근 10:00',r1.start===iso('10:00')&&r1.end===iso('18:00'));
 ok('찍은 시각부터 규칙이면 09:50',tm.creditFor({employeeId:'a',start:iso('09:50'),end:iso('18:00')},sh,{earlyIn:'actual',lateOut:'actual',unit:1}).start===iso('09:50'));
 const r5=tm.creditFor({employeeId:'a',start:iso('10:03'),end:iso('18:02')},sh,{earlyIn:'scheduled',lateOut:'actual',unit:5});
 ok('5분 단위는 직원에게 유리하게(출근 내림·퇴근 올림)',r5.start===iso('10:00')&&r5.end===iso('18:05'));
 ok('늦게 퇴근 예정 시각까지 규칙',tm.creditFor({employeeId:'a',start:iso('10:00'),end:iso('18:40')},sh,{earlyIn:'scheduled',lateOut:'scheduled',unit:1}).end===iso('18:00'));
 const t=tm.normalizeTeam(null);delete t.legacy;const [e]=t.employees;t.employees=[{...e,id:'a',name:'가',payType:'시급',wage:10320,autoPay:false}];t.shifts=sh.slice(0,1);
 t.attendance=[{id:'r1',employeeId:'a',start:iso('09:50'),end:iso('18:00'),breakMinutes:0,breakStart:null}];tm.applyCredit(t.attendance[0],t);
 ok('원본 시각은 그대로, 인정 시각 따로',t.attendance[0].start===iso('09:50')&&t.attendance[0].credit.start===iso('10:00'));
 ok('급여 시간은 인정 시간(8시간)',Math.abs(tm.worked(t.attendance[0])-8)<1e-9&&Math.abs(tm.workedRaw(t.attendance[0])-(8+10/60))<1e-9);
 const before=JSON.stringify(tm.calculate(t,'2026-10'));t.settings={...t.settings,attendanceRule:{earlyIn:'actual',lateOut:'actual',unit:10}};tm.applyCredit(t.attendance[0],t);
 ok('규칙을 바꿔도 지난 기록은 다시 계산하지 않음',JSON.stringify(tm.calculate(t,'2026-10'))===before);
 console.log('PASS: 지시서 2라운드 (상태 배지·인정 시간).');
}
// 지시서 2주차: 알림 검사·근무표 변경·알림톡
{
 const {alertsFor}=await import('../lib/alert-sweep.ts');const {scheduleChanges}=await import('../lib/schedule-diff.ts');const {sendAlimtalk,alimtalkReady}=await import('../lib/alimtalk-send.ts');
 const d='2026-10-07',T=(hm)=>Date.parse(`${d}T${hm}:00+09:00`),iso=(hm)=>new Date(T(hm)).toISOString();
 const base={employees:[{id:'a',name:'가',payDay:10},{id:'b',name:'나',payDay:10}],shifts:[{id:'s1',employeeId:'a',date:d,start:'10:00',end:'15:00'},{id:'s2',employeeId:'b',date:d,start:'13:00',end:'18:00'}],attendance:[],payrollRuns:{'2026-09:m':{locked:true,month:'2026-09'}}};
 const keys=(x,now)=>alertsFor(x,now).map(a=>a.key).sort().join();
 ok('101 근무 1시간 전 알림(직원)',keys(base,T('12:05')).includes('before:s2'));
 ok('001 예정 +10분 전에는 미출근 알림 없음',!keys(base,T('10:09')).includes('noshow:s1'));
 ok('001 예정 +10분 지나면 사장님께 미출근',alertsFor(base,T('10:11')).some(a=>a.key==='noshow:s1'&&a.to==='owner'));
 ok('출근했으면 미출근 알림 없음',!keys({...base,attendance:[{id:'r',employeeId:'a',start:iso('10:02'),end:null}]},T('10:30')).includes('noshow:s1'));
 const open={...base,attendance:[{id:'r',employeeId:'a',start:iso('10:00'),end:null}]};
 ok('002 예정 퇴근 +30분 전에는 없음',!keys(open,T('15:29')).includes('clockout:r'));
 ok('002 +30분 지나면 직원·사장님 둘 다',keys(open,T('15:31')).includes('clockout:r')&&keys(open,T('15:31')).includes('clockout-owner:r'));
 ok('휴가인 직원은 알림 없음',!keys({...base,approvedLeaves:[{employeeId:'a',start:d,end:d}]},T('10:30')).includes('noshow:s1'));
 const nov={...base,payrollRuns:{}};ok('117 급여일 3일 전 미확정 알림',keys(nov,T('10:00')).includes('payday:2026-09')&&!keys(base,T('10:00')).includes('payday:2026-09'));
 const ch=scheduleChanges([{id:'1',employeeId:'a',date:'2026-10-08',start:'09:00',end:'15:00'},{id:'2',employeeId:'b',date:'2026-10-08',start:'13:00',end:'18:00'},{id:'3',employeeId:'b',date:'2026-10-01',start:'13:00',end:'18:00'}],[{id:'1',employeeId:'a',date:'2026-10-09',start:'09:00',end:'15:00'},{id:'2',employeeId:'b',date:'2026-10-08',start:'13:00',end:'18:00'}],'2026-10-07');
 ok('024 바뀐 직원에게만(지난 근무 삭제는 무시)',ch.size===1&&ch.get('a')==='10/8 09:00–15:00 → 10/9 09:00–15:00');
 ok('알림톡 설정 없으면 안 보냄',(await sendAlimtalk({},'01012345678','PAYSLIP_SENT',{})) ===null&&!alimtalkReady({}));
 let req;const env={SOLAPI_API_KEY:'k',SOLAPI_API_SECRET:'s',SOLAPI_PFID:'pf',SOLAPI_SENDER:'0212345678',ALIMTALK_TEMPLATES:JSON.stringify({CLOCKOUT_MISSING:'KA01'})};
 const r=await sendAlimtalk(env,'010-1234-5678','CLOCKOUT_MISSING',{이름:'가',날짜:'10/7'},async(u,o)=>{req={u,o};return new Response('{}',{status:200})});
 ok('알림톡 요청 모양',r==='sent'&&req.u.includes('solapi')&&JSON.parse(req.o.body).message.kakaoOptions.variables['#{이름}']==='가'&&/^HMAC-SHA256 apiKey=k, date=.*signature=[0-9a-f]{64}$/.test(req.o.headers.Authorization));
 ok('심사 안 된 템플릿은 안 보냄',(await sendAlimtalk(env,'01012345678','PAYSLIP_SENT',{이름:'가',가게:'x',월:'9',실수령액:1,지급일:'x'}))===null);
 console.log('PASS: 지시서 2주차 (알림 검사·근무표 변경·알림톡).');
}
// 직원 엑셀 파일 등록: .xlsx·CSV 읽기
{
 const {readFileSync}=await import('node:fs');
 const {readXlsx,readCsv,toBulkText,serialDate}=await import('../lib/xlsx-read.ts');
 const {parseBulk}=await import('../dist/server/bulk-members.js');
 const buf=readFileSync(new URL('./fixtures/staff.xlsx',import.meta.url));
 const rows=await readXlsx(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));
 ok('엑셀 제목 줄+2줄',rows.length===3&&rows[0][0]==='이름');
 const text=toBulkText(rows);
 ok('앞 0 빠진 휴대폰 번호 복구',text.includes('01012345678'));
 ok('엑셀 날짜 숫자 → 날짜',text.includes('2026-10-05'));
 ok('따옴표·쉼표 글자 그대로',rows[2][0]==='박"따옴",쉼표');
 const parsed=parseBulk(text,'b1',[],{workplace:'가게',employer:'사장'});
 ok('엑셀에서 읽은 두 명 모두 등록 가능',parsed.filter(r=>r.member).length===2);
 ok('일련번호 변환',serialDate(46300)==='2026-10-05');
 const csv=readCsv('﻿이름,연락처\n"홍,길동","010-1"\r\n\n이순신,010-2');
 ok('CSV 따옴표·빈 줄',csv.length===3&&csv[1][0]==='홍,길동'&&csv[2][1]==='010-2');
 ok('탭 CSV',readCsv('a\tb\nc\td')[1][1]==='d');
 console.log('PASS: 직원 엑셀 파일 읽기.');
}
// 홈 알림·비서
{
 const {todayBoard,homeAlerts}=await import('../dist/server/close-check.js');
 const {assistantBrief,searchAnswers}=await import('../dist/server/assistant.js');
 const {checkDay}=await import('../lib/attendance-check.ts');
 const {FAQ}=await import('../dist/server/faq.js');
 const t=normalizeTeam(null);delete t.legacy;const [a]=t.employees;const mk=(id,name)=>({...a,id,name,status:'재직'});
 t.employees=[mk('e1','가'),mk('e2','나'),mk('e3','다')];const d='2026-10-05',iso=h=>new Date(Date.parse(d+'T'+h+':00+09:00')).toISOString();
 t.shifts=[{id:'s1',employeeId:'e1',date:d,start:'13:00',end:'20:00',breakMinutes:0},{id:'s2',employeeId:'e2',date:d,start:'09:00',end:'18:00',breakMinutes:0}];
 t.attendance=[{id:'a2',employeeId:'e2',start:iso('09:20'),end:null,breakMinutes:0},{id:'a3',employeeId:'e3',start:'2026-10-03T00:00:00.000Z',end:null,breakMinutes:0}];
 const now=Date.parse(d+'T14:10:00+09:00'),f=checkDay(d,t.shifts,t.attendance,'normal',now),b=todayBoard(t,a.branchId,d,f,now);
 ok('출근 시각 지났는데 기록 없음',b.rows.find(r=>r.employeeId==='e1').status==='noshow'&&b.rows.find(r=>r.employeeId==='e1').label==='1시간 10분째 출근 기록 없음');
 ok('허용 오차 안이면 아직 예정',todayBoard(t,a.branchId,d,f,Date.parse(d+'T13:03:00+09:00')).rows.find(r=>r.employeeId==='e1').status==='planned');
 const al=homeAlerts(t,a.branchId,d,b);
 ok('알림: QR 안 찍음이 맨 앞',al[0].key==='noshow-s1'&&al[0].title.includes('출근 QR'));
 ok('알림: 지각·퇴근 누락',al.some(x=>x.key==='late-s2')&&al.some(x=>x.key==='out-a3'&&x.title.includes('퇴근 QR')));
 for(const page of ['홈','출퇴근 기록','근무 스케줄','급여·명세서','직원 관리','휴가·공지']){const br=assistantBrief(t,a.branchId,page,d,now);ok('비서 '+page+' 안내',br.length>0&&br.every(x=>x.text.length>5))}
 ok('비서 홈: 지금 상황 요약',assistantBrief(t,a.branchId,'홈',d,now)[0].text.includes('오늘 근무 2명'));
 ok('비서 출퇴근: 알림 그대로',assistantBrief(t,a.branchId,'출퇴근 기록',d,now).some(x=>x.tone==='red'));
 const empty=normalizeTeam(null);delete empty.legacy;empty.employees=[];ok('직원 없으면 가입 링크 안내',assistantBrief(empty,a.branchId,'홈',d,now)[0].text.includes('가입 링크'));
 const items=FAQ.flatMap(g=>g.items);ok('질문 검색: 주휴수당',searchAnswers(items,'주휴수당은 어떻게 계산하나요?').length>0);
 ok('질문 검색: 짧은 말은 무시',searchAnswers(items,'아').length===0);
 console.log('PASS: 홈 알림·척척 비서.');
}
// 명세서 칸 보기: 저장된 글을 다시 나눠 읽기
{
 const {payslipText,parsePayslip,payslipFromRow}=await import('../lib/payslip.ts');
 const row={employeeId:'3fa9c1d2-77ab',name:'김예시',hours:86.5,days:12,earnings:[{name:'기본급',amount:892680,formula:'10,320원 × 86.5시간'},{name:'주휴수당',amount:165120,formula:'(20/40) × 8시간 × 10,320원 × 4주'}],deductions:[{name:'사업소득 원천징수',amount:34900,formula:'3.3%'}],gross:1057800,deduction:34900,net:1022900,note:'9월분'};
 const v=parsePayslip(payslipText('척척식당','2026-09','2026-10-10',row)),r=payslipFromRow('척척식당','2026-09','2026-10-10',row);
 ok('칸 보기: 지급·공제 항목',v.earnings.length===2&&v.earnings[1].formula.startsWith('(20/40)')&&v.deductions[0].amount===34900);
 ok('칸 보기: 합계·실지급',v.gross===1057800&&v.deduction===34900&&v.net===1022900&&v.note==='9월분');
 ok('칸 보기: 기본 정보',v.info.find(x=>x[0]==='임금지급일')[1]==='2026-10-10'&&v.info.find(x=>x[0]==='근무')[1]==='12일 · 86.50시간');
 ok('글에서 읽은 것과 원래 값이 같음',JSON.stringify(v.info)===JSON.stringify(r.info)&&v.net===r.net);
 const none=parsePayslip(payslipText('가','2026-09','2026-10-10',{...row,deductions:[],deduction:0,net:1057800,note:''}));ok('공제 없음',none.deductions.length===0&&none.net===1057800);
 ok('명세서가 아닌 글은 null',parsePayslip('안녕하세요')===null);
 console.log('PASS: 명세서 칸 보기.');
}
// 휴게: 길이를 정하면 저절로 끝남
{
 const {applyClock,onBreak,settleBreak,breakEndsAt}=await import('../dist/server/team-model.js');
 const t0=Date.parse('2026-10-05T03:00:00Z'),m=n=>t0+n*60000;
 const a={start:new Date(t0).toISOString(),end:null,breakMinutes:0,breakStart:null,breakPlan:null};
 ok('휴게 시작 30분',applyClock(a,'break',m(120),30)===null&&a.breakPlan===30&&onBreak(a,m(130)));
 ok('30분 지나면 휴게 아님',!onBreak(a,m(151))&&breakEndsAt(a)===new Date(m(150)).toISOString());
 ok('휴게 끝을 안 눌러도 퇴근 때 30분만 빠짐',applyClock(a,'out',m(480))===null&&a.breakMinutes===30&&a.end);
 const b={start:new Date(t0).toISOString(),end:null,breakMinutes:0,breakStart:null};
 applyClock(b,'break',m(60),60);applyClock(b,'resume',m(80));ok('일찍 끝내면 실제 쉰 20분',Math.round(b.breakMinutes)===20&&!b.breakStart);
 applyClock(b,'break',m(200),30);ok('지난 휴게가 정리된 뒤 새 휴게 가능',applyClock(b,'break',m(300),30)===null&&Math.round(b.breakMinutes)===50);
 const c={start:new Date(t0).toISOString(),end:null,breakMinutes:0,breakStart:null};applyClock(c,'break',m(10));ok('길이 없는 휴게는 끝낼 때까지',onBreak(c,m(500))&&applyClock(c,'break',m(20))!==null);
 settleBreak(c,m(70));ok('정리하면 60분',Math.round(c.breakMinutes)===60);
 ok('모르는 기록',applyClock(c,'jump',m(80))!==null);
 console.log('PASS: 휴게 자동 끝.');
}
// 척척 비서: 말 알아듣기 · 분석 · 답
{
 const {reply,analyze}=await import('../dist/server/assistant.js');
 const {parseTimes,parseDate,parseWage,legalBreak}=await import('../lib/assistant-intents.ts');
 const d='2026-10-05';// 월요일
 ok('9시부터 6시 → 09:00–18:00',JSON.stringify(parseTimes('9시부터 6시 근무'))==='{"start":"09:00","end":"18:00"}');
 ok('오후 2시~10시',JSON.stringify(parseTimes('오후 2시~10시'))==='{"start":"14:00","end":"22:00"}');
 ok('09:00-15:30',JSON.stringify(parseTimes('09:00-15:30'))==='{"start":"09:00","end":"15:30"}');
 ok('9시 반부터 3시',JSON.stringify(parseTimes('9시 반부터 3시'))==='{"start":"09:30","end":"15:00"}');
 ok('밤 10시부터 2시(다음 날)',JSON.stringify(parseTimes('밤 10시부터 2시'))==='{"start":"22:00","end":"02:00"}');
 ok('시간 없으면 null',parseTimes('시급 10500')===null);
 ok('내일·모레',parseDate('내일',d)==='2026-10-06'&&parseDate('모레 근무',d)==='2026-10-07');
 ok('10월 8일 · 10/8',parseDate('10월 8일',d)==='2026-10-08'&&parseDate('10/8 9시',d)==='2026-10-08');
 ok('수요일 · 다음주 월요일',parseDate('수요일',d)==='2026-10-07'&&parseDate('다음주 월요일',d)==='2026-10-12');
 ok('8일(지난 날이면 다음 달)',parseDate('20일 9시부터',d)==='2026-10-20'&&parseDate('3일 근무',d)==='2026-11-03');
 ok('날짜 없으면 null',parseDate('9시부터 6시',d)===null);
 ok('시급·월급 만원',parseWage('시급 10,500원').wage===10500&&parseWage('월급 230만원').wage===2300000&&parseWage('일당 12만').payType==='일급');
 ok('법정 휴게',legalBreak('09:00','18:00')===60&&legalBreak('09:00','14:00')===30&&legalBreak('09:00','12:00')===0);
 const t=normalizeTeam(null);delete t.legacy;const [a]=t.employees;t.employees=[{...a,id:'e1',name:'김민지',status:'재직',payType:'시급',wage:10320,weeklyHours:20,joined:'2025-10-20'},{...a,id:'e2',name:'민지',status:'재직',email:'b@x.kr'}];t.shifts=[];t.attendance=[];t.payrollRuns={};
 const now=Date.parse(d+'T14:00:00+09:00');
 let r=reply('김민지 시급 10500',t,a.branchId,d,now);ok('임금 바꾸기 카드(긴 이름 우선)',r.actions[0].type==='setWage'&&r.actions[0].employeeId==='e1'&&r.actions[0].wage===10500);
 r=reply('김민지 시급 9000',t,a.branchId,d,now);ok('최저시급 경고',r.lines.some(l=>l.includes('최저시급')));
 r=reply('김민지 내일 9시부터 6시 근무',t,a.branchId,d,now);ok('근무 넣기 카드',r.actions[0].type==='addShift'&&r.actions[0].date==='2026-10-06'&&r.actions[0].end==='18:00'&&r.actions[0].breakMinutes===60);
 r=reply('김민지 시급 11000 수요일 10시부터 3시',t,a.branchId,d,now);ok('임금+근무 한 번에',r.actions.length===2);
 r=reply('박새로 시급 11000',t,a.branchId,d,now);ok('없는 이름은 새 직원 등록',r.actions[0].type==='register'&&r.actions[0].name==='박새로');
 r=reply('명세서 다 보내줘',t,a.branchId,d,now);ok('확정 전이면 급여 화면으로',r.actions[0].type==='go'&&r.actions[0].target==='payroll');
 t.payrollRuns={['2026-09:'+a.branchId]:{locked:true,month:'2026-09',rows:[{employeeId:'e1'},{employeeId:'e2'}]}};
 r=reply('명세서 다 보내줘',t,a.branchId,d,now);ok('지난달 확정분 모두 보내기',r.actions[0].type==='sendPayslip'&&r.actions[0].employeeIds.length===2&&r.actions[0].runKey==='2026-09:'+a.branchId);
 r=reply('김민지 명세서 보내',t,a.branchId,d,now);ok('한 명만 보내기',r.actions[0].employeeIds.length===1);
 r=reply('김민지 명세서 보여줘',t,a.branchId,d,now);ok('명세서 보기',r.actions[0].type==='openPayslip');
 ok('QR · 계약서',reply('QR 띄워줘',t,a.branchId,d,now).actions[0].type==='qr'&&reply('김민지 계약서 보내줘',t,a.branchId,d,now).actions[0].href==='/contracts');
 ok('누가 일해',reply('오늘 누가 일해?',t,a.branchId,d,now).lines[0].includes('일하는 사람은 없어요'));
 ok('인건비',reply('이번 달 인건비',t,a.branchId,d,now).lines[0].includes('10월'));
 ok('개인 급여',reply('김민지 이번 달 급여 얼마',t,a.branchId,d,now).actions[0].type==='openPayslip');
 ok('도움말',reply('도움말',t,a.branchId,d,now).lines.length>3);
 ok('모르는 말',reply('ㅁㄴㅇㄹ',t,a.branchId,d,now).lines[0].includes('도움말'));
 ok('FAQ로 답',reply('주휴수당 조건',t,a.branchId,d,now,[{q:'주휴수당 조건은?',a:'주 15시간 이상'}]).lines[0].includes('15시간'));
 t.shifts=[{id:'s1',employeeId:'e1',date:'2026-10-06',start:'09:00',end:'23:00',breakMinutes:60},{id:'s2',employeeId:'e2',date:'2026-10-07',start:'09:00',end:'23:30',breakMinutes:30}];
 const an=analyze(t,a.branchId,d,now);
 ok('분석: 주 15시간 경계',an.some(x=>x.text.includes('15시간을 넘기면')));
 ok('분석: 1년 근속 임박',an.some(x=>x.text.includes('1년을 채워요')));
 ok('분석: 다음 주 비었음',an.some(x=>x.text.includes('다음 주 근무표')));
 ok('주휴 질문',reply('김민지 주휴 돼?',t,a.branchId,d,now).lines[0].includes('13.0시간'));
 ok('분석해줘',reply('분석해줘',t,a.branchId,d,now).lines.length>=2);
 console.log('PASS: 척척 비서 말 알아듣기·분석.');
}
// 척척 비서: 앞 대화 기억
{
 const {reply}=await import('../dist/server/assistant.js');
 const t=normalizeTeam(null);delete t.legacy;const [a]=t.employees;t.employees=[{...a,id:'e1',name:'김예시',status:'재직',payType:'시급',wage:10320}];t.shifts=[];t.attendance=[];t.payrollRuns={};
 const d='2026-10-05',now=Date.parse(d+'T14:00:00+09:00');
 let r=reply('김예시 근로계약서 작성',t,a.branchId,d,now);ok('계약서 말한 직원 기억',r.memo.employeeId==='e1'&&r.memo.lastVerb==='contract');
 r=reply('시급 12000원으로 만들어줘',t,a.branchId,d,now,[],r.memo);ok('이름 없이 말해도 방금 그 직원',r.actions[0].type==='setWage'&&r.actions[0].employeeId==='e1'&&r.actions[0].wage===12000);
 ok('계약서 이어서 만들기 버튼',r.actions.some(x=>x.type==='link'&&x.href==='/contracts'));
 r=reply('시급 12000',t,a.branchId,d,now);ok('기억 없으면 이름 물어봄',r.memo.pending==='시급 12000');
 const r2=reply('김예지',t,a.branchId,d,now,[],r.memo);ok('이름만 답하면 아까 부탁 처리(한 글자 틀려도)',r2.actions[0]?.type==='setWage'&&r2.lines[0].includes('김예시님으로 알아들었어요'));
 const r3=reply('김예시',t,a.branchId,d,now);ok('이름만 쓰면 직원 요약',r3.lines[0].includes('시급 10,320원'));
 ok('그 직원 명세서',reply('그 직원 명세서 보여줘',t,a.branchId,d,now,[],{employeeId:'e1'}).actions[0].type==='openPayslip');
 console.log('PASS: 척척 비서 앞 대화 기억.');
}
// 척척 비서 질문 100가지
{
 const {KB,matchKB,answerKB}=await import('../dist/server/assistant.js');
 const {reply}=await import('../dist/server/assistant.js');
 ok('질문 100가지 이상',KB.length>=100&&new Set(KB.map(x=>x.id)).size===KB.length);
 const miss=KB.filter(it=>matchKB(it.q)?.id!==it.id).map(it=>it.id);ok('예시 질문마다 자기 항목으로 감'+(miss.length?' '+miss.join(','):''),!miss.length);
 const t=normalizeTeam(null);delete t.legacy;const [a]=t.employees;t.employees=[{...a,id:'e1',name:'김예시',status:'재직',payType:'시급',wage:9000,weeklyHours:12,joined:'2025-11-01',birthMonth:'2010-03'}];
 t.shifts=[{id:'s1',employeeId:'e1',date:'2026-10-06',start:'09:00',end:'15:00',breakMinutes:30}];t.attendance=[{id:'a1',employeeId:'e1',start:'2026-10-02T00:00:00.000Z',end:null,breakMinutes:0}];t.payrollRuns={};
 const d='2026-10-05',now=Date.parse(d+'T14:00:00+09:00'),c={s:t,branch:a.branchId,date:d,now,es:t.employees,ids:new Set(['e1']),text:''};
 let bad=[];for(const it of KB){try{const o=answerKB(it,c);if(!o.lines.length||o.lines.some(l=>!l||l.includes('undefined')||l.includes('NaN')))bad.push(it.id)}catch(e){bad.push(it.id+':'+e.message)}}
 ok('100가지 모두 답이 나옴'+(bad.length?' '+bad.join(','):''),!bad.length);
 ok('내일 근무자',reply('내일 누가 일해?',t,a.branchId,d,now).lines[0].includes('김예시 09:00–15:00'));
 ok('최저시급 미달 찾기',reply('최저시급보다 적게 받는 직원 있어?',t,a.branchId,d,now).lines[0].includes('김예시 9,000원'));
 ok('퇴근 누락',reply('퇴근 안 찍은 사람 있어?',t,a.branchId,d,now).lines[0].includes('10월 2일'));
 ok('18세 미만',reply('18세 미만 직원 있어?',t,a.branchId,d,now).lines[0].includes('김예시'));
 ok('곧 1년',reply('곧 1년 되는 직원은?',t,a.branchId,d,now).lines[0].includes('11월 1일'));
 ok('노무 상식: 주휴 조건',reply('주휴수당 조건이 뭐야?',t,a.branchId,d,now).lines[0].includes('15시간'));
 ok('질문은 명령으로 안 감',reply('명세서는 어떻게 보내?',t,a.branchId,d,now).actions.every(x=>x.type!=='sendPayslip'));
 ok('계약서 안 쓴 직원 목록',reply('계약서 안 쓴 직원은?',t,a.branchId,d,now).lines[0].includes('김예시'));
 ok('명령은 그대로',reply('명세서 다 보내줘',t,a.branchId,d,now).actions[0].type==='go');
 ok('개인 주휴는 개인 답',reply('김예시 주휴 받을 수 있어?',t,a.branchId,d,now).lines[0].includes('김예시님 이번 주'));
 console.log('PASS: 척척 비서 질문 100가지.');
}
// 지시서 3주차: 근무표 — 021 끌어 바꾸기 막힘, 022 필요 인원, 023 공개·확인, 107 마감 알림, 114·127 근무 넣을 때 확인
{
 const {checkShift,staffingGaps,weekHours}=await import('../lib/schedule-rules.ts');const {editBlockReason}=await import('../lib/schedule-move.ts');
 const {mergePublished,ackWeek,publishStatus,pendingAcks}=await import('../lib/schedule-publish.ts');const {alertsFor}=await import('../lib/alert-sweep.ts');
 const sh=(id,emp,date,start,end,b=0)=>({id,employeeId:emp,date,start,end,breakMinutes:b});
 const minor={id:'m',name:'미성',birthMonth:'2010-03'},adult={id:'a',name:'성인'};
 ok('127 연소자 밤 근무 막음',checkShift(sh('x','m','2026-10-07','20:00','23:00'),[],minor).some(c=>c.level==='block'&&c.text.includes('밤 10시')));
 ok('127 연소자 하루 7시간 초과 막음',checkShift(sh('x','m','2026-10-07','09:00','17:30',0),[],minor).some(c=>c.level==='block'&&c.text.includes('7시간')));
 const wk=['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'].map((d,i)=>sh('w'+i,'m',d,'10:00','17:00'));
 ok('127 연소자 주 35시간 초과 막음',checkShift(sh('x','m','2026-10-10','10:00','12:00'),wk,minor).some(c=>c.level==='block'&&c.text.includes('35시간')));
 ok('성인 낮 근무는 막지 않음',!checkShift(sh('x','a','2026-10-07','20:00','23:00'),[],adult).some(c=>c.level==='block'));
 const four=['2026-10-05','2026-10-06','2026-10-07'].map((d,i)=>sh('f'+i,'a',d,'10:00','14:00'));
 ok('114 주 15시간 처음 넘길 때만 경고',checkShift(sh('x','a','2026-10-08','10:00','14:00'),four,adult).some(c=>c.level==='warn'&&c.text.includes('주휴수당'))&&!checkShift(sh('x','a','2026-10-08','10:00','11:00'),four,adult).length);
 ok('주 시간 합계(일요일 시작)',weekHours(four,'a','2026-10-07','sun')===12);
 const needs=[{weekday:3,start:'11:00',end:'14:00',count:2},{weekday:3,start:'17:00',end:'20:00',count:1}];
 const g=staffingGaps('2026-10-07',[sh('1','a','2026-10-07','10:00','15:00'),sh('2','b','2026-10-07','12:00','15:00'),sh('3','b','2026-10-07','17:00','20:00'),sh('4','c','2026-10-07','17:00','20:00'),sh('5','d','2026-10-07','17:00','20:00')],needs);
 ok('022 점심 11~12시 1명이라 부족',g.some(x=>x.kind==='부족'&&x.from==='11:00'&&x.have===1));
 ok('022 저녁 3명은 필요+1 넘어 과잉',g.some(x=>x.kind==='과잉'&&x.from==='17:00'&&x.have===3));
 ok('022 다른 요일 필요 인원은 무시',!staffingGaps('2026-10-08',[],needs).length);
 const team={shifts:[sh('s1','a','2026-10-07','10:00','15:00')],payrollRuns:{},approvedLeaves:[{employeeId:'b',start:'2026-10-07',end:'2026-10-07'}]};
 ok('021 같은 직원 겹치면 막음',!!editBlockReason(team,sh('c','a','2026-10-07','14:00','16:00'))&&!editBlockReason(team,sh('s1','a','2026-10-07','11:00','16:00'),'s1'));
 ok('021 휴가인 직원에게 끌어 넣기 막음',editBlockReason(team,sh('c','b','2026-10-07','10:00','12:00')).includes('휴가'));
 ok('021 확정된 달은 막음',editBlockReason({...team,payrollRuns:{k:{locked:true,month:'2026-10',rows:[{employeeId:'a'}]}}},sh('s1','a','2026-10-07','11:00','16:00'),'s1').includes('확정'));
 const key='br:2026-10-05',s1=[sh('1','a','2026-10-06','10:00','15:00'),sh('2','b','2026-10-06','10:00','15:00')];
 let m=mergePublished({},{[key]:{at:'t1',acks:{a:'fake'}}},s1,s1);
 ok('023 처음 공개는 알림 대상, 사장님이 보낸 확인은 무시',m.fresh.join()===key&&!Object.keys(m.published[key].acks).length);
 let a=ackWeek(m.published,key,'a','br','t2');ok('023 직원 확인',a.published[key].acks.a==='t2');
 ok('023 다른 매장 근무표는 확인 못 함',!!ackWeek(m.published,key,'a','other','t2').error&&!!ackWeek({},key,'a','br','t').error);
 a=ackWeek(a.published,key,'b','br','t3');
 const s2=s1.map(x=>x.employeeId==='a'?{...x,end:'16:00'}:x);m=mergePublished(a.published,a.published,s1,s2);
 ok('023 근무 바뀐 직원만 확인 풀림',!m.fresh.length&&!m.published[key].acks.a&&m.published[key].acks.b==='t3');
 ok('023 다시 공개하면 모두 다시 확인',!Object.keys(mergePublished(a.published,{[key]:{at:'t9',acks:{}}},s1,s1).published[key].acks).length);
 const st=publishStatus(a.published,'br','2026-10-08',[{id:'a',name:'가',branchId:'br'},{id:'b',name:'나',branchId:'br'},{id:'c',name:'다',branchId:'x'}]);
 ok('023 확인 현황(내 매장 직원만)',st.published&&st.acked.length===2&&!st.pending.length);
 ok('023 직원 할 일: 안 한 이번 주 이후 공개분',pendingAcks({[key]:{at:'t',acks:{}},'br:2026-09-28':{at:'t',acks:{}}},'a','br','2026-10-07').join()===key);
 const ad={employees:[{id:'a',name:'가'},{id:'b',name:'나'}],shifts:[],attendance:[],settings:{availabilityDue:3},availability:{a:{updatedAt:'2026-10-05T01:00:00Z'},b:{updatedAt:'2026-10-01T01:00:00Z'}}};
 const T=(d,hm)=>Date.parse(`${d}T${hm}:00+09:00`),ks=(x,n)=>alertsFor(x,n).filter(z=>z.key.startsWith('avail:')).map(z=>z.to).join();
 ok('107 마감 요일 10시 이후 안 낸 직원에게만',ks(ad,T('2026-10-07','10:05'))==='b'&&ks(ad,T('2026-10-07','09:50'))===''&&ks(ad,T('2026-10-08','10:05'))===''&&ks({...ad,settings:{}},T('2026-10-07','10:05'))==='');
 console.log('PASS: 지시서 3주차 (근무표 규칙·필요 인원·공개 확인·마감 알림).');
}
// 지시서 4주차: 급여 마감 — 지난달 대비, 재확정 비교, 지급 완료, 일괄 수당, 확정 이력
{
 const {compareMonths,revisionDiff,reopenRun,finalizeHistory,markPaid,paidSummary,bulkAdjust,prevMonthOf}=await import('../lib/payroll-close.ts');
 const R=(id,net,h=10)=>({employeeId:id,name:id.toUpperCase(),net,gross:net,hours:h});
 ok('지난달 계산',prevMonthOf('2026-01')==='2025-12'&&prevMonthOf('2026-10')==='2026-09');
 const c=compareMonths([R('a',1000000),R('b',1500000),R('c',300000)],[R('a',1000000),R('b',1000000),R('d',500000)]);
 ok('지난달 대비: 30% 넘으면 표시, 신규·빠짐',c.find(x=>x.employeeId==='b').flag==='크게 바뀜'&&!c.find(x=>x.employeeId==='a').flag&&c.find(x=>x.employeeId==='c').flag==='신규'&&c.find(x=>x.employeeId==='d').flag==='이번 달 없음');
 ok('지난달 자료 없으면 표시 없음',compareMonths([R('a',1)],null).every(x=>!x.flag));
 const run={locked:true,revision:1,at:'2026-10-01T00:00:00Z',actor:{name:'사장'},rows:[R('a',1000000),R('b',900000)],history:finalizeHistory(undefined,1,'2026-10-01T00:00:00Z','사장',[R('a',1000000),R('b',900000)])};
 let r=markPaid(run,['a'],'2026-10-10');ok('지급 완료 기록',r.run.paid.a==='2026-10-10'&&paidSummary(r.run).done===1&&paidSummary(r.run).amountLeft===900000);
 ok('지급 완료 취소',!markPaid(r.run,['a'],'',true).run.paid.a);
 ok('확정 전·모르는 직원은 지급 완료 못 함',!!markPaid({...run,locked:false},['a'],'2026-10-10').error&&!!markPaid(run,['zz'],'2026-10-10').error&&!!markPaid(run,['a'],'').error);
 const op=reopenRun(r.run,'수당 누락','2026-10-11T00:00:00Z','사장');
 ok('확정 해제: 잠금 풀고 지난 내용·이력 남기고 지급 기록은 지움',!op.locked&&op.prevRows.length===2&&!Object.keys(op.paid).length&&op.history.map(h=>h.kind).join()==='확정,해제'&&op.history[1].reason==='수당 누락');
 const d=revisionDiff(op.prevRows,[R('a',1050000,11),R('b',900000)]);
 ok('재확정 비교: 바뀐 직원만',d.length===1&&d[0].diff===50000&&d[0].hours===1);
 ok('재확정 이력',finalizeHistory(op,2,'t','사장',[R('a',1)]).map(h=>h.kind+h.revision).join()==='확정1,해제1,확정2');
 const b=bulkAdjust({'2026-10:a':{earnings:[{name:'상여',amount:1,formula:'x'}],deductions:[],note:''}},'2026-10',['a','b'],'earnings',{name:' 상여 ',amount:50000,formula:'추석'});
 ok('일괄 수당: 같은 이름은 바꾸고 없으면 새로',b.adjustments['2026-10:a'].earnings.length===1&&b.adjustments['2026-10:a'].earnings[0].amount===50000&&b.adjustments['2026-10:b'].earnings[0].name==='상여');
 ok('일괄 수당 막힘',!!bulkAdjust({},'2026-10',[],'earnings',{name:'x',amount:1,formula:''}).error&&!!bulkAdjust({},'2026-10',['a'],'earnings',{name:'x',amount:0,formula:''}).error&&!!bulkAdjust({},'2026-10',['a'],'deductions',{name:'',amount:5,formula:''}).error);
 console.log('PASS: 지시서 4주차 (급여 마감 도우미).');
}
