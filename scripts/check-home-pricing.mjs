import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildHomeSite} from './build-home.mjs';
const out=await mkdtemp(path.join(tmpdir(),'chuk-home-pricing-'));
try{
 const {html}=await buildHomeSite(out);
 const table=html.match(/<table class="price-examples">([\s\S]*?)<\/table>/)?.[1];
 assert(table,'employee totals are rendered without waiting for JavaScript');
 for(const [count,basic,pro] of [[1,'2,900','3,900'],[3,'8,700','11,700'],[5,'14,500','19,500'],[10,'29,000','39,000']]){
  const row=table.match(new RegExp(`<tr><th scope="row">직원 ${count}명<\\/th>([\\s\\S]*?)<\\/tr>`))?.[1];
  assert(row,`${count} staff can find their own total`);assert(row.includes(`${basic}<span>원</span>`));assert(row.includes(`${pro}<span>원</span>`));
 }
 assert(html.includes('전자근로계약서 체결 비용은 별도입니다.'));
 assert(html.includes('기존 이용권은 현재 계약 조건을 유지해요.'));
 assert(html.includes('재직 직원 기준'));
 const plans=html.match(/<fieldset class="plans">([\s\S]*?)<\/fieldset>/)?.[1];
 assert.equal((plans.match(/>30일 무료로 시작하기<\/a>/g)||[]).length,2);
 assert(html.includes('aria-label="베이직 30일 무료로 시작하기"'));
 assert(html.includes('aria-label="프로 30일 무료로 시작하기"'));
 assert(!/<summary><span class="tag">/.test(html),'FAQ questions are not preceded by emotional tags');
 console.log('PASS: visible 1/3/5/10 employee totals, VAT/contract/legacy conditions and consistent plan actions.');
}finally{await rm(out,{recursive:true,force:true})}
