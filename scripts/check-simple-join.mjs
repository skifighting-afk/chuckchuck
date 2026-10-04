import assert from 'node:assert/strict';
import worker,{api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
import {normalizeJoinCode,pastedJoinCode,joinPath} from '../lib/join-code.ts';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env,DB=env.DB;
let n=0;function ok(label,actual,expected=true){assert.deepEqual(actual,expected,label);console.log(`${++n}. PASS ${label}`)}
async function call(user,path,body){const r=await api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,data:await r.json()}}
const join=(u,b)=>call(u,'/api/staff-join',b);
await call('owner','/api/account',{action:'onboard',storeName:'가상가게',branchName:'본점',ownerName:'검수',plan:'basic',acknowledged:true,dpaAgreed:true});
let owner=(await join('owner')).data;
ok('owner creates short code',(await join('owner',{action:'code',branchId:'branch-main',version:owner.version})).status,200);
owner=(await join('owner')).data;const code=owner.codes[0].code;
ok('8 unambiguous characters',/^[A-HJ-NP-Z2-9]{8}$/.test(code));
ok('grouped lowercase normalizes',normalizeJoinCode(code.slice(0,4).toLowerCase()+' - '+code.slice(4).toLowerCase()),code);
ok('short link copy retains code',pastedJoinCode('https://qa.local'+joinPath(code),'https://qa.local'),code);
ok('old long link paste remains supported',pastedJoinCode('https://qa.local/employee?code='+code,'https://qa.local'),code);
ok('foreign website is not accepted as store link',pastedJoinCode('https://unknown.invalid/j/'+code,'https://qa.local'),'');
let r=await worker.fetch(new Request('https://qa.local'+joinPath(code)),env);ok('short link routes to employee signup',r.status,302);ok('short link prepopulates correct code',r.headers.get('location'),'https://qa.local/employee?code='+code);
ok('invalid short link 404',(await worker.fetch(new Request('https://qa.local/j/bad'),env)).status,404);
ok('anonymous cannot inspect join terms',(await join('',{action:'preview',code})).status,401);
ok('code alone cannot read staff data',(await call('new-staff','/api/store?code='+code)).status,409);
ok('formatted short code finds correct store',(await join('new-staff',{action:'preview',code:code.slice(0,4)+' '+code.slice(4)})).data.storeName,'가상가게');
ok('short code permits application',(await join('new-staff',{action:'apply',code,name:'가상직원',phone:'01000000000'})).status,200);
ok('application still waits for owner',(await join('new-staff')).data.requests[0].status,'pending');
ok('pending employee still cannot access store',(await call('new-staff','/api/store')).status,409);
owner=(await join('owner')).data;await join('owner',{action:'code',branchId:'branch-main',version:owner.version});
ok('reopening code does not rotate or invalidate it',(await join('owner')).data.codes[0].code,code);
ok('employee cannot create store code',(await join('new-staff',{action:'code',branchId:'branch-main',version:owner.version})).status,403);
// Existing printed/shared UUID links survive conversion to an easier code.
const oldCode='12345678-1234-4321-8765-123456789abc';const d=JSON.parse((await q('SELECT data FROM stores').first()).data);d._joinCodes[0].code=oldCode;await q('UPDATE stores SET data=?',JSON.stringify(d)).run();
owner=(await join('owner')).data;await join('owner',{action:'code',branchId:'branch-main',version:owner.version});owner=(await join('owner')).data;
ok('old code becomes 8 characters',owner.codes[0].code.length,8);
ok('previous code preserved as alias',owner.codes[0].legacyCode,oldCode);
ok('previous shared link still finds correct store',(await join('new-staff',{action:'preview',code:oldCode})).data.storeName,'가상가게');
ok('new short code finds same store',(await join('new-staff',{action:'preview',code:owner.codes[0].code})).data.storeName,'가상가게');
// 작업 058: 가입 링크 멈춤·기간·새 코드
owner=(await join('owner')).data;let cur=owner.codes[0].code;
ok('pause join',(await join('owner',{action:'code',branchId:'branch-main',paused:true,version:owner.version})).status,200);
ok('paused code refuses preview',(await join('late-staff',{action:'preview',code:cur})).status,410);
ok('paused code refuses apply',(await join('late-staff',{action:'apply',code:cur,name:'늦은직원',phone:'01011112222'})).status,410);
owner=(await join('owner')).data;await join('owner',{action:'code',branchId:'branch-main',paused:false,version:owner.version});
ok('resumed code works',(await join('late-staff',{action:'preview',code:cur})).status,200);
owner=(await join('owner')).data;ok('bad period rejected',(await join('owner',{action:'code',branchId:'branch-main',days:3,version:owner.version})).status,400);
await join('owner',{action:'code',branchId:'branch-main',days:7,version:owner.version});owner=(await join('owner')).data;ok('7-day expiry set',Math.abs(Date.parse(owner.codes[0].expiresAt)-Date.now()-7*86400000)<60000);
{const r=await q('SELECT data FROM stores WHERE owner=?',id('owner')).first();const d=JSON.parse(r.data);d._joinCodes[0].expiresAt='2020-01-01T00:00:00.000Z';await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('owner')).run();}
ok('expired code refused',(await join('late-staff',{action:'preview',code:cur})).status,410);
owner=(await join('owner')).data;await join('owner',{action:'code',branchId:'branch-main',days:0,renew:true,version:owner.version});owner=(await join('owner')).data;
ok('renew gives new code without expiry',owner.codes[0].code!==cur&&!owner.codes[0].expiresAt&&!owner.codes[0].legacyCode);
ok('old code stops after renew',(await join('late-staff',{action:'preview',code:cur})).status,404);
ok('new code works',(await join('late-staff',{action:'preview',code:owner.codes[0].code})).status,200);
console.log(`${n}/${n} simple join checks passed`);
await closeAll();
