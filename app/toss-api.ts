// 토스페이먼츠 결제: /api/billing
// GET  : 결제 준비 여부(클라이언트 키), 전자계약 요금 낼 달
// POST prepare : 서버가 금액을 계산해 '결제 대기' 주문을 만든다(요금제·지점·기간 또는 전자계약 달)
// POST confirm : 결제창에서 돌아오면 금액을 다시 맞춰 보고 토스 승인 API를 부른다 → 결제 기록·이용 상태 반영
// POST refund  : 본사만, 토스 취소 API로 환불(전액·부분)
// 키는 GitHub Secrets(TOSS_CLIENT_KEY·TOSS_SECRET_KEY)에서 서버 함수 비밀값으로만 들어온다. 키가 없으면 결제하기가 잠긴다.
import {resolveStore} from './saas-api';
import {isHQ} from './admin-api';
import {serverError} from '../lib/errors';
import {BillingError,createBillingQuote,prepareBillingQuote} from './billing-quotes';
import {fulfillPlanOrder} from './billing-fulfill';
import {confirmPayment} from './billing-confirm';
import {refundPayment} from './billing-refund';
import {planId,periodPrice,MAX_BRANCHES,CONTRACT_EXTRA_PRICE,plans,EMPLOYEE_PRICING_VERSION,type PlanId} from '../lib/plans';
import {TOSS_API,tossAuth,newOrderId,validOrderId,validPaymentKey,applyPlanPaid,contractsDue,tossErrorText} from '../lib/toss';

type Env={DB:D1Database,TOSS_CLIENT_KEY?:string,TOSS_SECRET_KEY?:string,TOSS_FETCH?:typeof fetch,HQ_ADMIN_EMAIL?:string,HQ_NATIVE_USER_ID?:string};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const kMonth=(ms:number)=>new Date(ms+9*3600000).toISOString().slice(0,7);
const monthStartIso=(m:string)=>new Date(Date.parse(m+'-01T00:00:00+09:00')).toISOString();
const nextMonth=(m:string)=>{const [y,mo]=m.split('-').map(Number);return new Date(Date.UTC(y,mo,1)).toISOString().slice(0,7)};

async function contractsByMonth(env:Env,owner:string,months:string[]){
 const signed:Record<string,number>={},paid:Record<string,number>={};
 for(const m of months){
  signed[m]=Number((await env.DB.prepare("SELECT count(*)::int AS n FROM contract_envelopes WHERE owner_id=? AND status='signed' AND completed_at>=? AND completed_at<?").bind(owner,monthStartIso(m),monthStartIso(nextMonth(m))).first<any>())?.n||0);
  paid[m]=Number((await env.DB.prepare("SELECT coalesce(sum(store_slots),0)::int AS n FROM payments WHERE owner=? AND kind='contracts' AND period_start=? AND status IN ('paid','partial_refund')").bind(owner,m).first<any>())?.n||0);
 }
 return contractsDue(signed,paid,CONTRACT_EXTRA_PRICE);
}

