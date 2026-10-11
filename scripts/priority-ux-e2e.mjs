import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
export async function priorityUxE2E({owner,srv,step,browser}){
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
  await step('직원별 서류 · 검색 · 월 선택 · 연결 실패와 복구',async()=>{
   await page.goto(srv.ORIGIN+'/app?screen=contracts',{waitUntil:'networkidle'});
   const board=page.getByRole('region',{name:'직원별 서류 현황'});
   await board.locator('article').first().waitFor();await board.locator('[aria-busy="false"]').count();
   await page.waitForFunction(()=>document.querySelector('.document-overview')?.getAttribute('aria-busy')==='false');
   const name=await board.locator('article h3').first().innerText();await board.getByRole('searchbox').fill(name);
   assert.equal(await board.locator('article').count(),1);
   await board.getByRole('button',{name:'근로조건 수정',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
   await board.getByLabel('명세서 월').fill('2026-01');await board.getByText(/2026-01 명세서와/).waitFor();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document board overflow '+width)}
   await page.route('**/api/contracts?summary=1',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable status'})}));
   await board.getByRole('button',{name:'상태 새로 확인',exact:true}).click();await board.getByRole('alert').waitFor();await board.getByText('상태 확인 필요',{exact:true}).first().waitFor();
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
