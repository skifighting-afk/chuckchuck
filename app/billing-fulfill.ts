import {billingDatabase,BillingError} from './billing-quotes';
import {applyPricingPaid} from '../lib/toss';

/** Payment and entitlement commit together; row locks serialize retries and concurrent confirms. */
export async function fulfillPlanOrder(db:D1Database,orderId:string,now=Date.now()){
 return billingDatabase(db).transaction(async tx=>{
  const p=await tx.prepare('SELECT * FROM payments WHERE order_id=? FOR UPDATE').bind(orderId).first<any>();
  if(!p||p.kind!=='plan'||!['paid','no_charge'].includes(p.status))throw new BillingError('ORDER_NOT_APPROVED','승인 상태를 먼저 확인해 주세요.');
  if(p.fulfilled_at)return {fulfilled:true,periodStart:p.period_start,periodEnd:p.period_end};
  const row=await tx.prepare('SELECT data FROM stores WHERE owner=? FOR UPDATE').bind(p.owner).first<any>();
  if(!row)throw new BillingError('STORE_NOT_FOUND','결제는 확인됐지만 매장을 찾을 수 없어요. 고객센터에 주문번호를 알려 주세요.');
  const data=JSON.parse(row.data),applied=applyPricingPaid(data._account,{snapshot:p.pricing_snapshot,orderId:p.order_id},Date.parse(p.paid_at||'')||now);
  data._account=applied.account;
  data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:new Date(now).toISOString(),actor:{id:p.owner,name:'사장님'},action:p.amount===0?'청구 없이 이용 시작':'요금 결제',target:p.order_id,before:null,after:{amount:p.amount,plan:p.plan,count:p.pricing_snapshot.count},reason:'서버 견적 기준'}].slice(-1000);
  await tx.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=?').bind(JSON.stringify(data),new Date(now).toISOString(),p.owner).run();
  await tx.prepare('UPDATE payments SET period_start=?,period_end=?,fulfilled_at=? WHERE order_id=?').bind(applied.periodStart,applied.periodEnd,new Date(now).toISOString(),p.order_id).run();
  return {fulfilled:true,periodStart:applied.periodStart,periodEnd:applied.periodEnd};
 });
}
