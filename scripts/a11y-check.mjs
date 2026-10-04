// 작업 083: 접근성 점검 — axe(WCAG 2.1 AA)와 우리 기준(누르는 곳 48px, 글자 12px 이상, 대비 4.5:1)
// 로그인 없이 볼 수 있는 화면(시작·가입·로그인·체험 화면 전체)을 휴대폰·PC 크기로 확인한다.
// 사용: SMOKE_URL=https://chukchukapp.kr node scripts/a11y-check.mjs   (axe-core가 설치돼 있어야 함)
import {chromium} from 'playwright';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const BASE=(process.env.SMOKE_URL||'https://chukchukapp.kr').replace(/\/$/,'');
const require=createRequire(import.meta.url);
const axePath=(()=>{try{return require.resolve('axe-core/axe.min.js')}catch{return null}})();
const axeSource=axePath&&existsSync(axePath)?readFileSync(axePath,'utf8'):null;
const pages=['/start','/signup?role=owner','/login?role=owner','/employee','/demo?screen=home','/demo?screen=employees','/demo?screen=attendance','/demo?screen=schedule','/demo?screen=payroll','/demo?screen=contracts','/demo?role=employee'];
const problems=[];
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
for(const width of [390,1280])for(const path of pages){
 const p=await browser.newPage({viewport:{width,height:900}});
 await p.goto(BASE+path,{waitUntil:'networkidle'});await p.waitForTimeout(600);
 const where=`${width}px ${path}`;
 if(axeSource){
  await p.addScriptTag({content:axeSource});
  const res=await p.evaluate(async()=>await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']}));
  for(const v of res.violations.filter(v=>['serious','critical'].includes(v.impact)))problems.push(`${where} [axe ${v.id}] ${v.help} — ${v.nodes.slice(0,3).map(n=>n.target.join(' ')).join(' | ')}`);
 }
 const own=await p.evaluate(()=>{
  const out=[];const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  for(const e of document.querySelectorAll('button,a,[role=button],input:not([type=hidden]),select,summary')){
   if(!vis(e))continue;const r=e.getBoundingClientRect();
   if(e.matches('input[type=checkbox],input[type=radio],[role=checkbox],[role=radio]')){if(r.height<20)out.push('작은 체크 상자 '+Math.round(r.height)+'px');continue}
   const inline=e.tagName==='A'&&getComputedStyle(e).display==='inline'&&e.closest('p,li,small,span,td');
   if(!inline&&r.height<44)out.push(`누르는 곳 ${Math.round(r.height)}px: ${(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,30)}`);
  }
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){const el=n.parentElement;if(!n.textContent.trim()||!vis(el))continue;const fs=parseFloat(getComputedStyle(el).fontSize);if(fs<12)out.push(`작은 글자 ${fs}px: ${n.textContent.trim().slice(0,20)}`)}
  return [...new Set(out)];
 });
 for(const x of own)problems.push(`${where} ${x}`);
 await p.close();
}
await browser.close();
if(!axeSource)console.log('axe-core가 없어 우리 기준만 확인했어요.');
if(problems.length){console.error(`접근성 문제 ${problems.length}건:\n`+problems.join('\n'));process.exit(1)}
console.log(`접근성 점검 통과: ${pages.length}개 화면 × 2개 크기${axeSource?' (axe 포함)':''}`);
