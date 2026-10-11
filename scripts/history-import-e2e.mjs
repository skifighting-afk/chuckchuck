import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

/** Runs against the existing isolated E2E database and authenticated owner. */
export async function historyImportE2E({owner,srv,step}){
 const store=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first(),data=JSON.parse(store.data);
 const base=data.employees[0];assert(base,'existing synthetic employee');
 data.branches.push({id:'history-east',name:'가져오기 2호점',address:''});
 data.employees.push(...[
  {id:'history-first',branchId:'branch-main',email:'history-first@example.invalid'},
  {id:'history-second',branchId:'history-east',email:'history-second@example.invalid'},
 ].map(e=>({...structuredClone(base),...e,name:'김민지'})));
 await srv.db.q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(data),store.owner).run();
 const originalViewport=owner.viewportSize();
 const content=Buffer.from('이름,날짜,시작,끝\n\n김민지,2099-10-14,17:00,22:00\n김민지,2099-10-15,18:00,23:00\n,2099-10-16,19:00,23:00');
 try{
  await step('가져오기 동명이인·이름 빈 줄 → 원본 확인·직접 연결·명시적 제외',async()=>{
   await owner.setViewportSize({width:390,height:844});
   await owner.goto(srv.ORIGIN+'/app?screen=settings',{waitUntil:'networkidle'});
   const panel=owner.locator('.hist-import');
   await panel.locator('input[type=file]').setInputFiles({name:'동명이인-검수.csv',mimeType:'text/csv',buffer:content});
   await panel.getByText('직원 연결을 확인해 주세요 · 3줄',{exact:true}).waitFor();
   assert(await panel.getByRole('button',{name:'직원 연결 3줄 확인 필요',exact:true}).isDisabled());
   assert.equal(await panel.locator('.hi-match-row').count(),3);
   assert.match(await panel.locator('.hi-match-row').first().innerText(),/2099-10-14/);
   assert.match(await panel.locator('.hi-match-row').nth(1).innerText(),/18:00/);
   const select=panel.getByRole('combobox',{name:'3줄 직원 연결',exact:true});
   assert.match(await select.locator('option[value="history-second"]').innerText(),/가져오기 2호점/);
   await select.focus();assert(await select.evaluate(el=>document.activeElement===el));
   const overflow=await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.right>document.documentElement.clientWidth+1});assert.equal(overflow,false);
   const screenshot=process.env.HISTORY_IMPORT_SCREENSHOT||'ci-logs/history-import-matching.png';await mkdir(dirname(screenshot),{recursive:true});await panel.screenshot({path:screenshot});
   await select.selectOption('history-first');
   await panel.getByRole('combobox',{name:'4줄 직원 연결',exact:true}).selectOption('history-second');
   await panel.getByRole('combobox',{name:'5줄 직원 연결',exact:true}).selectOption('__exclude__');
   await panel.getByText(/직접 제외한 줄 1개/).waitFor();
   const button=panel.getByRole('button',{name:'2건 가져오기',exact:true});assert(await button.isEnabled());
   const [res]=await Promise.all([owner.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/api/store')),button.click()]);assert(res.ok(),await res.text());
   await panel.getByText(/근무 2개를 넣었어요/).waitFor();
   await owner.reload({waitUntil:'networkidle'});
   const saved=JSON.parse((await srv.db.q('SELECT data FROM stores WHERE owner=?',store.owner).first()).data);
   assert.deepEqual(saved.shifts.filter(x=>x.employeeId.startsWith('history-')).map(x=>[x.employeeId,x.date,x.start]),[['history-first','2099-10-14','17:00'],['history-second','2099-10-15','18:00']]);
  });
  await step('가져오기 직접 연결·제외 초기화 → 재확인 전 저장 차단',async()=>{
   const panel=owner.locator('.hist-import');
   await panel.locator('input[type=file]').setInputFiles({name:'동명이인-검수.csv',mimeType:'text/csv',buffer:content});
   await panel.getByRole('combobox',{name:'3줄 직원 연결',exact:true}).selectOption('history-first');
   await panel.getByRole('button',{name:'직접 연결·제외 초기화',exact:true}).click();
   assert.equal(await panel.locator('.hi-match-row').count(),3);
   assert(await panel.getByRole('button',{name:'직원 연결 3줄 확인 필요',exact:true}).isDisabled());
   await panel.getByRole('button',{name:'취소',exact:true}).click();
   assert.equal(await panel.locator('.hi-preview').count(),0);
  });
 }finally{if(originalViewport)await owner.setViewportSize(originalViewport)}
}
