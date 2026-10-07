// 지시서 '다음' 052 공지 미열람 자동 재알림 · 067 마감 체크 없이 퇴근 알림 (10분마다 도는 알림 점검에서 쓴다)
import {noticeAudience} from './ops-view';
type A={key:string,to:string,kind:string,title:string,body:string};
/** 067: 마지막으로 퇴근한 사람(지점에 남은 근무자 없음)이 30분 안에 퇴근했는데, 그 근무 중 '마감' 체크가 한 번도 없으면 사장님께 */
export function closingMissed(d:any,now:number):A[]{
 const out:A[]=[],manuals=(d._manuals||[]).filter((m:any)=>(m.category||'기타')==='마감'),runs=d._checkRuns||[];
 if(!manuals.length)return out;
 const att=(d.attendance||[]) as any[],emp=new Map((d.employees||[]).map((e:any)=>[e.id,e]));
 for(const a of att){if(!a.end)continue;const end=Date.parse(a.end);if(end>now||now-end>30*60000)continue;const e:any=emp.get(a.employeeId);if(!e)continue;
  if(!manuals.some((m:any)=>m.branchId==='all'||m.branchId===e.branchId))continue;
  const stillWorking=att.some(x=>!x.end&&(emp.get(x.employeeId) as any)?.branchId===e.branchId);if(stillWorking)continue;
  const later=att.some(x=>x.end&&x.id!==a.id&&(emp.get(x.employeeId) as any)?.branchId===e.branchId&&Date.parse(x.end)>end);if(later)continue;
  const did=runs.some((r:any)=>r.category==='마감'&&(r.branchId===e.branchId||!r.branchId)&&Date.parse(r.at)>=Date.parse(a.start)-3600000&&Date.parse(r.at)<=end+15*60000);
  if(!did)out.push({key:'closecheck:'+a.id,to:'owner',kind:'manual',title:`${e.name}님이 마감 체크 없이 퇴근했어요`,body:`${new Date(end+9*3600000).toISOString().slice(11,16)} 퇴근 · 매장 매뉴얼의 마감 체크가 오늘 기록되지 않았어요.`});}
 return out;
}
/** 052: 올린 지 24시간이 지났는데 아직 안 읽은 직원에게 한 번만 다시(72시간 지나면 그만) */
export function noticeReminders(d:any,now:number):A[]{
 const out:A[]=[],notices=d._operations?.notices||[],staff=(d.employees||[]).filter((e:any)=>e.status!=='퇴사').map((e:any)=>({id:e.id,name:e.name,role:e.role,branchId:e.branchId}));
 const uidOf=(id:string)=>(d._members||[]).find((m:any)=>m.employeeId===id)?.userId;
 for(const n of notices){const t=Date.parse(n.publishAt||n.createdAt);if(!Number.isFinite(t)||now-t<24*3600000||now-t>72*3600000||n.autoRemind===false)continue;
  for(const id of noticeAudience(n.target,staff,n.branchId)){const uid=uidOf(id);if(!uid||(n.reads||[]).includes(uid))continue;out.push({key:`notice:${n.id}:${id}`,to:id,kind:'notice',title:'아직 안 읽은 공지가 있어요',body:String(n.title||'매장 공지').slice(0,60)})}}
 return out;
}
