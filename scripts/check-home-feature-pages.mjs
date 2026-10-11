import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildHomeSite,HOME_ORIGIN,APP_ORIGIN} from './build-home.mjs';
const out=await mkdtemp(path.join(tmpdir(),'chuk-feature-seo-'));
try{
 const {html:home}=await buildHomeSite(out),sitemap=await readFile(path.join(out,'sitemap.xml'),'utf8'),titles=new Set(),descriptions=new Set();
 for(const slug of ['schedule','attendance','payroll','documents']){
  const html=await readFile(path.join(out,'features',slug,'index.html'),'utf8'),url=HOME_ORIGIN+'/features/'+slug+'/';
  assert.equal((html.match(/<h1\b/g)||[]).length,1,slug+' has one main heading');
  const title=html.match(/<title>([^<]+)<\/title>/)?.[1],desc=html.match(/name="description" content="([^"]+)"/)?.[1];assert(title&&desc);titles.add(title);descriptions.add(desc);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);assert(html.includes('rel="canonical" href="'+url+'"'));assert(html.includes('property="og:url" content="'+url+'"'));
  assert(!html.includes('noindex'));assert(!html.includes('{{'));assert(sitemap.includes('<loc>'+url+'</loc>'));assert(home.includes('href="/features/'+slug+'/"'));
  assert(html.includes(APP_ORIGIN+'/signup?role=owner&amp;plan='));assert(html.includes(APP_ORIGIN+'/help'));
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));assert.equal(schemas.find(s=>s['@type']==='WebPage')?.url,url);assert.equal(schemas.find(s=>s['@type']==='BreadcrumbList')?.itemListElement.at(-1).item,url);
  const css=html.match(/rel="stylesheet" href="([^"]+)"/)?.[1];assert(css?.startsWith('/home/home-'));await readFile(path.join(out,css));
  for(const other of ['schedule','attendance','payroll','documents'].filter(s=>s!==slug))assert(html.includes('href="/features/'+other+'/"'),slug+' connects other functions');
 }
 assert.equal(titles.size,4);assert.equal(descriptions.size,4);
 const schedule=await readFile(path.join(out,'features/schedule/index.html'),'utf8'),attendance=await readFile(path.join(out,'features/attendance/index.html'),'utf8'),documents=await readFile(path.join(out,'features/documents/index.html'),'utf8');
 assert(schedule.includes('다음 달 자동 편성은 개선 예정'));assert(attendance.includes('위치 인증'));assert(documents.includes('3,000원'));assert(!schedule.includes('50%'));
 console.log('PASS: four crawlable feature pages, unique content/metadata, canonical/internal links/sitemap, shared CSS and honest availability.');
}finally{await rm(out,{recursive:true,force:true})}
