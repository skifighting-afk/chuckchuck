// 스토어 스크린샷: 체험(예시) 매장 화면을 아이폰 6.9형(1290×2796)·안드로이드 휴대폰(1080×1920) 크기로 찍는다.
// 사용: E2E_WWW=<빌드 폴더> PW_CHROMIUM=<크롬> node scripts/store-screenshots.mjs → mobile/store/screenshots/{ios,android}/
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {startE2EServer} from './e2e-server.mjs';
const srv=await startE2EServer(),B=srv.ORIGIN;
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
const shots=[['01-home','/demo?screen=home','오늘 가게 한눈에'],['02-schedule','/demo?screen=schedule','근무표 짜고 바로 공유'],['03-attendance','/demo?screen=attendance','QR 출퇴근 · 지각·미퇴근 자동 확인'],['04-payroll','/demo?screen=payroll','급여 자동 계산 · 명세서'],['05-staff','/demo?role=employee','직원은 내 근무·급여를 휴대폰으로'],['06-reports','/demo?screen=reports','인건비 리포트']];
const devices={ios:{viewport:{width:430,height:932},deviceScaleFactor:3},android:{viewport:{width:360,height:640},deviceScaleFactor:3}};
for(const [dev,opt] of Object.entries(devices)){
 const dir=`mobile/store/screenshots/${dev}`;mkdirSync(dir,{recursive:true});
 const ctx=await browser.newContext({...opt,isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});
 await ctx.addInitScript(()=>{const fixed=Date.parse('2026-10-08T10:30:00+09:00'),D=Date;class F extends D{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}};globalThis.Date=F;document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.add('native-app'))});
 const page=await ctx.newPage();
 for(const [name,path,caption] of shots){
  await page.goto(B+path,{waitUntil:'networkidle'}).catch(()=>{});await page.waitForTimeout(600);
  await page.evaluate(cap=>{document.querySelector('.ast-fab')?.remove();const bar=document.querySelector('.demo-toolbar');if(bar)bar.style.display='none';
   const h=document.createElement('div');h.textContent=cap;h.setAttribute('style','position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:18px 16px 22px;background:#12634b;color:#fff;font:700 22px/1.3 "Noto Sans CJK KR",sans-serif;text-align:center;box-shadow:0 -6px 18px rgba(0,0,0,.18)');document.body.appendChild(h)},caption).catch(()=>{});
  await page.screenshot({path:`${dir}/${name}.png`});console.log('찍음',dev,name);
 }
 await ctx.close();
}
await browser.close();await srv.close();
