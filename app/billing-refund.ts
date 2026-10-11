import {billingDatabase,BillingError} from './billing-quotes';
import {TOSS_API,tossAuth,validOrderId,tossErrorText} from '../lib/toss';
const json=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
type Env={DB:D1Database,TOSS_SECRET_KEY?:string,TOSS_FETCH?:typeof fetch};
export async function refundPayment(env:Env,b:any){
 if(!validOrderId(b.orderId)||typeof b.requestId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(b.requestId))throw new BillingError('REFUND_REQUEST_REQUIRED','주문번호와 환불 요청을 다시 확인해 주세요.',400);
 const pg=billingDatabase(env.DB),now=new Date().toISOString();
 const intent=await pg.transaction(async tx=>{
  const p=await tx.prepare('SELECT * FROM payments WHERE order_id=? FOR UPDATE').bind(b.orderId).first<any>();
  if(!p)throw new BillingError('PAYMENT_NOT_FOUND','결제를 찾을 수 없어요.',400);
  const previous=await tx.prepare('SELECT * FROM payment_refunds WHERE id=?').bind(b.requestId).first<any>();
  if(previous){if(previous.order_id!==p.order_id||b.amount!==undefined&&b.amount!==previous.amount)throw new BillingError('REFUND_PENDING','이미 저장된 환불 요청의 금액과 주문을 유지해 주세요.');return previous}
  if(!['paid','partial_refund'].includes(p.status)||!p.payment_key)throw new BillingError('NOT_REFUNDABLE','환불할 수 있는 결제가 아니에요.',400);
  const left=p.amount-(p.refunded_amount||0),amount=b.amount===undefined?left:b.amount,reason=String(b.reason||'').trim().slice(0,200);
  if(typeof amount!=='number'||!Number.isInteger(amount)||amount<1||amount>left)throw new BillingError('INVALID_REFUND_AMOUNT',`환불 금액은 1원~${left.toLocaleString('ko-KR')}원 사이로 넣어 주세요.`,400);
  if(!reason)throw new BillingError('REFUND_REASON_REQUIRED','환불 사유를 적어 주세요.',400);
  if(await tx.prepare("SELECT id FROM payment_refunds WHERE order_id=? AND status='pending'").bind(p.order_id).first())throw new BillingError('REFUND_PENDING','이 주문의 이전 환불 확인이 끝나야 새 환불을 할 수 있어요.');
  await tx.prepare("INSERT INTO payment_refunds(id,order_id,amount,previous_refunded,reason,status,created_at) VALUES(?,?,?,?,?,'pending',?)").bind(b.requestId,p.order_id,amount,p.refunded_amount||0,reason,now).run();
  return {id:b.requestId,order_id:p.order_id,amount,previous_refunded:p.refunded_amount||0,reason,status:'pending',created_at:now};
 });
 return pg.transaction(async tx=>{
  const p=await tx.prepare('SELECT * FROM payments WHERE order_id=? FOR UPDATE').bind(intent.order_id).first<any>();
  const current=await tx.prepare('SELECT * FROM payment_refunds WHERE id=? FOR UPDATE').bind(intent.id).first<any>();
  const refunded=current.previous_refunded+current.amount,result={ok:true,refunded,status:refunded>=p.amount?'refunded':'partial_refund'};
  if(current.status==='complete')return json({...result,already:true});
  if(current.status!=='pending')throw new BillingError('REFUND_CLOSED','종료된 환불 요청이에요. 처리 내역을 확인해 주세요.');
  const pending=(code='REFUND_PENDING')=>json({code,message:'기존 환불 요청의 처리 상태를 확인 중이에요. 같은 요청으로 다시 확인해 주세요.',requestId:current.id},202);
  // Supplier idempotency expires after 15 days. Never replay an uncertain refund beyond that window.
  if(Date.now()-Date.parse(current.created_at)>14*86400000)return pending('REFUND_REVIEW_REQUIRED');
  const call=env.TOSS_FETCH||fetch;let response:Response,details:any;
  try{response=await call(`${TOSS_API}/v1/payments/${encodeURIComponent(p.payment_key)}/cancel`,{method:'POST',headers:{Authorization:tossAuth(env.TOSS_SECRET_KEY!),'Content-Type':'application/json','Idempotency-Key':current.id},body:JSON.stringify({cancelReason:current.reason,cancelAmount:current.amount})});details=await response.json().catch(()=>({}))}catch{return pending()}
  if(!response.ok){
   if(response.status>=400&&response.status<500&&![408,429].includes(response.status)&&details.code!=='IDEMPOTENT_REQUEST_PROCESSING'){await tx.prepare("UPDATE payment_refunds SET status='failed' WHERE id=?").bind(current.id).run();return json({error:tossErrorText(details.code,details.message),code:details.code||'TOSS_ERROR'},502)}
   return pending();
  }
  if(!['CANCELED','PARTIAL_CANCELED'].includes(details.status)||details.orderId&&details.orderId!==p.order_id)return pending();
  if(p.refunded_amount!==current.previous_refunded)throw Error('Refund ledger conflict');
  if(result.status==='refunded'&&p.kind==='plan'&&p.pricing_version){
   const row=await tx.prepare('SELECT data FROM stores WHERE owner=? FOR UPDATE').bind(p.owner).first<any>();
   if(!row)throw Error('Refund entitlement store missing');
   const data=JSON.parse(row.data),a=data._account,queue=a.pendingSubscriptions||[a.pendingSubscription].filter(Boolean),remaining=queue.filter((x:any)=>x.orderId!==p.order_id);
   if(remaining.length){a.pendingSubscriptions=remaining;a.pendingSubscription=remaining[0]}else{delete a.pendingSubscriptions;delete a.pendingSubscription}
   if(a.lastOrderId===p.order_id){a.status='cancelled';a.paidUntil=now}
   const lastEnd=Date.parse(remaining.at(-1)?.periodEnd||a.paidUntil||a.trialEndsAt||'');
   if(a.cancelAt&&Number.isFinite(lastEnd)&&Date.parse(a.cancelAt)>lastEnd)a.cancelAt=new Date(lastEnd).toISOString();
   data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:now,actor:{name:'본사 관리자'},action:'요금 환불',target:p.order_id,before:null,after:{amount:refunded},reason:current.reason}].slice(-1000);
   await tx.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=?').bind(JSON.stringify(data),now,p.owner).run();
  }
  await tx.prepare('UPDATE payments SET refunded_amount=?,status=? WHERE order_id=?').bind(refunded,result.status,p.order_id).run();
  await tx.prepare("UPDATE payment_refunds SET status='complete',completed_at=? WHERE id=?").bind(now,current.id).run();return json(result);
 });
}
