// 지시서 나중: 090 오픈 API·웹훅 · 100 개인정보 열람 기록 · 070 매뉴얼 동영상
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function raw(user,path,body){return api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function call(user,path,body){const r=await raw(user,path,body);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'매뉴얼 검수',branchName:'본점',ownerName:'가상대표',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['amy','에이미'],['far','다른지점']]){await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});const j=(await call('boss','/api/staff-join')).body;await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version});}
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);const F=d._members.find(m=>m.userId===id('far')).employeeId;d.branches.push({id:'b2',name:'2호점',address:''});d.employees.find(e=>e.id===F).branchId='b2';await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
const st=async(u)=>(await call(u,'/api/store')).body;
const O=(key,path)=>api(new Request('https://qa.local/api/open/v1/'+path,{headers:key?{'x-api-key':key}:{}}),env).then(async r=>({status:r.status,body:await r.json()}));
ok('staff cannot make keys',(await call('amy','/api/open-admin',{action:'createKey'})).status,403);
let r=await call('boss','/api/open-admin',{action:'createKey',label:'회계'});ok('owner makes key',[r.status,/^ck_[a-f0-9]{40}$/.test(r.body.key)],[200,true]);const key=r.body.key;
ok('no key',(await O('', 'employees')).status,401);ok('bad key',(await O('ck_'+'0'.repeat(40),'employees')).status,401);
let e=await O(key,'employees');ok('employees read',[e.status,e.body.employees.length>=2,'phone' in e.body.employees[0]],[200,true,false]);
ok('range required',(await O(key,'shifts')).status,400);ok('range limit',(await O(key,'attendance?from=2026-01-01&to=2026-09-01')).status,400);
ok('shifts read',(await O(key,'shifts?from=2026-09-01&to=2026-09-30')).status,200);ok('attendance read',(await O(key,'attendance?from=2026-09-01&to=2026-09-30')).status,200);
ok('payroll needs month',(await O(key,'payroll')).status,400);ok('payroll read',(await O(key,'payroll?month=2026-09')).body.runs.length,0);
ok('unknown path',(await O(key,'secrets')).status,404);
r=await call('boss','/api/open-admin');ok('key listed with last use',!!r.body.keys[0].lastUsedAt,true);
ok('private webhook refused',(await call('boss','/api/open-admin',{action:'addHook',url:'https://192.168.0.2/x',events:['attendance.clock']})).status,400);
r=await call('boss','/api/open-admin',{action:'addHook',url:'https://hooks.example.invalid/in',events:['attendance.clock']});ok('add hook returns secret once',[r.status,/^[a-f0-9]{48}$/.test(r.body.secret),'secret' in r.body.webhooks[0]],[200,true,false]);
const secret=r.body.secret;const sent=[];const realFetch=globalThis.fetch;globalThis.fetch=async(u,o)=>{if(String(u).startsWith('https://hooks.example.invalid')){sent.push({u:String(u),o});return new Response('ok')}return realFetch(u,o)};
let b=await st('boss');const A=b.state.employees.find(x=>x.name==='에이미').id;
await call('boss','/api/store',{action:'attendance',employeeId:A,kind:'in',version:b.version});
globalThis.fetch=realFetch;
ok('webhook sent on clock',sent.length,1);const body=sent[0].o.body,hdr=sent[0].o.headers;
const kk=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',kk,new TextEncoder().encode(body)))).map(n=>n.toString(16).padStart(2,'0')).join('');
ok('webhook signed',[hdr['X-Chukchuk-Signature'],JSON.parse(body).event],['sha256='+sig,'attendance.clock']);
r=await call('boss','/api/open-admin',{action:'revokeKey',prefix:key.slice(0,10)});ok('revoked key stops',(await O(key,'employees')).status,401);
// 100 개인정보 열람
ok('staff cannot log pii',(await call('amy','/api/pii-log',{employeeId:A,kind:'phone'})).status,403);
ok('owner pii log',(await call('boss','/api/pii-log',{employeeId:A,kind:'phone'})).status,200);
b=await st('boss');ok('audit has pii view',b.audit.some(x=>x.action==='개인정보 열람'&&x.target==='에이미'&&x.after?.kind==='연락처'),true);
// 070 동영상
let mv=(await call('boss','/api/manual')).body;
ok('video must be https',(await call('boss','/api/manual',{action:'save',title:'영상',branchId:'all',category:'기타',steps:[{text:'',videoUrl:'http://x.y/z'}],version:mv.version,notify:false})).status,400);
ok('video-only step ok',(await call('boss','/api/manual',{action:'save',title:'영상',branchId:'all',category:'기타',steps:[{text:'',videoUrl:'https://youtu.be/abc123'}],version:mv.version,notify:false})).status,200);
mv=(await call('amy','/api/manual')).body;ok('staff sees video url',mv.manuals.find(m=>m.title==='영상').steps[0].videoUrl,'https://youtu.be/abc123');
console.log('PASS: 오픈 API·웹훅·개인정보 열람 기록·매뉴얼 동영상.');
await closeAll();
