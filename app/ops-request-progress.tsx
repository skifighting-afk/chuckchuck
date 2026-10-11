import {swapProgress,requestFollowup} from '../lib/ops-request-display';
export function SwapProgress({status,accepted=false}:{status:string,accepted?:boolean}){
 const progress=swapProgress(status,accepted);
 return <div className="ops-progress" role="group" aria-label="대타·교대 진행 단계"><ol>{['요청 등록','맡을 직원 결정','사장님 승인','근무표 반영'].map((label,i)=><li key={label} className={progress.done[i]?'done':''} aria-current={!progress.ended&&i===(status==='승인 대기'?2:1)?'step':undefined}><span aria-hidden="true">{progress.done[i]?'✓':i+1}</span>{label}<span className="sr-only">{progress.done[i]?' 완료':''}</span></li>)}</ol><p>{progress.next}</p></div>
}
export function RequestFollowup({kind,status,owner}:{kind:'leave'|'swap',status:string,owner:boolean}){
 const text=requestFollowup(kind,status,owner);return text?<p className="ops-followup">{text}</p>:null;
}
