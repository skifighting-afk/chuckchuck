import assert from 'node:assert/strict';
import {build} from 'rolldown';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdir,readFile} from 'node:fs/promises';
const folder=new URL('../.superpowers/sdd/2026-10-11-employee-pricing/',import.meta.url);await mkdir(folder,{recursive:true});
await build({input:'app/pricing.tsx',external:id=>id==='react'||id.startsWith('react/'),transform:{jsx:{runtime:'automatic'}},output:{file:new URL('pricing-render.mjs',folder).pathname.replace(/^\/(\w:)/,'$1'),format:'esm'}});
const {PricingPicker}=await import(new URL('pricing-render.mjs',folder));
for(const [employees,basic,pro] of [[0,'0','0'],[1,'2,900','3,900'],[5,'14,500','19,500']]){
 const html=renderToStaticMarkup(createElement(PricingPicker,{plan:'basic',setPlan:()=>{},employees,setEmployees:()=>{},idPrefix:'test'}));
 assert.match(html,new RegExp('월 '+basic+'원'));assert.match(html,new RegExp('월 '+pro+'원'));
 assert.match(html,/예상 재직 직원 수/);assert.match(html,/동일 계정/);assert.doesNotMatch(html,/6개월|12개월|지점 요금|% 할인/);
 console.log(`PASS: public pricing renders ${employees} employees with both actual monthly amounts`);
}
const meta=await readFile(new URL('../dist/client/pricing.html',import.meta.url),'utf8');assert.match(meta,/2,900/);assert.match(meta,/3,900/);assert.doesNotMatch(meta,/9,900|14,900|지점 수로만/);
console.log('PASS: public pricing metadata matches employee prices');
