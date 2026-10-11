import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';
import {closeAll} from './test-db.mjs';
import {seed} from '../lib/model.ts';
import {refundFromPayment} from '../lib/plans.ts';
import {activatePendingSubscription} from '../lib/toss.ts';
const T=await authedTest({domain:'example.com'}),{q,id,headersFor}=T,env=T.env;
env.TOSS_CLIENT_KEY='test_ck_synthetic';env.TOSS_SECRET_KEY='test_sk_synthetic';env.HQ_NATIVE_USER_ID=id('hq-edge');
let template;let preSend=false,lookupStatus='missing',posts=0;const approved=new Map(),keys=[];
env.TOSS_FETCH=async(url,init)=>{
 const b=JSON.parse(init.body||'{}');
 if(url.endsWith('/confirm')){posts++;keys.push(init.headers['Idempotency-Key']);if(preSend){preSend=false;throw Error('synthetic request never sent')};const p={status:'DONE',orderId:b.orderId,paymentKey:b.paymentKey,totalAmount:b.amount,currency:'KRW',approvedAt:new Date().toISOString()};approved.set(b.orderId,p);return Response.json(p)}
 if(url.includes('/orders/')){const orderId=decodeURIComponent(url.split('/').at(-1));return approved.has(orderId)?Response.json(approved.get(orderId)):lookupStatus==='ready'?Response.json({status:'IN_PROGRESS',orderId,paymentKey:'pk_edge_synthetic_12345',totalAmount:3900,currency:'KRW'}):Response.json({code:'NOT_FOUND_PAYMENT'},{status:404})}
 if(url.endsWith('/cancel'))return Response.json({status:'CANCELED'});
 throw Error('Unexpected synthetic provider request');
};
const call=async(u,path,b)=>{const r=await api(new Request('https://test.local'+path,{method:b?'POST':'GET',headers:{origin:'https://test.local',...await headersFor(u)},...(b?{body:JSON.stringify(b)}:{})}),env);return {status:r.status,data:await r.json()}};
const bill=(u,b)=>call(u,'/api/billing',b),raw=async u=>JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id(u)).first()).data),save=(u,d)=>q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id(u)).run();
const setup=async u=>{assert.equal((await call(u,'/api/account',{action:'onboard',plan:'pro',storeName:'합성 경계 검사',branchName:'본점',ownerName:'합성',acknowledged:true,dpaAgreed:true})).status,201);const d=await raw(u);d.employees=[{...structuredClone(template),id:'edge-'+u,name:'합성 직원',status:'재직'}];d._account.trialEndsAt=new Date(Date.now()-86400000).toISOString();await save(u,d)};
const quote=async u=>(await bill(u,{action:'quote',plan:'pro'})).data;
const prep=(u,quoteId)=>bill(u,{action:'prepare',kind:'plan',quoteId,agreed:true});
const prepare=async u=>{const r=await prep(u,(await quote(u)).quoteId);assert.equal(r.status,200,JSON.stringify(r.data));return r.data};
const confirm=(u,p)=>bill(u,{action:'confirm',orderId:p.orderId,paymentKey:'pk_edge_synthetic_12345',amount:p.amount});
let passed=0,failed=0;const test=async(name,fn)=>{try{await fn();passed++;console.log('PASS: '+name)}catch(e){failed++;console.error('FAIL: '+name+' — '+e.message)}};
try{
 await q('INSERT INTO stores VALUES(?,?,?,?)',id('seed-edge'),JSON.stringify(seed()),1,new Date().toISOString()).run();template=(await call('seed-edge','/api/store')).data.state.employees[0];
 await test('distinct simultaneous zero quotes cannot queue multiple free periods',async()=>{
  await setup('free-edge');const p=await prepare('free-edge');assert.equal((await confirm('free-edge',p)).status,200);const d=await raw('free-edge');d.employees=[];await save('free-edge',d);
  const quotes=await Promise.all([quote('free-edge'),quote('free-edge'),quote('free-edge')]);const attempts=await Promise.all(quotes.map(x=>prep('free-edge',x.quoteId)));
  assert.equal(attempts.filter(x=>x.status===200).length,1,JSON.stringify(attempts));assert.ok(attempts.filter(x=>x.status!==200).every(x=>x.data.code==='NO_CHARGE_ACTIVE'));
  assert.equal((await q("SELECT count(*)::int n FROM payments WHERE owner=? AND provider='internal'",id('free-edge')).first()).n,1);
 });
 for(const state of ['missing','ready'])await test('pre-send confirmation loss recovers from supplier '+state,async()=>{
  const u='network-'+state;await setup(u);const p=await prepare(u);preSend=true;lookupStatus=state;const before=posts;
  assert.equal((await confirm(u,p)).status,202);assert.equal((await confirm(u,p)).status,200);assert.equal(posts-before,2);assert.equal(keys.at(-1),keys.at(-2));assert.equal((await raw(u))._account.lastOrderId,p.orderId);
 });
 await test('old uncertain confirmation never replays outside supplier idempotency window',async()=>{
  await setup('old-confirm');const p=await prepare('old-confirm');preSend=true;lookupStatus='missing';assert.equal((await confirm('old-confirm',p)).status,202);
  await q('UPDATE payments SET confirmation_started_at=? WHERE order_id=?',new Date(Date.now()-16*86400000).toISOString(),p.orderId).run();const before=posts;
  const r=await confirm('old-confirm',p);assert.equal(r.status,202);assert.equal(r.data.code,'PAYMENT_REVIEW_REQUIRED');assert.equal(posts,before);
 });
 await test('remaining prorated refund deducts all prior refunds',async()=>{
  const p={amount:10000,period_start:'2026-01-01T00:00:00Z',period_end:'2026-01-31T00:00:00Z',refunded_amount:1000},now=Date.parse('2026-01-16T00:00:00Z');
  assert.equal(refundFromPayment(p,now).refund,4000);assert.equal(refundFromPayment({...p,refunded_amount:5000},now).refund,0);assert.equal(refundFromPayment({...p,refunded_amount:8000},now).refund,0);
 });
 await test('purchasing Basic preserves remaining Pro trial and queues its month',async()=>{
  await setup('trial-edge');const d=await raw('trial-edge'),end=new Date(Date.now()+20*86400000).toISOString();d._account={...d._account,plan:'pro',status:'trialing',trialEndsAt:end};await save('trial-edge',d);
  const qr=await bill('trial-edge',{action:'quote',plan:'basic'}),p=(await prep('trial-edge',qr.data.quoteId)).data;assert.equal((await confirm('trial-edge',p)).status,200);
  const a=(await raw('trial-edge'))._account;assert.equal(a.status,'trialing');assert.equal(a.plan,'pro');assert.equal(a.trialEndsAt,end);assert.equal(a.pendingSubscription.periodStart,end);assert.equal((await call('trial-edge','/api/store')).data.qrRequired,true);
 });
 await test('full refund removes queued entitlement without moving later paid periods or cancel boundary',async()=>{
  await setup('refund-queue');const first=await prepare('refund-queue');await confirm('refund-queue',first);const second=await prepare('refund-queue');await confirm('refund-queue',second);const third=await prepare('refund-queue');await confirm('refund-queue',third);
  let d=await raw('refund-queue');const later=d._account.pendingSubscriptions[1];d._account.cancelAt=later.periodEnd;await save('refund-queue',d);
  const r=await bill('hq-edge',{action:'refund',requestId:crypto.randomUUID(),orderId:second.orderId,reason:'합성 예약 이용권 전액 환불'});assert.equal(r.status,200,JSON.stringify(r.data));d=await raw('refund-queue');
  assert.ok(!d._account.pendingSubscriptions.some(x=>x.orderId===second.orderId));assert.equal(d._account.pendingSubscription.orderId,third.orderId);assert.equal(d._account.pendingSubscription.periodStart,later.periodStart);assert.equal(d._account.cancelAt,later.periodEnd);
  assert.equal(activatePendingSubscription(d._account,Date.parse(later.periodStart)-1).lastOrderId,first.orderId);
  assert.equal(activatePendingSubscription(d._account,Date.parse(later.periodStart)).lastOrderId,third.orderId);
 });
 await test('coowner store/export/backup cannot retrieve billing snapshot or billing audit',async()=>{
  await setup('privacy-edge');const p=await prepare('privacy-edge');await confirm('privacy-edge',p);const d=await raw('privacy-edge');d._coowners=[{userId:id('co-edge'),email:'co-edge@example.com'}];await save('privacy-edge',d);
  await q('INSERT INTO store_backups(owner,week,data,bytes,created_at) VALUES(?,?,?,?,?)',id('privacy-edge'),'2026-10-05',JSON.stringify(d),JSON.stringify(d).length,new Date().toISOString()).run();
  for(const path of ['/api/store','/api/export','/api/export?backup=2026-10-05']){const r=await call('co-edge',path);assert.equal(r.status,200,JSON.stringify(r.data));const text=JSON.stringify(r.data);assert.ok(!text.includes('pricingSnapshot'),path);assert.ok(!text.includes('요금 결제'),path);assert.ok(!text.includes(p.orderId),path)}
  const owner=await call('privacy-edge','/api/export');assert.ok(JSON.stringify(owner.data).includes('pricingSnapshot'),'representative keeps billing in own export');
 });
 console.log(`Billing review regressions: ${passed} passed; ${failed} failed.`);if(failed)process.exitCode=1;
}finally{await closeAll()}
