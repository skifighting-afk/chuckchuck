// 지시서 '다음' 052 공지 미열람 자동 재알림 · 067 마감 체크 없이 퇴근 알림 (10분마다 도는 알림 점검에서 쓴다)
import {noticeAudience} from './ops-view';
import {monthPatterns} from './attendance-check';
import {annualLeave} from './annual-leave';
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
/** 지시서 010: 이번 달 결근·지각이 정한 횟수에 닿으면 사장님께 한 번(기본 결근 2번·지각 4번, 0이면 끔) */
export function absenceAlerts(d:any,month:string,now:number):A[]{
 const cfg=d.settings?.absenceAlert||{absent:2,late:4},out:A[]=[];if(!cfg.absent&&!cfg.late)return out;
 const leaves=new Set<string>();for(const l of (d._operations?.leaves||[]).filter((l:any)=>l.status==='승인'))for(let x=l.start;x<=l.end;x=new Date(Date.parse(x+'T00:00:00Z')+86400000).toISOString().slice(0,10))leaves.add(l.employeeId+':'+x);
 const shifts=(d.shifts||[]).filter((s:any)=>s.date.startsWith(month)&&!leaves.has(s.employeeId+':'+s.date));
 const pat=monthPatterns(month,shifts,d.attendance||[],d.settings?.attendanceTolerance||'normal',now);
 for(const p of pat){const e=(d.employees||[]).find((x:any)=>x.id===p.employeeId);if(!e||e.status==='퇴사')continue;
  if(cfg.absent&&p.결근>=cfg.absent)out.push({key:`absentcnt:${month}:${p.employeeId}`,to:'owner',kind:'attendance',title:`${e.name}님 이번 달 결근 ${p.결근}번`,body:`정해 둔 ${cfg.absent}번에 닿았어요.${p.repeatDay?` ${p.repeatDay}요일에 자주 빠져요.`:''} 직원과 이야기해 보세요.`});
  if(cfg.late&&p.지각>=cfg.late)out.push({key:`latecnt:${month}:${p.employeeId}`,to:'owner',kind:'attendance',title:`${e.name}님 이번 달 지각 ${p.지각}번`,body:`모두 ${p.lateMinutes}분 늦었어요. 정해 둔 ${cfg.late}번에 닿았어요.`});}
 return out;
}
/** 지시서 060: 챙길 날 — 매달 1일 아침에 그달 생일(생년월만 알아서 달 단위), 입사 기념일은 3일 전에 */
export function careDays(d:any,now:number):A[]{
 const k=new Date(now+9*3600000);if(k.getUTCHours()!==8)return [];
 const today=k.toISOString().slice(0,10),month=today.slice(5,7),out:A[]=[],staff=(d.employees||[]).filter((e:any)=>e.status!=='퇴사');
 if(today.endsWith('-01')){const b=staff.filter((e:any)=>/^\d{4}-\d{2}$/.test(e.birthMonth||'')&&e.birthMonth.slice(5)===month);if(b.length)out.push({key:'bday:'+today.slice(0,7),to:'owner',kind:'brief',title:`🎂 ${Number(month)}월 생일 ${b.length}명`,body:b.map((e:any)=>e.name).join(', ')+' · 작은 축하를 준비해 보세요.'})}
 const in3=new Date(Date.parse(today+'T00:00:00Z')+3*86400000).toISOString().slice(0,10);
 for(const e of staff){if(!/^\d{4}-\d{2}-\d{2}$/.test(e.joined||''))continue;const yrs=Number(in3.slice(0,4))-Number(e.joined.slice(0,4));if(yrs>=1&&e.joined.slice(5)===in3.slice(5))out.push({key:`anniv:${e.id}:${in3}`,to:'owner',kind:'brief',title:`🎉 ${e.name}님 입사 ${yrs}주년이 3일 남았어요`,body:`${Number(in3.slice(5,7))}월 ${Number(in3.slice(8))}일 · ${e.joined} 입사. ${yrs===1?'1년이 되면 주 15시간 이상 직원은 퇴직금 대상이 되고, 5명 이상 사업장은 80% 이상 출근했으면 연차 15일이 생겨요.':'고마움을 전해 보세요.'}`})}
 return out;
}
/** 지시서 057: 연차 사용 촉진 시기 알림 — 1년 근속분 연차의 사용 기간 끝나기 6개월 전(1차)·2개월 전(2차) 아침 8시 */
export function leavePromotion(d:any,now:number):A[]{
 const k=new Date(now+9*3600000);if(k.getUTCHours()!==8||!d.settings?.fivePlus)return [];
 const today=k.toISOString().slice(0,10),out:A[]=[],mAdd=(x:string,n:number)=>{const y=Number(x.slice(0,4)),m=Number(x.slice(5,7))-1+n,dd=Number(x.slice(8));const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(dd,last))).toISOString().slice(0,10)};
 for(const e of (d.employees||[]).filter((x:any)=>x.status!=='퇴사')){const r=annualLeave(e,today,true);if(!r.eligible)continue;
  for(const g of r.grants.filter((g:any)=>g.kind==='1년 근속')){const first=mAdd(g.expires,-6),due2=mAdd(g.expires,-2),second=new Date(Date.parse(due2+'T00:00:00Z')-7*86400000).toISOString().slice(0,10);
   if(today===first)out.push({key:`promo1:${e.id}:${g.at}`,to:'owner',kind:'brief',title:`${e.name}님 연차 사용 촉진 1차 통지 시기예요`,body:`${g.expires} 끝나는 연차가 있어요. 오늘부터 10일 안에 남은 일수를 알리고 사용 시기를 정해 달라고 서면으로 요청하세요(근로계약서 화면 → 서식함).`});
   if(today===second)out.push({key:`promo2:${e.id}:${g.at}`,to:'owner',kind:'brief',title:`${e.name}님 연차 사용 촉진 2차 통지 시기예요`,body:`1차 통지 뒤에도 직원이 사용 시기를 안 정했다면, ${due2}까지 사장님이 사용 시기를 정해 서면으로 알려 주세요.`})}}
 return out;
}
