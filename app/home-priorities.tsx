import {won} from '../lib/team-model';
export function HomePriorities({date,staff,total,month,locked,budget,onSchedule,onRequests,onPayroll}:{date:string;staff:number;total:number;month:string;locked:boolean;budget?:{ratio:number;planned:number;budget:number}|null;onSchedule:()=>void;onRequests:()=>void;onPayroll:()=>void}){
 return <section className="home-priorities" aria-label="먼저 확인할 세 가지">
  <button type="button" onClick={onSchedule}><span>오늘 근무</span><strong>{staff}명</strong><small>{date} · 시간표 확인</small></button>
  <button type="button" onClick={onRequests}><span>처리할 요청</span><strong>확인하기</strong><small>휴가·대타·교대 요청</small></button>
  <button type="button" onClick={onPayroll}><span>{Number(month.slice(5))}월 {locked?'확정':'예상'} 급여</span><strong>{won(total)}<em>원</em></strong><small>{locked?'확정 실수령 합계 · 송금 기록과 별개':'현재 입력된 근무·수당·공제 기준 · 확정 전'}</small>{budget&&<small>인건비 예산 {Math.round(budget.ratio*100)}% · 근무표 기준 {won(budget.planned)}원 / {won(budget.budget)}원</small>}</button>
 </section>;
}
