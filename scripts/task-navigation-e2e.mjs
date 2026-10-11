import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
export async function taskNavigationE2E({page,srv,step}){
 await step('업무별 메뉴 · 최근 사용 · 직원 계약서 직접 열기 · 모바일 큰 글씨',async()=>{
  const row=await srv.db.q('SELECT data FROM stores LIMIT 1').first(),data=JSON.parse(row.data),employee=data.employees.find(e=>e.status!=='퇴사');
  await page.goto(srv.ORIGIN+'/app?screen=home',{waitUntil:'networkidle'});
  const menu=page.getByRole('navigation',{name:'업무별 메뉴',exact:true});
  const open=async()=>{if(!await menu.isVisible()){const more=page.locator('.app-tabs').getByRole('button',{name:'더보기',exact:true});if(await more.isVisible())await more.click();else await page.getByRole('button',{name:'메뉴 열고 닫기',exact:true}).click()}await menu.waitFor()};
  await open();for(const label of ['인사·근무','소통·매뉴얼','계약·서류','매장·설정'])await menu.getByRole('region',{name:label,exact:true}).waitFor();
  await menu.getByRole('button',{name:'근무 스케줄',exact:true}).focus();await page.keyboard.press('Enter');await page.locator('.page-heading h1').filter({hasText:'근무 스케줄'}).waitFor();
  await open();await menu.getByRole('button',{name:'최근 사용 · 근무 스케줄',exact:true}).waitFor();await menu.getByRole('button',{name:'근로계약서',exact:true}).click();await page.locator('.page-heading h1').filter({hasText:'근로계약서'}).waitFor();
  await open();assert((await menu.getByRole('region',{name:'최근 사용',exact:true}).getByRole('button').count())<=3);
  await menu.getByRole('button',{name:'홈',exact:true}).click();
  await page.getByRole('searchbox',{name:'직원 이름으로 찾기',exact:true}).fill(employee.name);
  const hit=page.locator('.gs-item').filter({has:page.getByText(employee.name,{exact:true})}).first();
  await hit.getByRole('button',{name:'근로계약서',exact:true}).click();const contract=page.getByRole('dialog');await contract.waitFor();assert((await contract.locator('.t-document').innerText()).includes(employee.name));await page.keyboard.press('Escape');
  for(const large of [false,true]){
   if(large){await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click()}
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await open();assert(await menu.getByRole('button',{name:'설정',exact:true}).count()===1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'task menu overflow '+width+' large='+large);if(width<768)await page.keyboard.press('Escape')}
  }
  await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.locator('.owner-display-settings summary').click();await page.setViewportSize({width:390,height:844});
  await page.locator('.app-tabs').getByRole('button',{name:'근무표',exact:true}).click();await page.locator('.page-heading h1').filter({hasText:'근무 스케줄'}).waitFor();assert.equal(await menu.isVisible(),false);
  await page.locator('.app-tabs').getByRole('button',{name:'출퇴근',exact:true}).click();await page.locator('.page-heading h1').filter({hasText:'출퇴근 기록'}).waitFor();
  await page.locator('.app-tabs').getByRole('button',{name:'홈',exact:true}).click();await open();await menu.getByRole('button',{name:'최근 사용 · 출퇴근 기록',exact:true}).waitFor();await menu.getByRole('button',{name:'최근 사용 · 근무 스케줄',exact:true}).waitFor();
  await mkdir('ci-logs',{recursive:true});await page.screenshot({path:'ci-logs/task-navigation-mobile.png'});await page.keyboard.press('Escape');
 });
}
