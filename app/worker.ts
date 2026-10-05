import {authLimit} from './auth-api';
import {cronApi} from './cron-api';
import {recordServerError} from '../lib/ops-alert';
import {documentsApi} from './documents-api';
import {serverError,reportError} from '../lib/errors';
import {payslipText,payslipProblems} from '../lib/payslip';
import {normalizeJoinCode} from '../lib/join-code';
import {contractsApi} from './contracts-api';
import {personalTeam} from '../lib/personal-team';
import {nativeAuth,withNativeIdentity,type AuthEnv} from './auth-api';
import {adminApi,isHQ} from './admin-api';
import {correctionError} from '../lib/attendance-review';
import {teamSchema,normalizeTeam,calculate,contractText,kdate,attendanceSchema,newMember} from '../lib/team-model';
import {managerApi} from './manager-api';
import {staffJoinApi} from './staff-join-api';
import {accountApi,resolveStore} from './saas-api';
import {plans,trialStatus,isPlan,canWrite,capacityError,hasFeature} from '../lib/plans';
import {evidenceApi} from './evidence-api';
import {manualApi} from './manual-api';
import {pushApi,notifyUser} from './push-api';
import {qrTokenOk} from '../lib/qr-live';
import {qrLiveApi} from './qr-live-api';
import {exportApi} from './export-api';
import {withdrawApi,processDeletions} from './withdraw-api';
import {operationsApi} from './operations-api';
import {extendAttendance} from './attendance-store';
type Env=AuthEnv&{HQ_ADMIN_EMAIL?:string,HQ_NATIVE_USER_ID?:string,DB:D1Database,ASSETS?:{fetch:(r:Request)=>Promise<Response>},RESEND_API_KEY?:string,EMAIL_FROM?:string,VAPID_PUBLIC_KEY?:string,VAPID_PRIVATE_KEY?:string,VAPID_SUBJECT?:string,CRON_SECRET?:string};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
import {same} from '../lib/same';
import {findShiftConflict} from '../lib/schedule-tools';
const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function slipText(row:any,month:string,date:string,store:string){return payslipText(store,month,date,row)}
// 가이드 44: 모든 요청을 감싸서 서버 오류(5xx)가 잇달아 나면 본사에 알린다.
export async function api(request:Request,env:Env){
 const path=new URL(request.url).pathname;let res:Response;
 try{res=await route(request,env)}catch(e){res=serverError('api',e)}
 if(res.status>=500&&res.status!==503){const id=await res.clone().json().then((d:any)=>d?.errorId).catch(()=>undefined);await recordServerError(env.DB as any,path,id,m=>notifyUser(env as any,env.HQ_NATIVE_USER_ID,m)).catch(e=>reportError('ops-alert',e))}
 return res;
}
async function route(request:Request,env:Env){
 const path=new URL(request.url).pathname;
 // 작업 056: 기한이 지난 탈퇴 예약을 로그인·계정 요청 때 조금씩 마무리한다.
 if(path==='/api/auth'||path==='/api/account')await processDeletions(env).catch(e=>{reportError('withdraw-purge',e);return 0});
 if(path==='/api/cron')return cronApi(request,env);
 if(path==='/api/auth')return nativeAuth(request,env);
 request=await withNativeIdentity(request,env);
 // 작업 078: 모든 서버 경로 요청 제한 — IP당 분당 600회, 계정당 저장 요청 분당 300회(로그인 경로는 따로 더 엄격)
 {const ip=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim()||request.headers.get('cf-connecting-ip')||'',uid=request.headers.get('oai-authenticated-user-id');
  const slow=()=>Response.json({error:'요청이 너무 많아요. 1분 뒤 다시 시도해 주세요.',code:'RATE_LIMITED'},{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
  if(ip&&!await authLimit(env as any,'api-ip:'+ip,600,60000))return slow();
  if(uid&&request.method!=='GET'&&!await authLimit(env as any,'api-user:'+uid,300,60000))return slow();}
 if(path==='/api/admin')return adminApi(request,env);
 if(path==='/api/documents')return documentsApi(request,env);
 if(path==='/api/contracts')return contractsApi(request,env);
 if(path==='/api/manager')return managerApi(request,env);
 if(path==='/api/staff-join')return staffJoinApi(request,env);
 if(path==='/api/account')return accountApi(request,env);
 if(path==='/api/evidence')return evidenceApi(request,env);
 if(path==='/api/manual')return manualApi(request,env);
 if(path==='/api/push')return pushApi(request,env);
 if(path==='/api/qr-live')return qrLiveApi(request,env);
 if(path==='/api/export')return exportApi(request,env);
 if(path==='/api/withdraw')return withdrawApi(request,env);
 if(path==='/api/operations')return operationsApi(request,env);
 if(!['/api/store','/api/join'].includes(path))return json({error:'없는 기능이에요. 새로고침한 뒤 다시 시도해 주세요.'},404);
 const userId=request.headers.get('oai-authenticated-user-id');if(!userId)return json({error:'로그인 후 이용해 주세요.'},401);
 try{
 if(new URL(request.url).pathname==='/api/join')return join(request,env,userId);
 const linked=await resolveStore(env.DB,userId);
 if(!linked)return json({error:'매장 등록을 먼저 완료해 주세요.',code:'ONBOARDING_REQUIRED'},409);
 if(linked.access==='revoked')return json({error:'이 가게를 볼 권한이 없어요. 사장님께 연결을 요청해 주세요.'},403);
 const owner=linked.owner,row=linked.row;
 const raw=row?JSON.parse(row.data):null;let state=normalizeTeam(raw);
 // 작업 026: 승인된 휴가(주휴 개근 판단용, 읽기 전용)
 (state as any).approvedLeaves=(raw?._operations?.leaves||[]).filter((l:any)=>l.status==='승인'&&l.start&&l.end).map((l:any)=>({employeeId:l.employeeId,start:l.start,end:l.end}));let audit:any[]=raw?._audit||[],outbox:any[]=raw?._outbox||[],invitations:any[]=raw?._invitations||[],members:any[]=raw?._members||[];const version=row?.version||0;
 const self=state.employees.find(e=>e.id===members.find(m=>m.userId===userId)?.employeeId),access=owner===userId?'owner':self?.access==='중간관리자'?'manager':'employee';
 if(owner!==userId&&(!self||self.status==='퇴사'))return json({error:'이 가게를 볼 권한이 없어요. 사장님께 연결을 요청해 주세요.'},403);
 let name=request.headers.get('oai-authenticated-user-full-name')||request.headers.get('oai-authenticated-user-email')||'사장님';try{if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8')name=decodeURIComponent(name)}catch{}
 const actor={id:userId,name:self?.name||name,email:request.headers.get('oai-authenticated-user-email')||''};
 let inviteUrl:string|undefined;let attendanceQrUrl:string|undefined;
 const result=()=>{
  if(access==='owner')return {state,version:version+1,audit,outbox,actor,emailConnected:!!(env.RESEND_API_KEY&&env.EMAIL_FROM),access,selfId:null,inviteUrl,attendanceQrUrl,qrModes:raw?._attendanceQrMode||{},plan:raw?._account||null,qrRequired:hasFeature(raw?._account,'qr')};
  const filtered=personalTeam(state,self!.id);
  return {state:filtered,version:version+1,audit:[],outbox:[],actor,emailConnected:false,access,selfId:self!.id,plan:raw?._account?{plan:raw._account.plan}:null,qrRequired:hasFeature(raw?._account,'qr')};
 };
 if(request.method==='GET')return json({...result(),version,updatedAt:row?.updated_at});
 if(raw?._account?.deletion)return json({error:'탈퇴를 예약해 가게가 읽기 전용이에요. 계정 화면에서 예약을 취소하면 다시 저장할 수 있어요.',code:'WITHDRAW_PENDING'},403);
 if(raw?._account&&!canWrite(raw._account))return json({error:'체험이 끝났어요. 기록 조회·내려받기는 계속 되고, 계정·요금제 화면에서 요금제를 결제하면 다시 저장할 수 있어요.',code:'TRIAL_ENDED'},403);
 if(!['PUT','POST'].includes(request.method))return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장봇 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const text=await request.text();if(text.length>1500000)return json({error:'한 번에 저장할 수 있는 양을 넘었어요. 오래된 기록을 정리하거나 나눠서 저장해 주세요.'},413);
 let b:any;try{b=JSON.parse(text)}catch{return json({error:'요청을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
 if(access!=='owner'&&(request.method==='PUT'||!['attendance','request'].includes(b.action)))return json({error:'이 작업은 사장님만 할 수 있어요. 사장님께 요청해 주세요.'},403);
 if(access!=='owner'&&b.action==='attendance'&&b.employeeId!==self!.id)return json({error:'본인 출퇴근만 기록할 수 있어요. 내 계정으로 로그인했는지 확인해 주세요.'},403);
 if(access!=='owner'&&b.action==='request'){const target=state.attendance.find(a=>a.id===b.id);if(!target||target.employeeId!==self!.id)return json({error:'본인 출퇴근만 정정 요청할 수 있어요.'},403);}
 // 출퇴근은 화면이 조금 오래돼도 지금 서버 기록을 기준으로 처리한다(같은 시각에 여러 직원이 찍어도 막지 않음). 저장은 아래 version 조건으로 원자적.
 if(b.action!=='attendance'&&b.version!==version)return json({error:'다른 화면의 변경 사항이 있습니다. 새로고침 후 다시 시도해 주세요.'},409);
 const fail=(message:string)=>{throw new Error(message)};
 const log=(action:string,target:string,before:any,after:any,reason='')=>audit.push({id:crypto.randomUUID(),at:new Date().toISOString(),actor,action,target,before,after,reason});
 const enqueue=(key:string,to:string,subject:string,body:string)=>{if(!outbox.some(m=>m.key===key))outbox.push({id:crypto.randomUUID(),key,to,subject,body,status:to?'발송 대기':'수신 주소 필요',createdAt:new Date().toISOString(),providerId:null})};
 const locked=(a:any)=>Object.values(state.payrollRuns).some((r:any)=>r.locked&&r.month===kdate(a.start).slice(0,7)&&r.rows.some((e:any)=>e.employeeId===a.employeeId));
 if(request.method==='PUT'){
  // 작업 045: 출퇴근 기록은 이 경로로 바꿀 수 없으므로 서버 기록을 그대로 쓴다(화면은 보내지 않아도 된다).
  const sig=(list:any[])=>JSON.stringify((list||[]).map((x:any)=>[x.id,x.employeeId,x.start,x.end??null,x.breakMinutes,x.breakStart??null]).sort());
  if(b.state&&typeof b.state==='object'){if(Array.isArray(b.state.attendance)&&b.state.attendance.length&&sig(b.state.attendance)!==sig(state.attendance))return json({error:'출퇴근 기록은 기록·수정 요청 버튼으로 처리해 주세요.'},400);b.state.attendance=state.attendance;}
  const p=teamSchema.safeParse(b.state);if(!p.success)return json({error:p.error.issues[0].message},400);const next=p.data;next.attendance=state.attendance;
  const exceeded=capacityError(next,raw?._account);if(exceeded)return json({error:exceeded,code:'CAPACITY_EXCEEDED'},400);
  if(!hasFeature(raw?._account,'payroll')&&!same(state.adjustments,next.adjustments))fail('급여 항목 관리는 베이직부터 이용할 수 있어요.');
  if(!same(state.payrollRuns,next.payrollRuns)||!same(state.requests,next.requests))fail('급여 확정·승인은 전용 버튼으로 처리해 주세요.');
  if(!same(state.attendance,next.attendance))fail('출퇴근 기록은 기록·수정 요청 버튼으로 처리해 주세요.');
  for(const r of Object.values(state.payrollRuns) as any[])if(r.locked&&!same(calculate(state,r.month).filter(x=>r.rows.some((y:any)=>y.employeeId===x.employeeId)),calculate(next,r.month).filter(x=>r.rows.some((y:any)=>y.employeeId===x.employeeId))))fail('확정된 급여에 영향을 주는 변경입니다. 먼저 확정을 해제해 주세요.');
  for(const e of next.employees){const prev=state.employees.find(x=>x.id===e.id);if(!same(e.contract.signedAt,prev?.contract.signedAt??null)||!same(e.contract.signedBy,prev?.contract.signedBy??null)||e.contract.status==='체결 완료'&&prev?.contract.status!=='체결 완료')fail('체결 기록은 계약서 화면에서 별도로 등록해 주세요.');if(!prev&&(!e.email||!e.phone||!e.contract.workplace||!e.contract.employer))fail('신규 직원의 이메일·연락처·근무장소·사업주를 입력해 주세요.');if(prev?.contract.status==='체결 완료'&&(!same(prev.contract,e.contract)||contractText(state,prev)!==contractText(next,e)))fail('체결된 계약은 먼저 변경 계약 작성을 시작해 주세요.');}
  if(!hasFeature(raw?._account,'contracts'))for(const e of next.employees){const prev=state.employees.find(x=>x.id===e.id);const baseline=prev?.contract||newMember(e.branchId).contract;const detailed=(v:any)=>{const {workplace,employer,...rest}=v;return rest};if(!same(detailed(e.contract),detailed(baseline)))fail('근로계약서 작성은 베이직부터 이용할 수 있어요.');}
  if(!same(state.employees,next.employees))log('직원 정보 변경','직원 관리',state.employees,next.employees,b.reason||'정보 등록·변경');
  // 작업 055: 매니저 권한 부여·변경·회수는 따로 남긴다
  for(const e of next.employees){const p=state.employees.find(x=>x.id===e.id);if(!p)continue;const before={access:p.access,permissions:[...(p.managerPermissions||[])].sort()},after={access:e.access,permissions:[...(e.managerPermissions||[])].sort()};if(!same(before,after))log(after.access==='중간관리자'&&before.access!=='중간관리자'?'매니저 권한 부여':before.access==='중간관리자'&&after.access!=='중간관리자'?'매니저 권한 회수':'매니저 권한 변경',e.name,before,after,b.reason||'')}
  if(!same(state.shifts,next.shifts)){for(const shift of next.shifts){if(raw?._operations?.leaves?.some((l:any)=>l.status==='승인'&&l.employeeId===shift.employeeId&&shift.date>=l.start&&shift.date<=l.end))fail('승인된 휴가 날짜에는 근무를 등록할 수 없습니다.');}if(findShiftConflict(next.shifts as any))fail('같은 직원의 근무시간이 겹칩니다. 날짜와 시간을 확인해 주세요.');}
  if(!same(state.shifts,next.shifts))log('스케줄 변경','근무 스케줄',state.shifts,next.shifts);
  if(!same(state.settings,next.settings))log('설정 변경','설정',state.settings,next.settings);
  if(!same(state.adjustments,next.adjustments))log('급여 항목 변경','급여',state.adjustments,next.adjustments);
  state=next;
 }else switch(b.action){
 case 'invite':{const e=state.employees.find(e=>e.id===b.id);if(!e?.email)fail('직원 이메일을 먼저 등록해 주세요.');const token=crypto.randomUUID()+crypto.randomUUID();const hash=await hashToken(token);invitations=invitations.filter(i=>i.employeeId!==e!.id);invitations.push({hash,employeeId:e!.id,email:e!.email.toLowerCase(),expires:Date.now()+7*86400000});inviteUrl=new URL('/?invite='+token,request.url).href;log('직원 초대 링크 생성',e!.name,null,{expires:'7일'});break;}
 case 'attendanceQr':{if(!state.branches.some(x=>x.id===b.branchId))fail('매장을 확인해 주세요.');raw._attendanceQr ||= {};if(b.mode==='dynamic'||b.mode==='static'){raw._attendanceQrMode={...(raw._attendanceQrMode||{}),[b.branchId]:b.mode}}if(!raw._attendanceQr[b.branchId]||b.rotate===true)raw._attendanceQr[b.branchId]=crypto.randomUUID()+crypto.randomUUID();attendanceQrUrl=new URL('/app?branch='+encodeURIComponent(b.branchId)+'&attendanceQr='+encodeURIComponent(raw._attendanceQr[b.branchId])+'#attendance',request.url).href;log('출퇴근 QR 발급',b.branchId,null,{renewed:b.rotate===true,mode:raw._attendanceQrMode?.[b.branchId]||'static'});break;}
 case 'attendance':{if(access!=='owner'&&['in','out'].includes(b.kind)&&hasFeature(raw?._account,'qr')){if(!await qrTokenOk(raw?._attendanceQr?.[self!.branchId],raw?._attendanceQrMode?.[self!.branchId],b.qrToken))return json({error:raw?._attendanceQrMode?.[self!.branchId]==='dynamic'?'QR을 찍은 지 1분이 지났어요. 매장 화면의 QR을 다시 찍고 바로 기록해 주세요.':'매장의 새 출퇴근 QR을 찍은 뒤 다시 기록해 주세요.',code:'QR_REQUIRED'},403);}const e=state.employees.find(e=>e.id===b.employeeId);if(!e||e.status==='퇴사')fail('재직 중인 직원을 선택해 주세요.');const a=state.attendance.find(a=>a.employeeId===b.employeeId&&!a.end);if(b.kind==='in'){if(a)fail('이미 출근한 직원입니다.');const n={id:crypto.randomUUID(),employeeId:b.employeeId,start:new Date().toISOString(),end:null,breakMinutes:0,breakStart:null};if(locked(n))fail('확정된 월은 변경할 수 없습니다.');state.attendance.push(n);log('출근 기록',e!.name,null,n);}else{if(!a)fail('출근 기록이 없습니다.');if(locked(a))fail('급여 확정을 먼저 해제해 주세요.');const before={...a!};if(b.kind==='break'){if(a!.breakStart)fail('이미 휴게 중입니다.');a!.breakStart=new Date().toISOString()}else{if(a!.breakStart){a!.breakMinutes+=(Date.now()-+new Date(a!.breakStart))/60000;a!.breakStart=null}if(b.kind==='out')a!.end=new Date().toISOString();else if(b.kind!=='resume')fail('지원하지 않는 기록입니다.')}log('근태 기록',e!.name,before,a);}break;}
 case 'request':{if(state.requests.some(r=>r.before.id===b.id&&r.status==='승인 대기'))fail('이미 확인 중인 수정 요청이 있어요. 처리 상태를 확인해 주세요.');const before=state.attendance.find(a=>a.id===b.id);if(!before)fail('기록을 찾을 수 없습니다.');if(locked(before))fail('급여 확정을 먼저 해제해 주세요.');if(!b.reason?.trim())fail('수정 사유를 입력해 주세요.');const after=attendanceSchema.parse({...before,start:b.start,end:b.end,breakMinutes:Number(b.breakMinutes),breakStart:null});if(locked(after))fail('변경 후 날짜가 급여 확정 기간입니다.');const conflict=correctionError(state.attendance,before,after);if(conflict)fail(conflict);state.requests.push({id:crypto.randomUUID(),before,after,reason:String(b.reason).slice(0,1000),actor,at:new Date().toISOString(),status:'승인 대기'});log('출퇴근 수정 요청',before!.employeeId,before,after,b.reason);break;}
 case 'review':{const r=state.requests.find(x=>x.id===b.id);if(!r||r.status!=='승인 대기')fail('처리할 요청이 없습니다.');if(typeof b.approve!=='boolean')fail('승인 또는 반려를 선택해 주세요.');if(b.approve){const conflict=correctionError(state.attendance,r.before,r.after);if(conflict)fail(conflict);const current=state.attendance.find(a=>a.id===r.before.id);if(!same(current,r.before))fail('요청 이후 원본이 변경되어 승인할 수 없습니다.');if(locked(current)||locked(r.after))fail('급여 확정을 먼저 해제해 주세요.');state.attendance=state.attendance.map(a=>a.id===r.before.id?r.after:a);}r.status=b.approve?'승인':'반려';r.reviewer=actor;r.reviewedAt=new Date().toISOString();log('수정 '+r.status,r.before.employeeId,r.before,b.approve?r.after:r.before,r.reason);break;}
 case 'finalize':{if(!hasFeature(raw?._account,'payroll'))fail('급여 마감은 베이직부터 이용할 수 있어요. 계정·요금제에서 체험해 보세요.');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month)||!/^\d{4}-\d{2}-\d{2}$/.test(b.payDate)||!Number.isFinite(Date.parse(b.payDate))||new Date(b.payDate).toISOString().slice(0,10)!==b.payDate)fail('급여 월과 지급일을 확인해 주세요.');const key=b.month+':'+b.branch;await extendAttendance(env.DB,owner,state,new Date(Date.parse(b.month+'-01T00:00:00+09:00')-7*86400000).toISOString(),raw?._attendanceFrom);if(state.payrollRuns[key]?.locked)fail('이미 확정했습니다.');const rows=calculate(state,b.month).filter(e=>e.branchId===b.branch);if(!rows.length)fail('해당 지점의 직원이 없습니다.');{const zero=rows.filter(x=>x.hours>0&&x.gross===0&&!(state.employees.find(e=>e.id===x.employeeId)?.wage));if(zero.length)fail(`임금이 0원인 직원이 있어요(${zero.map(x=>x.name).join(', ')}). 직원 관리에서 임금을 입력한 뒤 확정해 주세요.`);}if(rows.some(x=>x.net<0))fail('공제 합계가 지급액보다 큰 직원이 있습니다.');{const bad=payslipProblems(state.store.name,b.month,b.payDate,rows as any);if(bad.length)fail(`임금명세서 필수 기재사항이 빠지는 직원이 있어요: ${bad.map(x=>x.name+'('+x.missing.join('·')+')').join(', ')}. 급여 화면에서 해당 항목의 계산 근거를 입력해 주세요.`);}if(state.attendance.some(a=>!a.end&&kdate(a.start).startsWith(b.month)&&rows.some(e=>e.employeeId===a.employeeId)))fail('퇴근 처리되지 않은 기록을 확인해 주세요.');const revision=(state.payrollRuns[key]?.revision||0)+1;state.payrollRuns[key]={locked:true,month:b.month,branch:b.branch,payDate:b.payDate,rows,at:new Date().toISOString(),actor,revision};log('급여 확정',key,null,state.payrollRuns[key]);if(state.settings.autoPayslip)for(const e of rows)enqueue(key+':'+revision+':'+e.employeeId,e.email,b.month+' 급여명세서 · '+state.store.name,slipText(e,b.month,b.payDate,state.store.name));if(state.settings.autoAccountant)enqueue(key+':'+revision+':accountant',state.settings.accountantEmail,b.month+' 급여 자료 · '+state.store.name,rows.map(e=>{const emp=state.employees.find(x=>x.id===e.employeeId)!;return [slipText(e,b.month,b.payDate,state.store.name),'소득: '+emp.income,'보험: '+Object.entries(emp.insurances).map(([n,i])=>n+' '+i.status+' '+i.reason).join(', ')].join('\n')}).join('\n\n----------------\n\n'));break;}
 case 'reopen':{const r=state.payrollRuns[b.key];if(!r?.locked||!b.reason?.trim())fail('확정 건과 해제 사유를 확인해 주세요.');r.locked=false;for(const m of outbox)if(m.key.startsWith(b.key+':')&&['발송 대기','수신 주소 필요'].includes(m.status))m.status='확정 해제로 취소';log('급여 확정 해제',b.key,null,null,b.reason);break;}
 case 'contract':{if(!hasFeature(raw?._account,'contracts'))fail('근로계약서는 베이직부터 이용할 수 있어요.');const e=state.employees.find(e=>e.id===b.id);if(!e)fail('직원을 찾을 수 없습니다.');if(!b.reason?.trim())fail('서면 체결일·보관 위치 등 확인 근거를 입력해 주세요.');const before={...e!.contract};if(b.reset){e!.contract.status='검토 중';e!.contract.signedAt=null;e!.contract.signedBy=null;}else{if(!e!.email||!e!.contract.employer||!e!.contract.workplace)fail('계약 필수 정보를 입력해 주세요.');e!.contract.status='체결 완료';e!.contract.signedAt=new Date().toISOString();e!.contract.signedBy='서면 체결 확인 등록: '+actor.name+' / '+b.reason;if(state.settings.autoContract)enqueue('contract:'+e!.id+':'+e!.contract.signedAt,e!.email,'근로조건 확인서 사본 · '+state.store.name,contractText(state,e!));}log(b.reset?'변경 계약 시작':'서면 계약 확인',e!.name,before,e!.contract,b.reason);break;}
 case 'queueContract':{if(!hasFeature(raw?._account,'contracts'))fail('근로계약서는 베이직부터 이용할 수 있어요.');const e=state.employees.find(e=>e.id===b.id);if(!e?.email)fail('직원 이메일을 먼저 등록해 주세요.');enqueue('contract-manual:'+crypto.randomUUID(),e!.email,'근로조건 확인서 · '+state.store.name,contractText(state,e!));log('계약 이메일 준비',e!.name,null,null);break;}
 case 'send':{const m=outbox.find(m=>m.id===b.id);if(!m||m.status!=='발송 대기')fail('발송 대기 건만 전송할 수 있습니다.');if(!env.RESEND_API_KEY||!env.EMAIL_FROM)fail('발신 이메일 서비스가 연결되지 않았습니다.');if(!m.to)fail('수신 주소가 없습니다.');m.status='발송 처리 중';m.attemptedAt=new Date().toISOString();log('이메일 발송 요청',m.to,null,{id:m.id,subject:m.subject});break;}
 default:fail('지원하지 않는 작업입니다.');
 }
 delete (state as any).approvedLeaves;const checked=teamSchema.safeParse(state);if(!checked.success)return json({error:checked.error.issues[0].message},400);
 const data=JSON.stringify({...checked.data,_attendanceQr:raw?._attendanceQr,_attendanceQrMode:raw?._attendanceQrMode,_hq:raw?._hq,_joinTerms:raw?._joinTerms,_joinCodes:raw?._joinCodes,_joinApplications:raw?._joinApplications,_account:raw?._account,_operations:raw?._operations,_manuals:raw?._manuals,_attendanceFrom:raw?._attendanceFrom,_audit:audit,_outbox:outbox,_invitations:invitations,_members:members}),updatedAt=new Date().toISOString();
 const q=version===0?env.DB.prepare('INSERT OR IGNORE INTO stores(owner,data,version,updated_at) VALUES(?,?,?,?)').bind(owner,data,1,updatedAt):env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(data,version+1,updatedAt,owner,version);
 if(!(await q.run()).meta.changes)return json({error:'동시에 변경된 내용이 있습니다. 새로고침해 주세요.'},409);
 // 작업 092: 출퇴근 정정 결과를 요청한 사람에게 알림
 if(b.action==='review'){const r=state.requests.find((x:any)=>x.id===b.id);if(r?.actor?.id&&r.actor.id!==request.headers.get('oai-authenticated-user-id'))await notifyUser(env,r.actor.id,{title:'출퇴근 정정 '+r.status,body:`${kdate(r.before.start)} 기록 정정 요청이 ${r.status}되었어요.`,url:'/app'})}
 if(b.action==='send'){
  const m=outbox.find(m=>m.id===b.id);let status='결과 확인 필요',providerId=null;
  try{const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'onjang-'+m.id},body:JSON.stringify({from:env.EMAIL_FROM,to:[m.to],subject:m.subject,html:'<pre style="font-family:sans-serif;white-space:pre-wrap">'+esc(m.body)+'</pre>'})});const r:any=await resp.json();status=resp.ok&&r.id?'발송 접수':'발송 실패';providerId=r.id||null;}catch{}
  for(let attempt=0;attempt<4;attempt++){const latest=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(owner).first<any>();const d=JSON.parse(latest.data);const target=d._outbox.find((x:any)=>x.id===m.id);Object.assign(target,{status,providerId,processedAt:new Date().toISOString()});const saved=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),latest.version+1,new Date().toISOString(),owner,latest.version).run();if(saved.meta.changes)return json({...result(),state:normalizeTeam(d),audit:d._audit,outbox:d._outbox,version:latest.version+1});}return json({error:'발송 결과를 새로고침하여 확인해 주세요. 중복 전송하지 마세요.'},409);
 }
 return json(result());
 }catch(error){return error instanceof Error&&error.name!=='PostgresError'&&!/D1|SQLITE|constraint|database|relation|syntax/i.test(error.message)?json({error:error.message},400):serverError('store',error,'처리하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.',400)}
}
const appRoutes=new Set(['/admin','/admin/login','/','/app','/signup','/login','/account','/start','/demo','/try','/terms','/privacy','/employee','/staff-requests','/logout','/verify-email','/contracts','/manager','/qr-screen','/help','/refund']);
export default {async fetch(request:Request,env:Env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return api(request,env);
 if(['GET','HEAD'].includes(request.method)&&url.pathname.startsWith('/j/')){const code=normalizeJoinCode(url.pathname.slice(3));return code?Response.redirect(new URL('/employee?code='+encodeURIComponent(code),url).href,302):new Response('가게 링크를 다시 확인해 주세요.',{status:404});}
 // Sites asset serving does not guarantee Wrangler's SPA fallback at runtime.
 // Serve the entry document explicitly for known client routes; retain the
 // browser URL/query so onboarding, staff links and account routing still work.
 if(['GET','HEAD'].includes(request.method)&&appRoutes.has(url.pathname.replace(/\/$/,'')||'/')){
  url.pathname='/';url.search='';
  return env.ASSETS!.fetch(new Request(url,request));
 }
 return env.ASSETS!.fetch(request);
}};
async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('')}
async function join(request:Request,env:Env,userId:string){
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'초대 주소가 올바르지 않아요. 사장님께 새 초대 링크를 요청해 주세요.'},403);
 const b:any=await request.json();if(typeof b.token!=='string'||b.token.length>100)return json({error:'초대 링크가 올바르지 않아요. 사장님께 새 초대 링크를 요청해 주세요.'},400);
 const hash=await hashToken(b.token),row=await env.DB.prepare("SELECT stores.owner,stores.data,stores.version FROM stores, jsonb_array_elements(coalesce(stores.data::jsonb->'_invitations','[]'::jsonb)) AS i(value) WHERE (i.value->>'hash')=? LIMIT 1").bind(hash).first<any>();
 if(!row)return json({error:'초대 링크가 만료됐거나 이미 쓰였어요. 사장님께 새 링크를 요청해 주세요.'},400);
 const data=JSON.parse(row.data),invite=data._invitations.find((i:any)=>i.hash===hash),email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
 if(userId.startsWith('native:')&&request.headers.get('oai-authenticated-user-email-verified')!=='true')return json({error:'이메일 가입 직원은 가게 코드로 합류를 신청하고 사장님의 수락을 받아 주세요.'},403);
 if(invite.expires<Date.now()||!email||email!==invite.email)return json({error:'초대받은 이메일 계정으로 로그인해 주세요. 초대는 7일간 유효합니다.'},403);
 if(userId===row.owner)return json({error:'사장님 계정으로는 직원 초대를 받을 수 없어요. 직원 계정으로 로그인해 주세요.'},400);
 const existing=await env.DB.prepare("SELECT owner FROM stores WHERE try_jsonb(data)->'_members' @> jsonb_build_array(jsonb_build_object('userId',CAST(? AS text))) LIMIT 1").bind(userId).first<any>();
 const own=await env.DB.prepare('SELECT owner FROM stores WHERE owner=?').bind(userId).first<any>();if(own)return json({error:'이미 사장님 매장이 연결된 계정입니다. 다른 직원 계정을 사용해 주세요.'},409);
 if(data._account&&!canWrite(data._account))return json({error:'이 가게의 체험이 끝나 지금은 초대를 받을 수 없어요. 사장님께 알려 주세요.'},403);
 if(existing)return json({error:'이미 가게에 연결된 계정이에요. 로그인하면 바로 가게로 들어가요.'},409);
 if(data._members?.some((m:any)=>m.employeeId===invite.employeeId))return json({error:'이미 연결된 직원이에요. 목록을 새로고침해 주세요.'},409);
 data._members=[...(data._members||[]),{userId,employeeId:invite.employeeId}];data._invitations=data._invitations.filter((i:any)=>i.hash!==hash);
 data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id:userId,name:email,email},action:'직원 초대 수락',target:invite.employeeId,before:null,after:null,reason:'초대 이메일 일치 확인'}];
 const r=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),row.version+1,new Date().toISOString(),row.owner,row.version).run();
 return r.meta.changes?json({ok:true}):json({error:'다시 시도해 주세요.'},409);
}




