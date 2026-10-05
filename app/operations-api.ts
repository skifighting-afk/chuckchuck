import {notifyUser} from './push-api';
import type {PushEnv} from '../lib/webpush';
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {trialStatus,canWrite,hasFeature} from '../lib/plans';
import {z} from 'zod';
import {leaveBalanceFor,unusedLeavePay} from '../lib/annual-leave';
import {ordinaryHourly} from '../lib/team-model';
import {same} from '../lib/same';
import type {StoreData,Operations,Swap,ShiftSnap} from '../lib/store-data';
type Emp=StoreData['employees'][number];type Shift=StoreData['shifts'][number];
const kstToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const leaveSchema=z.object({employeeId:z.string().max(100),start:date,end:date,kind:z.enum(['연차','무급휴가']),days:z.number().min(.5).max(31).multipleOf(.5),reason:z.string().trim().min(1).max(500)}).refine(v=>v.end>=v.start&&(+new Date(v.end)-+new Date(v.start))/86400000<31&&v.days<=(+new Date(v.end)-+new Date(v.start))/86400000+1,'휴가 날짜와 차감 일수를 확인해 주세요.');
const noticeSchema=z.object({title:z.string().trim().min(1).max(100),body:z.string().trim().min(1).max(3000),branchId:z.string().max(100)});
export async function operationsApi(request:Request,env:{DB:D1Database}&PushEnv){
 const userId=request.headers.get('oai-authenticated-user-id');if(!userId)return json({error:'로그인이 필요합니다.'},401);
 try{
 const linked=await resolveStore(env.DB,userId);if(!linked)return json({error:'먼저 가게를 등록해 주세요.'},409);if(linked.access==='revoked')return json({error:'이 기능을 쓸 권한이 없어요. 사장님께 확인해 주세요.'},403);
 const {row,access}=linked,data:StoreData=JSON.parse(row.data),ops:Operations=data._operations||{leaves:[],notices:[]};
 const self=data.employees.find((e)=>e.id===data._members?.find((m)=>m.userId===userId)?.employeeId);
 const fivePlus=!!data.settings?.fivePlus,asOf=kstToday();
 const accrual=(e:Emp)=>{const r=leaveBalanceFor(e,ops.leaves.filter((l)=>l.employeeId===e.id),asOf,fivePlus);let hourly=0;try{hourly=ordinaryHourly(e).hourly}catch{};return {eligible:r.eligible,reason:r.reason,earned:r.earned,used:r.used,remaining:r.remaining,next:r.next,grants:r.grants.length,unusedPay:r.eligible?unusedLeavePay(r.remaining,hourly):0}};
 const myBranch=self?.branchId,visibleSwap=(w:Swap)=>access==='owner'||w.branchId===myBranch;
 const upcoming=(s:Shift)=>s.date>=asOf&&(access==='owner'||s.employeeId===self?.id);
 const view=()=>({fivePlus,availability:Object.fromEntries(Object.entries(ops.availability||{}).filter(([k])=>access==='owner'||k===self?.id)),swaps:(ops.swaps||[]).filter(visibleSwap).slice(-200),myShifts:data.shifts.filter(upcoming).sort((a:any,b:any)=>(a.date+a.start<b.date+b.start?-1:1)).slice(0,200).map((s)=>({id:s.id,employeeId:s.employeeId,date:s.date,start:s.start,end:s.end})),colleagues:data.employees.filter((e)=>e.status!=='퇴사'&&(access==='owner'||(e.branchId===myBranch&&e.id!==self?.id))).map((e)=>({id:e.id,name:e.name,branchId:e.branchId})),version:row.version,access,selfId:self?.id||null,employees:data.employees.filter((e)=>access==='owner'||e.id===self?.id).map((e)=>({id:e.id,name:e.name,branchId:e.branchId,leaveBalance:e.leaveBalance,joined:e.joined,accrual:accrual(e)})),branches:access==='owner'?data.branches:data.branches.filter((b)=>b.id===self?.branchId),leaves:ops.leaves.filter((l)=>access==='owner'||l.employeeId===self?.id),notices:ops.notices.filter((n)=>access==='owner'||n.branchId==='all'||n.branchId===self?.branchId).map((n)=>({id:n.id,title:n.title,body:n.body,branchId:n.branchId,createdAt:n.createdAt,author:n.author,read:n.reads.includes(userId),...(access==='owner'?(()=>{const members=(data._members||[]).map((m)=>({uid:m.userId,e:data.employees.find((e)=>e.id===m.employeeId)})).filter((x):x is {uid:string,e:Emp}=>!!x.e&&x.e.status!=='퇴사'&&(n.branchId==='all'||x.e.branchId===n.branchId));return {readCount:n.reads.length,readers:members.filter((x)=>n.reads.includes(x.uid)).map((x)=>x.e.name),unread:members.filter((x)=>!n.reads.includes(x.uid)).map((x)=>x.e.name)}})():{})}))});
 if(request.method==='GET')return json(view());
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장봇 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const raw=await request.text();if(raw.length>15000)return json({error:'보낸 내용이 너무 커요. 내용을 줄여서 다시 시도해 주세요.'},413);let b:any;try{b=JSON.parse(raw)}catch{return json({error:'요청을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},400)};
 if(data._account&&!canWrite(data._account))return json({error:'체험이 끝나 지금은 조회·내려받기만 할 수 있어요. 계정·요금제 화면에서 요금제를 결제하면 다시 저장할 수 있어요.'},403);
 if(b.version!==row.version)return json({error:'새로운 변경이 있습니다. 새로고침하고 다시 처리해 주세요.'},409);
 const now=new Date().toISOString(),actor={id:userId,name:self?.name||request.headers.get('oai-authenticated-user-email')||'사장님'};
 let label='',target='';
 if(['requestLeave','reviewLeave'].includes(b.action)&&!hasFeature(data._account,'leave'))return json({error:'휴가 신청·승인은 베이직부터 이용할 수 있어요.'},403);
 if(b.action==='requestLeave'){
  const parsed=leaveSchema.safeParse(b);if(!parsed.success)return json({error:parsed.error.issues[0].message},400);const p=parsed.data;
  if(access!=='owner'&&p.employeeId!==self?.id)return json({error:'본인 휴가만 신청할 수 있어요.'},403);
  const e=data.employees.find((e)=>e.id===p.employeeId&&e.status!=='퇴사');if(!e)return json({error:'재직 직원을 선택해 주세요.'},400);
  if(ops.leaves.length>=2000)return json({error:'휴가 기록을 더 저장할 수 없어요. 지난 기록을 정리한 뒤 다시 시도해 주세요.'},400);
  if(ops.leaves.some((l)=>l.employeeId===p.employeeId&&['승인 대기','승인'].includes(l.status)&&l.start<=p.end&&l.end>=p.start))return json({error:'같은 기간에 이미 신청했거나 승인된 휴가가 있어요. 날짜를 바꾸거나 기존 신청을 취소해 주세요.'},409);
  ops.leaves.push({...p,id:crypto.randomUUID(),name:e.name,status:'승인 대기',at:now,actor:actor.name});label='휴가 신청';target=e.name;
 }else if(b.action==='reviewLeave'){
  if(access!=='owner')return json({error:'승인은 사장님만 할 수 있어요. 사장님께 확인을 요청해 주세요.'},403);
  if(typeof b.approve!=='boolean'||typeof b.comment!=='string'||!b.comment.trim()||b.comment.length>500)return json({error:'처리 사유를 입력해 주세요.'},400);
  const l=ops.leaves.find((l)=>l.id===b.id);if(!l||l.status!=='승인 대기')return json({error:'처리할 신청이 없어요. 목록을 새로고침해 주세요.'},409);
  const e=data.employees.find((e)=>e.id===l.employeeId&&e.status!=='퇴사');if(!e)return json({error:'재직 직원을 확인해 주세요.'},400);
  if(b.approve){
   if(data.shifts.some((s)=>s.employeeId===l.employeeId&&s.date>=l.start&&s.date<=l.end))return json({error:'휴가 기간에 근무가 등록되어 있습니다. 근무표를 먼저 조정해 주세요.'},409);
   if(l.kind==='연차'){if(e.leaveBalance<l.days)return json({error:'남은 연차가 부족해요. 날짜를 줄이거나 사장님께 잔여일 확인을 요청해 주세요.'},409);e.leaveBalance-=l.days;}
  }
  l.status=b.approve?'승인':'반려';l.reviewedAt=now;l.reviewer=actor.name;l.comment=b.comment.trim();label='휴가 '+l.status;target=e.name;
 }else if(b.action==='cancelLeave'){
  const l=ops.leaves.find((l)=>l.id===b.id);if(!l||l.status!=='승인 대기')return json({error:'이미 처리된 신청은 취소할 수 없어요. 바꾸려면 새로 신청해 주세요.'},409);
  if(access!=='owner'&&l.employeeId!==self?.id)return json({error:'본인이 낸 신청만 취소할 수 있어요.'},403);l.status='취소';label='휴가 신청 취소';target=l.name;
 }else if(b.action==='syncLeave'){
  if(access!=='owner')return json({error:'연차 반영은 사장님만 할 수 있어요.'},403);
  if(!fivePlus)return json({error:'상시 근로자 5명 이상 사업장으로 설정한 뒤 반영할 수 있어요. 설정에서 바꿀 수 있어요.'},400);
  const list=data.employees.filter((e)=>e.status!=='퇴사'&&(b.employeeId==='all'||e.id===b.employeeId));if(!list.length)return json({error:'반영할 재직 직원이 없어요. 직원 목록을 새로고침해 주세요.'},400);
  const changed:string[]=[];for(const e of list){const a=accrual(e);if(a.eligible&&a.remaining!==e.leaveBalance){e.leaveBalance=Math.min(100,a.remaining);changed.push(e.name)}}
  label='연차 자동 계산 반영';target=changed.join(', ')||'변경 없음';b.comment='입사일 기준 발생분 − 승인된 연차';
 }else if(['requestSwap','acceptSwap','reviewSwap','cancelSwap'].includes(b.action)){
  // 작업 049: 대타·교대 — 직원끼리 구하고 사장님은 승인만
  ops.swaps=ops.swaps||[];const emp=(id:string)=>data.employees.find((e)=>e.id===id&&e.status!=='퇴사');
  const lockedMonth=(employeeId:string,date:string)=>Object.values(data.payrollRuns||{}).some((r)=>r.locked&&r.month===date.slice(0,7)&&r.rows?.some((x)=>x.employeeId===employeeId));
  const onLeave=(employeeId:string,date:string)=>ops.leaves.some((l)=>l.status==='승인'&&l.employeeId===employeeId&&date>=l.start&&date<=l.end);
  const toMin=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m},span=(s:{start:string,end:string})=>{const a=toMin(s.start),z=toMin(s.end);return [a,z<=a?z+1440:z]};
  const overlaps=(employeeId:string,shift:any,ignore:string[])=>data.shifts.some((x)=>x.employeeId===employeeId&&x.date===shift.date&&!ignore.includes(x.id)&&(()=>{const [a1,b1]=span(x),[a2,b2]=span(shift);return a1<b2&&a2<b1})());
  const check=(employeeId:string,shift:any,ignore:string[])=>{const e=emp(employeeId);if(!e)return '재직 중인 직원만 맡을 수 있어요. 다른 직원을 골라 주세요.';if(lockedMonth(shift.employeeId,shift.date)||lockedMonth(employeeId,shift.date))return '급여가 확정된 달의 근무예요. 사장님께 확정 해제를 요청해 주세요.';if(onLeave(employeeId,shift.date))return e.name+'님은 그날 승인된 휴가가 있어요. 다른 직원을 찾아 주세요.';if(overlaps(employeeId,shift,ignore))return e.name+'님은 그 시간에 이미 근무가 있어요. 시간을 확인해 주세요.';return ''};
  const core=(s:Shift|ShiftSnap|null|undefined)=>s&&({id:s.id,date:s.date,start:s.start,end:s.end,employeeId:s.employeeId}),snap=(s:Shift):ShiftSnap=>({id:s.id,date:s.date,start:s.start,end:s.end,employeeId:s.employeeId,name:emp(s.employeeId)?.name||''});
  if(b.action==='requestSwap'){
   if(!['대타','교대'].includes(b.kind)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>500)return json({error:'종류와 사유를 입력해 주세요.'},400);
   const shift=data.shifts.find((s)=>s.id===b.shiftId);if(!shift||shift.date<asOf)return json({error:'오늘 이후 근무만 대타·교대를 구할 수 있어요. 근무를 다시 골라 주세요.'},400);
   if(access!=='owner'&&shift.employeeId!==self?.id)return json({error:'본인 근무만 대타·교대를 요청할 수 있어요.'},403);
   if(ops.swaps.some((w)=>w.shift.id===shift.id&&['구하는 중','승인 대기'].includes(w.status)))return json({error:'이 근무는 이미 대타·교대를 구하는 중이에요. 기존 요청을 확인해 주세요.'},409);
   if(ops.swaps.length>=2000)return json({error:'요청 기록을 더 저장할 수 없어요. 사장님께 지난 기록 정리를 요청해 주세요.'},400);
   const pick=b.targetId?emp(b.targetId):null;if(b.targetId&&(!pick||pick.id===shift.employeeId||(access!=='owner'&&pick.branchId!==self?.branchId)))return json({error:'같은 지점의 다른 직원을 골라 주세요.'},400);
   const owner=emp(shift.employeeId);ops.swaps.push({id:crypto.randomUUID(),kind:b.kind,branchId:owner?.branchId||'',shift:snap(shift),targetId:pick?.id||null,targetName:pick?.name||'',reason:b.reason.trim(),status:'구하는 중',at:now,by:actor.name});label=b.kind+' 요청';
  }else{
   const w=ops.swaps.find((w)=>w.id===b.id);if(!w||!visibleSwap(w))return json({error:'요청을 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
   const shift=data.shifts.find((s)=>s.id===w.shift.id);
   if(b.action==='cancelSwap'){if(!['구하는 중','승인 대기'].includes(w.status))return json({error:'이미 처리된 요청이에요. 목록을 새로고침해 주세요.'},409);if(access!=='owner'&&w.shift.employeeId!==self?.id)return json({error:'요청한 직원이나 사장님만 취소할 수 있어요.'},403);w.status='취소';label=w.kind+' 요청 취소';
   }else if(b.action==='acceptSwap'){
    if(w.status!=='구하는 중')return json({error:'이미 다른 직원이 맡았거나 마감된 요청이에요. 목록을 새로고침해 주세요.'},409);
    const who=access==='owner'?b.employeeId:self?.id;if(!who||who===w.shift.employeeId)return json({error:'요청한 본인은 맡을 수 없어요. 같은 지점 동료가 수락할 때까지 기다려 주세요.'},400);
    if(w.targetId&&w.targetId!==who)return json({error:'지정된 직원만 수락할 수 있어요.'},403);
    if(!shift||!same(core(shift),core(w.shift)))return json({error:'근무가 바뀌어서 수락할 수 없어요. 요청한 직원에게 다시 요청해 달라고 해 주세요.'},409);
    let mine:any=null;if(w.kind==='교대'){mine=data.shifts.find((s)=>s.id===b.myShiftId&&s.employeeId===who&&s.date>=asOf);if(!mine)return json({error:'바꿔 줄 내 근무를 골라 주세요.'},400);const back=check(w.shift.employeeId,{...mine,employeeId:mine.employeeId},[shift.id]);if(back)return json({error:back},409);}
    const err=check(who,shift,mine?[mine.id]:[]);if(err)return json({error:err},409);
    const e=emp(who)!;w.taker={id:who,name:e.name,at:now};w.counter=mine?snap(mine):null;w.status='승인 대기';label=w.kind+' 수락';
   }else{
    if(access!=='owner')return json({error:'승인은 사장님만 할 수 있어요. 사장님께 확인을 요청해 주세요.'},403);
    if(w.status!=='승인 대기'||typeof b.approve!=='boolean')return json({error:'처리할 요청이 없어요. 목록을 새로고침해 주세요.'},409);
    if(b.approve){
     if(!shift||!same(core(shift),core(w.shift)))return json({error:'요청 이후 근무가 바뀌어 승인할 수 없어요. 반려한 뒤 다시 요청받아 주세요.'},409);
     const cid=w.counter?.id,counter=cid?data.shifts.find((s)=>s.id===cid):null;if(w.counter&&(!counter||!same(core(counter),core(w.counter))))return json({error:'바꿀 근무가 바뀌어 승인할 수 없어요. 반려한 뒤 다시 요청받아 주세요.'},409);
     const err=check(w.taker!.id,shift,counter?[counter.id]:[])||(counter?check(w.shift.employeeId,counter,[shift.id]):'');if(err)return json({error:err},409);
     shift.employeeId=w.taker!.id;if(counter)counter.employeeId=w.shift.employeeId;
    }
    w.status=b.approve?'승인':'반려';w.reviewedAt=now;w.reviewer=actor.name;w.comment=typeof b.comment==='string'?b.comment.slice(0,500):'';label=w.kind+' '+w.status;
   }
   target=w.shift.name+' '+w.shift.date;
  }
  if(b.action==='requestSwap'){const w=ops.swaps[ops.swaps.length-1];target=w.shift.name+' '+w.shift.date}
 }else if(b.action==='setAvailability'){
  // 작업 050: 근무 가능 시간 — 직원이 요일별로 내고, 사장님은 근무표 초안에 쓴다
  const who=access==='owner'?b.employeeId:self?.id,e=data.employees.find((e)=>e.id===who&&e.status!=='퇴사');if(!e)return json({error:'재직 중인 본인만 근무 가능 시간을 낼 수 있어요.'},access==='owner'?400:403);
  const hm=/^([01]\d|2[0-3]):[0-5]\d$/;if(!Array.isArray(b.slots)||b.slots.length>21||b.slots.some((x:any)=>!Number.isInteger(x?.weekday)||x.weekday<0||x.weekday>6||!hm.test(x.start)||!hm.test(x.end)||x.start===x.end))return json({error:'요일과 시작·끝 시간을 확인해 주세요. 하루에 최대 3개까지 낼 수 있어요.'},400);
  if(typeof b.note!=='undefined'&&(typeof b.note!=='string'||b.note.length>300))return json({error:'메모는 300자 이내로 줄여 주세요.'},400);
  ops.availability=ops.availability||{};ops.availability[e.id]={slots:b.slots.map((x:any)=>({weekday:x.weekday,start:x.start,end:x.end})),note:(b.note||'').trim(),updatedAt:now};label='근무 가능 시간 제출';target=e.name;
 }else if(b.action==='postNotice'){
  if(access!=='owner')return json({error:'공지는 사장님이나 공지 권한을 받은 매니저만 등록할 수 있어요.'},403);
  const parsed=noticeSchema.safeParse(b);if(!parsed.success)return json({error:'제목과 내용을 확인해 주세요.'},400);const n=parsed.data;
  if(n.branchId!=='all'&&!data.branches.some((v)=>v.id===n.branchId))return json({error:'없는 지점이에요. 지점을 다시 골라 주세요.'},400);
  if(ops.notices.length>=500)return json({error:'공지를 더 저장할 수 없어요. 지난 공지를 정리한 뒤 다시 등록해 주세요.'},400);
  ops.notices.push({...n,id:crypto.randomUUID(),author:actor.name,createdAt:now,reads:[]});label='매장 공지 등록';target=n.title;
 }else if(b.action==='readNotice'){
  const n=ops.notices.find((n)=>n.id===b.id);if(!n||(access!=='owner'&&n.branchId!=='all'&&n.branchId!==self?.branchId))return json({error:'볼 수 없는 공지예요. 목록을 새로고침해 주세요.'},404);
  if(!n.reads.includes(userId))n.reads.push(userId);label='매장 공지 확인';target=n.title;
 }else return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 data._operations=ops;data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:now,actor,action:label,target,before:null,after:{id:b.id||null},reason:b.comment||b.reason||''}];
 const result=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),row.version+1,now,linked.owner,row.version).run();
 if(!result.meta.changes)return json({error:'동시 변경이 있습니다. 새로고침해 주세요.'},409);row.version++;
 // 작업 092: 휴가 처리 결과·대타 요청 알림
 if(b.action==='reviewLeave'){const l=ops.leaves.find((x)=>x.id===b.id);const uidOf=(eid:string)=>data._members?.find((m)=>m.employeeId===eid)?.userId;if(l)await notifyUser(env,uidOf(l.employeeId),{title:'휴가 신청 '+l.status,body:`${l.start}~${l.end} ${l.kind} 신청이 ${l.status}되었어요.`,url:'/app'})}
 if(b.action==='requestSwap'){const w=(ops.swaps||[]).at(-1);const tid=w?.targetId?data._members?.find((m)=>m.employeeId===w.targetId)?.userId:null;if(w&&tid)await notifyUser(env,tid,{title:w.kind+' 요청',body:`${w.shift.name}님이 ${w.shift.date} ${w.shift.start}~${w.shift.end} 근무 ${w.kind}를 부탁했어요.`,url:'/app'})}
 return json(view());
 }catch(e){return serverError('operations',e,'정보를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
