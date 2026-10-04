// 작업 078: 모든 서버 경로 요청 제한
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest(),{headersFor,env}=T;
const req=async(user,method,extra={})=>(await api(new Request('https://qa.local/api/operations',{method,headers:{origin:'https://qa.local','content-type':'application/json',...(await headersFor(user)),...extra},...(method==='POST'?{body:'{}'}:{})}),env)).status;
// 분 경계에 걸리면 창이 바뀌어 결과가 흔들리므로 새 분의 앞쪽에서 시작한다
const fresh=async()=>{const into=Date.now()%60000;if(into>25000)await new Promise(r=>setTimeout(r,60000-into+200))};
await fresh();let last=0;for(let i=0;i<300;i++)last=await req('busy','POST');assert.notEqual(last,429,'300 writes allowed');
assert.equal(await req('busy','POST'),429,'301st write in a minute limited');
assert.notEqual(await req('busy','GET'),429,'reads not limited per account');
assert.notEqual(await req('calm','POST'),429,'other accounts unaffected');
await fresh();let s=0;for(let i=0;i<600;i++)s=await req('','GET',{'x-forwarded-for':'203.0.113.9'});assert.notEqual(s,429,'600 per IP allowed');
assert.equal(await req('','GET',{'x-forwarded-for':'203.0.113.9'}),429,'601st per IP limited');
assert.notEqual(await req('','GET',{'x-forwarded-for':'203.0.113.10'}),429,'other IP unaffected');
console.log('PASS: 요청 제한(계정당 저장 분당 300, IP당 분당 600).');
await closeAll();
