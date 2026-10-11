import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {calculate} from '../dist/server/team-model.js';
export function lockedSelfRun(data,self){return {locked:true,month:'2026-09',branch:self.branchId,payDate:'2026-10-10',rows:calculate(data,'2026-09').filter(row=>row.employeeId===self.id)}}
export async function workContextE2E({page,staff,browser,srv,step}){
 await step('매장·일주월 고정 맥락 · 실제/휴게/인정/확정 급여 시간 구분',async()=>{
  const saved=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first(),data=JSON.parse(saved.data);
  const who=await (await staff.request.get(srv.ORIGIN+'/api/store')).json(),self=data.employees.find(e=>e.id===who.selfId);assert(self);
  const record={id:'ux-pay-time-proof',employeeId:self.id,start:'2026-09-30T13:00:00.000Z',end:'2026-09-30T17:00:00.000Z',breakMinutes:30,breakStart:null,credit:{start:'2026-09-30T13:15:00.000Z',end:'2026-09-30T17:00:00.000Z',rule:'출근 예정 시각부터'}};
  const context=page.locator('.owner-work-context'),summary='급여 시간 확인 · 3시간 15분';
  const go=screen=>page.goto(srv.ORIGIN+'/app?screen='+screen+'&branch='+encodeURIComponent(self.branchId),{waitUntil:'networkidle'});
  let employeeCtx;
  try{
   delete data.payrollRuns['2026-09:'+self.branchId];
   await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();
   await srv.db.q('INSERT INTO attendance_records(owner,id,employee_id,start_at,record) VALUES(?,?,?,?,?)',saved.owner,record.id,self.id,record.start,JSON.stringify(record)).run();
   await page.setViewportSize({width:1440,height:900});await go('attendance');await page.getByLabel('근태 날짜',{exact:true}).fill('2026-09-30');
   assert.match(await context.innerText(),/2026\.09\.30 · 일간 출퇴근/);
   const views=page.getByRole('group',{name:'보기',exact:true});await views.getByRole('button',{name:'주',exact:true}).click();assert.match(await context.innerText(),data.settings.weekStart==='sun'?/2026\.09\.27–2026\.10\.03/:/2026\.09\.28–2026\.10\.04/);
   await views.getByRole('button',{name:'월',exact:true}).click();assert.match(await context.innerText(),/2026\.09\.01–2026\.09\.30 · 월간 출퇴근/);await views.getByRole('button',{name:'일',exact:true}).click();
   const detail=page.locator('.att-table .attendance-pay-time').filter({has:page.getByText(summary,{exact:true})});await detail.locator('summary').click();assert.match(await detail.innerText(),/4시간[\s\S]*30분[\s\S]*3시간 15분[\s\S]*미확정/);assert.match(await detail.innerText(),/다음 날 퇴근/);
   const size=await context.locator('span').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
   for(const large of [false,true]){
    if(large){await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click();assert(await context.locator('span').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>size)}
    for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'work context overflow '+width+' large='+large);await page.locator('.att-rule summary').scrollIntoViewIfNeeded();const box=await context.boundingBox();assert(box&&box.y>=0&&box.y+box.height<900,'selected period remains in view')}
   }
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.setViewportSize({width:1440,height:900});
   if(data.branches.length>1){const other=data.branches.find(b=>b.id!==self.branchId);await page.getByLabel('지점 선택',{exact:true}).selectOption(other.id);assert.match(await context.innerText(),new RegExp(other.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));await page.getByLabel('지점 선택',{exact:true}).selectOption(self.branchId)}
   await go('schedule');await page.getByLabel('근무표 날짜',{exact:true}).fill('2026-09-30');await page.getByRole('button',{name:'주간 · 7일 한눈에',exact:true}).click();assert.match(await context.innerText(),/2026\.09\.30–2026\.10\.06 · 주간 근무표/);await page.getByRole('button',{name:'월간 · 한 달 미리 보기',exact:true}).click();assert.match(await context.innerText(),/2026\.09\.01–2026\.09\.30 · 월간 근무표/);
   await go('payroll');await page.getByLabel('급여 월',{exact:true}).fill('2028-02');assert.match(await context.innerText(),/2028\.02\.01–2028\.02\.29 · 월 급여/);
   data.payrollRuns['2026-09:'+self.branchId]=lockedSelfRun({...data,attendance:[...data.attendance,record]},self);await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();
   await go('attendance');await page.getByLabel('근태 날짜',{exact:true}).fill('2026-09-30');await detail.locator('summary').click();await detail.getByText('확정됨 · 명세서 기준 확인',{exact:true}).waitFor();assert.match(await detail.innerText(),/아래는 현재 출퇴근 기록/);
   employeeCtx=await browser.newContext({storageState:await staff.context().storageState(),viewport:{width:390,height:844},serviceWorkers:'block'});const employee=await employeeCtx.newPage();await employee.goto(srv.ORIGIN+'/app',{waitUntil:'networkidle'});const more=employee.getByRole('button',{name:/지난 기록 더 보기/});if(await more.count())await more.click();const own=employee.locator('.attendance-pay-time').filter({has:employee.getByText(summary,{exact:true})});await own.locator('summary').click();await own.getByText('확정됨 · 명세서 기준 확인',{exact:true}).waitFor();
   for(const width of [320,390,768,1440]){await employee.setViewportSize({width,height:900});assert(await employee.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'personal pay-time overflow '+width)}
   await page.setViewportSize({width:390,height:844});await detail.scrollIntoViewIfNeeded();await mkdir('ci-logs',{recursive:true});await page.screenshot({path:'ci-logs/work-context-pay-time-mobile.png'});
  }finally{await employeeCtx?.close();await srv.db.q('DELETE FROM attendance_records WHERE id=?',record.id).run();await srv.db.q('UPDATE stores SET data=? WHERE owner=?',saved.data,saved.owner).run();await page.setViewportSize({width:1440,height:900})}
 });
}
