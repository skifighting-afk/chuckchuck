// 법정수당·4대보험 자동 계산 점검. 기대값은 손으로 계산해 둔 값이다.
import assert from 'node:assert/strict';
import {allowances,insuranceLines,splitRecord,monday} from '../lib/pay-rules.ts';
import {calculate,normalizeTeam} from '../dist/server/team-model.js';
import {payslipText,payslipMissing,employeeNumber} from '../lib/payslip.ts';

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
ok('income tax left for manual entry',row.warnings.some(w=>w.includes('간이세액표')));
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
