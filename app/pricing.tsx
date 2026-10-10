// 요금 고르기(가게 만들기·계정 화면 공용). 가격은 VAT 포함. 금액은 결제일 재직 직원 수 × 1명당 단가.
import {plans,employeeMonthlyPrice,monthlyPrice,periodPrice,money,PERIODS,TRIAL_DAYS,contractFeeText,type PlanId} from '../lib/plans';

export function PricingPicker({plan,setPlan,staffCount=1,months,setMonths,idPrefix='p'}:{plan:PlanId,setPlan:(p:PlanId)=>void,staffCount?:number,months:1|6|12,setMonths:(m:1|6|12)=>void,idPrefix?:string}){
 const n=Math.max(1,Math.floor(staffCount)||1);
 return <div className="pricing">
  <p className="pricing-basis">직원 1명당 월 요금이에요. <b>결제일 재직 직원 {n}명</b> 기준으로 계산해요(퇴사·초대 대기 직원은 빼요).</p>
  <fieldset className="pricing-period"><legend>구독 기간</legend>{PERIODS.map(p=><label key={p.months} className={months===p.months?'selected':''}><input type="radio" name={idPrefix+'-months'} checked={months===p.months} onChange={()=>setMonths(p.months)}/>{p.months}개월</label>)}</fieldset>
  <div className="pricing-plans" role="radiogroup" aria-label="요금제">
   {Object.values(plans).map(p=>{const m=monthlyPrice(p.id,n),total=periodPrice(p.id,n,months);return <label key={p.id} className={'pricing-plan'+(plan===p.id?' selected':'')}><input type="radio" name={idPrefix+'-plan'} checked={plan===p.id} onChange={()=>setPlan(p.id)}/>
    <b>{p.name}</b><strong>직원 1명당 월 {money(employeeMonthlyPrice(p.id,1))}원</strong><small>VAT 포함 · 재직 {n}명이면 월 {money(m)}원</small>
    {months>1&&<small className="pricing-total">{months}개월 {money(total)}원 · 할인 없음</small>}
    <span>{p.description}</span></label>})}
  </div>
  <ul className="pricing-notes">
   <li>처음 {TRIAL_DAYS}일은 무료 체험이에요. 카드 등록이 없고 자동 결제되지 않아요. 체험 중에는 프로 기능(QR 출퇴근)까지 모두 써 볼 수 있어요.</li>
   <li>지점 수와 상관없이 직원 수로만 요금이 정해져요. 결제 기간에 따른 할인은 없어요.</li>
   <li>결제할 때 재직 직원 수를 다시 세어 금액을 정해요. 결제 뒤 인원이 늘어도 이번 기간 금액은 그대로예요. 다음 결제부터 바뀐 인원으로 계산돼요.</li>
   <li>전자근로계약서는 {contractFeeText()} 따로 붙어요(사장님·직원 둘 다 서명해 체결된 건만, 철회·거절된 건은 0원).</li>
  </ul>
 </div>;
}
