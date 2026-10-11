import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildHomeSite} from './build-home.mjs';
import {canWrite,trialStatus} from '../lib/plans.ts';
const out=await mkdtemp(path.join(tmpdir(),'chuk-home-start-'));
try{
 const {html}=await buildHomeSite(out);
 const css=await readFile(new URL('../site/home.css',import.meta.url),'utf8');
 assert.match(css,/\.start-roadmap\{padding:88px var\(--gut\)/,'roadmap uses the shared horizontal gutter');
 assert(css.includes('html.large-text .trial-ending')&&css.includes('html.large-text .start-roadmap h2'),'actual text-size preference scales new content');
 const start=html.match(/<section class="start-roadmap"[\s\S]*?<\/section>/)?.[0];
 assert(start,'before signing up, owners see their actual three starting steps');
 assert.equal((start.match(/<li>/g)||[]).length,3);
 for(const text of ['우리 매장 만들기','직원 연결하기','첫 근무표 공개하기'])assert(start.includes(text));
 assert(start.includes('/employee'),'employees have their own start path');
 assert(html.indexOf('id="start-roadmap"')<html.indexOf('id="finale"'));
 const ending=html.match(/<ol class="trial-ending">([\s\S]*?)<\/ol>/)?.[1];
 assert(ending);assert.equal((ending.match(/<li>/g)||[]).length,3);
 assert(ending.includes('조회하고 내려받을'));assert(ending.includes('자동 결제는 없어요'));assert(ending.includes('직접 요금제를 선택'));
 const expired={status:'trialing',plan:'pro',trialEndsAt:'2020-01-01T00:00:00Z'};
 assert.equal(trialStatus(expired),'expired');assert.equal(canWrite(expired),false,'post-trial edits require an active plan');
 assert(html.includes('사장님은 근무표부터 급여·근로계약서까지 관리하고, 직원은 자기 근무와 월급을 확인해요.'));
 console.log('PASS: clear audience, actual owner steps, employee entry and honest post-trial record/edit distinction.');
}finally{await rm(out,{recursive:true,force:true})}