export async function tossApi(request:Request,env:Env){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 const url=new URL(request.url),ready=!!(env.TOSS_CLIENT_KEY&&env.TOSS_SECRET_KEY),call=env.TOSS_FETCH||fetch;
 try{
  if(request.method==='GET'){
   const linked=await resolveStore(env.DB,user);if(!linked||linked.access!=='owner'||linked.coowner)return json({ready:false,clientKey:null,contracts:[]});
   const now=Date.now(),cur=kMonth(now),months=[cur,kMonth(Date.parse(cur+'-01T00:00:00Z')-86400000),kMonth(Date.parse(cur+'-01T00:00:00Z')-40*86400000)];
   return json({ready,clientKey:ready?env.TOSS_CLIENT_KEY:null,customerKey:'cc_'+(await hash(linked.owner)).slice(0,40),contracts:(await contractsByMonth(env,linked.owner,months)).filter(x=>x.count)});
  }
  if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({error:'척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
  const b:any=await request.json().catch(()=>({}));

  if(b.action==='refund'){// 본사만
   if(!isHQ(request,env as any))return json({error:'환불은 본사 관리자만 할 수 있어요. 본사 계정으로 로그인해 주세요.'},403);
   if(!ready)return json({error:'결제가 아직 연결되지 않았어요. 토스페이먼츠 키를 넣은 뒤 다시 시도해 주세요.',code:'BILLING_NOT_READY'},503);
   return await refundPayment(env,b);
  }

  const linked=await resolveStore(env.DB,user);if(!linked||linked.access!=='owner'||linked.coowner)return json({error:'결제는 가게 대표 계정에서만 할 수 있어요.'},403);
  if(b.action==='quote')return json(await createBillingQuote(env.DB,linked.owner,b.plan));
  if(b.action==='prepare'&&b.kind!=='contracts'&&b.quoteId){
   const order=await prepareBillingQuote(env.DB,linked.owner,b,ready);
   const fulfillment=order.noCharge?await fulfillPlanOrder(env.DB,order.orderId):null;
   return json({...order,...(fulfillment?{paidUntil:fulfillment.periodEnd}:{}),clientKey:ready?env.TOSS_CLIENT_KEY:null,customerKey:'cc_'+(await hash(linked.owner)).slice(0,40)});
  }
  if(!ready)return json({error:'아직 결제를 받지 않아요. 지금은 무료·체험으로 계속 이용하시면 돼요.',code:'BILLING_NOT_READY'},503);
  const owner=linked.owner,nowIso=new Date().toISOString();

  if(b.action==='prepare'){
   if(b.kind!=='contracts'&&JSON.parse(linked.row.data)._account?.pricingVersion===EMPLOYEE_PRICING_VERSION)throw new BillingError('QUOTE_REQUIRED','현재 직원 수와 금액을 먼저 확인해 주세요.',400);
   let kind:'plan'|'contracts',amount:number,orderName:string,plan='contracts',slots=0,months=0,periodStart:string|null=null;
   if(b.kind==='contracts'){
    if(!/^\d{4}-\d{2}$/.test(String(b.month||'')))return json({error:'결제할 달을 골라 주세요.'},400);
    const [due]=await contractsByMonth(env,owner,[b.month]);if(!due?.due)return json({error:'이 달에는 낼 전자계약 요금이 없어요. 계정·요금제 화면을 새로고침해 낼 달을 다시 확인해 주세요.'},400);
    kind='contracts';amount=due.amount;slots=due.due;periodStart=b.month;orderName=`전자근로계약서 ${due.due}건 (${Number(b.month.slice(5))}월)`;
   }else{
    const p=planId(b.plan) as PlanId|null,n=Math.floor(Number(b.storeSlots)),m=Number(b.months);
    if(!p)return json({error:'요금제를 골라 주세요.'},400);if(!Number.isInteger(n)||n<1||n>MAX_BRANCHES)return json({error:`지점 수를 1~${MAX_BRANCHES} 사이로 골라 주세요.`},400);if(![1,6,12].includes(m))return json({error:'이용 기간을 1·6·12개월 중에서 골라 주세요.'},400);
    kind='plan';plan=p;slots=n;months=m;amount=periodPrice(p,n,m as 1|6|12);orderName=`척척사장 ${plans[p].name} ${n}지점 ${m}개월`;
   }
   if(b.agreed!==true)return json({error:'이용약관과 해지·환불 규정에 동의해 주세요.'},400);
   const orderId=newOrderId(kind);
   await env.DB.prepare("INSERT INTO payments(id,owner,order_id,plan,store_slots,months,amount,status,provider,period_start,created_at,kind) VALUES(?,?,?,?,?,?,?,'ready','toss',?,?,?)").bind(crypto.randomUUID(),owner,orderId,plan,slots,months,amount,periodStart,nowIso,kind).run();
   return json({orderId,amount,orderName,clientKey:env.TOSS_CLIENT_KEY,customerKey:'cc_'+(await hash(owner)).slice(0,40)});
  }

  if(b.action==='confirm')return await confirmPayment(env,owner,b);

  if(b.action==='abandon'){// 결제창에서 그만두면 대기 주문을 닫는다
   if(!validOrderId(b.orderId))return json({ok:true});
   await env.DB.prepare("UPDATE payments SET status='cancelled',fail_reason=? WHERE order_id=? AND owner=? AND status='ready'").bind(String(b.code||'사용자 취소').slice(0,60),b.orderId,owner).run();return json({ok:true});
  }
  return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 }catch(e){if(e instanceof BillingError)return json({error:e.message,code:e.code},e.status);return serverError('billing',e,'결제를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요. 돈이 빠져나갔다면 문의하기 → 요금·결제로 알려 주세요.')}
}
async function hash(s:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('toss-customer:'+s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}
