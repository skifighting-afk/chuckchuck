import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,access} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {buildHomeSite} from './build-home.mjs';
import {currentSectionIndex} from '../site/section-navigation.ts';
assert.equal(currentSectionIndex([600,1400,3000,4000],100),-1);
assert.equal(currentSectionIndex([90,900,1600,2400],100),0);
assert.equal(currentSectionIndex([-900,-200,500,1200],100),1);
assert.equal(currentSectionIndex([-3000,-2000,-1000,20],100),3);
const html=await readFile(new URL('../site/index.html',import.meta.url),'utf8');
const mobile=html.match(/<nav class="page-sections"[\s\S]*?<\/nav>/)?.[0];
assert(mobile,'small screens keep an accessible short table of contents');
for(const id of ['tour','benefits-title','pricing','start-roadmap'])assert(mobile.includes('href="#'+id+'"'));
const css=await readFile(new URL('../site/home.css',import.meta.url),'utf8');
assert(css.includes('scroll-margin-top:var(--header-clearance'),'anchor clearance follows the measured header');
const out=await mkdtemp(path.join(tmpdir(),'chuk-nav-imports-'));
try{
 await buildHomeSite(out);
 for(const file of await readdir(out,{recursive:true})){
  if(!file.endsWith('.js'))continue;
  const absolute=path.join(out,file),code=await readFile(absolute,'utf8');
  for(const match of code.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)){
   await assert.doesNotReject(()=>access(path.resolve(path.dirname(absolute),match[1])),'emitted import resolves: '+file+' -> '+match[1]);
  }
 }
}finally{await rm(out,{recursive:true,force:true})}
assert(css.includes('.hero-pin,html.anim .hero-pin{padding-top:calc(var(--header-clearance'),'default animation also clears the taller mobile header');
console.log('PASS: section selection, mobile contents and measured anchor clearance.');
