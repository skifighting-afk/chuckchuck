// 작업 089: 390px 폭에서 모든 화면을 찍고, 가로 넘침을 검사하고, 이전 실행 사진과 비교한다.
// - 가로로 화면 밖으로 나가는 요소가 있으면 실패(휴대폰에서 옆으로 밀리는 화면).
// - MOBILE_BASELINE 폴더(이전 CI 실행 사진)가 있으면 화면별 바뀐 픽셀 비율을 mobile/report.json에 남긴다(참고용, 실패 아님).
// 사용: E2E_WWW=<빌드 폴더> node scripts/mobile-check.mjs  → ci-logs/mobile/*.png
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {startE2EServer} from './e2e-server.mjs';
const OUT=process.env.MOBILE_OUT||'ci-logs/mobile',BASE=process.env.MOBILE_BASELINE||'';
mkdirSync(OUT,{recursive:true});
const srv=await startE2EServer(),B=srv.ORIGIN;
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});
// 날짜·시각처럼 매일 바뀌는 값 때문에 비교가 흔들리지 않게 시계를 고정
await ctx.addInitScript(()=>{const fixed=Date.parse('2026-10-05T10:00:00+09:00'),D=Date;class F extends D{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}};globalThis.Date=F});
const pages=[['public-home','/'],['public-start','/start'],['public-login','/login'],['public-signup','/signup?role=owner'],['public-calculator','/calculator'],['public-help','/help'],['public-refund','/refund'],['public-terms','/terms'],['public-pricing','/pricing'],['public-status','/status'],['public-privacy','/privacy'],
 ...['home','employees','attendance','schedule','payroll','contracts','retirement','outbox','operations','manual','reports','stores','settings','guide'].map(s=>['demo-'+s,'/demo?screen='+s]),['demo-staff','/demo?role=employee']];
const failures=[],report={};
const page=await ctx.newPage();
for(const [name,path] of pages){
 await page.goto(B+path,{waitUntil:'networkidle'}).catch(()=>{});await page.waitForTimeout(400);
 const over=await page.evaluate(()=>{const w=document.documentElement.clientWidth,bad=[];for(const el of document.querySelectorAll('body *')){const r=el.getBoundingClientRect();if(r.width>0&&r.right>w+1&&getComputedStyle(el).position!=='fixed'){let p=el.parentElement,clipped=false;while(p&&p!==document.body){const o=getComputedStyle(p).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'||o==='clip'){clipped=true;break}p=p.parentElement}if(!clipped)bad.push((el.tagName.toLowerCase())+(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:'')+' '+Math.round(r.right)+'px')}}return {scroll:document.documentElement.scrollWidth>w+1,bad:bad.slice(0,5)}});
 if(over.scroll||over.bad.length)failures.push(`${name}: 가로 넘침 ${over.bad.join(', ')||'(scrollWidth)'}`);
 const file=`${OUT}/${name}.png`;await page.screenshot({path:file,fullPage:true});
 if(BASE&&existsSync(`${BASE}/${name}.png`)){
  const ratio=await page.evaluate(async([a,b])=>{const load=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src});const [x,y]=await Promise.all([load(a),load(b)]);const w=Math.max(x.width,y.width),h=Math.max(x.height,y.height);const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(x,0,0);const d1=g.getImageData(0,0,w,h).data;g.clearRect(0,0,w,h);g.drawImage(y,0,0);const d2=g.getImageData(0,0,w,h).data;let diff=0;for(let i=0;i<d1.length;i+=4)if(Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2])>48)diff++;return diff/(w*h)},['data:image/png;base64,'+readFileSync(`${BASE}/${name}.png`).toString('base64'),'data:image/png;base64,'+readFileSync(file).toString('base64')]);
  report[name]=Math.round(ratio*10000)/100;
 }
 console.log(`${failures.some(f=>f.startsWith(name+':'))?'FAIL':'PASS'} ${name}${report[name]!==undefined?` · 이전과 ${report[name]}% 다름`:''}`);
}
// 가이드 33: 글씨 크게(가 크게) 켠 상태에서도 가로 넘침이 없어야 한다
await page.evaluate(()=>localStorage.setItem('chukchuk-large-text','1'));
for(const [name,path] of pages){
 await page.goto(B+path,{waitUntil:'networkidle'}).catch(()=>{});await page.waitForTimeout(300);
 const over=await page.evaluate(()=>{document.documentElement.classList.add('large-text');const w=document.documentElement.clientWidth,bad=[];for(const el of document.querySelectorAll('body *')){const r=el.getBoundingClientRect();if(r.width>0&&r.right>w+1&&getComputedStyle(el).position!=='fixed'){let p=el.parentElement,clipped=false;while(p&&p!==document.body){const o=getComputedStyle(p).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'||o==='clip'){clipped=true;break}p=p.parentElement}if(!clipped)bad.push((el.tagName.toLowerCase())+(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:'')+' '+Math.round(r.right)+'px')}}return {scroll:document.documentElement.scrollWidth>w+1,bad:bad.slice(0,5)}});
 if(over.scroll||over.bad.length){failures.push(`${name}(큰 글씨): 가로 넘침 ${over.bad.join(', ')||'(scrollWidth)'}`);await page.screenshot({path:`${OUT}/${name}-large.png`,fullPage:true})}
 console.log(`${failures.some(f=>f.startsWith(name+'(큰 글씨)'))?'FAIL':'PASS'} ${name} (큰 글씨)`);
}
writeFileSync(`${OUT}/report.json`,JSON.stringify({at:new Date().toISOString(),changedPercent:report,failures},null,1));
const changed=Object.entries(report).filter(([,v])=>v>2);if(changed.length)console.log('이전 실행과 2% 넘게 달라진 화면:',changed.map(([k,v])=>`${k} ${v}%`).join(', '));
await browser.close();await srv.close();
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`390px 화면 ${pages.length}개(보통·큰 글씨): 가로 넘침 없음`);
