'use client';
// 작업 065·067·068·069: 체험 종료 안내, 환불·차액 안내, 세금계산서 정보와 발행 요청
import {useState} from 'react';
import {changeQuote,refundQuote,validBizNo,type PlanId} from '../lib/plans';
const won=(n:number)=>n.toLocaleString('ko-KR');
const post=async(body:any)=>{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d:any=await r.json();if(!r.ok)throw Error(d.error||'저장하지 못했어요.');return d};
export function TrialBanner({account}:{account:any}){
 const n=account?.notice;if(!n?.level)return null;
 const text=n.level==='ended'?'무료 체험이 끝났어요. 기록 조회와 내려받기는 계속 돼요.':n.level==='1d'?'무료 체험이 내일 끝나요.':`무료 체험이 ${n.daysLeft}일 남았어요.`;
 return <div className={'trial-banner '+n.level} role="status">{text} 자동으로 결제되지 않아요. <a href="/account">요금제 확인 →</a></div>
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
