import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seed} from '../lib/model.ts';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';
import {closeAll} from './test-db.mjs';
import {EMPLOYEE_PRICING_VERSION as VERSION} from '../lib/plans.ts';

const T=await authedTest({domain:'example.com'}),{q,headersFor,id}=T,env=T.env;
const call=async(user,path,body,method)=>{const r=await api(new Request('https://test.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://test.local',...await headersFor(user)},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}};
const account=(user,body)=>call(user,'/api/account',body);
const billing=(user,body)=>call(user,'/api/billing',body);
const raw=async user=>JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id(user)).first()).data);
const save=async(user,data)=>q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(data),id(user)).run();
const setup={action:'onboard',storeName:'합성 테스트 매장',branchName:'본점',ownerName:'합성 사장',plan:'basic',storeSlots:1,months:12,acknowledged:true,dpaAgreed:true};
let passed=0;
const ok=label=>{passed++;console.log('PASS: '+label)};

try{
 let r=await account('pricing',setup);assert.equal(r.status,201,JSON.stringify(r.data));
 assert.equal(r.data.account.pricingVersion,VERSION);
 assert.equal(r.data.account.storeSlots,50);assert.equal(r.data.account.months,1);
 assert.equal(r.data.account.nextQuote.count,0);assert.equal(r.data.account.nextQuote.amount,0);
 assert.equal(r.data.account.currentSubscription,null);ok('new account has employee pricing, monthly period, 50 stores and 0 employee estimate');
 // Real normalized employee fixture, synthetic identities only.
 await q('INSERT INTO stores VALUES(?,?,?,?)',id('seed'),JSON.stringify(seed()),1,new Date().toISOString()).run();
 const template=(await call('seed','/api/store')).data.state.employees[0];
 let d=await raw('pricing');
 d.employees=Array.from({length:7},(_,i)=>({...structuredClone(template),id:'pricing-e'+i,name:'합성 직원 '+i,status:i===5?'입사 준비':i===6?'퇴사':'재직'}));
 d._members=[{userId:id('staff'),employeeId:'pricing-e0'},{userId:id('staff'),employeeId:'pricing-e1'},{userId:id('pricing'),employeeId:'pricing-e2'}];
 d._account.billingTestEmployeeIds=['pricing-e3'];d._coowners=[{userId:id('coowner'),email:'coowner@example.com'}];
 await save('pricing',d);
 r=await account('pricing');assert.equal(r.data.account.nextQuote.count,2);assert.equal(r.data.account.nextQuote.amount,5800);
 assert.equal(r.data.account.nextQuote.excluded.length,5);ok('account estimate follows server employment, account deduplication, owner and test exclusions');
 const legacyEnd='2027-04-15T00:00:00.000Z',legacyStart='2026-10-15T00:00:00.000Z';
 d._account={plan:'pro',storeSlots:3,months:6,status:'active',periodPrice:107460,periodStart:legacyStart,paidUntil:legacyEnd,lastOrderId:'legacy-six'};
 await save('pricing',d);
 for(const months of [6,12])await q("INSERT INTO payments(id,owner,order_id,plan,store_slots,months,amount,status,period_start,period_end,created_at) VALUES(?,?,?,'pro',3,?,?,'paid',?,?,?)",'legacy-'+months,id('pricing'),'legacy-'+months,months,months===6?107460:191040,legacyStart,legacyEnd,legacyStart).run();
 // Applying the additive migration to populated legacy rows must preserve originals and remain repeatable.
 await T.sql.unsafe(readFileSync(new URL('../supabase/migrations/20261011110000_employee_pricing.sql',import.meta.url),'utf8'));
 const records=(await q('SELECT * FROM payments WHERE owner=? ORDER BY months',id('pricing')).all()).results;
 assert.deepEqual(records.map(p=>[p.months,p.amount,p.period_start,p.period_end,p.pricing_version,p.pricing_snapshot]),[[6,107460,legacyStart,legacyEnd,null,null],[12,191040,legacyStart,legacyEnd,null,null]]);
 ok('additive migration preserves legacy 6/12 month amounts and period bounds');
 const before=(await q('SELECT data,version FROM stores WHERE owner=?',id('pricing')).first());
 r=await account('pricing');assert.equal(r.data.account.periodPrice,107460);assert.equal(r.data.account.currentSubscription.amount,107460);assert.equal(r.data.account.currentSubscription.periodEnd,legacyEnd);assert.equal(r.data.account.currentSubscription.pricingVersion,null);
 assert.equal(r.data.account.nextQuote.amount,11700);assert.equal(r.data.account.pricingVersion,null);
 const after=await q('SELECT data,version FROM stores WHERE owner=?',id('pricing')).first();assert.equal(after.data,before.data);assert.equal(after.version,before.version);
 ok('legacy subscription shows original amount separately; reads never convert or extend it');
 r=await account('pricing',{action:'changePlan',plan:'basic',storeSlots:1,months:1});assert.equal(r.status,409);assert.equal(r.data.code,'PAID_SUBSCRIPTION_PROTECTED');assert.equal((await raw('pricing'))._account.paidUntil,legacyEnd);
 ok('direct plan change cannot overwrite a paid legacy subscription');
 await q("INSERT INTO billing_quotes(id,owner,pricing_version,snapshot,created_at,expires_at) VALUES(?,?,?,?::jsonb,?,?)",'schema-quote',id('pricing'),VERSION,JSON.stringify({count:3,amount:11700}),new Date().toISOString(),new Date(Date.now()+900000).toISOString()).run();
 const privacy=await q("SELECT relrowsecurity FROM pg_class WHERE oid='billing_quotes'::regclass").first();assert.equal(privacy.relrowsecurity,true);
 assert.equal((await q("SELECT has_table_privilege('anon','billing_quotes','SELECT') AS allowed").first()).allowed,false);
 assert.equal((await q("SELECT has_table_privilege('authenticated','billing_quotes','SELECT') AS allowed").first()).allowed,false);
 ok('quote snapshots are server-only with RLS and revoked public privileges');
 assert.equal((await account('staff')).data.account,null);
 assert.equal((await billing('staff',{action:'quote',plan:'basic'})).status,403);
 assert.equal((await billing('coowner',{action:'quote',plan:'basic'})).status,403);
 ok('staff and coowners cannot obtain billing quotes');
 console.log(`PASS: billing snapshots and legacy protection ${passed}/${passed}.`);
}finally{await closeAll()}
