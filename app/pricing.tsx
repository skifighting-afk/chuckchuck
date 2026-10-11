import {plans,employeePrice,EMPLOYEE_PRICE,money,TRIAL_DAYS,contractFeeText,type PlanId} from '../lib/plans';
/** Public estimate; authenticated orders always use server snapshots. */
export function PricingPicker({plan,setPlan,employees=1,setEmployees,idPrefix='p'}:{plan:PlanId,setPlan:(p:PlanId)=>void,employees?:number,setEmployees?:(n:number)=>void,idPrefix?:string}){
 return <div className="pricing employee-pricing">
  <label className="saas-field" htmlFor={idPrefix+'-employees'}>예상 재직 직원 수<input id={idPrefix+'-employees'} type="number" inputMode="numeric" min={0} max={100000} step={1} value={employees} readOnly={!setEmployees} onChange={e=>setEmployees?.(Math.max(0,Math.min(100000,Math.floor(Number(e.target.value)||0))))}/><small>예상액 계산기예요. 실제 결제는 서버의 재직 직원 수로 확인해요.</small></label>
  <div className="pricing-plans" role="radiogroup" aria-label="요금제">
   {Object.values(plans).map(p=><label key={p.id} className={'pricing-plan'+(plan===p.id?' selected':'')}><input type="radio" name={idPrefix+'-plan'} checked={plan===p.id} onChange={()=>setPlan(p.id)}/><b>{p.name}</b><span>직원 1명당 월 {money(EMPLOYEE_PRICE[p.id])}원</span><strong>월 {money(employeePrice(p.id,employees))}원</strong><small>재직 {employees}명 기준 · VAT 포함</small><span>{p.description}</span></label>)}
  </div>
  <ul className="pricing-notes"><li>처음 {TRIAL_DAYS}일 무료. 카드 등록·자동 결제 없이 QR 출퇴근까지 체험해요.</li><li>재직 직원만 집계해요. 동일 계정은 여러 매장에서 일해도 한 명으로 계산하고, 이름이 같아도 다른 직원이면 따로 계산해요.</li><li>초대 대기·입사 준비·퇴사·사장님 본인·테스트 직원은 제외해요. 직원 0명은 0원이에요.</li><li>인원 변경은 다음 이용 기간의 견적에 반영해요. 매장 수와 관계없이 같은 직원당 단가이며 월 단위로 직접 결제해요.</li><li>전자근로계약서는 {contractFeeText()} 별도예요. 양측 서명이 끝난 계약만 집계해요.</li></ul>
 </div>;
}
