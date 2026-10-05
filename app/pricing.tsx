// 요금 고르기(가게 만들기·계정 화면 공용). 가격은 VAT 포함.
import {plans,monthlyPrice,periodPrice,money,PERIODS,MAX_BRANCHES,TRIAL_DAYS,CONTRACTS_FREE_PER_MONTH,CONTRACT_EXTRA_PRICE,type PlanId} from '../lib/plans';

export function PricingPicker({plan,setPlan,branches,setBranches,months,setMonths,idPrefix='p'}:{plan:PlanId,setPlan:(p:PlanId)=>void,branches:number,setBranches:(n:number)=>void,months:1|6|12,setMonths:(m:1|6|12)=>void,idPrefix?:string}){
 return <div className="pricing">
  <div className="pricing-row">
   <label className="saas-field" htmlFor={idPrefix+'-branches'}>지점 수<input id={idPrefix+'-branches'} type="number" inputMode="numeric" min={1} max={MAX_BRANCHES} value={branches} onChange={e=>setBranches(Math.max(1,Math.min(MAX_BRANCHES,Math.floor(Number(e.target.value)||1))))}/></label>
   <fieldset className="pricing-period"><legend>구독 기간</legend>{PERIODS.map(p=><label key={p.months} className={months===p.months?'selected':''}><input type="radio" name={idPrefix+'-months'} checked={months===p.months} onChange={()=>setMonths(p.months)}/>{p.months}개월{p.discount?<small>{p.discount*100}% 할인</small>:null}</label>)}</fieldset>
  </div>
  <div className="pricing-plans" role="radiogroup" aria-label="요금제">
   {Object.values(plans).map(p=>{const m=monthlyPrice(p.id,branches),total=periodPrice(p.id,branches,months);return <label key={p.id} className={'pricing-plan'+(plan===p.id?' selected':'')}><input type="radio" name={idPrefix+'-plan'} checked={plan===p.id} onChange={()=>setPlan(p.id)}/>
    <b>{p.name}</b><strong>월 {money(m)}원</strong><small>VAT 포함 · 지점 {branches}곳 · 직원 수 제한 없음</small>
    {months>1&&<small className="pricing-total">{months}개월 {money(total)}원 (월 {money(Math.round(total/months/10)*10)}원꼴) · <b>{money(m*months-total)}원 할인</b></small>}
    <span>{p.description}</span></label>})}
  </div>
  <ul className="pricing-notes">
   <li>처음 {TRIAL_DAYS}일은 무료 체험이에요. 카드 등록이 없고 자동 결제되지 않아요. 체험 중에는 프로 기능(QR 출퇴근)까지 모두 써 볼 수 있어요.</li>
   <li>지점 요금: 1지점 · 2~3지점 · 4~5지점 구간 요금, 6지점부터 지점당 월 {money(plans.basic.extraPerBranch)}원 추가.</li>
   <li>전자근로계약서는 월 {CONTRACTS_FREE_PER_MONTH}장 무료, 추가 1장 {money(CONTRACT_EXTRA_PRICE)}원.</li>
   <li>지금은 결제 서비스를 연결하기 전이라 청구되지 않아요.</li>
  </ul>
 </div>;
}
