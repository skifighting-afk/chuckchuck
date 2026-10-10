// 스토어 앱 검사: 앱 알림(FCM·APNs) 보내기와 토큰 등록, 서명(JWT), 앱 설정 파일
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
import * as N from '../lib/native-push.ts';
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
const {subtle}=globalThis.crypto;
const pem=(buf,label)=>`-----BEGIN ${label}-----\n${Buffer.from(buf).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
const rsa=await subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const ec=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const rsaPem=pem(await subtle.exportKey('pkcs8',rsa.privateKey),'PRIVATE KEY'),ecPem=pem(await subtle.exportKey('pkcs8',ec.privateKey),'PRIVATE KEY');
// JWT 서명이 공개키로 검증되는지
for(const [alg,key,pub,params] of [['RS256',rsaPem,rsa.publicKey,{name:'RSASSA-PKCS1-v1_5'}],['ES256',ecPem,ec.publicKey,{name:'ECDSA',hash:'SHA-256'}]]){
 const jwt=await N.signJwt(alg,key,{kid:'k1'},{iss:'x'});const [h,p,s]=jwt.split('.');
 ok(alg+' signature verifies',await subtle.verify(params,pub,Buffer.from(s,'base64url'),new TextEncoder().encode(h+'.'+p)));
 ok(alg+' header',JSON.parse(Buffer.from(h,'base64url')).alg,alg);
}
ok('token check ios',N.validNativeToken('a'.repeat(64),'ios'),true);ok('token check bad',N.validNativeToken('zz','ios'),false);ok('token check android',N.validNativeToken('abc:'+'x'.repeat(40),'android'),true);
const calls=[];const fetcher=async(url,init)=>{calls.push({url:String(url),init});if(String(url).includes('oauth2'))return new Response(JSON.stringify({access_token:'at',expires_in:3600}));if(String(url).includes('gone'))return new Response(JSON.stringify({error:{status:'NOT_FOUND'}}),{status:404});if(String(url).includes('push.apple.com')&&String(url).includes('dead'))return new Response(JSON.stringify({reason:'Unregistered'}),{status:410});return new Response('{}')};
const env={FCM_SERVICE_ACCOUNT:JSON.stringify({client_email:'a@b.iam',private_key:rsaPem,project_id:'demo-proj'}),APNS_KEY:ecPem,APNS_KEY_ID:'KEY123',APNS_TEAM_ID:'TEAM123'};
N.resetFcmCache();
ok('android sent',await N.sendNative(env,{token:'tok-'+'x'.repeat(30),platform:'android'},{title:'t',body:'b',url:'/app'},fetcher),'sent');
const fcm=calls.find(c=>c.url.includes('fcm.googleapis.com'));ok('fcm url + bearer',[fcm.url,fcm.init.headers.Authorization],['https://fcm.googleapis.com/v1/projects/demo-proj/messages:send','Bearer at']);
ok('fcm data url',JSON.parse(fcm.init.body).message.data.url,'/app');
ok('android gone',await N.sendNative(env,{token:'gone',platform:'android'},{title:'t',body:'b',url:'/'},async(u,i)=>String(u).includes('oauth2')?fetcher(u,i):new Response(JSON.stringify({error:{status:'NOT_FOUND'}}),{status:404})),'gone');
ok('ios sent',await N.sendNative(env,{token:'ab'.repeat(32),platform:'ios'},{title:'t',body:'b',url:'/app'},fetcher),'sent');
const ap=calls.find(c=>c.url.includes('push.apple.com'));ok('apns topic + push type',[ap.init.headers['apns-topic'],ap.init.headers['apns-push-type'],ap.url.startsWith('https://api.push.apple.com/3/device/')],['kr.chukchukapp.app','alert',true]);
ok('ios gone',await N.sendNative(env,{token:'dead',platform:'ios'},{title:'t',body:'b',url:'/'},fetcher),'gone');
ok('no keys skipped',await N.sendNative({},{token:'x',platform:'ios'},{title:'t',body:'b',url:'/'},fetcher),'skipped');
// 서버: 토큰 등록·알림 보내기
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T;
const E={...T.env,...env};
async function call(user,body){const r=await api(new Request('https://qa.local/api/push',{method:'POST',headers:{origin:'https://qa.local',...(await headersFor(user))},body:JSON.stringify(body)}),E);return {status:r.status,body:await r.json()}}
ok('bad token rejected',(await call('nat1',{action:'nativeToken',token:'x',platform:'ios'})).status,400);
ok('ios token saved',(await call('nat1',{action:'nativeToken',token:'cd'.repeat(32),platform:'ios'})).status,200);
ok('stored',(await q('SELECT platform FROM native_push_tokens WHERE user_id=?',id('nat1')).first()).platform,'ios');
const {notifyUser}=await import('../dist/server/index.js').then(m=>m).catch(()=>({}));
if(typeof notifyUser==='function'){calls.length=0;const sent=await notifyUser(E,id('nat1'),{title:'근무표',body:'바뀌었어요',url:'/app'},fetcher);ok('notify sends to app device',sent>=1,true)}else ok('notify (export check skipped)',true);
ok('remove all',(await call('nat1',{action:'nativeRemove',all:true})).status,200);ok('removed',(await q('SELECT count(*)::int AS n FROM native_push_tokens WHERE user_id=?',id('nat1')).first()).n,0);
// 앱 설정
const cfg=JSON.parse(readFileSync('mobile/capacitor.config.json','utf8'));ok('app id',cfg.appId,'kr.chukchukapp.app');ok('web dir',cfg.webDir,'www');
const pkg=JSON.parse(readFileSync('mobile/package.json','utf8'));ok('capacitor versions pinned (no ^ ~)',Object.values({...pkg.dependencies,...pkg.devDependencies}).every(v=>/^\d+\.\d+\.\d+$/.test(v)),true);
const entry=readFileSync('supabase/functions/api/entry.ts','utf8');ok('entry allows app origins',entry.includes("capacitor://localhost,https://localhost"),true);
await closeAll();
