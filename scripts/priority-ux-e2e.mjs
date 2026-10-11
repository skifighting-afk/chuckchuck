import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {dayRows} from '../lib/attendance-check.ts';
import {attendanceEvidence} from '../lib/attendance-display.ts';
export async function priorityUxE2E({owner,staff,srv,step,browser}){
 const ctx=await browser.newContext({storageState:await owner.context().storageState(),serviceWorkers:'block',viewport:{width:1440,height:900}}),page=await ctx.newPage();
 try{
  await step('업무 가시성 · 비서 기본 닫힘 · 키보드 열기와 복귀',async()=>{
   await page.goto(srv.ORIGIN+'/app?screen=payroll',{waitUntil:'networkidle'});
   const trigger=page.locator('#owner-assistant-launcher .ast-fab'),dialog=page.getByRole('dialog',{name:'척척 비서'});
   await trigger.waitFor();assert.equal(await dialog.isVisible(),false);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).paddingRight),'0px');
   await trigger.click();await dialog.waitFor();assert.equal(await page.locator('#ast-q').evaluate(el=>document.activeElement===el),true);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'payroll overflow '+width);
   }
   await page.setViewportSize({width:390,height:844});
   await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>Array.from(document.fonts).some(f=>f.family.includes('ChukAppSans')&&f.status==='loaded')),'Korean font loaded');
   assert.equal((await page.request.get(srv.ORIGIN+'/fonts/pretendard.woff2')).status(),200);
   const overview=page.getByRole('region',{name:'직원별 급여',exact:true}),exports=page.locator('.payroll-exports');
   const firstNet=overview.locator('tbody tr').first().locator('td[data-label="실수령액"]');
   const netBox=await firstNet.evaluate(el=>({bottom:el.getBoundingClientRect().bottom,viewport:innerHeight}));assert(netBox.bottom<netBox.viewport-80,'first employee net amount visible on mobile: '+JSON.stringify(netBox));
   assert(await exports.evaluate(el=>!el.open),'export tools start collapsed');
   assert(await page.evaluate(()=>document.querySelector('.payroll-overview').compareDocumentPosition(document.querySelector('.payroll-exports'))&Node.DOCUMENT_POSITION_FOLLOWING),'employee amounts before export tools');
   const employeeRows=overview.locator('tbody tr');assert(await employeeRows.count()>0);
   for(const row of await employeeRows.all()){
    const time=await row.locator('td[data-label="실근무"]').innerText();assert.match(time,/^(?:−)?(?:\d+시간(?: \d+분)?|\d+분)$/,'duration uses minutes, not decimal hours');
    assert.match(await row.locator('.payroll-type').innerText(),/^(?:시급 · 출퇴근 기록 기준|월급 · 등록 조건 기준|일급 · 근무일 기준|급여 유형 확인 필요)$/);
    assert.match(await row.locator('td[data-label="상태"]').innerText(),/예상 · (?:검토 전|확인 필요)|확정 · 지급 기록 전|지급 기록 · /);
   }
   const titleSize=await page.locator('.page-heading h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert(titleSize>=24&&titleSize<=32,'shared readable app title');
   await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click();
   const largeTitle=await page.locator('.page-heading h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert(largeTitle>titleSize,'owner large text also enlarges heading');
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'readable payroll large text overflow '+width)}
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.locator('.owner-display-settings summary').click();await page.setViewportSize({width:390,height:844});
   assert((await overview.locator('table').evaluate(el=>getComputedStyle(el).fontVariantNumeric)).includes('tabular-nums'));
   await overview.getByRole('button',{name:'계산 근거',exact:true}).first().click();const basis=page.getByRole('dialog');await basis.locator('.pay-basis').waitFor();
   const basisTime=await basis.locator('.pay-basis>h3').last().innerText();assert.doesNotMatch(basisTime,/\d+\.\d+시간/);await page.keyboard.press('Escape');
   await exports.getByText('급여 자료 내려받기',{exact:true}).click();await exports.getByRole('button',{name:'세무사 자료',exact:true}).waitFor();
   const [download]=await Promise.all([page.waitForEvent('download'),exports.getByRole('button',{name:'세무사 자료',exact:true}).click()]);
   const csv=await readFile(await download.path(),'utf8');assert(csv.startsWith('\uFEFF"성명","직원번호"'),'accountant CSV still downloads');assert(!csv.includes('</table>'),'CSV contains data, not source markup');
   await exports.getByText('급여 자료 내려받기',{exact:true}).click();await mkdir('ci-logs',{recursive:true});await page.screenshot({path:'ci-logs/priority-payroll-mobile.png',fullPage:true});
  });
  await step('사장님·직원 같은 출퇴근 근거 · 허용 기준 · 작은 화면',async()=>{
   const saved=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first(),data=JSON.parse(saved.data),employeeId=data._members[0].employeeId;
   const fixtureDate=new Date(Date.now()+9*3600000-86400000).toISOString().slice(0,10),fixtureId='evidence-shared-record';
   data.shifts=data.shifts.filter(s=>s.employeeId!==employeeId||s.date!==fixtureDate);
   data.shifts.push({id:'evidence-shared-shift',employeeId,branchId:data.employees.find(e=>e.id===employeeId).branchId,date:fixtureDate,start:'17:00',end:'22:00',breakMinutes:30});
   const fixture={id:fixtureId,employeeId,start:fixtureDate+'T08:06:00Z',end:fixtureDate+'T12:58:00Z',breakMinutes:30,breakStart:null};
   await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();
   await srv.db.q('INSERT INTO attendance_records(owner,id,employee_id,start_at,record) VALUES(?,?,?,?,?)',saved.owner,fixtureId,employeeId,fixture.start,JSON.stringify(fixture)).run();
   try{
   // Use the app's authenticated fetch adapter, which routes /api to the Edge Function.
   const {state}=await staff.evaluate(async()=>{const response=await fetch('/api/store');if(!response.ok)throw Error('Staff store request failed: '+response.status);return response.json()});
   const record=state.attendance.find(a=>a.id===fixtureId);assert(record,'matched staff attendance fixture exists');
   const date=new Date(Date.parse(record.start)+9*3600000).toISOString().slice(0,10),tol=state.settings.attendanceTolerance||'normal',minutes={strict:0,normal:5,lenient:10}[tol];
   const row=dayRows(date,state.shifts,state.attendance,tol,Date.now(),state.approvedLeaves||[]).find(r=>r.records.some(a=>a.id===record.id));assert(row?.shift,'comparison fixture is matched to a shift');
   const expected=attendanceEvidence(row,minutes);
   await page.goto(srv.ORIGIN+'/app?screen=attendance',{waitUntil:'networkidle'});await page.getByLabel('근태 날짜',{exact:true}).fill(date);
   const ownerRecord=page.locator('.att-table tbody tr').filter({has:page.getByText(state.employees.find(e=>e.id===employeeId).name,{exact:true})});
   await ownerRecord.locator('.attendance-evidence p').filter({hasText:expected}).waitFor();
   const size=await page.locator('.att-table .attendance-evidence p').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert(size>=14);
   await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click();
   assert(await page.locator('.att-table .attendance-evidence p').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>size);
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'attendance evidence overflow '+width)}
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();
   const employeeCtx=await browser.newContext({storageState:await staff.context().storageState(),viewport:{width:390,height:844},serviceWorkers:'block'}),employee=await employeeCtx.newPage();
   try{
    await employee.goto(srv.ORIGIN+'/app?screen=attendance',{waitUntil:'networkidle'});
    const more=employee.getByRole('button',{name:/지난 기록 더 보기/});if(await more.count())await more.click();
    await employee.locator('.attendance-evidence p').filter({hasText:expected}).first().waitFor();
    for(const width of [320,390,768]){await employee.setViewportSize({width,height:844});assert(await employee.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'personal attendance evidence overflow '+width)}
    await employee.setViewportSize({width:390,height:844});await mkdir('ci-logs',{recursive:true});await employee.screenshot({path:'ci-logs/staff-attendance-evidence.png',fullPage:true});
    const receipt=employee.getByRole('region',{name:'최근 저장된 출퇴근 기록',exact:true}),savedClock=await receipt.locator('time').first().getAttribute('datetime');
    data.branches.push({...data.branches[0],id:'ux-transfer-branch',name:'이동 후 매장'});data.employees.find(e=>e.id===employeeId).branchId='ux-transfer-branch';
    await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();await employee.reload({waitUntil:'networkidle'});
    await receipt.getByText(/현재 소속 매장: 이동 후 매장/).waitFor();assert.match(await receipt.innerText(),/기록 당시 매장을 뜻하지 않아요/);
    assert.equal(await receipt.locator('time').first().getAttribute('datetime'),savedClock,'moving store does not relabel the saved clock time');
   }finally{await employeeCtx.close()}
   }finally{await srv.db.q('UPDATE stores SET data=? WHERE owner=?',saved.data,saved.owner).run();await srv.db.q('DELETE FROM attendance_records WHERE id=?',fixtureId).run()}
  });
  await step('근무표 도구 정리 · 시간 범위 · 고정 직원명 · 변경 전후 · 월간 요약',async()=>{
   await page.goto(srv.ORIGIN+'/demo?role=owner&screen=schedule',{waitUntil:'networkidle'});
   const tools=page.locator('.schedule-tools');assert.equal(await tools.evaluate(el=>el.open),false);
   await page.getByLabel('근무표 날짜',{exact:true}).waitFor();
   await tools.locator('summary').focus();await page.keyboard.press('Space');assert(await tools.evaluate(el=>el.open));await tools.getByRole('button',{name:'템플릿',exact:true}).waitFor();
   await tools.locator('summary').click();
   const wrap=page.getByRole('region',{name:'일간 근무 시간표',exact:true}),person=wrap.locator('.daily-person').first();
   const initial=await person.evaluate(el=>el.getBoundingClientRect().left);await wrap.evaluate(el=>el.scrollLeft=el.scrollWidth);
   assert(Math.abs(await person.evaluate(el=>el.getBoundingClientRect().left)-initial)<2,'employee remains fixed when timetable scrolls');await wrap.evaluate(el=>el.scrollLeft=0);
   assert(await page.locator('.daily-hours>span:not(.daily-end)').count()<24,'working range trims empty night hours');
   await page.getByRole('button',{name:'24시간 전체 보기',exact:true}).click();assert.equal(await page.locator('.daily-hours>span:not(.daily-end)').count(),24);
   await page.getByRole('button',{name:'근무 시간 중심으로',exact:true}).click();
   await wrap.locator('.daily-bar').first().click();const dialog=page.getByRole('dialog',{name:'근무 일정',exact:true});
   const oldStart=await dialog.getByLabel('출근',{exact:true}).inputValue(),oldEnd=await dialog.getByLabel('퇴근',{exact:true}).inputValue();
   const mins=Number(oldStart.slice(0,2))*60+Number(oldStart.slice(3))+15,newStart=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
   await dialog.getByLabel('출근',{exact:true}).fill(newStart);await dialog.getByLabel('퇴근',{exact:true}).fill(oldEnd==='23:00'?'22:45':'23:00');
   await dialog.getByLabel('휴게 (분)',{exact:true}).fill('30');await dialog.getByLabel('근무일',{exact:true}).fill('2099-10-13');
   const select=dialog.getByRole('combobox',{name:'직원',exact:true}),options=await select.evaluate(el=>Array.from(el.options).map(o=>({value:o.value,selected:o.selected}))),other=options.find(o=>!o.selected);assert(other,'demo has another employee option: '+JSON.stringify(options));await select.selectOption(other.value);
   const preview=dialog.getByRole('region',{name:'저장 전 근무 변경 확인',exact:true});await preview.waitFor();assert.match(await preview.innerText(),new RegExp(oldStart));assert.match(await preview.innerText(),new RegExp(newStart));
   for(const key of ['직원','근무일','출근','퇴근','휴게'])await preview.locator('dt').filter({hasText:key}).waitFor();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'schedule preview overflow '+width)}
   await dialog.getByRole('button',{name:'닫기',exact:true}).click();
   await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'월간 · 한 달 미리 보기',exact:true}).click();
   await page.locator('.month-count').first().waitFor();assert.match(await page.locator('.month-count').first().innerText(),/\d+명 · \d+근무/);
   await page.locator('.month-cell').filter({has:page.locator('.month-count')}).first().getByRole('button').first().click();await page.locator('.month-daylist').waitFor();
   await page.screenshot({path:'ci-logs/schedule-month-summary-mobile.png',fullPage:true});
   await page.getByRole('button',{name:'일간 · 시간별로 보기',exact:true}).click();
   await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'schedule large overflow '+width)}
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.locator('.owner-display-settings summary').click();
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:'ci-logs/schedule-tools-mobile.png',fullPage:true});
  });
  await step('반복 저장의 실제 변경 범위 · 휴가만 있는 날짜의 직원 이름',async()=>{
   const saved=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first(),data=JSON.parse(saved.data),emp=data.employees[0],one={id:'preview-series-one',series:'preview-series',employeeId:emp.id,date:'2099-10-13',start:'09:00',end:'15:00',breakMinutes:30};
   data.shifts.push(one,{...one,id:'preview-series-two',date:'2099-10-20',start:'10:00',end:'16:00'});data._operations={...data._operations,leaves:[...(data._operations?.leaves||[]),{id:'preview-approved-leave',employeeId:emp.id,start:'2099-10-14',end:'2099-10-14',status:'승인'}]};
   await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(data),saved.owner).run();
   try{
    await page.goto(srv.ORIGIN+'/app?screen=schedule',{waitUntil:'networkidle'});await page.getByLabel('근무표 날짜',{exact:true}).fill('2099-10-13');
    await page.getByRole('region',{name:'일간 근무 시간표',exact:true}).locator('.daily-bar').first().click();
    const dialog=page.getByRole('dialog',{name:'근무 일정',exact:true});await dialog.getByLabel('이 날 이후 같은 반복 근무도 모두 바꾸기',{exact:true}).check();
    const preview=dialog.getByRole('region',{name:'저장 전 근무 변경 확인',exact:true});await preview.getByText(/반복 근무 1개의 값/).waitFor();await preview.getByRole('heading',{name:emp.name+' · 2099-10-20',exact:true}).waitFor();
    assert.match(await preview.innerText(),/10:00/);assert.match(await preview.innerText(),/09:00/);
    await dialog.getByLabel('근무일',{exact:true}).fill('2099-10-15');assert.equal(await preview.locator('dt').filter({hasText:'근무일'}).count(),0,'series ignores date edit just as save does');
    await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.getByLabel('근무표 날짜',{exact:true}).fill('2099-10-14');await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'월간 · 한 달 미리 보기',exact:true}).click();await page.getByRole('button',{name:/10월 14일.*휴가 있음/}).click();
    await page.locator('.month-day-leaves').getByText(emp.name,{exact:true}).waitFor();await page.screenshot({path:'ci-logs/schedule-leave-only-mobile.png',fullPage:true});
   }finally{await srv.db.q('UPDATE stores SET data=? WHERE owner=?',saved.data,saved.owner).run()}
  });
  await step('HR 리포트 · 정확한 값과 근거 · 기록 없음 · 모바일 큰 글씨',async()=>{
   await page.goto(srv.ORIGIN+'/demo?role=owner&screen=reports',{waitUntil:'networkidle'});
   const plot=page.getByRole('region',{name:'최근 6개월, 급여가 어떻게 달라졌나요?',exact:true}),table=page.getByRole('region',{name:'월별 급여 정확한 값',exact:true});
   await plot.waitFor();assert.equal(await table.locator('tbody tr').count(),6);
   for(const row of await table.locator('tbody tr').all()){
    const cells=await row.locator('td').allTextContents(),status=cells[3];assert.match(status,/^(예상 급여|확정 급여|기록 없음)$/);
    if(status!=='기록 없음'){assert.match(cells[0],/^[\d,]+원$/);assert.match(cells[1],/^(?:\d+시간(?: \d+분)?|\d+분)$/);assert.match(cells[2],/^\d+명$/)}else assert.equal(cells[0],'—');
   }
   const exact=await table.locator('tbody tr td:first-of-type').allTextContents(),visual=await plot.locator('.report-bar .v').allTextContents();assert.deepEqual(visual,exact.map(v=>v==='—'?'기록 없음':v));
   assert.equal(await page.getByText(/매출 대비|POS·카드|시간당 매출/).count(),0);
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'report overflow '+width)}
   await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'report large overflow '+width)}
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.locator('.owner-display-settings summary').click();
   await page.getByLabel('리포트 월',{exact:true}).fill('1999-01');await table.getByText('기록 없음',{exact:true}).first().waitFor();assert.equal(await table.locator('tbody tr').filter({hasText:'기록 없음'}).count(),6);
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:'ci-logs/hr-report-readable-mobile.png',fullPage:true});
   await page.goto(srv.ORIGIN+'/demo?role=owner&screen=settings',{waitUntil:'networkidle'});assert.equal(await page.getByText('매출 대비 인건비 목표(%)',{exact:true}).count(),0);
  });
  await (await import('./home-first-work-e2e.mjs')).homeFirstWorkE2E({page,srv,step});
  await step('홈 핵심 업무 먼저 · 모바일 직원 검색 열기와 복귀',async()=>{
   await page.setViewportSize({width:390,height:844});await page.goto(srv.ORIGIN+'/demo?role=owner&screen=home',{waitUntil:'networkidle'});
   const core=page.getByRole('region',{name:'먼저 확인할 세 가지',exact:true});await core.waitFor();assert.equal(await core.getByRole('button').count(),3);
   assert(await core.evaluate(el=>el.getBoundingClientRect().bottom<innerHeight),'three priorities before fold');
   assert(await page.evaluate(()=>document.querySelector('.home-priorities').compareDocumentPosition(document.querySelector('.home-overview .db, .home-overview .db-mini'))&Node.DOCUMENT_POSITION_FOLLOWING),'core before optional boards');
   await core.getByRole('button',{name:/오늘 근무/}).click();await page.getByRole('region',{name:'일간 근무 시간표',exact:true}).waitFor();
   await page.goto(srv.ORIGIN+'/demo?role=owner&screen=home',{waitUntil:'networkidle'});await core.getByRole('button',{name:/처리할 요청/}).click();await page.locator('.page-heading h1').filter({hasText:'휴가·공지'}).waitFor();
   await page.goto(srv.ORIGIN+'/demo?role=owner&screen=home',{waitUntil:'networkidle'});await core.getByRole('button',{name:/월 예상 급여|월 확정 급여/}).click();await page.locator('.payroll-overview').waitFor();
   const search=page.getByRole('searchbox',{name:'직원 이름으로 찾기',exact:true}),trigger=page.getByRole('button',{name:'직원 찾기',exact:true});assert.equal(await search.isVisible(),false,'mobile search starts collapsed');await trigger.click();await page.waitForFunction(()=>document.activeElement?.id==='global-employee-search');assert.equal(await search.evaluate(el=>document.activeElement===el),true,'opening focuses employee search after its animation frame');
   await search.fill('예시');await page.getByRole('listbox',{name:'찾은 직원',exact:true}).waitFor();await search.press('Escape');assert.equal(await search.isVisible(),false,'Escape collapses search');await page.waitForFunction(()=>document.activeElement?.classList.contains('gsearch-trigger'));assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,'Escape returns focus after its animation frame');
   await trigger.click();await search.fill('예시');await page.getByRole('listbox',{name:'찾은 직원',exact:true}).getByRole('button',{name:'근무표',exact:true}).first().click();await page.locator('.page-heading h1').filter({hasText:'근무 스케줄'}).waitFor();assert.equal(await search.isVisible(),false);
   await page.setViewportSize({width:1440,height:900});await search.waitFor({state:'visible'});assert.equal(await search.isVisible(),true,'desktop search stays visible');await page.goto(srv.ORIGIN+'/demo?role=owner&screen=home',{waitUntil:'networkidle'});
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home focus overflow '+width)}
   await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home focus large overflow '+width)}
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.locator('.owner-display-settings summary').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'ci-logs/home-priorities-mobile.png',fullPage:true});
  });
  await step('직원별 서류 · 검색 · 월 선택 · 연결 실패와 복구',async()=>{
   await page.goto(srv.ORIGIN+'/app?screen=contracts',{waitUntil:'networkidle'});
   const board=page.getByRole('region',{name:'직원별 근로계약서·급여명세서'});
   await board.locator('article').first().waitFor();await board.locator('[aria-busy="false"]').count();
   await page.waitForFunction(()=>document.querySelector('.document-overview')?.getAttribute('aria-busy')==='false');
   const total=await board.locator('article').count(),name=await board.locator('article h3').first().innerText();await board.getByRole('searchbox').fill(' '+name+' ');
   assert.equal(await board.locator('article').count(),1);
   await board.getByRole('button',{name:'근로조건 수정',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
   await board.getByLabel('찾을 문서',{exact:true}).selectOption('contract');
   const contractState=await board.locator('article .document-state b').first().innerText();await board.getByLabel('문서 상태',{exact:true}).selectOption(contractState);assert.equal(await board.locator('article').count(),1);
   await board.getByLabel('찾을 문서',{exact:true}).selectOption('payslip');assert.equal(await board.getByLabel('문서 상태',{exact:true}).inputValue(),'all','kind change resets incompatible state');
   await board.getByRole('searchbox').fill('필터검사없는직원');assert.equal(await board.locator('article').count(),0);await board.getByText(/선택한 조건에 해당하는 직원이 없어요/).waitFor();
   await board.getByRole('button',{name:'검색 조건 초기화',exact:true}).click();assert.equal(await board.locator('article').count(),total);assert.equal(await board.getByLabel('찾을 문서',{exact:true}).inputValue(),'all');
   await board.getByLabel('급여명세서 월',{exact:true}).fill('2026-01');await board.getByText(/2026-01 급여명세서와/).waitFor();
   for(const large of [false,true]){
    if(large){await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click()}
    for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document board overflow '+width+' large='+large)}
   }
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.locator('.owner-display-settings summary').click();
   await page.route('**/api/contracts?summary=1',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable status'})}));
   await board.getByRole('button',{name:'상태 새로 확인',exact:true}).click();await board.getByRole('alert').waitFor();await board.locator('.document-overview-rows').getByText('상태 확인 필요',{exact:true}).first().waitFor();
   await page.unroute('**/api/contracts?summary=1');await board.getByRole('button',{name:'상태 새로 확인',exact:true}).click();await board.getByRole('alert').waitFor({state:'hidden'});
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:'ci-logs/priority-documents-mobile.png',fullPage:true});
  });
  await step('새 화면 연결 실패 · 복구 안내 · 재시도 성공',async()=>{
   const failed=await ctx.newPage();
   try{
    await failed.route('**/chunks/team-*.js',route=>route.fulfill({status:503,contentType:'text/javascript',body:'/* synthetic unavailable chunk */'}));
    await failed.goto(srv.ORIGIN+'/app',{waitUntil:'networkidle'});
    await failed.getByRole('alert').getByRole('heading',{name:'화면을 다시 불러와 주세요.'}).waitFor();
    await failed.getByRole('link',{name:'서비스 상태 확인'}).waitFor();
    await failed.unroute('**/chunks/team-*.js');await failed.getByRole('button',{name:'화면 다시 불러오기',exact:true}).click();
    await failed.locator('#owner-assistant-launcher .ast-fab').waitFor();
   }finally{await failed.close()}
  });
 }finally{await ctx.close()}
 await (await import('./home-result-e2e.mjs')).homeResultE2E({browser,step});
}
