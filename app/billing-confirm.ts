import {TOSS_API,tossAuth,validOrderId,validPaymentKey,tossErrorText} from '../lib/toss';
import {fulfillPlanOrder} from './billing-fulfill';
const json=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const pending=(p:any,approved=false)=>json({orderId:p.order_id,amount:p.amount,approved,fulfilled:false,code:approved?'FULFILLMENT_PENDING':'PAYMENT_CHECK_PENDING',message:approved?'결제는 승인됐어요. 같은 주문의 이용권 반영을 확인 중이에요. 다시 결제하지 마세요.':'같은 주문의 승인 상태를 확인 중이에요. 이 화면에서 다시 확인해 주세요. 새로 결제하지 마세요.'},202);
type Env={DB:D1Database,TOSS_SECRET_KEY?:string,TOSS_FETCH?:typeof fetch};

/** Persist uncertain confirmations, recover by order lookup, and fulfill exactly once. */
export async function confirmPayment(env:Env,owner:string,b:any){
 if(!validOrderId(b.orderId)||!validPaymentKey(b.paymentKey))return json({error:'결제 주문번호와 인증 정보를 확인해 주세요.'},400);
 let p=await env.DB.prepare('SELECT * FROM payments WHERE order_id=? AND owner=?').bind(b.orderId,owner).first<any>();
 if(!p)return json({error:'주문을 찾을 수 없어요.'},404);
 if(!['ready','confirming','paid','no_charge'].includes(p.status))return json({error:'종료된 주문이에요. 계정 화면에서 내역을 확인해 주세요.'},409);
 if(Number(b.amount)!==p.amount){if(!p.pricing_version&&p.status==='ready')await env.DB.prepare("UPDATE payments SET status='failed',fail_reason='금액 불일치' WHERE order_id=? AND status='ready'").bind(p.order_id).run();return json({error:'주문 금액과 달라 승인하지 않았어요.'},400)}
 if(p.payment_key&&p.payment_key!==b.paymentKey)return json({error:'기존 주문의 결제 인증 정보와 달라요.'},400);
 const finish=async(already:boolean)=>{
  if(p.kind==='contracts')return json({ok:true,already,orderId:p.order_id,amount:p.amount,receiptUrl:p.receipt_url,fulfilled:true});
  try{const result=await fulfillPlanOrder(env.DB,p.order_id);return json({ok:true,already,orderId:p.order_id,amount:p.amount,receiptUrl:p.receipt_url,fulfilled:true,paidUntil:result.periodEnd})}catch{return pending(p,true)}
 };
 if(['paid','no_charge'].includes(p.status))return finish(true);
 const claimed=await env.DB.prepare("UPDATE payments SET status='confirming',payment_key=? WHERE order_id=? AND status='ready'").bind(b.paymentKey,p.order_id).run();
 const call=env.TOSS_FETCH||fetch,headers={Authorization:tossAuth(env.TOSS_SECRET_KEY!),'Content-Type':'application/json'};
 let response:Response,details:any;
 try{
  if(claimed.meta.changes){
   response=await call(`${TOSS_API}/v1/payments/confirm`,{method:'POST',headers:{...headers,'Idempotency-Key':'confirm-'+p.order_id},body:JSON.stringify({paymentKey:b.paymentKey,orderId:p.order_id,amount:p.amount})});
   details=await response.json().catch(()=>({}));
   if(details.code==='IDEMPOTENT_REQUEST_PROCESSING'||[408,429].includes(response.status))return pending(p);
   if(!response.ok&&details.code!=='ALREADY_PROCESSED_PAYMENT'){
    // Only explicit supplier declines are terminal. Timeouts/server errors remain recoverable.
    if(response.status>=400&&response.status<500){await env.DB.prepare("UPDATE payments SET status='failed',fail_reason=? WHERE order_id=? AND status='confirming'").bind(String(details.code||'TOSS_DECLINED').slice(0,60),p.order_id).run();return json({error:tossErrorText(details.code,details.message),code:details.code||'TOSS_DECLINED'},402)}
    return pending(p);
   }
   if(!response.ok){response=await call(`${TOSS_API}/v1/payments/orders/${encodeURIComponent(p.order_id)}`,{method:'GET',headers});details=await response.json().catch(()=>({}))}
  }else{
   p=await env.DB.prepare('SELECT * FROM payments WHERE order_id=? AND owner=?').bind(b.orderId,owner).first<any>();
   if(['paid','no_charge'].includes(p.status))return finish(true);
   if(p.status!=='confirming')return json({error:'종료된 주문이에요. 내역을 확인해 주세요.'},409);
   response=await call(`${TOSS_API}/v1/payments/orders/${encodeURIComponent(p.order_id)}`,{method:'GET',headers});details=await response.json().catch(()=>({}));
  }
 }catch{return pending(p)}
 if(!response.ok||details.status!=='DONE'||details.orderId!==p.order_id||details.paymentKey!==b.paymentKey||Number(details.totalAmount)!==p.amount||!Number.isFinite(Date.parse(details.approvedAt||'')))return pending(p);
 try{
  await env.DB.prepare("UPDATE payments SET status='paid',payment_key=?,method=?,receipt_url=?,paid_at=? WHERE order_id=? AND status='confirming'").bind(b.paymentKey,String(details.method||'').slice(0,20),details.receipt?.url||null,new Date(details.approvedAt).toISOString(),p.order_id).run();
  p.receipt_url=details.receipt?.url||null;
 }catch{return pending(p,true)}
 return finish(false);
}
