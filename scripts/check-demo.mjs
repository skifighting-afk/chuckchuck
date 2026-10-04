// 작업 090: 체험 화면 숫자 점검. 가상 매장의 급여·명세서·임금대장 합계가 서로 맞아야 한다.
import assert from 'node:assert/strict';
import {demoTeam} from '../dist/server/demo.js';
import {calculate,teamSchema} from '../dist/server/team-model.js';
import {wageLedger} from '../dist/server/wage-ledger.js';
import {payslipText,payslipMissing} from '../lib/payslip.ts';
let n=0;const ok=(name,v)=>{assert.ok(v,name);console.log(`PASS ${++n}. ${name}`)};
const sum=(xs)=>xs.reduce((t,x)=>t+x.amount,0);
for(const now of ['2026-10-04','2026-02-15','2026-03-31']){
 const s=demoTeam(now),prev=Object.values(s.payrollRuns)[0];
 ok(`${now}: demo state passes the store schema`,teamSchema.safeParse(s).success);
 ok(`${now}: only synthetic contacts`,s.employees.every(e=>e.email.endsWith('@example.invalid')&&e.phone==='010-0000-0000'));
 ok(`${now}: last month confirmed with today's calculation`,JSON.stringify(prev.rows)===JSON.stringify(calculate(s,prev.month).filter(r=>r.branchId==='branch-main')));
 for(const month of [prev.month,now.slice(0,7)])for(const r of calculate(s,month)){
  assert.equal(r.gross,sum(r.earnings),`${month} ${r.name} gross = earnings`);
  assert.equal(r.deduction,sum(r.deductions),`${month} ${r.name} deduction = deductions`);
  assert.equal(r.net,r.gross-r.deduction,`${month} ${r.name} net`);
  assert.ok(!(r.warnings||[]).some(w=>w.includes('최저임금')),`${month} ${r.name} no minimum wage warning`);
 }
 ok(`${now}: every row adds up (gross, deductions, net)`,true);
 const rows=prev.rows,by=name=>rows.find(r=>r.name===name);
 ok(`${now}: 35-hour weekly worker gets 주휴수당`,by('박샘플').earnings.some(i=>i.name==='주휴수당'&&i.amount>0));
 ok(`${now}: 12-hour weekend worker gets no 주휴수당`,!by('정가상').earnings.some(i=>i.name==='주휴수당'));
 ok(`${now}: insured worker has 4대보험 lines`,['국민연금','건강보험','고용보험'].every(n=>by('이체험').deductions.some(i=>i.name===n)));
 ok(`${now}: excluded part-timer only has 고용보험`,by('정가상').deductions.every(i=>i.name==='고용보험'));
 ok(`${now}: payslips have every required item`,rows.every(r=>payslipMissing(payslipText(s.store.name,prev.month,prev.payDate,r)).length===0));
 const ledger=wageLedger(s,prev.month,prev.month);
 ok(`${now}: wage ledger total equals payroll total`,ledger.reduce((t,e)=>t+e.net,0)===rows.reduce((t,r)=>t+r.net,0)&&ledger.length===4);
 const open=s.attendance.filter(a=>!a.end);
 ok(`${now}: one person still at work today`,open.length===1&&open[0].start.startsWith(now));
 ok(`${now}: no attendance in the future`,s.attendance.every(a=>a.start.slice(0,10)<=now));
}
console.log('PASS: 체험 화면 숫자(급여·명세서·임금대장 합계).');
