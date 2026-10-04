// 작업 092: 웹 푸시 — RFC 8291 예시 일치, VAPID 서명 검증, 구독 API, 휴가 결과 알림, 만료 구독 정리
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {encryptPayload,b64u,vapidHeader} from '../lib/webpush.ts';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
const out=await encryptPayload(new TextEncoder().encode('When I grow up, I want to be a watermelon'),b64u.dec('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),b64u.dec('BTBZMqHH6r4Tts7J_aSIgg'),{asPrivate:'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',asPublic:'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',salt:b64u.dec('DGv6ra1nlYgDCS1FRnbzlw')});
ok('RFC 8291 예시와 같은 암호문',b64u.enc(out),'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const VAPID_PUBLIC_KEY=b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey))),VAPID_PRIVATE_KEY=(await crypto.subtle.exportKey('jwk',kp.privateKey)).d;
const h=await vapidHeader('https://push.example.invalid/abc',{VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY});const jwt=h.match(/t=([^,]+)/)[1].split('.');
ok('VAPID 서명이 공개키로 검증됨',await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},kp.publicKey,b64u.dec(jwt[2]),new TextEncoder().encode(jwt[0]+'.'+jwt[1])));
ok('VAPID aud는 푸시 서버 주소',JSON.parse(new TextDecoder().decode(b64u.dec(jwt[1]))).aud,'https://push.example.invalid');
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T;
const bare=T.env,env={...T.env,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY};
async function call(user,path,body,e=env){const r=await api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),e);return{status:r.status,body:await r.json()}}
ok('키가 없으면 공개키 없음',(await call('amy','/api/push',null,bare)).body.publicKey,null);
const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const p256dh=b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw',ua.publicKey))),auth=b64u.enc(crypto.getRandomValues(new Uint8Array(16)));
const sub={endpoint:'https://push.example.invalid/amy-phone',keys:{p256dh,auth}};
ok('키가 없으면 구독 거부',(await call('amy','/api/push',{action:'subscribe',subscription:sub},bare)).status,503);
ok('http 주소 구독 거부',(await call('amy','/api/push',{action:'subscribe',subscription:{...sub,endpoint:'http://x'}})).status,400);
ok('구독 저장',(await call('amy','/api/push',{action:'subscribe',subscription:sub})).status,200);ok('내 기기 1대',(await call('amy','/api/push')).body.devices,1);
// 휴가 승인 → 직원 기기로 알림
await call('boss','/api/account',{action:'onboard',storeName:'알림 가게',branchName:'본점',ownerName:'대표',plan:'pro',acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;await call('amy','/api/staff-join',{action:'apply',code,name:'에이미',phone:'01000000000'});
let j=(await call('boss','/api/staff-join')).body;await call('boss','/api/staff-join',{action:'review',id:j.requests[0].id,approve:true,payType:'시급',wage:10320,version:j.version});
{const d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);d.employees[0].status='재직';d.employees[0].leaveBalance=5;await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();}
let op=(await call('amy','/api/operations')).body;op=(await call('amy','/api/operations',{action:'requestLeave',version:op.version,employeeId:op.selfId,start:'2026-11-02',end:'2026-11-02',days:1,kind:'연차',reason:'휴식'})).body;
const sent=[];const realFetch=globalThis.fetch;globalThis.fetch=async(url,o)=>{sent.push({url,o});return new Response(null,{status:201})};
op=(await call('boss','/api/operations')).body;await call('boss','/api/operations',{action:'reviewLeave',version:op.version,id:op.leaves[0].id,approve:true,comment:'좋아요'});
ok('휴가 결과 알림 1건 전송',sent.length,1);ok('암호화 본문과 VAPID 머리말',[sent[0].url,sent[0].o.headers['Content-Encoding'],sent[0].o.headers.Authorization.startsWith('vapid t=')],[sub.endpoint,'aes128gcm',true]);
// 받는 쪽에서 풀어 보기(우리 암호화가 실제 기기에서 풀리는지)
{const body=new Uint8Array(sent[0].o.body),salt=body.slice(0,16),asPub=body.slice(21,86),cipher=body.slice(86);
 const hm=async(k,d)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']),d));const cat=(...a)=>{const o=new Uint8Array(a.reduce((x,y)=>x+y.length,0));let i=0;for(const p of a){o.set(p,i);i+=p.length}return o};const te=new TextEncoder();
 const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:await crypto.subtle.importKey('raw',asPub,{name:'ECDH',namedCurve:'P-256'},false,[])},ua.privateKey,256));
 const ikm=await hm(await hm(b64u.dec(auth),ecdh),cat(te.encode('WebPush: info\0'),b64u.dec(p256dh),asPub,new Uint8Array([1]))),prk=await hm(salt,ikm);
 const cek=(await hm(prk,cat(te.encode('Content-Encoding: aes128gcm\0'),new Uint8Array([1])))).slice(0,16),nonce=(await hm(prk,cat(te.encode('Content-Encoding: nonce\0'),new Uint8Array([1])))).slice(0,12);
 const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),cipher));
 const msg=JSON.parse(new TextDecoder().decode(plain.slice(0,-1)));ok('기기에서 풀린 알림 내용',[msg.title,msg.body.includes('2026-11-02')],['휴가 신청 승인',true]);}
// 410이면 구독 지움
globalThis.fetch=async()=>new Response(null,{status:410});op=(await call('amy','/api/operations')).body;op=(await call('amy','/api/operations',{action:'requestLeave',version:op.version,employeeId:op.selfId,start:'2026-11-03',end:'2026-11-03',days:1,kind:'연차',reason:'휴식'})).body;
op=(await call('boss','/api/operations')).body;await call('boss','/api/operations',{action:'reviewLeave',version:op.version,id:op.leaves.find(l=>l.status==='승인 대기').id,approve:false,comment:'바빠요'});
globalThis.fetch=realFetch;ok('만료된 구독은 지움',(await call('amy','/api/push')).body.devices,0);
console.log('PASS: 웹 푸시.');
await closeAll();
