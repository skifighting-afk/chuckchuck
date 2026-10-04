import {isIndustry,industryName} from '../lib/industries';
import {isHQ} from './admin-api';
import {normalizeTeam} from '../lib/team-model';
import {LEGAL,consentCurrent} from '../lib/legal';
import {plans,isPlan,TRIAL_DAYS,trialStatus,planLimits,monthlyPrice,capacityError} from '../lib/plans';
type Env={DB:D1Database,HQ_ADMIN_EMAIL?:string,HQ_NATIVE_USER_ID?:string};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function resolveStore(db:D1Database,userId:string){
  // Owners keep their existing store even if a stale invite also exists.
  const own=await db.prepare('SELECT owner,data,version,updated_at FROM stores WHERE owner=?').bind(userId).first<any>();
  if(own)return {row:own,owner:userId,access:'owner' as const};
  const linked=await db.prepare("SELECT stores.owner,stores.data,stores.version,stores.updated_at FROM stores, jsonb_array_elements(coalesce(stores.data::jsonb->'_members','[]'::jsonb)) AS m(value) WHERE (m.value->>'userId')=? LIMIT 1").bind(userId).first<any>();
  if(!linked)return null;
  const data=JSON.parse(linked.data),member=data._members?.find((m:any)=>m.userId===userId),employee=data.employees?.find((e:any)=>e.id===member?.employeeId);
  if(!employee||employee.status==='퇴사')return {row:linked,owner:linked.owner,access:'revoked' as const};
  return {row:linked,owner:linked.owner,access:employee.access==='중간관리자'?'manager' as const:'employee' as const};
}
export async function accountApi(request:Request,env:Env){
 const id=request.headers.get('oai-authenticated-user-id');
 if(!id)return json({error:'로그인 후 이용해 주세요.',code:'SIGN_IN_REQUIRED'},401);
 try{
  const email=request.headers.get('oai-authenticated-user-email')||'';
  const linked=await resolveStore(env.DB,id);
  if(linked?.access==='revoked')return json({error:'매장 이용 권한이 종료되었습니다.'},403);
  const data=linked?JSON.parse(linked.row.data):null;
  // 작업 016: 약관·처리방침 버전이 바뀌었거나 동의 기록이 없으면 다시 동의를 받는다.
  const consentRow=id.startsWith('native:')?await env.DB.prepare('SELECT terms_version,privacy_version FROM app_users WHERE id=?').bind(id).first<any>():null;
  const consentRequired=!!consentRow&&!consentCurrent(consentRow);
  const view=(d:any)=>({hq:isHQ(request,env),consentRequired,legal:{terms:LEGAL.terms.version,privacy:LEGAL.privacy.version},user:{email,authMethod:id.startsWith('native:')?'email':'chatgpt',role:request.headers.get('oai-authenticated-user-native-role')||'owner',emailVerified:!id.startsWith('native:')||request.headers.get('oai-authenticated-user-email-verified')==='true'},onboarded:!!d,access:linked?.access||'owner',storeName:d?.store?.name||'',industry:d?._account?.industry||null,industryName:industryName(d?._account?.industry),account:linked&&linked.access!=='owner'?null:d?{plan:d._account?.plan||null,status:trialStatus(d._account),trialEndsAt:d._account?.trialEndsAt||null,createdAt:d._account?.createdAt||null,autoRenew:false,storeSlots:planLimits(d._account).branches,limits:planLimits(d._account),monthlyPrice:isPlan(d._account?.plan)?monthlyPrice(d._account.plan,planLimits(d._account).branches):0}:null,usage:linked&&linked.access!=='owner'?null:d?{employees:d.employees.filter((e:any)=>e.status!=='퇴사').length,branches:d.branches?.length||1,perBranch:d.branches.map((b:any)=>({id:b.id,name:b.name,employees:d.employees.filter((e:any)=>e.branchId===b.id&&e.status!=='퇴사').length}))}:null,billing:{enabled:false,reason:'사업자 정보와 결제 서비스 연결을 준비하고 있어요. 현재 결제되지 않습니다.'}});
  if(request.method==='GET')return json(view(data));
  if(request.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청 출처를 확인할 수 없습니다.'},403);
  const raw=await request.text();if(raw.length>12000)return json({error:'요청이 너무 큽니다.'},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:'올바르지 않은 요청입니다.'},400)}
  if(b.action==='onboard'){
   if(request.headers.get('oai-authenticated-user-native-role')==='employee')return json({error:'직원 계정에서는 가게 합류를 신청해 주세요.'},403);
   if(linked)return json({error:'이미 연결된 매장이 있습니다.'},409);
   if(!email)return json({error:'이메일이 확인된 계정으로 로그인해 주세요.'},400);
   if(!isPlan(b.plan))return json({error:'요금제를 선택해 주세요.'},400);
   for(const key of ['storeName','branchName','ownerName'])if(typeof b[key]!=='string'||!b[key].trim()||b[key].trim().length>80)return json({error:'매장명·지점명·사장님 성함을 80자 이내로 입력해 주세요.'},400);
   if(b.industry!==undefined&&!isIndustry(b.industry))return json({error:'업종을 목록에서 선택해 주세요.'},400);
   if(b.acknowledged!==true)return json({error:'체험 운영 안내를 확인해 주세요.'},400);
   // 작업 017: 직원 개인정보는 사장님이 처리자, 척척사장봇은 수탁자다. 처리위탁 내용에 동의해야 가게를 만든다.
   if(b.dpaAgreed!==true)return json({error:'직원 개인정보 처리위탁 내용을 확인하고 동의해 주세요.',code:'DPA_REQUIRED'},400);
   const state=normalizeTeam(null);
   state.store={name:b.storeName.trim(),branch:b.branchName.trim()};
   state.branches=[{id:'branch-main',name:b.branchName.trim(),address:''}];
   state.employees=[];state.shifts=[];state.attendance=[];state.adjustments={};state.payrollRuns={};state.requests=[];delete state.legacy;
   state.settings={accountantName:'',accountantEmail:'',autoPayslip:false,autoContract:false,autoAccountant:false,employerName:b.ownerName.trim(),fivePlus:false};
   const now=new Date().toISOString();
   const next={...state,_account:{industry:b.industry||null,plan:b.plan,storeSlots:b.plan==='multi'?Math.max(2,Math.min(10,Math.floor(Number(b.storeSlots)||2))):1,status:b.plan==='free'?'free':'trialing',createdAt:now,trialEndsAt:b.plan==='free'?null:new Date(Date.now()+TRIAL_DAYS*86400000).toISOString(),trialUsed:b.plan!=='free',acknowledgedAt:now,noticeVersion:'prelaunch-2026-09',dpa:{version:LEGAL.dpa.version,agreedAt:now,by:id},autoRenew:false},_audit:[],_outbox:[],_members:[],_invitations:[]};
   const result=await env.DB.prepare('INSERT OR IGNORE INTO stores(owner,data,version,updated_at) VALUES(?,?,?,?)').bind(id,JSON.stringify(next),1,now).run();
   if(!result.meta.changes)return json({error:'이미 매장이 생성되었습니다. 새로고침해 주세요.'},409);
   return json(view(next),201);
  }
  if(!linked)return json({error:'매장 등록을 먼저 완료해 주세요.'},409);
  if(linked.access!=='owner')return json({error:'사장님만 이용권을 관리할 수 있습니다.'},403);
  if(b.action==='checkout')return json({error:'아직 결제를 받지 않습니다. 결제 서비스 연결 후 별도 동의로 시작됩니다.',code:'BILLING_NOT_READY'},503);
  if(!data._account)return json({error:'기존 매장은 현재 이용 상태가 유지됩니다. 정식 판매 전 요금제를 별도로 안내합니다.'},409);
  if(b.action==='changePlan'){
   if(b.plan!=='free'&&trialStatus(data._account)!=='trialing'&&data._account.trialUsed)return json({error:'유료 기능 체험을 이미 사용했습니다. 현재 결제 연결 전이며 무료 요금제로 계속 이용할 수 있습니다.'},403);
   if(!isPlan(b.plan))return json({error:'올바른 요금제를 선택해 주세요.'},400);
   const nextAccount={...data._account,plan:b.plan,storeSlots:b.plan==='multi'?Math.max(2,Math.min(10,Math.floor(Number(b.storeSlots)||2))):1};const exceeded=capacityError(data,nextAccount);if(exceeded)return json({error:exceeded},409);
   if(b.plan!=='free'&&!data._account.trialUsed){nextAccount.trialEndsAt=new Date(Date.now()+TRIAL_DAYS*86400000).toISOString();nextAccount.trialUsed=true;}
   nextAccount.status=b.plan==='free'?'free':'trialing';data._account=nextAccount;
  }else if(b.action==='endTrial'){
   if(b.confirm!==true)return json({error:'체험 종료 확인이 필요합니다.'},400);
   if(data._account.plan==='free')return json({error:'무료 요금제에는 종료할 유료 체험이 없습니다.'},400);data._account.status='cancelled';data._account.cancelledAt=new Date().toISOString();
  }else return json({error:'지원하지 않는 작업입니다.'},400);
  data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id,name:email,email},action:b.action==='endTrial'?'체험 종료':'체험 요금제 변경',target:'이용권',before:null,after:{plan:data._account.plan,status:trialStatus(data._account)},reason:'계정 관리'}];
  const saved=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),linked.row.version+1,new Date().toISOString(),id,linked.row.version).run();
  return saved.meta.changes?json(view(data)):json({error:'다른 변경이 있습니다. 새로고침해 주세요.'},409);
 }catch(error){console.error('Account request failed',error instanceof Error?error.name:'Unknown');return json({error:'계정 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},500)}
}
