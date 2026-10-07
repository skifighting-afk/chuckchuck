'use client';
// 체험 화면의 휴가·공지: 실제 화면(OpsView)과 같은 구성. 버튼을 누르면 체험 안에서만 상태가 바뀐다(저장 없음).
// 휴가·대타를 승인하면 체험 근무표도 바로 바뀐다.
import {useMemo,useState} from 'react';
import {toast} from 'sonner';
import {OpsView,StatusBadge} from './ops-board';
import {Swaps} from './operations';
import {type Team,today} from '../lib/team-model';
import {noticeAudience,md,plusDays} from '../lib/ops-view';

const dow=(d:string)=>new Date(d+'T00:00:00Z').getUTCDay();
const nextDow=(from:string,w:number,skip=0):string=>{let d=plusDays(from,1);while(dow(d)!==w)d=plusDays(d,1);return plusDays(d,skip*7)};
export function DemoOperations({team,onTeam,branchId}:{team:Team,onTeam:(s:Team)=>void,branchId:string}){
 const t0=today(),es=team.employees.filter(e=>e.branchId===branchId&&e.status!=='퇴사'),by=(n:string)=>es.find(e=>e.name===n)||es[0];
 const [ops,setOps]=useState(()=>{
  const tue=nextDow(t0,2,1),sh=team.shifts.filter(s=>s.date>t0).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)),kim=sh.find(s=>s.employeeId===by('김예시').id)||sh[0],first=(n:string)=>sh.find(s=>s.employeeId===by(n).id)?.date||plusDays(t0,3),sat=first('정가상'),wed=sh.filter(s=>s.employeeId===by('박샘플').id)[1]?.date||first('박샘플');
  const at=new Date(Date.now()-3600000).toISOString(),read=(names:string[])=>names;
  return {
   leaves:[
    {id:'dl1',employeeId:by('정가상').id,name:'정가상',start:sat,end:sat,kind:'연차',days:1,reason:'가족 행사',status:'승인 대기',at},
    {id:'dl2',employeeId:by('박샘플').id,name:'박샘플',start:wed,end:wed,kind:'연차',days:1,reason:'병원 진료',status:'승인 대기',at:new Date(Date.now()-7200000).toISOString()},
    {id:'dl3',employeeId:by('이체험').id,name:'이체험',start:tue,end:plusDays(tue,1),kind:'연차',days:2,reason:'여행',status:'승인',at,reviewedAt:at,reviewer:'예시 사장님',comment:'승인'},
   ],
   swaps:kim?[{id:'ds1',kind:'대타',branchId,shift:{id:kim.id,date:kim.date,start:kim.start,end:kim.end,employeeId:kim.employeeId,name:'김예시'},targetId:null,targetName:'',reason:'학교 시험이 있어요',status:'승인 대기',at,by:'김예시',taker:{id:by('정가상').id,name:'정가상',at}}]:[],
   notices:[
    {id:'dn1',title:'위생 점검 안내',body:'다음 주 화요일 구청 위생 점검이 있어요. 모자·앞치마 꼭 챙겨 주세요.',branchId:'all',author:'예시 사장님',createdAt:new Date(Date.now()-86400000).toISOString(),target:{type:'all'},readers:read(['김예시','박샘플','이체험']),remindedAt:null},
    {id:'dn2',title:'주방 냉장고 정리',body:'금요일 마감 때 냉장고 칸별로 날짜 스티커를 붙여 주세요.',branchId:'all',author:'예시 사장님',createdAt:new Date(Date.now()-3*3600000).toISOString(),target:{type:'role',roles:['주방']},readers:[],remindedAt:null},
   ] as any[],
  };
 });
 const emps=es.map(e=>({id:e.id,name:e.name,role:e.role,branchId:e.branchId}));
 const data=useMemo(()=>{
  const aud=(n:any)=>noticeAudience(n.target,emps,n.branchId).map(id=>emps.find(e=>e.id===id)!.name);
  return {access:'owner',selfId:null,fivePlus:false,today:t0,weekStart:(team.settings as any).weekStart||'mon',branches:team.branches,
   employees:es.map(e=>({id:e.id,name:e.name,branchId:e.branchId,role:e.role,leaveBalance:e.leaveBalance,accrual:{eligible:false,reason:'체험 매장은 5명 미만이라 연차를 자동 계산하지 않아요.'}})),
   colleagues:emps,availability:{},
   shifts:team.shifts.filter(s=>s.date>=plusDays(t0,-7)).map(s=>({id:s.id,employeeId:s.employeeId,date:s.date,start:s.start,end:s.end,breakMinutes:s.breakMinutes})),
   myShifts:team.shifts.filter(s=>s.date>=t0).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).map(s=>({id:s.id,employeeId:s.employeeId,date:s.date,start:s.start,end:s.end})),
   leaves:ops.leaves,swaps:ops.swaps,
   notices:ops.notices.map(n=>{const a=aud(n),scheduled=!!n.publishAt&&Date.parse(n.publishAt)>Date.now();return {...n,scheduled,audience:a.length,readCount:a.filter(x=>n.readers.includes(x)).length,readers:a.filter(x=>n.readers.includes(x)),unread:a.filter(x=>!n.readers.includes(x))}})};
 },[ops,team]);
 function action(b:any){
  const now=new Date().toISOString();
  if(b.action==='reviewLeave'){const l=ops.leaves.find(x=>x.id===b.id)!;let removed:any[]=[];
   if(b.approve){removed=team.shifts.filter(s=>s.employeeId===l.employeeId&&s.date>=l.start&&s.date<=l.end);if(removed.length){const ids=new Set(removed.map(s=>s.id));onTeam({...team,shifts:team.shifts.filter(s=>!ids.has(s.id))})}}
   setOps(o=>({...o,leaves:o.leaves.map(x=>x.id===b.id?{...x,status:b.approve?'승인':'반려',comment:b.comment,reviewedAt:now,reviewer:'예시 사장님',removedShifts:removed.map(s=>({id:s.id,date:s.date,start:s.start,end:s.end}))}:x)}));
   toast.success(b.approve?(removed.length?`승인했어요. ${l.name}님 ${removed.map(s=>md(s.date)).join(', ')} 근무를 근무표에서 뺐어요.`:'승인했어요.'):`반려했어요. ${l.name}님에게 사유를 알렸어요(체험).`);return}
  if(b.action==='reviewSwap'){const w=ops.swaps.find(x=>x.id===b.id)!;
   if(b.approve)onTeam({...team,shifts:team.shifts.map(s=>s.id===w.shift.id?{...s,employeeId:w.taker!.id}:s)});
   setOps(o=>({...o,swaps:o.swaps.map(x=>x.id===b.id?{...x,status:b.approve?'승인':'반려',comment:b.comment,reviewedAt:now,reviewer:'예시 사장님'}:x)}));
   toast.success(b.approve?`승인했어요. ${md(w.shift.date)} 근무자를 ${w.taker!.name}님으로 바꿨어요.`:'반려했어요. 직원에게 사유를 알렸어요(체험).');return}
  if(b.action==='postNotice'){setOps(o=>({...o,notices:[...o.notices,{id:crypto.randomUUID(),title:b.title,body:b.body,branchId:b.branchId,author:'예시 사장님',createdAt:now,target:b.target,publishAt:b.publishAt,photo:b.photo,readers:[],remindedAt:null}]}));toast.success(b.publishAt?'공지를 예약했어요(체험).':'공지를 보냈어요(체험). 실제 매장에서는 직원 휴대폰에 알림이 가요.');return}
  if(b.action==='remindNotice'){const n=data.notices.find((x:any)=>x.id===b.id);setOps(o=>({...o,notices:o.notices.map(x=>x.id===b.id?{...x,remindedAt:now}:x)}));toast.success(`${n?.unread.join(', ')}님에게 다시 알렸어요(체험).`);return}
  if(b.action==='requestLeave'){const e=es.find(x=>x.id===b.employeeId)!;setOps(o=>({...o,leaves:[...o.leaves,{id:crypto.randomUUID(),employeeId:e.id,name:e.name,start:b.start,end:b.end,kind:b.kind,days:b.days,reason:b.reason,status:'승인 대기',at:now}]}));toast.success('휴가 신청을 넣었어요(체험).');return}
  if(b.action==='cancelLeave'){setOps(o=>({...o,leaves:o.leaves.map(x=>x.id===b.id?{...x,status:'취소'}:x)}));return}
  toast.info('체험에서는 사장님 승인·반려와 공지만 해 볼 수 있어요.');
 }
 const leaveTab=<section className="panel t-gap"><div className="panel-heading"><h2>휴가 신청 내역</h2></div>{ops.leaves.slice().reverse().map(l=><article className="t-panelbody ops-request" key={l.id}><div className="t-inline"><b>{l.name}</b><StatusBadge s={l.status}/><span>{l.kind} · {l.days}일</span></div><p>{l.start} ~ {l.end}</p><p className="ops-reason">{l.reason}</p>{l.comment&&<p className="footnote">처리: {l.comment}</p>}{l.status==='승인 대기'&&<small className="footnote">'처리할 것'에서 승인·반려해요.</small>}</article>)}</section>;
 return <><p className="notice">체험용 예시예요. 승인·반려·공지를 눌러 보세요. 승인하면 체험 근무표가 바로 바뀌어요(새로고침하면 처음으로).</p>
  <OpsView demo data={data} action={action} busy={false} branchId={branchId} swaps={<Swaps data={data} owner busy={false} action={action} branchId={branchId}/>} leaveTab={leaveTab}/></>;
}
