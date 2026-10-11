import {shiftChangeGroups} from '../lib/schedule-display';
import {seriesEdit} from '../lib/schedule-bulk';
import {type Team} from '../lib/team-model';
export function SchedulePreview({state,original,next}:{state:Team;original:Team['shifts'][number]|undefined;next:Team['shifts'][number]}){
 if(!original)return null;
 const series=!!((next as any).applySeries&&original.series);
 const projected=series?seriesEdit(state.shifts,original.id,{start:next.start,end:next.end,breakMinutes:next.breakMinutes,position:next.position||undefined,note:next.note?.trim()||undefined}).shifts:state.shifts.map(s=>s.id===original.id?next:s);
 const groups=shiftChangeGroups(state.shifts,projected);
 if(!groups.length&&!series)return null;
 const value=(key:string,text:string,employeeId:string)=>key==='employeeId'?state.employees.find(e=>e.id===text)?.name||'직원 확인 필요':key==='branchId'?state.branches.find(b=>b.id===(text||state.employees.find(e=>e.id===employeeId)?.branchId))?.name||'소속 지점':key==='position'?(text||'기본 업무'):(text||'없음');
 return <section className="schedule-preview" aria-label="저장 전 근무 변경 확인"><h3>저장하면 이렇게 바뀌어요</h3>{series&&<p>반복 근무 {groups.length}개의 값이 바뀌어요. 직원·날짜·지점은 그대로 두고 시간·휴게·업무·메모만 적용해요.</p>}{!groups.length&&<p>달라지는 값이 없어요.</p>}{groups.map(group=><div className="schedule-change-group" key={group.before.id}>{series&&<h4>{state.employees.find(e=>e.id===group.before.employeeId)?.name} · {group.before.date}</h4>}<dl>{group.rows.map(row=><div key={row.key}><dt>{row.label}</dt><dd><span><small>변경 전</small>{value(row.key,row.before,group.before.employeeId)}</span><span><small>변경 후</small>{value(row.key,row.after,group.after.employeeId)}</span></dd></div>)}</dl></div>)}</section>;
}
