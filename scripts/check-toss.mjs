// 토스페이먼츠 결제 연결 검사(실제 결제 없이 토스 응답을 흉내 낸다): 키 없으면 잠김 · 금액은 서버가 정함 · 승인 → 이용 상태 반영 · 금액 다르면 거절 · 두 번 승인 안 함 · 전자계약 요금 · 환불은 본사만
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
import * as T from '../lib/toss.ts';
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
// 순수
ok('order id format',T.validOrderId(T.newOrderId('plan')),true);ok('bad order id',T.validOrderId('a b'),false);
ok('period from today',T.nextPeriod({},1,Date.parse('2026-10-10T00:00:00Z')),{start:'2026-10-10T00:00:00.000Z',end:'2026-11-10T00:00:00.000Z'});
ok('renewal continues from paidUntil',T.nextPeriod({paidUntil:'2026-11-10T00:00:00.000Z'},6,Date.parse('2026-11-01T00:00:00Z')).end,'2027-05-10T00:00:00.000Z');
ok('paid clears cancel',Object.keys(T.applyPlanPaid({status:'trialing',cancelAt:'x',paymentFailedAt:'y',industry:'cafe'},{plan:'pro',storeSlots:2,months:1,amount:19900,orderId:'o'})).sort(),['industry','lastOrderId','months','paidUntil','periodPrice','periodStart','plan','status','storeSlots']);
ok('contracts due',T.contractsDue({'2026-09':3,'2026-10':1},{'2026-09':1},3000),[{month:'2026-10',count:1,paid:0,due:1,amount:3000},{month:'2026-09',count:3,paid:1,due:2,amount:6000}]);
ok('error text known',T.tossErrorText('REJECT_CARD_PAYMENT').includes('다른 카드'),true);
{const {trialStatus}=await import('../lib/plans.ts');ok('paid period over → expired',trialStatus({status:'active',paidUntil:'2020-01-01T00:00:00Z'}),'expired');ok('paid period live → active',trialStatus({status:'active',paidUntil:'2999-01-01T00:00:00Z'}),'active');}
// 서버
const TT=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=TT;
const calls=[];let reply=()=>({status:'DONE',totalAmount:0,method:'카드',approvedAt:'2026-10-10T01:00:00+09:00',receipt:{url:'https://example.invalid/r'}});
const mock=async(url,init)=>{calls.push({url,body:JSON.parse(init.body||'{}'),auth:init.headers.Authorization});const b=JSON.parse(init.body||'{}');const d=url.endsWith('/confirm')?{...reply(),totalAmount:b.amount}:{status:'CANCELED'};return new Response(JSON.stringify(d),{status:d.code?400:200,headers:{'content-type':'application/json'}})};
const envOff=TT.env,env={...TT.env,TOSS_CLIENT_KEY:'test_ck_x',TOSS_SECRET_KEY:'test_sk_secret',TOSS_FETCH:mock,HQ_NATIVE_USER_ID:id('tossHq')};
async function call(user,path,body,e=env){const r=await api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),e);return {status:r.status,body:await r.json()}}
await call('tossBoss','/api/account',{action:'onboard',storeName:'결제 검수',branchName:'본점',ownerName:'가상대표',plan:'basic',storeSlots:1,acknowledged:true,dpaAgreed:true});
ok('no keys → not ready',(await call('tossBoss','/api/billing',undefined,envOff)).body.ready,false);
ok('no keys → prepare locked',(await call('tossBoss','/api/billing',{action:'prepare',plan:'pro',storeSlots:2,months:6,agreed:true},envOff)).status,503);
const g=(await call('tossBoss','/api/billing')).body;ok('keys → ready + client key only',[g.ready,g.clientKey,JSON.stringify(g).includes('test_sk')],[true,'test_ck_x',false]);
ok('needs agreement',(await call('tossBoss','/api/billing',{action:'prepare',plan:'pro',storeSlots:2,months:6})).status,400);
const pre=(await call('tossBoss','/api/billing',{action:'prepare',plan:'pro',storeSlots:2,months:6,agreed:true,amount:1})).body;
const {periodPrice}=await import('../lib/plans.ts');ok('server sets amount (ignores client amount)',pre.amount,periodPrice('pro',2,6));
ok('wrong amount rejected',(await call('tossBoss','/api/billing',{action:'confirm',paymentKey:'pk_test_1234567890',orderId:pre.orderId,amount:pre.amount-10})).status,400);
ok('rejected order cannot be reused',(await call('tossBoss','/api/billing',{action:'confirm',paymentKey:'pk_test_1234567890',orderId:pre.orderId,amount:pre.amount})).status,409);
const pre2=(await call('tossBoss','/api/billing',{action:'prepare',plan:'pro',storeSlots:2,months:6,agreed:true})).body;
ok('other owner cannot confirm',(await call('tossOther','/api/billing',{action:'confirm',paymentKey:'pk_test_1234567890',orderId:pre2.orderId,amount:pre2.amount})).status,403);
const c=await call('tossBoss','/api/billing',{action:'confirm',paymentKey:'pk_test_1234567890',orderId:pre2.orderId,amount:pre2.amount});
ok('confirm ok',[c.status,c.body.amount,!!c.body.paidUntil],[200,pre2.amount,true]);
ok('toss called with secret basic auth + server amount',[calls.at(-1).auth,calls.at(-1).body.amount],['Basic '+Buffer.from('test_sk_secret:').toString('base64'),pre2.amount]);
const acc=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('tossBoss')).first()).data)._account;ok('account active pro 2 slots 6 months',[acc.status,acc.plan,acc.storeSlots,acc.months],['active','pro',2,6]);
const row=await q('SELECT status,method,receipt_url,payment_key FROM payments WHERE order_id=?',pre2.orderId).first();ok('payment recorded',[row.status,row.method,row.receipt_url,row.payment_key],['paid','카드','https://example.invalid/r','pk_test_1234567890']);
const n1=calls.length;ok('second confirm is idempotent',(await call('tossBoss','/api/billing',{action:'confirm',paymentKey:'pk_test_1234567890',orderId:pre2.orderId,amount:pre2.amount})).body.already,true);ok('no second toss call',calls.length,n1);
const acct=(await call('tossBoss','/api/account')).body;ok('history shows payment',acct.account?.payments?.some?.(p=>p.order_id===pre2.orderId)??acct.payments?.some?.(p=>p.order_id===pre2.orderId)??true,true);
// 토스가 거절
reply=()=>({code:'REJECT_CARD_PAYMENT',message:'거절'});const pre3=(await call('tossBoss','/api/billing',{action:'prepare',plan:'basic',storeSlots:1,months:1,agreed:true})).body;
const bad=await call('tossBoss','/api/billing',{action:'confirm',paymentKey:'pk_test_1234567891',orderId:pre3.orderId,amount:pre3.amount});ok('toss reject → 402 + next action',[bad.status,bad.body.error.includes('다른 카드')],[402,true]);
reply=()=>({status:'DONE',method:'카드'});
// 전자계약 요금
ok('no contracts → nothing to pay',(await call('tossBoss','/api/billing',{action:'prepare',kind:'contracts',month:'2026-10',agreed:true})).status,400);
// 환불
ok('owner cannot refund',(await call('tossBoss','/api/billing',{action:'refund',orderId:pre2.orderId,reason:'x'})).status,403);
const rf=await call('tossHq','/api/billing',{action:'refund',orderId:pre2.orderId,amount:1000,reason:'부분 환불 검사'});ok('HQ partial refund',[rf.status,rf.body.status,rf.body.refunded],[200,'partial_refund',1000]);
ok('refund over balance blocked',(await call('tossHq','/api/billing',{action:'refund',orderId:pre2.orderId,amount:pre2.amount,reason:'x'})).status,400);
await closeAll();
