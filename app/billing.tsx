'use client';
import {CANCEL_REASONS} from '../lib/improve2';
// 작업 065·067·068·069: 체험 종료 안내, 환불·차액 안내, 세금계산서 정보와 발행 요청
import {useEffect,useState} from 'react';
import {changeQuote,refundQuote,validBizNo,monthlyPrice,periodPrice,plans,planId,EMPLOYEE_PRICE,type PlanId} from '../lib/plans';
const won=(n:number)=>n.toLocaleString('ko-KR');
const post=async(body:any)=>{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d:any=await r.json();if(!r.ok)throw Error(d.error||'저장하지 못했어요.');return d};
export function TrialBanner({account}:{account:any}){
 // 지시서 143: 결제 실패 유예 기간 안내(그동안은 그대로 쓸 수 있어요)
 if(typeof account?.graceLeft==='number')return <div className="trial-banner 1d" role="alert">정기 결제가 되지 않았어요. {account.graceLeft>0?`${account.graceLeft}일 동안은 그대로 쓸 수 있어요.`:'지금은 조회·내려받기만 돼요.'} 카드를 확인하거나 결제 수단을 바꿔 주세요. <a href="/account#checkout-title">결제 수단 확인 →</a></div>;
 const n=account?.notice;if(!n?.level)return null;
 const text=n.level==='ended'?'무료 체험이 끝났어요. 기록 조회와 내려받기는 계속 돼요.':n.level==='1d'?'무료 체험이 내일 끝나요.':`무료 체험이 ${n.daysLeft}일 남았어요.`;
 return <div className={'trial-banner '+n.level} role="status">{text} 자동으로 결제되지 않아요. {!(window as any).Capacitor?.isNativePlatform?.()&&<a href="/account#checkout-title">결제하기 →</a>}</div>
}
export function PlanChangeQuote({a,plan,branches,months}:{a:any,plan:PlanId,branches:number,months:1|6|12}){
 if(a.status!=='active'||!a.periodStart)return <p className="saas-fine">{a.status==='trialing'?'체험 중에는 차액 없이 바로 바뀌어요.':'결제를 연결하기 전이라 차액이 청구되지 않아요.'}</p>;
 const q=changeQuote({plan:a.plan,slots:a.storeSlots,months:a.months},{plan,slots:branches,months},a.periodStart);
 return <p className="saas-fine">이번 이용 기간({q.periodEnd}까지) 남은 {q.daysLeft}일 기준 {q.diff>0?`추가 ${won(q.diff)}원`:q.diff<0?`다음 결제에서 ${won(-q.diff)}원 차감`:'차액 없음'} (예상 · VAT 포함)</p>
}
export function RefundEstimate({a}:{a:any}){
 if(a.status!=='active'||!a.periodStart)return null;const q=a.refundEstimate;if(!q)return null;
 return <div className="usage-line"><span>지금 해지하면 환불 예상</span><b title={q.formula}>{won(q.refund)}원</b></div>
}
export function TaxInvoice({a,reload}:{a:any,reload:()=>Promise<void>}){
 const b=a.billing||{},[f,setF]=useState({bizNo:b.bizNo||'',company:b.company||'',ceo:b.ceo||'',email:b.email||'',address:b.address||'',bizType:b.bizType||'',bizItem:b.bizItem||''}),[month,setMonth]=useState(new Date().toISOString().slice(0,7)),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const run=async(body:any,done:string)=>{setBusy(true);setErr('');setMsg('');try{await post(body);await reload();setMsg(done)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 const bizOk=validBizNo(f.bizNo),field=(k:keyof typeof f,label:string,extra:any={})=><label className="saas-field">{label}<input value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} {...extra}/></label>;
 return <section className="auth-card t-gap tax-invoice"><h2>세금계산서 정보</h2><p className="saas-fine">결제를 연결하면 이 정보로 세금계산서를 발행해요. 지금은 요청만 기록돼요.</p>
  <div className="tax-grid">{field('bizNo','사업자등록번호',{inputMode:'numeric',placeholder:'000-00-00000',maxLength:12})}{field('company','상호',{maxLength:100})}{field('ceo','대표자',{maxLength:50})}{field('email','받을 이메일',{type:'email',maxLength:200})}{field('bizType','업태 (선택)',{maxLength:50})}{field('bizItem','종목 (선택)',{maxLength:50})}{field('address','사업장 주소 (선택)',{maxLength:300})}</div>
  {f.bizNo&&!bizOk&&<p className="saas-error">사업자등록번호를 다시 확인해 주세요.</p>}
  <button className="saas-primary" disabled={busy||!bizOk||!f.company.trim()||!f.ceo.trim()||!f.email.includes('@')} onClick={()=>run({action:'billingInfo',...f},'사업자 정보를 저장했어요.')}>사업자 정보 저장</button>
  {a.billing&&<div className="t-wrapactions t-gap"><label className="saas-field">발행받을 달<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button className="saas-secondary" disabled={busy} onClick={()=>run({action:'taxInvoiceRequest',month},month+' 세금계산서 발행을 요청했어요.')}>발행 요청</button></div>}
  {err&&<p className="saas-error" role="alert">{err}</p>}{msg&&<p className="saas-success" role="status">{msg}</p>}
  {a.invoiceRequests?.length>0&&<ul className="invoice-list">{a.invoiceRequests.slice().reverse().map((r:any)=><li key={r.id}>{r.month} · {r.status} · {new Date(r.at).toLocaleDateString('ko-KR')}</li>)}</ul>}
 </section>
}
/** 작업 066: 가격·약관 변경 고지와 동의 */
export function ServiceNotices({notices}:{notices?:any[]}){
 const [done,setDone]=useState<string[]>([]),[err,setErr]=useState('');
 const list=(notices||[]).filter(n=>!n.agreedAt&&!done.includes(n.id));if(!list.length)return null;
 return <div className="service-notice" role="status">{list.map(n=><details key={n.id}><summary><b>{n.kind} 변경 안내</b> · {n.title} · {n.effectiveAt}부터</summary><p>{n.body}</p><p className="saas-fine">시행일 전에 동의하지 않으시면 언제든 해지하실 수 있어요. 해지해도 기록 내려받기는 계속 돼요.</p><button className="saas-primary" onClick={async()=>{setErr('');try{await post({action:'agreeNotice',id:n.id});setDone([...done,n.id])}catch(e){setErr((e as Error).message)}}}>내용을 확인했고 동의해요</button></details>)}{err&&<p className="saas-error" role="alert">{err}</p>}</div>
}
/** 작업 064: 결제 내역·영수증 */
export function PaymentHistory({payments,reload}:{payments?:any[],reload?:()=>Promise<void>}){
 const [busy,setBusy]=useState(''),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const status:Record<string,string>={ready:'결제 대기',confirming:'승인 확인 중',paid:'결제 완료',no_charge:'청구 없음',cancelled:'취소',refunded:'환불 완료',partial_refund:'부분 환불',failed:'승인 거절'};
 const recover=async(orderId:string)=>{setBusy(orderId);setErr('');setMsg('');try{const r=await fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover',orderId})});const d:any=await r.json();if(!r.ok)throw Error(d.error||'주문을 확인하지 못했어요.');setMsg(r.status===202?d.message:'같은 주문의 이용권 반영을 확인했어요.');await reload?.()}catch(e){setErr((e as Error).message)}finally{setBusy('')}};
 return <section className="auth-card t-gap payment-history"><h2>결제 내역</h2>{!payments?.length?<p>아직 결제 내역이 없어요.</p>:<div className="billing-table-scroll" role="region" aria-label="결제 내역" tabIndex={0}><table className="t-table"><thead><tr><th>날짜</th><th>내용</th><th>금액</th><th>상태</th><th>확인</th></tr></thead><tbody>{payments.map(p=><tr key={p.order_id}><td>{new Date(p.paid_at||p.created_at||Date.now()).toLocaleDateString('ko-KR')}</td><td>{p.kind==='contracts'?'근로계약서 체결료':`${p.plan==='pro'?'프로':'베이직'} · ${p.pricing_snapshot?`직원 ${p.pricing_snapshot.count}명`:`기존 ${p.store_slots}지점`} · ${p.months}개월`}{p.period_end&&<small>{new Date(p.period_start).toLocaleDateString('ko-KR')} ~ {new Date(p.period_end).toLocaleDateString('ko-KR')}</small>}</td><td>{won(p.amount)}원{p.refunded_amount>0&&<small>환불 {won(p.refunded_amount)}원</small>}</td><td>{p.status==='paid'&&p.pricing_version&&!p.fulfilled_at?'이용권 반영 확인 중':status[p.status]||p.status}</td><td>{p.status==='confirming'||p.status==='paid'&&p.pricing_version&&!p.fulfilled_at?<button type="button" className="saas-secondary" disabled={!!busy} onClick={()=>recover(p.order_id)}>{busy===p.order_id?'확인 중…':'같은 주문 다시 확인'}</button>:p.receipt_url?<a href={p.receipt_url} target="_blank" rel="noopener">영수증</a>:'—'}</td></tr>)}</tbody></table></div>}{msg&&<p role="status">{msg}</p>}{err&&<p role="alert" className="saas-error">{err}</p>}</section>;
}/** 작업 018: 해지 신청(이번 결제 기간 끝까지 이용) */
export function CancelSubscription({a,reload}:{a:any,reload:()=>Promise<void>}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 if(a.status!=='active'||!a.periodStart)return <p className="saas-fine">결제 중인 이용권이 없어요. 해지·환불 규정은 <a href="/refund">여기</a>에서 볼 수 있어요.</p>;
 const run=async(body:any)=>{setBusy(true);setErr('');try{await post(body);await reload()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 const q=a.refundEstimate;
 return <details className="auth-card t-gap"><summary><b>해지 신청</b>{a.cancelAt&&<> · {new Date(a.cancelAt).toLocaleDateString('ko-KR')}까지 이용 후 해지 예정</>}</summary>
  {a.cancelAt?<><p>해지가 예약되어 있어요. {new Date(a.cancelAt).toLocaleDateString('ko-KR')}까지 지금처럼 쓰고, 그 뒤로는 기록 조회·내려받기만 할 수 있어요.</p><button className="saas-secondary" disabled={busy} onClick={()=>run({action:'undoCancel'})}>해지 취소하고 계속 이용</button></>:<>
  <p>해지해도 이번 결제 기간이 끝날 때까지 그대로 쓸 수 있어요. 자동 결제는 없어요. 남은 기간 환불을 원하시면 해지 사유에 적어 주세요{q?` (예상 환불 ${won(q.refund)}원 · ${q.formula})`:" 원본 결제 기록을 확인한 뒤 금액을 안내해요."}</p>
  <div className="t-inline" role="group" aria-label="해지 이유 고르기">{CANCEL_REASONS.map(r=><button type="button" key={r} className={reason.includes(r)?"primary":"secondary"} aria-pressed={reason.includes(r)} onClick={()=>setReason(reason.includes(r)?reason.replace(r,"").replace(/^ · | · $/g,"").replace(" ·  · "," · "):(reason?reason+" · ":"")+r)}>{r}</button>)}</div><label className="saas-field">해지 사유 (선택)<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  <button className="saas-secondary" disabled={busy} onClick={()=>run({action:'cancelSubscription',reason})}>해지 예약</button> <a href="/refund">해지·환불 규정</a></>}
  {err&&<p className="saas-error" role="alert">{err}</p>}</details>
}
export function RefundPolicy(){
 return <main className="saas-policy"><span className="saas-kicker">해지·환불</span><h1>해지·환불 규정</h1><p className="auth-note">정식 판매 전 운영 기준 초안이에요. 결제 서비스를 연결하고 이용약관을 확정할 때 함께 확정합니다. 지금은 결제를 받지 않아요.</p>
  <h2>언제든 해지할 수 있어요</h2><p>계정·요금제 화면의 '해지 신청'에서 예약하면 이번 결제 기간이 끝날 때까지 그대로 쓰고, 그 뒤로는 기록 조회·내려받기만 할 수 있어요. 자동 결제·자동 갱신은 하지 않아요.</p>
  <h2>무료 체험</h2><p>체험 중에는 결제가 없어서 환불할 금액도 없어요. 체험을 그만두거나 끝나도 기록은 지우지 않아요.</p>
  <h2>결제 후 7일 안 · 사용 전</h2><p>결제하고 7일이 지나지 않았고 결제 뒤 저장한 기록이 없으면 전액 환불해요.</p>
  <h2>이용 중 해지 환불</h2><p>남은 기간만큼 날짜로 나눠 환불해요: 낸 금액 − (쓴 날 ÷ 이용 기간 일수 × 낸 금액), 10원 미만은 버려요. 기존에 결제한 6·12개월 이용권은 원래 결제 금액과 이용 기간으로 계산해요. 현재 직원 수로 과거 결제 금액을 다시 계산하지 않아요.</p>
  <h2>전자근로계약서 건당 요금</h2><p>사장님과 직원이 모두 서명해 체결된 계약서 1건마다 3,000원(VAT 포함)이 그달 이용료에 더해져요. 무료 제공은 없어요. 서명 요청을 철회했거나 직원이 거절해 체결되지 않은 건에는 붙지 않아요. 체결된 계약서는 이미 제공된 서비스라 환불하지 않지만, 시스템 오류로 잘못 셈된 건은 확인 후 돌려드려요.</p>
  <h2>요금제·직원 수 변경</h2><p>현재 이용권의 금액과 기간은 유지해요. 변경한 요금제와 재직 직원 수는 다음 이용 기간의 견적에 반영해요. 자동 결제는 없고, 전환 전에 금액을 확인하고 직접 동의해요.</p>
  <h2>환불 방법과 기간</h2><p>결제한 수단으로 돌려드려요. 신청 확인 후 3영업일 안에 처리하고, 카드사 사정에 따라 실제 반영까지 더 걸릴 수 있어요.</p>
  <h2>탈퇴하면</h2><p>탈퇴 전에 가게 데이터를 내려받아 두세요. 근로계약서·임금 서류는 근로기준법에 따라 3년 보관해야 해요. 결제 기록은 전자상거래법에 따라 5년 보관해요.</p>
  <RefundCalc/>
  <h2>환불 신청</h2><p>로그인한 뒤 <a href="/support?category=환불 신청">문의하기 → 환불 신청</a>으로 남겨 주세요. 결제일·금액·사유를 적으면 3영업일 안에 처리 결과를 알려 드려요. 계정·요금제 화면의 '해지 예약'도 함께 할 수 있어요.</p>
  <p className="saas-fine"><a href="/account">← 계정·요금제로</a></p></main>
}
/** 출시 준비: 환불 금액 미리 계산(규정의 공식 그대로) */
function RefundCalc(){
 const [paid,setPaid]=useState('29800'),[days,setDays]=useState('30'),[used,setUsed]=useState('10'),[fresh,setFresh]=useState(false);
 const p=Number(paid)||0,d=Math.max(1,Number(days)||1),u=Math.min(d,Math.max(0,Number(used)||0)),refund=fresh?p:Math.max(0,Math.floor((p-u/d*p)/10)*10);
 return <section className="refund-calc" aria-labelledby="rc-title"><h2 id="rc-title">환불 금액 미리 계산</h2><div className="t-inline"><label>낸 금액(원) <input inputMode="numeric" value={paid} onChange={e=>setPaid(e.target.value.replace(/\D/g,''))}/></label><label>이용 기간(일) <input inputMode="numeric" value={days} onChange={e=>setDays(e.target.value.replace(/\D/g,''))}/></label><label>쓴 날(일) <input inputMode="numeric" value={used} disabled={fresh} onChange={e=>setUsed(e.target.value.replace(/\D/g,''))}/></label></div>
  <label className="t-check"><input type="checkbox" checked={fresh} onChange={e=>setFresh(e.target.checked)}/> 결제 후 7일 안이고 기록을 저장하지 않았어요</label>
  <p className="refund-result" role="status">돌려받는 금액 약 <b>{refund.toLocaleString('ko-KR')}원</b>{fresh?' (전액)':` = ${p.toLocaleString('ko-KR')} − (${u} ÷ ${d} × ${p.toLocaleString('ko-KR')}), 10원 미만 버림`}</p><p className="saas-fine">참고용 계산이에요. 실제 금액은 결제 기록으로 다시 확인해요.</p></section>;
}
/** 작업 011: 사업자 상태(국세청 조회) */
export function BizStatus({a,reload}:{a:any,reload:()=>Promise<void>}){
 const c=a.bizCheck,[no,setNo]=useState(c?.bizNo||''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 return <section className="auth-card t-gap"><h2>사업자 확인</h2><p>{c?<><b>{c.status}</b>{c.status==='미확인'&&c.reason?` · ${c.reason}`:''} · {c.bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/,'$1-$2-$3')} · {new Date(c.checkedAt).toLocaleDateString('ko-KR')} 조회</>:'아직 사업자등록번호를 넣지 않았어요.'}</p>
  <div className="t-wrapactions"><label className="saas-field">사업자등록번호<input inputMode="numeric" maxLength={12} value={no} onChange={e=>setNo(e.target.value)}/></label><button className="saas-secondary" disabled={busy||!validBizNo(no)} onClick={async()=>{setBusy(true);setErr('');try{await post({action:'bizCheck',bizNo:no});await reload()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}}>{c?'다시 조회':'국세청에 확인'}</button></div>{err&&<p className="saas-error" role="alert">{err}</p>}</section>
}

/** 결제하기: 지금 고른 요금제로 결제할 금액과 수단. 결제대행사를 연결하기 전이라 버튼은 잠겨 있다. */
const METHODS=[['card','신용·체크카드'],['kakaopay','카카오페이'],['naverpay','네이버페이'],['tosspay','토스페이'],['transfer','계좌이체']] as const;
export function Checkout({a,reload}:{a:any,reload?:()=>Promise<void>}){
 const [plan,setPlan]=useState<PlanId>(planId(a?.plan)||'basic'),[method,setMethod]=useState('card'),[agree,setAgree]=useState(false),[convert,setConvert]=useState(false),[bill,setBill]=useState<any>(null),[quote,setQuote]=useState<any>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[message,setMessage]=useState(''),[refresh,setRefresh]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{let active=true;fetch('/api/billing').then(r=>r.ok?r.json():null).then(d=>{if(active)setBill(d)}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{const controller=new AbortController();setQuote(null);setAgree(false);setConvert(false);setLoading(true);setErr('');fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'quote',plan}),signal:controller.signal}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error||'견적을 확인하지 못했어요.');if(!controller.signal.aborted)setQuote(d)}).catch(e=>{if(!controller.signal.aborted)setErr(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[plan,refresh,a.currentSubscription?.orderId]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
 const amount=quote?.snapshot.amount??null,expired=quote&&Date.parse(quote.expiresAt)<=now,zeroActive=amount===0&&(quote?.noChargeActive||a.currentSubscription?.amount===0&&Date.parse(a.currentSubscription.periodEnd)>now);
 const allowed=quote&&!expired&&!zeroActive&&!loading&&!busy&&agree&&(!quote.requiresConversionConsent||convert)&&(amount===0||bill?.ready);
 const reasons:Record<string,string>={'not-active':'재직 상태 아님',owner:'사장님 본인',test:'테스트 직원','duplicate-account':'동일 계정 중복 제외'};
 const pay=async()=>{if(!allowed)return;setBusy(true);setErr('');setMessage('');try{const result=await tossPay({kind:'plan',quoteId:quote.quoteId,agreed:true,convertPricing:convert},method,bill);if(result?.noCharge){setMessage('청구 없이 이용을 시작했어요.');await reload?.()}}catch(e){setErr((e as Error).message);setQuote(null)}finally{setBusy(false)}};
 return <section className="checkout employee-checkout" aria-labelledby="checkout-title"><span className="saas-kicker">직원 수 확인 → 동의 → 이용 시작</span><h2 id="checkout-title">다음 이용 기간 준비하기</h2><p>이미 결제한 기간은 유지해요. 인원 변경은 다음 견적에 반영하고 자동 결제하지 않아요.</p>
  <fieldset className="billing-plan-options"><legend>다음에 쓸 요금제</legend>{(['basic','pro'] as PlanId[]).map(p=><label key={p} className={plan===p?'selected':''}><input type="radio" name="checkout-plan" checked={plan===p} disabled={busy} onChange={()=>setPlan(p)}/><b>{plans[p].name}</b><span>직원 1명당 월 {won(EMPLOYEE_PRICE[p])}원</span></label>)}</fieldset>
  <div className="billing-quote"><div className="billing-quote-heading"><h3>{quote?`과금 직원 ${quote.snapshot.count}명`:loading?'직원 수를 확인 중이에요…':'견적을 다시 확인해 주세요'}</h3><button type="button" className="saas-secondary" disabled={loading||busy} onClick={()=>setRefresh(x=>x+1)}>직원 수 다시 확인</button></div>{quote&&<><p className="billing-quote-amount"><b>{won(amount!)}원</b><span>1개월 · VAT 포함</span></p><p>{won(quote.snapshot.unitPrice)}원 × {quote.snapshot.count}명 · 확인 시각 {new Date(quote.snapshot.countedAt).toLocaleTimeString('ko-KR')}</p><details className="billing-people"><summary>포함·제외 직원 확인 ({quote.employees.length}명)</summary>{quote.employees.length?<ul>{quote.employees.map((e:any)=><li key={e.id}><span><b>{e.name}</b><small>{e.branch}</small></span><span className={e.included?'included':'excluded'}>{e.included?'과금 포함':reasons[e.reason]||'제외'}</span></li>)}</ul>:<p>재직 직원이 없어 0원으로 시작할 수 있어요.</p>}</details></>}</div>
  {amount!==null&&amount>0&&<fieldset className="checkout-methods"><legend>결제 수단</legend>{METHODS.map(([v,l])=><label key={v} className={method===v?'on':''}><input type="radio" name="pay-method" checked={method===v} onChange={()=>setMethod(v)}/>{l}</label>)}</fieldset>}
  {quote?.requiresConversionConsent&&<label className="checkout-agree billing-conversion"><input type="checkbox" aria-label="직원당 요금 전환 동의" checked={convert} onChange={e=>setConvert(e.target.checked)}/><span>기존 이용 조건과 남은 기간을 유지하고, 다음 이용 기간부터 직원당 요금으로 전환하는 데 동의해요.</span></label>}
  <label className="checkout-agree"><input type="checkbox" aria-label="이용약관과 해지·환불 규정 동의" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span><a href="/terms">이용약관</a>과 <a href="/refund">해지·환불 규정</a>을 확인했어요. 자동 갱신 없이 1개월만 이용해요.</span></label>
  {expired&&<p role="alert" className="saas-error">15분 확인 시간이 지났어요. 직원 수를 다시 확인해 주세요.</p>}{zeroActive&&<p>청구 없는 이용 기간이 준비되어 있거나 이용 중이에요. 그 기간이 끝나면 다시 확인해 주세요.</p>}
  <button type="button" className="saas-primary billing-pay" disabled={!allowed} onClick={pay}>{busy?'처리 중…':amount===0?'0원으로 이용 시작':amount===null?'견적 확인 후 결제하기':`${won(amount)}원 결제하기`}</button>
  {err&&<p role="alert" className="saas-error">{err}</p>}{message&&<p role="status" className="saas-success">{message}</p>}{amount>0&&!bill?.ready&&<p className="checkout-wait">결제 연결을 준비하고 있어요. 연결 전에는 위 금액이 청구되지 않아요.</p>}
  <p className="saas-fine">초대 대기·입사 준비·퇴사·사장님 본인·테스트 직원은 제외해요. 같은 인증 계정은 여러 매장에 있어도 한 명으로 계산해요. 전자근로계약서 체결료는 별도예요.</p>{bill?.ready&&<ContractFees bill={bill} method={method}/>}
 </section>;
}
/* ───────── 토스페이먼츠 결제창 ───────── */
const TOSS_METHOD:Record<string,any>={card:{method:'CARD'},transfer:{method:'TRANSFER'},kakaopay:{method:'CARD',card:{flowMode:'DIRECT',easyPay:'KAKAOPAY'}},naverpay:{method:'CARD',card:{flowMode:'DIRECT',easyPay:'NAVERPAY'}},tosspay:{method:'CARD',card:{flowMode:'DIRECT',easyPay:'TOSSPAY'}}};
function loadToss():Promise<any>{const w=window as any;if(w.TossPayments)return Promise.resolve(w.TossPayments);return new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='https://js.tosspayments.com/v2/standard';sc.onload=()=>w.TossPayments?ok(w.TossPayments):no(Error('결제창을 불러오지 못했어요. 새로고침한 뒤 다시 눌러 주세요.'));sc.onerror=()=>no(Error('결제창을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'));document.head.appendChild(sc)})}
/** 서버에서 금액이 정해진 주문을 만들고 토스 결제창을 연다. 결제가 끝나면 /billing/success로 돌아와 승인한다. */
export async function tossPay(body:any,method:string,bill:any){
 const r=await fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare',...body})});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'주문을 만들지 못했어요. 새로고침한 뒤 다시 눌러 주세요.');
 if(d.noCharge)return d;
 const T=await loadToss(),pay=T(d.clientKey).payment({customerKey:d.customerKey||bill?.customerKey});
 try{await pay.requestPayment({...(TOSS_METHOD[method]||TOSS_METHOD.card),amount:{currency:'KRW',value:d.amount},orderId:d.orderId,orderName:d.orderName,successUrl:location.origin+'/billing/success',failUrl:location.origin+'/billing/fail'})}
 catch(e:any){void fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'abandon',orderId:d.orderId,code:e?.code})}).catch(()=>null);if(e?.code==='USER_CANCEL'||e?.code==='PAY_PROCESS_CANCELED')throw Error('결제를 그만뒀어요. 언제든 다시 결제할 수 있어요.');throw Error(e?.message?e.message+' 다시 시도해 주세요.':'결제창을 열지 못했어요. 다시 시도해 주세요.')}
}
/** 전자근로계약서 요금(체결 1건당 3,000원) 낼 달 */
function ContractFees({bill,method}:{bill:any,method:string}){
 const due=(bill?.contracts||[]).filter((x:any)=>x.due>0),[busy,setBusy]=useState(''),[err,setErr]=useState('');if(!due.length)return null;
 return <div className="contract-fees"><h3>전자근로계약서 요금</h3><ul>{due.map((x:any)=><li key={x.month}>{Number(x.month.slice(5))}월 체결 {x.count}건{x.paid?` (낸 것 ${x.paid}건)`:''} · <b>{won(x.amount)}원</b> <button type="button" className="saas-secondary" disabled={!!busy} onClick={async()=>{setBusy(x.month);setErr('');try{await tossPay({kind:'contracts',month:x.month,agreed:true},method,bill)}catch(e){setErr((e as Error).message)}finally{setBusy('')}}}>{busy===x.month?'여는 중…':'결제하기'}</button></li>)}</ul><p className="saas-fine">체결 1건당 3,000원(VAT 포함). 이번 달 건은 달이 끝나기 전에도 낼 수 있어요.</p>{err&&<p className="saas-error" role="alert">{err}</p>}</div>;
}
/** 결제창에서 돌아온 화면: 승인(금액을 서버가 다시 맞춰 봄) → 결과 */
export function BillingResult({ok}:{ok:boolean}){
 const q=new URLSearchParams(location.search),[st,setSt]=useState<{busy:boolean,msg:string,err:string,pending?:boolean,receipt?:string}>({busy:ok,msg:'',err:''});
 const check=async()=>{setSt({busy:true,msg:'',err:''});try{const r=await fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirm',paymentKey:q.get('paymentKey'),orderId:q.get('orderId'),amount:Number(q.get('amount'))})});const d:any=await r.json();if(!r.ok)throw Error(d.error||'승인 상태를 확인하지 못했어요. 새로 결제하지 말고 이 주문을 다시 확인해 주세요.');setSt({busy:false,msg:r.status===202?d.message:`${won(d.amount)}원 결제와 이용권 반영을 확인했어요.${d.paidUntil?` ${new Date(d.paidUntil).toLocaleDateString('ko-KR')}까지 이용해요.`:''}`,err:'',pending:r.status===202,receipt:d.receiptUrl})}catch(e){setSt({busy:false,msg:'',err:(e as Error).message,pending:true})}};
 useEffect(()=>{if(ok){void check();return}void fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'abandon',orderId:q.get('orderId'),code:q.get('code')})}).catch(()=>null)},[]);
 return <main className="saas-account"><h1>{ok?'결제 확인':'결제 취소'}</h1>{ok?<>{st.busy?<p role="status">같은 주문의 승인 상태를 확인 중이에요…</p>:<>{st.msg&&<p role="status" className={st.pending?'billing-pending':'saas-success'}>{st.msg}</p>}{st.err&&<p role="alert" className="saas-error">{st.err}</p>}{st.pending&&<button type="button" className="saas-primary" onClick={check}>같은 주문 다시 확인</button>}{st.receipt&&<p><a href={st.receipt} target="_blank" rel="noopener noreferrer">영수증 보기</a></p>}</>}</>:<p>{q.get('message')||'결제창을 닫았어요. 계정 화면에서 내역을 확인해 주세요.'}</p>}<p><a href="/account">계정·요금제로 →</a></p></main>;
}
