// 법정수당·4대보험 자동 계산 점검. 기대값은 손으로 계산해 둔 값이다.
import assert from 'node:assert/strict';
import {allowances,insuranceLines,splitRecord,monday} from '../lib/pay-rules.ts';
import {calculate,normalizeTeam} from '../dist/server/team-model.js';

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
console.log('PASS: 법정수당(주휴·연장·야간)·4대보험 자동 계산.');
