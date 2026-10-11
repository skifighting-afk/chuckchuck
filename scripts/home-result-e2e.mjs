import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import {buildHomeSite} from './build-home.mjs';
export async function homeResultE2E({browser,step}){
 const out=await mkdtemp(path.join(tmpdir(),'chuk-result-browser-'));let server,ctx;
 try{
  await buildHomeSite(out);
  server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(out,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(out+path.sep)){res.writeHead(403).end();return}const body=await readFile(file),ext=path.extname(file),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'}).end(body)}catch{if((req.headers.accept||'').includes('text/html'))res.writeHead(404,{'Content-Type':'text/html'}).end(await readFile(path.join(out,'404.html')));else res.writeHead(404).end()}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await step('홈페이지 기록→시간→급여 · 모바일/큰글씨 · 키보드',async()=>{
   await page.goto(url,{waitUntil:'networkidle'});
   const flow=page.getByRole('region',{name:'월급의 이유가, 기록으로 남아요.'});
   const first=flow.locator('[data-record-step="0"]'),second=flow.locator('[data-record-step="1"]'),third=flow.locator('[data-record-step="2"]'),play=flow.locator('#hero-flow-play');
   await play.waitFor();await play.focus();await page.keyboard.press('Enter');assert.equal(await play.getAttribute('aria-pressed'),'false','focused first click stops auto');
   await first.focus();await page.keyboard.press('Tab');assert(await second.evaluate(el=>document.activeElement===el),'step follows normal Tab order');await page.keyboard.press('Space');assert.equal(await second.getAttribute('aria-pressed'),'true');
   await page.keyboard.press('Tab');await page.keyboard.press('Space');assert.equal(await third.getAttribute('aria-pressed'),'true');assert.match(await flow.locator('#hero-flow-detail').innerText(),/54,400/);assert(await third.evaluate(el=>document.activeElement===el),'selection does not steal focus');
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'homepage overflow '+width)}
   await page.setViewportSize({width:390,height:844});await page.locator('#pref-text').click();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'large text overflow '+width)}
   await page.setViewportSize({width:390,height:844});await page.keyboard.press('Control+Home');
   const start=page.locator('#hero .cta-row .btn').first();assert((await start.boundingBox()).y+(await start.boundingBox()).height<760,'start action visible with large text');
   await page.screenshot({path:'ci-logs/home-result-mobile-large.png',fullPage:false});assert.deepEqual(errors,[],'homepage scripts load without errors');
  });
  await step('요금 비교 · 직원 수별 총액 · 모바일과 큰 글씨',async()=>{
   let normalSizes;
   for(const large of [false,true]){
    await page.goto(url,{waitUntil:'networkidle'});
    if(!large&&await page.locator('html').evaluate(el=>el.classList.contains('large-text')))await page.locator('#pref-text').click();
    if(large&&!await page.locator('html').evaluate(el=>el.classList.contains('large-text')))await page.locator('#pref-text').click();
    const pricing=page.locator('#pricing');
    await page.setViewportSize({width:320,height:900});
    const sizes=await pricing.locator('.price-examples td,.price-conditions,.plan-contract,.pricing-help').evaluateAll(els=>els.map(el=>parseFloat(getComputedStyle(el).fontSize)));
    if(!large)normalSizes=sizes;else assert(sizes.every((n,i)=>n>normalSizes[i]),'large setting actually enlarges amounts, contract fees, conditions and help');
    for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:900});
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'pricing page overflow '+width+' large='+large);
     for(const cell of await pricing.locator('.price-examples th,.price-examples td').all())assert(await cell.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'price value clipped '+width+' large='+large);
     const actions=pricing.locator('.plan-start');assert.equal(await actions.count(),2);
     for(const action of await actions.all()){assert((await action.boundingBox()).height>=48);assert.equal(await action.innerText(),'30일 무료로 시작하기')}
     const plans=await pricing.locator('.plan').all(),widths=await Promise.all(plans.map(p=>p.evaluate(el=>el.getBoundingClientRect().width)));
     assert(Math.abs(widths[0]-widths[1])<1,'plan widths match '+width);
    }
    assert.match(await pricing.locator('.price-examples').innerText(),/8,700/);assert.match(await pricing.locator('.price-examples').innerText(),/11,700/);
   }
   await page.setViewportSize({width:390,height:844});await page.locator('.price-examples').scrollIntoViewIfNeeded();
   await page.screenshot({path:'ci-logs/home-price-comparison-mobile.png'});
  });
  await step('기능 소개 읽기 · 전후 비교 · 서류 뒤 시작 · 모바일 제목',async()=>{
   for(const large of [false,true]){
    await page.goto(url,{waitUntil:'networkidle'});
    if(await page.locator('html').evaluate(el=>el.classList.contains('large-text'))!==large)await page.locator('#pref-text').click();
    const stories=page.locator('.feature-story');assert.equal(await stories.count(),8);
    assert.equal(await page.locator('.feature-secondary-group .feature-story').count(),4);
    for(const story of await stories.all()){
     assert.equal(await story.locator('.feature-difference dt').allTextContents().then(v=>v.join('/')),'이전에는/척척사장에서는');
     assert.equal(await story.locator('figcaption').innerText(),'기능 설명을 위한 예시 화면입니다.');
    }
    const start=page.locator('.feature-start .btn');assert.match(await start.getAttribute('href'),/\/signup\?role=owner&plan=basic$/);assert.equal(await start.innerText(),'30일 무료로 시작하기');
    assert(await page.evaluate(()=>document.querySelector('#feature-documents').compareDocumentPosition(document.querySelector('.feature-start'))&Node.DOCUMENT_POSITION_FOLLOWING));
    assert(await page.evaluate(()=>document.querySelector('.feature-start').compareDocumentPosition(document.querySelector('.feature-secondary-group'))&Node.DOCUMENT_POSITION_FOLLOWING));
    for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'feature stories overflow '+width+' large='+large);
     for(const heading of await stories.locator('h3').all())assert(await heading.evaluate(el=>el.getBoundingClientRect().height<=parseFloat(getComputedStyle(el).lineHeight)*3+2),'feature title longer than3lines '+width+' large='+large);
     assert((await start.boundingBox()).height>=48);
     const xs=await stories.locator('.feature-story-copy').evaluateAll(els=>els.slice(0,4).map(el=>Math.round(el.getBoundingClientRect().left)));assert.equal(new Set(xs).size,1,'core copy shares left axis');
    }
   }
   await page.setViewportSize({width:390,height:844});await page.locator('.feature-start').scrollIntoViewIfNeeded();await page.screenshot({path:'ci-logs/home-feature-clarity-mobile.png'});
  });
  await step('움직임 줄이기에서도 기록 흐름을 직접 확인',async()=>{
   const reduced=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});
   try{const p=await reduced.newPage();await p.goto(url,{waitUntil:'networkidle'});const flow=p.locator('#hero-record-flow'),play=flow.locator('#hero-flow-play');assert(await play.isDisabled());assert.equal(await play.getAttribute('aria-pressed'),'false');await flow.locator('[data-record-step="1"]').click();assert.equal(await flow.locator('[data-record-step="1"]').getAttribute('aria-pressed'),'true')}finally{await reduced.close()}
  });
  await step('없는 홈페이지 주소 · 404 유지 · 모바일 복구 링크',async()=>{
   const p=await ctx.newPage();try{
    const missing=url+'/ux-audit-missing';const response=await p.goto(missing,{waitUntil:'networkidle'});assert.equal(response.status(),404);
    await p.getByRole('heading',{name:'요청하신 페이지를 찾을 수 없어요.'}).waitFor();assert.equal(p.url(),missing,'unknown path does not enter the app');
    for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'404 overflow '+width)}
    await p.setViewportSize({width:390,height:844});await p.screenshot({path:'ci-logs/home-not-found-mobile.png'});
    const home=p.getByRole('link',{name:'홈페이지로 돌아가기',exact:true});await home.focus();await p.keyboard.press('Enter');await p.locator('#hero-title').waitFor();assert.equal(p.url(),url+'/');
   }finally{await p.close()}
  });
 }finally{if(ctx)await ctx.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(out,{recursive:true,force:true})}
}
