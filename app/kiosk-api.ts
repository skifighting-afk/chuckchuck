// 지시서 020: 키오스크 모드 — 매장 태블릿 한 대에 띄워 두고, 직원은 이름을 누르고 숫자 4자리를 넣어 출퇴근한다.
// 태블릿은 로그인하지 않는다(사장님이 만든 지점 주소만). 주소로는 오늘 근무자 이름과 출퇴근만 할 수 있다.
import {authLimit} from './auth-api';
import {hydrateAttendance} from './attendance-store';
import {serverError} from '../lib/errors';
import {applyClock,applyCredit,kdate,attendanceSchema} from '../lib/team-model';
import {staffGone} from '../lib/staff-access';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export const kioskPinHash=(employeeId:string,salt:string,pin:string)=>hash(`kiosk:${employeeId}:${salt}:${pin}`);
export async function kioskApi(request:Request,env:{DB:D1Database}){
 try{
 const url=new URL(request.url),b:any=request.method==='POST'?await request.json().catch(()=>({})):{},k=String(url.searchParams.get('k')||b.k||'');
 if(!/^[a-f0-9]{48}$/.test(k))return json({error:'태블릿 주소가 맞지 않아요. 사장님께 새 주소를 받아 주세요.'},404);
 const th=await hash('kiosk-token:'+k);if(!await authLimit(env as any,'kiosk:'+th,60,60000))return json({error:'요청이 너무 많아요. 잠시 뒤 다시 눌러 주세요.'},429);
 const t=await env.DB.prepare('SELECT owner,branch_id FROM kiosk_tokens WHERE token_hash=?').bind(th).first<any>();if(!t)return json({error:'꺼진 태블릿 주소예요. 사장님께 새 주소를 받아 주세요.'},404);
 for(let attempt=0;attempt<3;attempt++){
  const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(t.owner).first<any>();if(!row)return json({error:'가게를 찾을 수 없어요. 사장님께 확인해 주세요.'},404);
  const d=JSON.parse(row.data);await hydrateAttendance(env.DB,t.owner,d,new Date(Date.now()-3*86400000).toISOString());
  const today=kdate(new Date().toISOString()),branch=(d.branches||[]).find((x:any)=>x.id===t.branch_id);if(!branch)return json({error:'지점이 없어졌어요. 사장님께 새 주소를 받아 주세요.'},404);
  const staff=(d.employees||[]).filter((e:any)=>e.branchId===t.branch_id&&!staffGone(e));
  const view=()=>({store:d.store?.name||'',branch:branch.name,staff:staff.map((e:any)=>{const open=(d.attendance||[]).find((a:any)=>a.employeeId===e.id&&!a.end);const sh=(d.shifts||[]).find((s:any)=>s.employeeId===e.id&&s.date===today);return {id:e.id,name:e.name,working:!!open,onBreak:!!open?.breakStart,shift:sh?`${sh.start}–${sh.end}`:null,pin:!!e.kioskPin}}).sort((a:any,c:any)=>(c.shift?1:0)-(a.shift?1:0)||a.name.localeCompare(c.name))});
  if(request.method==='GET')return json(view());
  if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침해 주세요.'},405);
  const e=staff.find((x:any)=>x.id===b.employeeId);if(!e)return json({error:'이 매장 직원을 골라 주세요.'},400);
  if(!e.kioskPin)return json({error:'아직 태블릿 비밀번호가 없어요. 내 휴대폰 앱의 "태블릿 출퇴근 비밀번호"에서 먼저 정해 주세요.'},400);
  if(!await authLimit(env as any,'kiosk-pin:'+t.owner+':'+e.id,5,15*60000))return json({error:'비밀번호를 여러 번 틀렸어요. 15분 뒤 다시 하거나 휴대폰으로 찍어 주세요.'},429);
  if(!/^\d{4,6}$/.test(String(b.pin||''))||await kioskPinHash(e.id,e.kioskPin.salt,String(b.pin))!==e.kioskPin.hash)return json({error:'비밀번호가 맞지 않아요. 다시 넣어 주세요.'},403);
  const locked=(a:any)=>Object.values<any>(d.payrollRuns||{}).some(r=>r.locked&&r.month===kdate(a.start).slice(0,7)&&r.rows.some((x:any)=>x.employeeId===a.employeeId));
  const open=(d.attendance||[]).find((a:any)=>a.employeeId===e.id&&!a.end),now=Date.now(),kind=b.kind==='break'||b.kind==='resume'?b.kind:open?'out':'in';let msg='';
  if(kind==='in'){if(open)return json({error:'이미 출근해 있어요.'},400);const n={id:crypto.randomUUID(),employeeId:e.id,start:new Date(now).toISOString(),end:null,breakMinutes:0,breakStart:null,device:'kiosk'};if(locked(n))return json({error:'급여가 확정된 달이에요. 사장님께 말씀해 주세요.'},400);d.attendance.push(n);if(e.status==='입사 준비')e.status='재직';msg=`${e.name}님 출근했어요. ${new Date(now+9*3600000).toISOString().slice(11,16)}`}
  else{if(!open)return json({error:'출근 기록이 없어요. 먼저 출근을 눌러 주세요.'},400);if(locked(open))return json({error:'급여가 확정된 달이에요. 사장님께 말씀해 주세요.'},400);const err=applyClock(open,kind,now);if(err)return json({error:err},400);if(kind==='out')applyCredit(open,d);if(!attendanceSchema.safeParse(open).success)return json({error:'기록을 확인할 수 없어요. 사장님께 말씀해 주세요.'},400);msg=kind==='out'?`${e.name}님 퇴근했어요. 수고하셨어요!`:kind==='break'?`${e.name}님 휴게 시작`:`${e.name}님 휴게 끝`}
  d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:new Date(now).toISOString(),actor:{id:'kiosk',name:'매장 태블릿'},action:'근태 기록(태블릿)',target:e.name,before:null,after:{kind},reason:branch.name}].slice(-1000);
  const u=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),row.version+1,new Date(now).toISOString(),t.owner,row.version).run();
  if(u.meta.changes)return json({...view(),ok:msg});
 }
 return json({error:'잠시 뒤 다시 눌러 주세요.'},409);
 }catch(e){return serverError('kiosk',e,'태블릿 출퇴근을 처리하지 못했어요. 잠시 뒤 다시 눌러 주세요.')}
}
