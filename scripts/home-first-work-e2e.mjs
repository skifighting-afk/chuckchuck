import assert from 'node:assert/strict';
export async function homeFirstWorkE2E({page,srv,step}){
 await step('첫 업무 안내 · 직원→근무표→출퇴근 · 선택 업무와 큰 글씨',async()=>{
  const saved=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first(),data=JSON.parse(saved.data),branch=data.branches[0].id;
  const guides=(await srv.db.q('SELECT * FROM start_guide_preferences WHERE owner=?',saved.owner).all()).results;
  const employee={...structuredClone(data.employees[0]),id:'ux-first-work-employee',name:'처음 시작 직원',email:'first-work@example.invalid',branchId:branch,status:'재직'};
  data.employees=data.employees.map(e=>({...e,status:'퇴사'}));
  const go=()=>page.goto(srv.ORIGIN+'/app?screen=home&branch='+encodeURIComponent(branch),{waitUntil:'networkidle'}),guide=page.getByRole('region',{name:'우리 매장 시작 순서',exact:true});
  try{
   await srv.db.q("UPDATE start_guide_preferences SET preferences='{}',revision=revision+1 WHERE owner=?",saved.owner).run();
   await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();await go();
   await guide.getByRole('button',{name:'첫 직원 등록하기 →',exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name:'새 직원 입사 등록'}).waitFor();await page.keyboard.press('Escape');
   data.employees.push(employee);await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();await go();
   await guide.getByRole('button',{name:'첫 근무표 만들기 →',exact:true}).waitFor();assert.equal(await guide.getByRole('button').count(),1);
   assert.match(await guide.locator('[aria-current="step"]').innerText(),/근무표 만들기/);assert.equal(await guide.locator('[aria-current="step"]').count(),1);
   const optional=page.locator('.home-extra-guide');assert.equal(await optional.evaluate(el=>el.open),false);
   assert(await guide.evaluate(el=>el.compareDocumentPosition(document.querySelector('.home-priorities'))&Node.DOCUMENT_POSITION_FOLLOWING));
   await guide.getByRole('button').focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'근무 스케줄',exact:false}).waitFor();
   const date=new Date(Date.now()+9*3600000).toISOString().slice(0,10);data.shifts.push({id:'ux-first-work-shift',employeeId:employee.id,branchId:branch,date,start:'09:00',end:'15:00',breakMinutes:30});
   await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();await go();
   await guide.getByRole('button',{name:'출퇴근 화면 확인하기 →',exact:true}).waitFor();await guide.getByText(/첫 출근 전에는 기록이 없어도/).waitFor();
   const size=await guide.locator('li').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
   for(const large of [false,true]){
    if(large){await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click();assert(await guide.locator('li').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>size)}
    for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'first work overflow '+width+' large='+large)}
   }
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.locator('.owner-display-settings summary').click();
   await page.setViewportSize({width:390,height:844});await guide.scrollIntoViewIfNeeded();await page.screenshot({path:'ci-logs/home-first-work-mobile.png'});
   await guide.getByRole('button').click();await page.getByRole('heading',{name:'출퇴근 기록',exact:false}).waitFor();assert.equal((await srv.db.q('SELECT id FROM attendance_records WHERE id=?','ux-first-work-clock').all()).results.length,0,'view action never records attendance');
   const start=date+'T00:00:00Z',record={id:'ux-first-work-clock',employeeId:employee.id,start,end:null,breakMinutes:0,breakStart:null};
   await srv.db.q('INSERT INTO attendance_records(owner,id,employee_id,start_at,record) VALUES(?,?,?,?,?)',saved.owner,record.id,employee.id,start,JSON.stringify(record)).run();await go();assert.equal(await guide.count(),0,'real loaded records remove the completed first-work prompt');
   await optional.locator('summary').focus();await page.keyboard.press('Enter');await page.locator('.qb-line').waitFor();await optional.locator('summary').click();assert.equal(await optional.evaluate(el=>el.open),false);
  }finally{
   await srv.db.q('DELETE FROM attendance_records WHERE id=?','ux-first-work-clock').run();await srv.db.q('UPDATE stores SET data=? WHERE owner=?',saved.data,saved.owner).run();
   for(const g of guides)await srv.db.q('UPDATE start_guide_preferences SET preferences=?,revision=? WHERE user_id=? AND owner=? AND branch_id=? AND role=? AND guide_kind=? AND guide_version=?',typeof g.preferences==='string'?g.preferences:JSON.stringify(g.preferences),g.revision,g.user_id,g.owner,g.branch_id,g.role,g.guide_kind,g.guide_version).run();
  }
 });
}
