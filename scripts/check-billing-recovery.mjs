import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';
import {closeAll} from './test-db.mjs';
import {seed} from '../lib/model.ts';
import {pricingPeriod} from '../lib/toss.ts';

const T=await authedTest({domain:'example.com'}),{q,headersFor,id}=T,env=T.env;
env.TOSS_CLIENT_KEY='test_ck_synthetic';env.TOSS_SECRET_KEY='test_sk_synthetic';env.HQ_NATIVE_USER_ID=id('hq');
const calls=[],approved=new Map();let loseResponse=false,rejectIdentity=false,cancelLost=false,inProgress=false;
env.TOSS_FETCH=async(url,init)=>{
 const method=init.method||'GET',b=JSON.parse(init.body||'{}');calls.push({url,method,b,key:init.headers['Idempotency-Key']});
 if(url.endsWith('/confirm')){
  const p={orderId:b.orderId,paymentKey:b.paymentKey,totalAmount:b.amount,status:'DONE',approvedAt:new Date().toISOString(),method:'카드',receipt:{url:'https://example.invalid/synthetic'}};
  approved.set(b.orderId,p);if(loseResponse){loseResponse=false;throw Error('synthetic lost approval response')}
  if(inProgress){inProgress=false;return Response.json({code:'IDEMPOTENT_REQUEST_PROCESSING'},{status:409})}
  return Response.json(rejectIdentity?{...p,orderId:'wrong-order'}:p);
 }
 if(url.includes('/orders/')){const p=approved.get(decodeURIComponent(url.split('/').at(-1)));return p?Response.json(rejectIdentity?{...p,orderId:'wrong-order'}:p):Response.json({code:'NOT_FOUND_PAYMENT'},{status:404})}
 if(url.endsWith('/cancel')){if(cancelLost){cancelLost=false;throw Error('synthetic lost cancel response')}return Response.json({status:'CANCELED'})}
 throw Error('Unexpected synthetic provider URL '+url);
};
const call=async(user,path,body)=>{const r=await api(new Request('https://test.local'+path,{method:body?'POST':'GET',headers:{origin:'https://test.local',...await headersFor(user)},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}};
const billing=(user,b)=>call(user,'/api/billing',b),raw=async u=>JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id(u)).first()).data);
const save=async(u,d)=>q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id(u)).run();
const setup=async u=>{const r=await call(u,'/api/account',{action:'onboard',plan:'basic',storeName:'합성 복구 매장',branchName:'본점',ownerName:'합성 사장',acknowledged:true,dpaAgreed:true});assert.equal(r.status,201);let d=await raw(u);d.employees=[{...structuredClone(template),id:'employee-'+u,name:'합성 직원',status:'재직'}];await save(u,d)};
const prepare=async(u,plan='pro',extra={})=>{const quote=await billing(u,{action:'quote',plan});assert.equal(quote.status,200);const r=await billing(u,{action:'prepare',kind:'plan',quoteId:quote.data.quoteId,agreed:true,...extra});assert.equal(r.status,200,JSON.stringify(r.data));return r.data};
const confirm=(u,p)=>billing(u,{action:'confirm',orderId:p.orderId,paymentKey:'pk_synthetic_1234567890',amount:p.amount});
let passed=0;const ok=s=>console.log(`PASS ${++passed}: ${s}`);
let template;
try{
 for(const [start,end] of [['2026-01-31T00:00:00+09:00','2026-02-28T00:00:00+09:00'],['2028-01-31T23:59:00+09:00','2028-02-29T23:59:00+09:00'],['2026-12-31T00:01:00+09:00','2027-01-31T00:01:00+09:00']])assert.equal(pricingPeriod(Date.parse(start)).end,new Date(end).toISOString());ok('Korean month-end, leap year and year boundary clamp');
 await q('INSERT INTO stores VALUES(?,?,?,?)',id('seed'),JSON.stringify(seed()),1,new Date().toISOString()).run();template=(await call('seed','/api/store')).data.state.employees[0];
 await setup('lost');let p=await prepare('lost');loseResponse=true;
 let r=await confirm('lost',p);assert.equal(r.status,202,JSON.stringify(r.data));assert.equal(r.data.code,'PAYMENT_CHECK_PENDING');
 assert.equal((await q('SELECT status FROM payments WHERE order_id=?',p.orderId).first()).status,'confirming');
 r=await confirm('lost',p);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.fulfilled,true);
 assert.equal(calls.filter(x=>x.url.endsWith('/confirm')&&x.b.orderId===p.orderId).length,1);
 assert.equal((await raw('lost'))._account.lastOrderId,p.orderId);ok('lost approval response recovers through lookup without a second approval request');
 await setup('processing');const processing=await prepare('processing');inProgress=true;r=await confirm('processing',processing);assert.equal(r.status,202);assert.equal((await q('SELECT status FROM payments WHERE order_id=?',processing.orderId).first()).status,'confirming');assert.equal((await confirm('processing',processing)).status,200);ok('supplier idempotency processing response remains recoverable');
 const until=(await raw('lost'))._account.paidUntil;
 const repeats=await Promise.all([confirm('lost',p),confirm('lost',p)]);assert.ok(repeats.every(x=>x.status===200));assert.equal((await raw('lost'))._account.paidUntil,until);
 assert.equal((await raw('lost'))._audit.filter(x=>x.target===p.orderId).length,1);ok('parallel and sequential confirmed retries apply entitlement once');
 await setup('dbfail');p=await prepare('dbfail');
 const original=T.DB.transaction.bind(T.DB);let failOnce=true;
 T.DB.transaction=fn=>original(async tx=>{const prepareSQL=tx.prepare.bind(tx);tx.prepare=sql=>{if(failOnce&&sql.startsWith('UPDATE stores SET data=')){failOnce=false;throw Error('synthetic entitlement storage failure')}return prepareSQL(sql)};return fn(tx)});
 r=await confirm('dbfail',p);T.DB.transaction=original;
 assert.equal(r.status,202,JSON.stringify(r.data));assert.equal(r.data.code,'FULFILLMENT_PENDING');
 let record=await q('SELECT status,fulfilled_at FROM payments WHERE order_id=?',p.orderId).first();assert.equal(record.status,'paid');assert.equal(record.fulfilled_at,null);assert.notEqual((await raw('dbfail'))._account.lastOrderId,p.orderId);
 r=await confirm('dbfail',p);assert.equal(r.status,200);assert.equal(r.data.fulfilled,true);assert.equal(calls.filter(x=>x.url.endsWith('/confirm')&&x.b.orderId===p.orderId).length,1);
 ok('approved payment survives transactional entitlement failure and resumes without paying again');
 await setup('parallel');p=await prepare('parallel');const parallel=await Promise.all([confirm('parallel',p),confirm('parallel',p)]);assert.ok(parallel.every(x=>[200,202].includes(x.status)));await confirm('parallel',p);assert.equal(calls.filter(x=>x.url.endsWith('/confirm')&&x.b.orderId===p.orderId).length,1);assert.equal((await raw('parallel'))._audit.filter(x=>x.target===p.orderId).length,1);ok('simultaneous first confirms approve and fulfill one order');
 await setup('mismatch');p=await prepare('mismatch');rejectIdentity=true;r=await confirm('mismatch',p);assert.equal(r.status,202);assert.equal(r.data.code,'PAYMENT_CHECK_PENDING');assert.notEqual((await raw('mismatch'))._account.lastOrderId,p.orderId);rejectIdentity=false;r=await confirm('mismatch',p);assert.equal(r.status,200);ok('mismatched supplier order ID never grants access, valid recheck recovers');
 await setup('legacy');let d=await raw('legacy');const end=new Date(Date.now()+15*86400000).toISOString();d._account={...d._account,pricingVersion:undefined,plan:'basic',status:'active',periodStart:new Date(Date.now()-15*86400000).toISOString(),paidUntil:end,periodPrice:59400,months:6,storeSlots:1};await save('legacy',d);
 p=await prepare('legacy','pro',{convertPricing:true});r=await confirm('legacy',p);assert.equal(r.status,200);d=await raw('legacy');assert.equal(d._account.plan,'basic');assert.equal(d._account.periodPrice,59400);assert.equal(d._account.paidUntil,end);assert.equal(d._account.pendingSubscription.plan,'pro');assert.equal((await call('legacy','/api/store')).data.qrRequired,false);
 // Shift the synthetic period boundary to now without waiting. Central resolution must activate for any role.
 d._account.pendingSubscription.periodStart=new Date(Date.now()-1000).toISOString();d._account.pendingSubscriptions=[d._account.pendingSubscription];d._account.paidUntil=new Date(Date.now()-1000).toISOString();await save('legacy',d);
 assert.equal((await call('legacy','/api/store')).data.qrRequired,true);d=await raw('legacy');assert.equal(d._account.plan,'pro');assert.equal(d._account.pendingSubscription,undefined);ok('paid legacy period stays intact; next period activates through common permission resolution');
 await call('zero','/api/account',{action:'onboard',plan:'pro',storeName:'합성 0원',branchName:'본점',ownerName:'합성',acknowledged:true,dpaAgreed:true});p=await prepare('zero');const zeroUntil=(await raw('zero'))._account.paidUntil;
 const q2=(await billing('zero',{action:'quote',plan:'pro'})).data;r=await billing('zero',{action:'prepare',kind:'plan',quoteId:q2.quoteId,agreed:true});assert.equal(r.status,409);assert.equal(r.data.code,'NO_CHARGE_ACTIVE');assert.equal((await raw('zero'))._account.paidUntil,zeroUntil);ok('repeated 0-price quotes cannot stockpile free future periods before hiring');
 await setup('refund');p=await prepare('refund');await confirm('refund',p);cancelLost=true;
 const requestId=crypto.randomUUID();
 r=await billing('hq',{action:'refund',requestId,orderId:p.orderId,amount:1000,reason:'합성 부분 환불'});assert.equal(r.status,202);assert.equal(r.data.code,'REFUND_PENDING');
 r=await billing('hq',{action:'refund',requestId,orderId:p.orderId,amount:2000,reason:'다른 금액'});assert.equal(r.status,409);
 r=await billing('hq',{action:'refund',requestId,orderId:p.orderId,amount:1000,reason:'합성 부분 환불'});assert.equal(r.status,200);assert.equal(r.data.refunded,1000);assert.equal((await q('SELECT refunded_amount FROM payments WHERE order_id=?',p.orderId).first()).refunded_amount,1000);
 const repeatedRefund=await billing('hq',{action:'refund',requestId,orderId:p.orderId,amount:1000,reason:'합성 부분 환불'});assert.equal(repeatedRefund.data.already,true);
 const cancels=calls.filter(x=>x.url.endsWith('/cancel'));assert.equal(cancels[0].key,cancels[1].key);ok('uncertain refund preserves the original intent and idempotency key');
 await setup('historical');d=await raw('historical');d._account={...d._account,pricingVersion:undefined,status:'active',plan:'pro',months:6,storeSlots:2,periodPrice:107460,periodStart:new Date(Date.now()-86400000).toISOString(),paidUntil:new Date(Date.now()+150*86400000).toISOString(),lastOrderId:'cc-historical-123456'};await save('historical',d);
 await q("INSERT INTO payments(id,owner,order_id,plan,store_slots,months,amount,status,period_start,period_end,payment_key,paid_at,created_at) VALUES(?,?,'cc-historical-123456','pro',2,6,107460,'paid',?,?,?, ?,?)",crypto.randomUUID(),id('historical'),d._account.periodStart,d._account.paidUntil,'pk_synthetic_1234567890',d._account.periodStart,d._account.periodStart).run();
 r=await confirm('historical',{orderId:'cc-historical-123456',amount:107460});assert.equal(r.status,200);assert.equal((await raw('historical'))._account.paidUntil,d._account.paidUntil);ok('pre-migration paid legacy transaction never extends an already applied historical period');
 console.log(`PASS: billing recovery ${passed}/${passed}.`);
}finally{await closeAll()}
