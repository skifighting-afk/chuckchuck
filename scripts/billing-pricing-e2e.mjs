import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {EMPLOYEE_PRICING_VERSION} from '../lib/plans.ts';
export async function billingPricingE2E({owner,srv,step}){
 const row=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first(),original=row.data,viewport=owner.viewportSize();
 const save=async data=>srv.db.q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(data),row.owner).run();
 try{
  await step('직원당 공개 요금 0·1·5명 · 320/390/768/1440 화면',async()=>{
   await owner.goto(srv.ORIGIN+'/pricing',{waitUntil:'networkidle'});
   const pricing=owner.locator('.employee-pricing');
   for(const [n,b,p] of [[0,'0','0'],[1,'2,900','3,900'],[5,'14,500','19,500']]){await pricing.getByLabel('예상 재직 직원 수',{exact:false}).fill(String(n));assert.deepEqual(await pricing.locator('.pricing-plan strong').allTextContents(),[`월 ${b}원`,`월 ${p}원`])}
   for(const width of [320,390,768,1440]){await owner.setViewportSize({width,height:900});assert(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`pricing overflow ${width}`)}
   await owner.setViewportSize({width:390,height:844});await owner.addStyleTag({content:'html{font-size:20px}'});assert(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'large font pricing overflow');
  });
  await step('서버 과금 인원 · 기존 유료 전환 동의 · 견적 연결 실패 재시도',async()=>{
   const d=JSON.parse(original);d._account={...d._account,pricingVersion:undefined,status:'active',plan:'basic',months:6,periodPrice:59400,periodStart:new Date(Date.now()-10*86400000).toISOString(),paidUntil:new Date(Date.now()+20*86400000).toISOString()};
   d.employees=d.employees.slice(0,1);d.employees[0].status='재직';await save(d);
   await owner.goto(srv.ORIGIN+'/account',{waitUntil:'networkidle'});
   const checkout=owner.locator('.employee-checkout');await checkout.getByText('과금 직원 1명',{exact:true}).waitFor();
   await checkout.getByLabel('직원당 요금 전환 동의').waitFor();assert(await checkout.getByRole('button',{name:/원 결제하기/}).isDisabled());
   assert.match(await owner.locator('.billing-current').innerText(),/59,400원/);
   await owner.route('**/billing',async route=>{const data=route.request().postDataJSON();if(data?.action==='quote')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'합성 견적 연결 실패'})});return route.continue()});
   await checkout.getByRole('button',{name:'직원 수 다시 확인',exact:true}).click();await checkout.getByRole('alert').getByText('합성 견적 연결 실패',{exact:false}).waitFor();assert(await checkout.getByRole('button',{name:/결제하기|이용 시작/}).isDisabled());
   await owner.unroute('**/billing');await checkout.getByRole('button',{name:'직원 수 다시 확인',exact:true}).click();await checkout.getByText('과금 직원 1명',{exact:true}).waitFor();
   d.employees.push({...structuredClone(d.employees[0]),id:'pricing-browser-added',name:'새 재직 직원'});await save(d);
   await checkout.getByRole('button',{name:'직원 수 다시 확인',exact:true}).click();await checkout.getByText('과금 직원 2명',{exact:true}).waitFor();
   assert.match(await owner.locator('.billing-current').innerText(),/59,400원/,'adding an employee must preserve the original paid amount');
  });
  await step('0원 이용 시작 · 공급자 창 없음 · 새로고침 후 기록 유지',async()=>{
   const d=JSON.parse(original);d.employees=[];d._account={...d._account,pricingVersion:EMPLOYEE_PRICING_VERSION,status:'trialing',months:1,periodStart:undefined,paidUntil:undefined,periodPrice:undefined,pendingSubscription:undefined,pendingSubscriptions:undefined};await save(d);
   await owner.goto(srv.ORIGIN+'/account',{waitUntil:'networkidle'});const checkout=owner.locator('.employee-checkout');await checkout.getByText('과금 직원 0명',{exact:true}).waitFor();
   for(const width of [320,390,768,1440]){await owner.setViewportSize({width,height:900});assert(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`account billing overflow ${width}`)}
   await owner.setViewportSize({width:390,height:844});const consent=checkout.getByLabel('이용약관과 해지·환불 규정 동의');await consent.focus();await owner.keyboard.press('Space');assert(await consent.isChecked());await owner.keyboard.press('Tab');assert(await checkout.getByRole('button',{name:'0원으로 이용 시작',exact:true}).evaluate(el=>el===document.activeElement));await owner.keyboard.press('Enter');
   await owner.getByText('청구 없이 이용을 시작했어요.',{exact:false}).waitFor();await owner.reload({waitUntil:'networkidle'});
   await owner.getByText('청구 없음',{exact:true}).waitFor();assert.equal(await owner.locator('script[src*="js.tosspayments.com"]').count(),0);
   await mkdir('ci-logs',{recursive:true});await owner.screenshot({path:'ci-logs/employee-pricing-mobile.png',fullPage:true});
  });
 }finally{await owner.unroute('**/billing').catch(()=>{});await srv.db.q("DELETE FROM payments WHERE owner=? AND provider='internal'",row.owner).run();await save(JSON.parse(original));if(viewport)await owner.setViewportSize(viewport)}
}
