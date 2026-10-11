import {billableEmployees,employeePrice,EMPLOYEE_PRICE,EMPLOYEE_PRICING_VERSION,createPricingSnapshot,isPlan,plans,MAX_BRANCHES,type PlanId,type PricingSnapshot} from '../lib/plans';
import type {PgD1} from '../lib/pg-d1';
import {newOrderId} from '../lib/toss';

export class BillingError extends Error{
 constructor(public code:string,message:string,public status=409){super(message)}
}
export const billingDatabase=(db:D1Database)=>{const pg=db as unknown as PgD1;if(typeof pg.transaction!=='function')throw Error('Billing requires transactional PostgreSQL');return pg};
const quoteContext=(a:any)=>({plan:a?.plan||null,pricingVersion:a?.pricingVersion||null,paidUntil:a?.paidUntil||null,lastOrderId:a?.lastOrderId||null,status:a?.status||null,trialEndsAt:a?.trialEndsAt||null});
const activeNoCharge=async(db:D1Database|PgD1,owner:string,now:number)=>!!await db.prepare("SELECT order_id FROM payments WHERE owner=? AND pricing_version=? AND kind='plan' AND status='no_charge' AND (fulfilled_at IS NULL OR period_end>?) LIMIT 1").bind(owner,EMPLOYEE_PRICING_VERSION,new Date(now).toISOString()).first();

export function billingInput(ownerId:string,data:any){
 return {ownerId,employees:data.employees||[],members:data._members||[],testEmployeeIds:data._account?.billingTestEmployeeIds||[]};
}
/** Original paid period, independent of today's employee count or pricing table. */
export function currentSubscription(account:any){
 if(!account?.periodStart||!account?.paidUntil)return null;
 return {plan:account.plan,amount:account.periodPrice??null,periodStart:account.periodStart,periodEnd:account.paidUntil,months:account.months||1,pricingVersion:account.pricingVersion||null,snapshot:account.pricingSnapshot||null,orderId:account.lastOrderId||null};
}
export function nextEmployeeEstimate(ownerId:string,data:any,plan:PlanId){
 const count=billableEmployees(billingInput(ownerId,data));
 return {pricingVersion:EMPLOYEE_PRICING_VERSION,plan,unitPrice:EMPLOYEE_PRICE[plan],count:count.count,amount:employeePrice(plan,count.count),months:1,vatIncluded:true,excluded:count.excluded};
}

export async function createBillingQuote(db:D1Database,owner:string,plan:unknown,now=Date.now()){
 if(!isPlan(plan))throw new BillingError('INVALID_PLAN','베이직·프로 중에서 골라 주세요.',400);
 const row=await db.prepare('SELECT data FROM stores WHERE owner=?').bind(owner).first<any>();
 if(!row)throw new BillingError('STORE_NOT_FOUND','매장을 찾을 수 없어요.',404);
 const data=JSON.parse(row.data),snapshot=await createPricingSnapshot({...billingInput(owner,data),plan,countedAt:new Date(now).toISOString()});
 const quoteId=crypto.randomUUID(),expiresAt=new Date(now+15*60000).toISOString();
 await db.prepare('INSERT INTO billing_quotes(id,owner,pricing_version,snapshot,context,created_at,expires_at) VALUES(?,?,?,?::text::jsonb,?::text::jsonb,?,?)').bind(quoteId,owner,EMPLOYEE_PRICING_VERSION,JSON.stringify(snapshot),JSON.stringify(quoteContext(data._account)),snapshot.countedAt,expiresAt).run();
 const excluded=new Map(snapshot.excluded.map(e=>[e.employeeId,e.reason]));
 return {quoteId,expiresAt,snapshot,noChargeActive:snapshot.amount===0&&await activeNoCharge(db,owner,now),requiresConversionConsent:data._account?.pricingVersion!==EMPLOYEE_PRICING_VERSION,currentSubscription:currentSubscription(data._account),employees:(data.employees||[]).map((e:any)=>({id:e.id,name:e.name,branch:(data.branches||[]).find((b:any)=>b.id===e.branchId)?.name||'',included:!excluded.has(e.id),reason:excluded.get(e.id)||null}))};
}

