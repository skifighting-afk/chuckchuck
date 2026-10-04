import {same} from '../lib/same';
import {correctionError} from '../lib/attendance-review';
import {resolveStore} from './saas-api';
import {shiftSchema,kdate} from '../lib/team-model';
import {canWrite,hasFeature} from '../lib/plans';
import type {StoreData,Operations} from '../lib/store-data';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function managerApi(request:Request,env:{DB:D1Database}){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인해 주세요.'},401);
 try{
 const link=await resolveStore(env.DB,uid);if(link?.access!=='manager')return json({error:'위임받은 매니저만 이용할 수 있어요.'},403);
 const d:StoreData=JSON.parse(link.row.data),self=d.employees.find((e)=>e.id===d._members?.find((m)=>m.userId===uid)?.employeeId)!,permissions:string[]=self.managerPermissions||[];
 const staff=d.employees.filter((e)=>e.branchId===self.branchId&&e.status!=='퇴사'),ids=new Set(staff.map((e)=>e.id));
 const ops:Operations=d._operations||{leaves:[],notices:[]};
 if(request.method==='GET')return json({version:link.row.version,permissions,branchId:self.branchId,branchName:d.branches.find((b)=>b.id===self.branchId)?.name,employees:staff.map((e)=>({id:e.id,name:e.name})),shifts:permissions.includes('schedule')?d.shifts.filter((s)=>ids.has(s.employeeId)):[],corrections:permissions.includes('attendance')?d.requests.filter((r)=>ids.has(r.before.employeeId)&&r.status==='승인 대기'&&r.actor.id!==uid&&r.before.employeeId!==self.id):[],leaves:permissions.includes('leave')?ops.leaves.filter((l)=>ids.has(l.employeeId)&&l.employeeId!==self.id&&l.status==='승인 대기'):[]});
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},403);
 const raw=await request.text();if(raw.length>10000)return json({error:'입력 용량 초과'},413);const b=JSON.parse(raw);
 const permission=({saveShift:'schedule',reviewCorrection:'attendance',reviewLeave:'leave',postNotice:'notices'} as any)[b.action];
 if(!permission||!permissions.includes(permission))return json({error:'사장님이 맡기지 않은 업무예요. 필요하면 사장님께 권한을 요청해 주세요.'},403);
 if(!canWrite(d._account))return json({error:'체험이 끝나 지금은 조회만 할 수 있어요. 무료 요금제로 바꾸면 다시 저장할 수 있어요.'},403);
 if(b.version!==link.row.version)return json({error:'다른 변경이 있어요. 새로고침 후 확인해 주세요.'},409);
 const now=new Date().toISOString(),actor={id:uid,name:self.name,email:self.email};let target='',before:any=null,after:any=null;
 if(b.action==='saveShift'){
  const shift=shiftSchema.parse({...b.shift,id:crypto.randomUUID()});if(!ids.has(shift.employeeId))return json({error:'소속 지점 직원만 관리할 수 있어요. 다른 지점은 사장님께 요청해 주세요.'},403);
  if(ops.leaves.some((l)=>l.employeeId===shift.employeeId&&l.status==='승인'&&l.start<=shift.date&&l.end>=shift.date))return json({error:'이미 승인된 휴가가 있는 날이에요. 다른 날짜를 골라 주세요.'},409);
  const interval=(s:{date:string,start:string,end:string})=>{const start=Date.parse(s.date+'T'+s.start+':00+09:00');return [start,Date.parse(s.date+'T'+s.end+':00+09:00')+(s.end<=s.start?86400000:0)]};const [start,end]=interval(shift);
  if(d.shifts.some((s)=>{const [a,z]=interval(s);return s.employeeId===shift.employeeId&&start<z&&end>a}))return json({error:'기존 근무와 시간이 겹쳐요. 시작·종료 시각을 바꿔 주세요.'},409);
  d.shifts.push(shift);target=shift.employeeId;after=shift;
 }else if(b.action==='reviewCorrection'){
  const r=d.requests.find((r)=>r.id===b.id&&r.status==='승인 대기');if(!r||!ids.has(r.before.employeeId)||(r.actor.id===uid||r.before.employeeId===self.id))return json({error:'다른 지점 직원이나 본인 요청은 승인할 수 없어요. 사장님께 승인을 부탁해 주세요.'},403);
  if(typeof b.approve!=='boolean')return json({error:'처리를 선택해 주세요.'},400);
  if(b.approve){const conflict=correctionError(d.attendance,r.before,r.after);if(conflict)return json({error:conflict},409);const current=d.attendance.find((a)=>a.id===r.before.id);if(!same(current,r.before))return json({error:'그 사이 기록이 바뀌었어요. 새로고침한 뒤 다시 요청해 주세요.'},409);
   if(Object.values(d.payrollRuns).some((p)=>p.locked&&[kdate(r.before.start).slice(0,7),kdate(r.after.start).slice(0,7)].includes(p.month)&&p.rows.some((e)=>e.employeeId===r.before.employeeId)))return json({error:'급여가 확정된 기간이에요. 사장님께 확정 해제를 요청해 주세요.'},409);
   d.attendance=d.attendance.map((a)=>a.id===r.before.id?r.after:a);
  }before=r.before;after=b.approve?r.after:r.before;r.status=b.approve?'승인':'반려';r.reviewer=actor;r.reviewedAt=now;target=r.id;
 }else if(b.action==='reviewLeave'){
  if(!hasFeature(d._account,'leave'))return json({error:'휴가 승인은 베이직부터 이용할 수 있어요.'},403);
  const l=ops.leaves.find((l)=>l.id===b.id&&l.status==='승인 대기');if(!l||!ids.has(l.employeeId)||l.employeeId===self.id)return json({error:'소속 지점 다른 직원의 신청만 승인할 수 있어요. 본인 신청은 사장님이 승인해요.'},403);
  if(typeof b.approve!=='boolean'||typeof b.comment!=='string'||!b.comment.trim()||b.comment.length>500)return json({error:'처리 사유를 입력해 주세요.'},400);
  const employee=staff.find((e)=>e.id===l.employeeId);if(b.approve){if(d.shifts.some((s)=>s.employeeId===l.employeeId&&s.date>=l.start&&s.date<=l.end))return json({error:'휴가 기간에 근무가 있어요. 사장님께 근무 조정을 요청하세요.'},409);if(l.kind==='연차'){if(employee.leaveBalance<l.days)return json({error:'남은 연차가 부족해요. 날짜를 줄이거나 잔여일을 확인해 주세요.'},409);employee.leaveBalance-=l.days;}}
  before={...l};l.status=b.approve?'승인':'반려';l.reviewedAt=now;l.reviewer=actor.name;l.comment=b.comment.trim();after=l;target=l.id;
 }else{
  if(typeof b.title!=='string'||!b.title.trim()||b.title.length>100||typeof b.body!=='string'||!b.body.trim()||b.body.length>3000)return json({error:'공지 제목과 내용을 확인해 주세요.'},400);
  if(ops.notices.length>=500)return json({error:'공지 한도를 확인해 주세요.'},409);
  const n={id:crypto.randomUUID(),branchId:self.branchId,title:b.title.trim(),body:b.body.trim(),author:self.name,createdAt:now,reads:[]};ops.notices.push(n);target=n.id;after=n;
 }
 d._operations=ops;d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:now,actor,action:'매니저 '+b.action,target,before,after,reason:'사장님 위임 업무'}];
 const result=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),now,link.owner,link.row.version).run();
 return result.meta.changes?json({ok:true}):json({error:'다른 변경이 있어요. 다시 확인해 주세요.'},409);
 }catch{return json({error:'입력 내용을 확인해 주세요.'},400)}
}

