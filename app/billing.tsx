'use client';
// 작업 065·067·068·069: 체험 종료 안내, 환불·차액 안내, 세금계산서 정보와 발행 요청
import {useState} from 'react';
import {changeQuote,refundQuote,validBizNo,monthlyPrice,periodPrice,plans,planId,type PlanId} from '../lib/plans';
const won=(n:number)=>n.toLocaleString('ko-KR');
const post=async(body:any)=>{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d:any=await r.json();if(!r.ok)throw Error(d.error||'저장하지 못했어요.');return d};
export function TrialBanner({account}:{account:any}){
 // 지시서 143: 결제 실패 유예 기간 안내(그동안은 그대로 쓸 수 있어요)
 if(typeof account?.graceLeft==='number')return <div className="trial-banner 1d" role="alert">정기 결제가 되지 않았어요. {account.graceLeft>0?`${account.graceLeft}일 동안은 그대로 쓸 수 있어요.`:'지금은 조회·내려받기만 돼요.'} 카드를 확인하거나 결제 수단을 바꿔 주세요. <a href="/account#checkout-title">결제 수단 확인 →</a></div>;
 const n=account?.notice;if(!n?.level)return null;
 const text=n.level==='ended'?'무료 체험이 끝났어요. 기록 조회와 내려받기는 계속 돼요.':n.level==='1d'?'무료 체험이 내일 끝나요.':`무료 체험이 ${n.daysLeft}일 남았어요.`;
 return <div className={'trial-banner '+n.level} role="status">{text} 자동으로 결제되지 않아요. <a href="/account#checkout-title">결제하기 →</a></div>
}
export function PlanChangeQuote({a,plan,branches,months}:{a:any,plan:PlanId,branches:number,months:1|6|12}){
 if(a.status!=='active'||!a.periodStart)return <p className="saas-fine">{a.status==='trialing'?'체험 중에는 차액 없이 바로 바뀌어요.':'결제를 연결하기 전이라 차액이 청구되지 않아요.'}</p>;
 const q=changeQuote({plan:a.plan,slots:a.storeSlots,months:a.months},{plan,slots:branches,months},a.periodStart);
 return <p className="saas-fine">이번 이용 기간({q.periodEnd}까지) 남은 {q.daysLeft}일 기준 {q.diff>0?`추가 ${won(q.diff)}원`:q.diff<0?`다음 결제에서 ${won(-q.diff)}원 차감`:'차액 없음'} (예상 · VAT 포함)</p>
}
export function RefundEstimate({a}:{a:any}){
 if(a.status!=='active'||!a.periodStart)return null;const q=refundQuote(a.periodPrice,a.months,a.periodStart);
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
export function PaymentHistory({payments}:{payments?:any[]}){
 const status:Record<string,string>={paid:'결제 완료',cancelled:'취소',refunded:'환불',failed:'실패'};
 return <section className="auth-card t-gap"><h2>결제 내역</h2>{!payments?.length?<p className="saas-fine">아직 결제 내역이 없어요. 결제를 연결하기 전이라 청구되지 않았어요.</p>:<table className="t-table"><thead><tr><th>날짜</th><th>내용</th><th>금액</th><th>상태</th><th>영수증</th></tr></thead><tbody>{payments.map(p=><tr key={p.order_id}><td>{p.paid_at?new Date(p.paid_at).toLocaleDateString('ko-KR'):'—'}</td><td>{p.plan==='pro'?'프로':'베이직'} {p.store_slots}지점 · {p.months}개월{p.period_start?` (${p.period_start}~${p.period_end})`:''}</td><td>{won(p.amount)}원{p.refunded_amount?` (환불 ${won(p.refunded_amount)}원)`:''}</td><td>{status[p.status]||p.status}</td><td>{p.receipt_url?<a href={p.receipt_url} target="_blank" rel="noopener">보기</a>:'—'}</td></tr>)}</tbody></table>}</section>
}
/** 작업 018: 해지 신청(이번 결제 기간 끝까지 이용) */
export function CancelSubscription({a,reload}:{a:any,reload:()=>Promise<void>}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 if(a.status!=='active'||!a.periodStart)return <p className="saas-fine">결제 중인 이용권이 없어요. 해지·환불 규정은 <a href="/refund">여기</a>에서 볼 수 있어요.</p>;
 const run=async(body:any)=>{setBusy(true);setErr('');try{await post(body);await reload()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 const q=refundQuote(a.periodPrice,a.months,a.periodStart);
 return <details className="auth-card t-gap"><summary><b>해지 신청</b>{a.cancelAt&&<> · {new Date(a.cancelAt).toLocaleDateString('ko-KR')}까지 이용 후 해지 예정</>}</summary>
  {a.cancelAt?<><p>해지가 예약되어 있어요. {new Date(a.cancelAt).toLocaleDateString('ko-KR')}까지 지금처럼 쓰고, 그 뒤로는 기록 조회·내려받기만 할 수 있어요.</p><button className="saas-secondary" disabled={busy} onClick={()=>run({action:'undoCancel'})}>해지 취소하고 계속 이용</button></>:<>
  <p>해지해도 이번 결제 기간이 끝날 때까지 그대로 쓸 수 있어요. 자동 결제는 없어요. 남은 기간 환불을 원하시면 해지 사유에 적어 주세요(지금 해지 시 예상 환불 {won(q.refund)}원 · {q.formula}).</p>
  <label className="saas-field">해지 사유 (선택)<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  <button className="saas-secondary" disabled={busy} onClick={()=>run({action:'cancelSubscription',reason})}>해지 예약</button> <a href="/refund">해지·환불 규정</a></>}
  {err&&<p className="saas-error" role="alert">{err}</p>}</details>
}
export function RefundPolicy(){
 return <main className="saas-policy"><span className="saas-kicker">해지·환불</span><h1>해지·환불 규정</h1><p className="auth-note">정식 판매 전 운영 기준 초안이에요. 결제 서비스를 연결하고 이용약관을 확정할 때 함께 확정합니다. 지금은 결제를 받지 않아요.</p>
  <h2>언제든 해지할 수 있어요</h2><p>계정·요금제 화면의 '해지 신청'에서 예약하면 이번 결제 기간이 끝날 때까지 그대로 쓰고, 그 뒤로는 기록 조회·내려받기만 할 수 있어요. 자동 결제·자동 갱신은 하지 않아요.</p>
  <h2>무료 체험</h2><p>체험 중에는 결제가 없어서 환불할 금액도 없어요. 체험을 그만두거나 끝나도 기록은 지우지 않아요.</p>
  <h2>결제 후 7일 안 · 사용 전</h2><p>결제하고 7일이 지나지 않았고 결제 뒤 저장한 기록이 없으면 전액 환불해요.</p>
  <h2>이용 중 해지 환불</h2><p>남은 기간만큼 날짜로 나눠 환불해요: 낸 금액 − (쓴 날 ÷ 이용 기간 일수 × 낸 금액), 10원 미만은 버려요. 6·12개월 할인은 쓴 기간에도 그대로 적용해요(할인 전 가격으로 다시 계산하지 않음).</p>
  <h2>요금제·지점 수 변경</h2><p>기간 중에 올리면 남은 기간만큼 차액을 더 내고, 내리면 다음 결제에서 빼요.</p>
  <h2>환불 방법과 기간</h2><p>결제한 수단으로 돌려드려요. 신청 확인 후 3영업일 안에 처리하고, 카드사 사정에 따라 실제 반영까지 더 걸릴 수 있어요.</p>
  <h2>탈퇴하면</h2><p>탈퇴 전에 가게 데이터를 내려받아 두세요. 근로계약서·임금 서류는 근로기준법에 따라 3년 보관해야 해요. 결제 기록은 전자상거래법에 따라 5년 보관해요.</p>
  <p className="saas-fine"><a href="/account">← 계정·요금제로</a></p></main>
}
/** 작업 011: 사업자 상태(국세청 조회) */
export function BizStatus({a,reload}:{a:any,reload:()=>Promise<void>}){
 const c=a.bizCheck,[no,setNo]=useState(c?.bizNo||''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 return <section className="auth-card t-gap"><h2>사업자 확인</h2><p>{c?<><b>{c.status}</b>{c.status==='미확인'&&c.reason?` · ${c.reason}`:''} · {c.bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/,'$1-$2-$3')} · {new Date(c.checkedAt).toLocaleDateString('ko-KR')} 조회</>:'아직 사업자등록번호를 넣지 않았어요.'}</p>
  <div className="t-wrapactions"><label className="saas-field">사업자등록번호<input inputMode="numeric" maxLength={12} value={no} onChange={e=>setNo(e.target.value)}/></label><button className="saas-secondary" disabled={busy||!validBizNo(no)} onClick={async()=>{setBusy(true);setErr('');try{await post({action:'bizCheck',bizNo:no});await reload()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}}>{c?'다시 조회':'국세청에 확인'}</button></div>{err&&<p className="saas-error" role="alert">{err}</p>}</section>
}

/** 결제하기: 지금 고른 요금제로 결제할 금액과 수단. 결제대행사를 연결하기 전이라 버튼은 잠겨 있다. */
const METHODS=[['card','신용·체크카드'],['kakaopay','카카오페이'],['naverpay','네이버페이'],['tosspay','토스페이'],['transfer','계좌이체']] as const;
export function Checkout({a}:{a:any}){
 const plan=(planId(a?.plan)||'pro') as PlanId,slots=Math.max(1,Number(a?.storeSlots)||1),months=([1,6,12].includes(Number(a?.months))?Number(a?.months):1) as 1|6|12;
 const [method,setMethod]=useState('card'),[agree,setAgree]=useState(false);
 const list=monthlyPrice(plan,slots)*months,pay=periodPrice(plan,slots,months),off=list-pay;
 const ready=false;
 return <section className="checkout" aria-labelledby="checkout-title"><h2 id="checkout-title">결제하기</h2>
  <dl className="checkout-sum"><div><dt>요금제</dt><dd>{plans[plan].name}</dd></div><div><dt>지점</dt><dd>{slots}곳</dd></div><div><dt>이용 기간</dt><dd>{months}개월</dd></div><div><dt>정가</dt><dd>{won(list)}원</dd></div>{off>0&&<div><dt>{months}개월 할인</dt><dd className="off">−{won(off)}원</dd></div>}<div className="total"><dt>결제 금액 (VAT 포함)</dt><dd>{won(pay)}원</dd></div></dl>
  <fieldset className="checkout-methods"><legend>결제 수단</legend>{METHODS.map(([v,l])=><label key={v} className={method===v?'on':''}><input type="radio" name="pay-method" value={v} checked={method===v} onChange={()=>setMethod(v)}/>{l}</label>)}</fieldset>
  <label className="checkout-agree"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span><a href="/terms">이용약관</a>과 <a href="/refund">해지·환불 규정</a>을 확인했어요. 자동 갱신 없이 {months}개월만 결제돼요.</span></label>
  <button type="button" className="saas-primary" disabled={!ready||!agree}>{won(pay)}원 결제하기</button>
  {!ready&&<p className="checkout-wait" role="note">결제 연결을 준비하고 있어요. 사업자 등록과 결제대행사 계약이 끝나면 이 버튼이 열려요. 그 전까지는 결제 없이 체험을 그대로 쓸 수 있어요. 요금제·지점 수·기간은 아래에서 미리 바꿔 둘 수 있어요.</p>}
 </section>;
}
