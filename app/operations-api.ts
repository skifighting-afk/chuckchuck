import {resolveStore} from './saas-api';
import {trialStatus,canWrite,hasFeature} from '../lib/plans';
import {z} from 'zod';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const leaveSchema=z.object({employeeId:z.string().max(100),start:date,end:date,kind:z.enum(['연차','무급휴가']),days:z.number().min(.5).max(31).multipleOf(.5),reason:z.string().trim().min(1).max(500)}).refine(v=>v.end>=v.start&&(+new Date(v.end)-+new Date(v.start))/86400000<31&&v.days<=(+new Date(v.end)-+new Date(v.start))/86400000+1,'휴가 날짜와 차감 일수를 확인해 주세요.');
const noticeSchema=z.object({title:z.string().trim().min(1).max(100),body:z.string().trim().min(1).max(3000),branchId:z.string().max(100)});
export async function operationsApi(request:Request,env:{DB:D1Database}){
 const userId=request.headers.get('oai-authenticated-user-id');if(!userId)return json({error:'로그인이 필요합니다.'},401);
 try{
 const linked=await resolveStore(env.DB,userId);if(!linked)return json({error:'매장 등록이 필요합니다.'},409);if(linked.access==='revoked')return json({error:'이용 권한이 없습니다.'},403);
 const {row,access}=linked,data=JSON.parse(row.data),ops=data._operations||{leaves:[],notices:[]};
 const self=data.employees.find((e:any)=>e.id===data._members?.find((m:any)=>m.userId===userId)?.employeeId);
 const view=()=>({version:row.version,access,selfId:self?.id||null,employees:data.employees.filter((e:any)=>access==='owner'||e.id===self?.id).map((e:any)=>({id:e.id,name:e.name,branchId:e.branchId,leaveBalance:e.leaveBalance})),branches:access==='owner'?data.branches:data.branches.filter((b:any)=>b.id===self?.branchId),leaves:ops.leaves.filter((l:any)=>access==='owner'||l.employeeId===self?.id),notices:ops.notices.filter((n:any)=>access==='owner'||n.branchId==='all'||n.branchId===self?.branchId).map((n:any)=>({id:n.id,title:n.title,body:n.body,branchId:n.branchId,createdAt:n.createdAt,author:n.author,read:n.reads.includes(userId),...(access==='owner'?{readCount:n.reads.length}:{})}))});
 if(request.method==='GET')return json(view());
 if(request.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청 출처를 확인할 수 없습니다.'},403);
 const raw=await request.text();if(raw.length>15000)return json({error:'요청 용량 초과'},413);let b:any;try{b=JSON.parse(raw)}catch{return json({error:'올바르지 않은 요청'},400)};
 if(data._account&&!canWrite(data._account))return json({error:'체험이 종료되어 조회만 가능합니다.'},403);
 if(b.version!==row.version)return json({error:'새로운 변경이 있습니다. 새로고침하고 다시 처리해 주세요.'},409);
 const now=new Date().toISOString(),actor={id:userId,name:self?.name||request.headers.get('oai-authenticated-user-email')||'사장님'};
 let label='',target='';
 if(['requestLeave','reviewLeave'].includes(b.action)&&!hasFeature(data._account,'leave'))return json({error:'휴가 신청·승인은 사장님 5 요금제부터 이용할 수 있어요.'},403);
 if(b.action==='requestLeave'){
  const parsed=leaveSchema.safeParse(b);if(!parsed.success)return json({error:parsed.error.issues[0].message},400);const p=parsed.data;
  if(access!=='owner'&&p.employeeId!==self?.id)return json({error:'본인의 휴가만 신청할 수 있습니다.'},403);
  const e=data.employees.find((e:any)=>e.id===p.employeeId&&e.status!=='퇴사');if(!e)return json({error:'재직 직원을 선택해 주세요.'},400);
  if(ops.leaves.length>=2000)return json({error:'휴가 기록 한도에 도달했습니다.'},400);
  if(ops.leaves.some((l:any)=>l.employeeId===p.employeeId&&['승인 대기','승인'].includes(l.status)&&l.start<=p.end&&l.end>=p.start))return json({error:'같은 기간에 신청 또는 승인된 휴가가 있습니다.'},409);
  ops.leaves.push({...p,id:crypto.randomUUID(),name:e.name,status:'승인 대기',at:now,actor:actor.name});label='휴가 신청';target=e.name;
 }else if(b.action==='reviewLeave'){
  if(access!=='owner')return json({error:'사장님만 승인할 수 있습니다.'},403);
  if(typeof b.approve!=='boolean'||typeof b.comment!=='string'||!b.comment.trim()||b.comment.length>500)return json({error:'처리 사유를 입력해 주세요.'},400);
  const l=ops.leaves.find((l:any)=>l.id===b.id);if(!l||l.status!=='승인 대기')return json({error:'승인 대기 중인 신청이 없습니다.'},409);
  const e=data.employees.find((e:any)=>e.id===l.employeeId&&e.status!=='퇴사');if(!e)return json({error:'재직 직원을 확인해 주세요.'},400);
  if(b.approve){
   if(data.shifts.some((s:any)=>s.employeeId===l.employeeId&&s.date>=l.start&&s.date<=l.end))return json({error:'휴가 기간에 근무가 등록되어 있습니다. 근무표를 먼저 조정해 주세요.'},409);
   if(l.kind==='연차'){if(e.leaveBalance<l.days)return json({error:'등록된 연차 잔여일수가 부족합니다.'},409);e.leaveBalance-=l.days;}
  }
  l.status=b.approve?'승인':'반려';l.reviewedAt=now;l.reviewer=actor.name;l.comment=b.comment.trim();label='휴가 '+l.status;target=e.name;
 }else if(b.action==='cancelLeave'){
  const l=ops.leaves.find((l:any)=>l.id===b.id);if(!l||l.status!=='승인 대기')return json({error:'승인 전 신청만 취소할 수 있습니다.'},409);
  if(access!=='owner'&&l.employeeId!==self?.id)return json({error:'본인의 신청만 취소할 수 있습니다.'},403);l.status='취소';label='휴가 신청 취소';target=l.name;
 }else if(b.action==='postNotice'){
  if(access!=='owner')return json({error:'사장님만 공지를 등록할 수 있습니다.'},403);
  const parsed=noticeSchema.safeParse(b);if(!parsed.success)return json({error:'제목과 내용을 확인해 주세요.'},400);const n=parsed.data;
  if(n.branchId!=='all'&&!data.branches.some((v:any)=>v.id===n.branchId))return json({error:'존재하지 않는 지점입니다.'},400);
  if(ops.notices.length>=500)return json({error:'공지 기록 한도에 도달했습니다.'},400);
  ops.notices.push({...n,id:crypto.randomUUID(),author:actor.name,createdAt:now,reads:[]});label='매장 공지 등록';target=n.title;
 }else if(b.action==='readNotice'){
  const n=ops.notices.find((n:any)=>n.id===b.id);if(!n||(access!=='owner'&&n.branchId!=='all'&&n.branchId!==self?.branchId))return json({error:'접근할 수 없는 공지입니다.'},404);
  if(!n.reads.includes(userId))n.reads.push(userId);label='매장 공지 확인';target=n.title;
 }else return json({error:'지원하지 않는 작업입니다.'},400);
 data._operations=ops;data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:now,actor,action:label,target,before:null,after:{id:b.id||null},reason:b.comment||b.reason||''}];
 const result=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),row.version+1,now,linked.owner,row.version).run();
 if(!result.meta.changes)return json({error:'동시 변경이 있습니다. 새로고침해 주세요.'},409);row.version++;return json(view());
 }catch(e){console.error('Operations request failed',e instanceof Error?e.name:'Unknown');return json({error:'정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},500)}
}
