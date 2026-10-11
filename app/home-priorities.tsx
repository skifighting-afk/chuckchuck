import {won} from '../lib/team-model';
export function HomePriorities({date,staff,total,month,locked,onSchedule,onRequests,onPayroll}:{date:string;staff:number;total:number;month:string;locked:boolean;onSchedule:()=>void;onRequests:()=>void;onPayroll:()=>void}){
 return <section className="home-priorities" aria-label="먼저 확인할 세 가지">
  <button type="button" onClick={onSchedule}><span>오늘 근무</span><strong>{staff}명</strong><small>{date} · 시간표 확인</small></button>
  <button type="button" onClick={onRequests}><span>처리할 요청</span><strong>확인하기</strong><small>휴가·대타·교대 요청</small></button>
  <button type="button" onClick={onPayroll}><span>{Number(month.slice(5))}월 {locked?'확정':'예상'} 급여</span><strong>{won(total)}<em>원</em></strong><small>실수령 합계 · {locked?'송금 기록과 별개':'확정 전'}</small></button>
 </section>;
}