export async function prepareBillingQuote(db:D1Database,owner:string,b:any,ready:boolean,now=Date.now()){
 if(b.agreed!==true)throw new BillingError('AGREEMENT_REQUIRED','이용약관과 해지·환불 규정에 동의해 주세요.',400);
 if(typeof b.quoteId!=='string'||b.quoteId.length>100)throw new BillingError('QUOTE_REQUIRED','직원 수와 금액을 다시 확인해 주세요.',400);
 return billingDatabase(db).transaction(async tx=>{
  const store=await tx.prepare('SELECT data FROM stores WHERE owner=? FOR UPDATE').bind(owner).first<any>();
  if(!store)throw new BillingError('STORE_NOT_FOUND','매장을 찾을 수 없어요.',404);
  const q=await tx.prepare('SELECT * FROM billing_quotes WHERE id=? AND owner=? FOR UPDATE').bind(b.quoteId,owner).first<any>();
  if(!q)throw new BillingError('QUOTE_NOT_FOUND','내 견적을 찾을 수 없어요. 다시 확인해 주세요.',404);
  if(q.order_id){
   const p=await tx.prepare('SELECT * FROM payments WHERE order_id=? AND owner=?').bind(q.order_id,owner).first<any>();
   if(!p||!['ready','confirming','paid','no_charge'].includes(p.status))throw new BillingError('ORDER_CLOSED','종료된 주문이에요. 새 견적을 확인해 주세요.');
   return orderView(p);
  }
  if(Date.parse(q.expires_at)<=now)throw new BillingError('QUOTE_EXPIRED','견적 확인 시간이 지났어요. 현재 직원 수로 다시 확인해 주세요.',410);
  const data=JSON.parse(store.data),snapshot=q.snapshot as PricingSnapshot;
  const fresh=await createPricingSnapshot({...billingInput(owner,data),plan:snapshot.plan,countedAt:new Date(now).toISOString()}),context=quoteContext(data._account);
  if(q.pricing_version!==EMPLOYEE_PRICING_VERSION||snapshot.version!==EMPLOYEE_PRICING_VERSION||snapshot.identityDigest!==fresh.identityDigest||snapshot.amount!==fresh.amount||Object.entries(context).some(([key,value])=>q.context[key]!==value))throw new BillingError('QUOTE_CHANGED','직원 또는 이용권 정보가 바뀌었어요. 새 견적을 확인해 주세요.');
  if(data._account?.pricingVersion!==EMPLOYEE_PRICING_VERSION&&b.convertPricing!==true)throw new BillingError('PRICING_CONSENT_REQUIRED','기존 이용권을 유지한 채 다음 기간부터 직원당 요금으로 전환하는 데 동의해 주세요.');
  if(snapshot.amount===0&&await activeNoCharge(tx,owner,now))throw new BillingError('NO_CHARGE_ACTIVE','청구 없는 이용 기간이 이미 준비되어 있거나 이용 중이에요. 그 기간이 끝나면 현재 직원 수로 다시 확인해 주세요.');
  if(snapshot.amount>0&&!ready)throw new BillingError('BILLING_NOT_READY','결제 연결을 준비하고 있어요. 지금은 결제되지 않아요.',503);
  const orderId=newOrderId('plan'),status=snapshot.amount===0?'no_charge':'ready',provider=snapshot.amount===0?'internal':'toss';
  await tx.prepare("INSERT INTO payments(id,owner,order_id,plan,store_slots,months,amount,status,provider,created_at,kind,pricing_version,pricing_snapshot) VALUES(?,?,?,?,?,1,?,?,?,?, 'plan',?,?::text::jsonb)").bind(crypto.randomUUID(),owner,orderId,snapshot.plan,MAX_BRANCHES,snapshot.amount,status,provider,new Date(now).toISOString(),EMPLOYEE_PRICING_VERSION,JSON.stringify(snapshot)).run();
  await tx.prepare('UPDATE billing_quotes SET order_id=? WHERE id=?').bind(orderId,q.id).run();
  return orderView({order_id:orderId,amount:snapshot.amount,plan:snapshot.plan,pricing_snapshot:snapshot,status});
 });
}
function orderView(p:any){return {orderId:p.order_id,amount:p.amount,noCharge:p.amount===0,orderName:`척척사장 ${plans[p.plan as PlanId].name} 직원 ${p.pricing_snapshot.count}명 1개월`,status:p.status}}
