import {shiftChangeRows} from '../lib/schedule-display';
import {type Team} from '../lib/team-model';
export function SchedulePreview({state,original,next}:{state:Team;original:Team['shifts'][number]|undefined;next:Team['shifts'][number]}){
 const rows=shiftChangeRows(original,next);
 if(!original||!rows.length)return null;
 const value=(key:string,text:string,employeeId:string)=>key==='employeeId'?state.employees.find(e=>e.id===text)?.name||'직원 확인 필요':key==='branchId'?state.branches.find(b=>b.id===(text||state.employees.find(e=>e.id===employeeId)?.branchId))?.name||'소속 지점':key==='position'?(text||'기본 업무'):(text||'없음');
 return <section className="schedule-preview" aria-label="저장 전 근무 변경 확인"><h3>저장하면 이렇게 바뀌어요</h3><dl>{rows.map(row=><div key={row.key}><dt>{row.label}</dt><dd><span><small>변경 전</small>{value(row.key,row.before,original.employeeId)}</span><span><small>변경 후</small>{value(row.key,row.after,next.employeeId)}</span></dd></div>)}</dl>{(next as any).applySeries&&<p>이 날 이후 반복 근무의 시간·휴게·업무·메모도 함께 바뀌어요.</p>}</section>;
}
