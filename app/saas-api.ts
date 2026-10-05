import {confirmSigner} from './auth-api';
import {checkBusiness} from '../lib/nts';
import {isIndustry,industryName} from '../lib/industries';
import {serverError} from '../lib/errors';
import {isHQ} from './admin-api';
import {normalizeTeam} from '../lib/team-model';
import {hydrateAttendance} from './attendance-store';
import {LEGAL,consentCurrent} from '../lib/legal';
import {plans,planId,TRIAL_DAYS,trialStatus,planLimits,monthlyPrice,periodPrice,capacityError,branchCount,MAX_BRANCHES,CONTRACTS_FREE_PER_MONTH,CONTRACT_EXTRA_PRICE,trialNotice,validBizNo} from '../lib/plans';
type Env={DB:D1Database,HQ_ADMIN_EMAIL?:string,HQ_NATIVE_USER_ID?:string,NTS_API_KEY?:string};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function resolveStore(db:D1Database,userId:string){
  // Owners keep their existing store even if a stale invite also exists.
  const own=await db.prepare('SELECT owner,data,version,updated_at FROM stores WHERE owner=?').bind(userId).first<any>();
  if(own){own.data=JSON.stringify(await hydrateAttendance(db,userId,JSON.parse(own.data)));return {row:own,owner:userId,access:'owner' as const};}
  const linked=await db.prepare("SELECT owner,data,version,updated_at FROM stores WHERE try_jsonb(data)->'_members' @> jsonb_build_array(jsonb_build_object('userId',CAST(? AS text))) LIMIT 1").bind(userId).first<any>();
  if(!linked)return null;
  const data=await hydrateAttendance(db,linked.owner,JSON.parse(linked.data));linked.data=JSON.stringify(data);
  const member=data._members?.find((m:any)=>m.userId===userId),employee=data.employees?.find((e:any)=>e.id===member?.employeeId);
  if(!employee||employee.status==='퇴사')return {row:linked,owner:linked.owner,access:'revoked' as const};
  return {row:linked,owner:linked.owner,access:employee.access==='중간관리자'?'manager' as const:'employee' as const};
}
/** 계정 화면에 보여 줄 요금 정보(VAT 포함) */
export function accountView(a:any,contractsThisMonth=0){
 const plan=planId(a?.plan),branches=branchCount(a),months=[1,6,12].includes(Number(a?.months))?Number(a.months):1;
 return {plan,planName:plan?plans[plan].name:null,deletion:a?.deletion||null,status:trialStatus(a),trialEndsAt:a?.trialEndsAt||null,createdAt:a?.createdAt||null,autoRenew:false,
  storeSlots:branches,limits:planLimits(a),months,monthlyPrice:plan?monthlyPrice(plan,branches):0,periodPrice:plan?periodPrice(plan,branches,months as 1|6|12):0,vatIncluded:true,qr:plan==='pro'||trialStatus(a)==='trialing',
  notice:trialNotice(a),cancelAt:a?.cancelAt||null,bizCheck:a?.bizCheck||null,transfer:a?.transfer&&Date.parse(a.transfer.expiresAt)>Date.now()?{toEmail:a.transfer.toEmail,expiresAt:a.transfer.expiresAt}:null,periodStart:a?.periodStart||null,billing:a?.billing||null,invoiceRequests:(a?.invoiceRequests||[]).slice(-24),
  contracts:{thisMonth:contractsThisMonth,free:CONTRACTS_FREE_PER_MONTH,extra:Math.max(0,contractsThisMonth-CONTRACTS_FREE_PER_MONTH),extraPrice:CONTRACT_EXTRA_PRICE}};
}
export async function accountApi(request:Request,env:Env){
 const id=request.headers.get('oai-authenticated-user-id');
 if(!id)return json({error:'로그인 후 이용해 주세요.',code:'SIGN_IN_REQUIRED'},401);
 try{
  const email=request.headers.get('oai-authenticated-user-email')||'';
  const linked=await resolveStore(env.DB,id);
  if(linked?.access==='revoked')return json({error:'이 가게 이용이 끝났어요. 받은 서류는 \'내 서류 보기\'에서 확인할 수 있어요.'},403);
  const data=linked?JSON.parse(linked.row.data):null;
  // 작업 016: 약관·처리방침 버전이 바뀌었거나 동의 기록이 없으면 다시 동의를 받는다.
  const consentRow=id.startsWith('native:')?await env.DB.prepare('SELECT terms_version,privacy_version FROM app_users WHERE id=?').bind(id).first<any>():null;
  const consentRequired=!!consentRow&&!consentCurrent(consentRow);
  // 이번 달(한국 시간) 만든 전자계약서 수: 월 1장 무료, 추가 장당 3,000원(결제 연결 전에는 안내만)
  const monthStart=new Date(Date.parse(new Date(Date.now()+9*3600000).toISOString().slice(0,7)+'-01T00:00:00+09:00')).toISOString();
  const contractsThisMonth=linked?.access==='owner'?Number((await env.DB.prepare('SELECT count(*)::int AS n FROM contract_envelopes WHERE owner_id=? AND created_at>=?').bind(id,monthStart).first<any>())?.n||0):0;
  const view=(d:any)=>({hq:isHQ(request,env),consentRequired,legal:{terms:LEGAL.terms.version,privacy:LEGAL.privacy.version},user:{email,authMethod:id.startsWith('native:')?'email':'chatgpt',role:request.headers.get('oai-authenticated-user-native-role')||'owner',emailVerified:!id.startsWith('native:')||request.headers.get('oai-authenticated-user-email-verified')==='true'},onboarded:!!d,access:linked?.access||'owner',storeName:d?.store?.name||'',industry:d?._account?.industry||null,industryName:industryName(d?._account?.industry),storeClosingAt:d?._account?.deletion?.purgeAt||null,account:linked&&linked.access!=='owner'?null:d?accountView(d._account,contractsThisMonth):null,usage:linked&&linked.access!=='owner'?null:d?{employees:d.employees.filter((e:any)=>e.status!=='퇴사').length,branches:d.branches?.length||1,perBranch:d.branches.map((b:any)=>({id:b.id,name:b.name,employees:d.employees.filter((e:any)=>e.branchId===b.id&&e.status!=='퇴사').length}))}:null,billing:{enabled:false,reason:'사업자 정보와 결제 서비스 연결을 준비하고 있어요. 지금은 결제되지 않아요.'}});
  if(request.method==='GET'){
   // 작업 041: 기간제 계약 만료 30일 전 — 사장님 이메일로 보낼 안내를 전송함에 한 번 준비(실제 발송은 메일 서비스 연결 후 전송함에서)
   if(linked?.access==='owner'&&data&&email){const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),until=new Date(Date.now()+9*3600000+30*86400000).toISOString().slice(0,10);
    const due=(data.employees||[]).filter((e:any)=>e.status!=='퇴사'&&e.endDate&&e.endDate>=today&&e.endDate<=until),box=data._outbox||[],add=due.filter((e:any)=>!box.some((m:any)=>m.key==='expiry:'+e.id+':'+e.endDate));
    if(add.length){data._outbox=[...box,...add.map((e:any)=>({id:crypto.randomUUID(),key:'expiry:'+e.id+':'+e.endDate,to:email,subject:`[척척사장봇] ${e.name}님 기간제 계약이 ${e.endDate}에 끝나요`,body:`${data.store?.name||''} ${e.name}님의 근로계약이 ${e.endDate}에 끝나요.\n\n계속 일한다면 새 계약서를 작성해 서명받고, 끝난다면 마지막 급여와 퇴직금 대상 여부를 확인해 주세요.\n(기간제 근로자를 2년 넘게 쓰면 기간의 정함이 없는 근로자로 봅니다 — 기간제법 제4조)`,status:'발송 대기',createdAt:new Date().toISOString(),providerId:null}))].slice(-500);
     const r=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),new Date().toISOString(),id,linked.row.version).run();if(!r.meta.changes)data._outbox=box}}
   const v:any=view(data);
   if(linked?.access==='owner')v.payments=(await env.DB.prepare('SELECT order_id,plan,store_slots,months,amount,status,method,receipt_url,paid_at,period_start,period_end,refunded_amount FROM payments WHERE owner=? ORDER BY created_at DESC LIMIT 24').bind(id).all<any>()).results;
   if(linked?.access==='owner'){const rows=await env.DB.prepare('SELECT n.id,n.kind,n.title,n.body,n.effective_at,c.agreed_at FROM service_notices n LEFT JOIN service_notice_consents c ON c.notice_id=n.id AND c.user_id=? WHERE n.effective_at>=? ORDER BY n.effective_at').bind(id,new Date(Date.now()-90*86400000).toISOString().slice(0,10)).all<any>();v.serviceNotices=rows.results.map((r:any)=>({id:r.id,kind:r.kind,title:r.title,body:r.body,effectiveAt:r.effective_at,agreedAt:r.agreed_at||null}))}
   // 작업 057: 나에게 넘겨진 가게(이메일 확인된 계정만)
   if(email&&v.user.emailVerified&&linked?.access!=='owner'){const rows=await env.DB.prepare("SELECT owner,data FROM stores WHERE lower(try_jsonb(data)#>>'{_account,transfer,toEmail}')=lower(?)").bind(email).all<any>();v.transferOffers=rows.results.map((r:any)=>{const d=JSON.parse(r.data);return Date.parse(d._account.transfer.expiresAt)>Date.now()?{owner:r.owner,storeName:d.store?.name||'',fromEmail:d._account.transfer.fromEmail||'',expiresAt:d._account.transfer.expiresAt}:null}).filter(Boolean)}
   return json(v)}
  if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장봇 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
  const raw=await request.text();if(raw.length>12000)return json({error:'보낸 내용이 너무 커요. 내용을 줄여서 다시 시도해 주세요.'},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:'요청을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
  if(b.action==='onboard'){
   if(request.headers.get('oai-authenticated-user-native-role')==='employee')return json({error:'직원 계정에서는 가게 합류를 신청해 주세요.'},403);
   if(linked)return json({error:'이미 연결된 가게가 있어요. 내 가게로 들어가 주세요.'},409);
   if(!email)return json({error:'이메일이 확인된 계정으로 로그인해 주세요.'},400);
   const chosen=planId(b.plan);if(!chosen)return json({error:'요금제(베이직·프로)를 골라 주세요.'},400);
   const branches=b.storeSlots===undefined?1:Math.floor(Number(b.storeSlots));if(!(branches>=1)||branches<1||branches>MAX_BRANCHES)return json({error:`지점 수를 1~${MAX_BRANCHES}곳으로 정해 주세요.`},400);
   const months=[1,6,12].includes(Number(b.months))?Number(b.months):1;
   for(const key of ['storeName','branchName','ownerName'])if(typeof b[key]!=='string'||!b[key].trim()||b[key].trim().length>80)return json({error:'매장명·지점명·사장님 성함을 80자 이내로 입력해 주세요.'},400);
   if(b.industry!==undefined&&!isIndustry(b.industry))return json({error:'업종을 목록에서 선택해 주세요.'},400);
   if(b.acknowledged!==true)return json({error:'체험 운영 안내를 확인해 주세요.'},400);
   // 작업 017: 직원 개인정보는 사장님이 처리자, 척척사장봇은 수탁자다. 처리위탁 내용에 동의해야 가게를 만든다.
   if(b.dpaAgreed!==true)return json({error:'직원 개인정보 처리위탁 내용을 확인하고 동의해 주세요.',code:'DPA_REQUIRED'},400);
   // 작업 011: 사업자등록번호(선택) — 국세청 상태조회, 확인이 안 돼도 가입은 받고 '미확인'으로
   if(b.bizNo!==undefined&&b.bizNo!==''&&!validBizNo(String(b.bizNo)))return json({error:'사업자등록번호 10자리를 다시 확인해 주세요. 모르면 비워 두고 나중에 넣어도 돼요.'},400);
   const bizCheck=b.bizNo?await checkBusiness(String(b.bizNo),env):null;
   const state=normalizeTeam(null);
   state.store={name:b.storeName.trim(),branch:b.branchName.trim()};
   state.branches=[{id:'branch-main',name:b.branchName.trim(),address:''}];
   state.employees=[];state.shifts=[];state.attendance=[];state.adjustments={};state.payrollRuns={};state.requests=[];delete state.legacy;
   state.settings={accountantName:'',accountantEmail:'',autoPayslip:false,autoContract:false,autoAccountant:false,employerName:b.ownerName.trim(),fivePlus:false};
   const now=new Date().toISOString();
   const next={...state,_account:{industry:b.industry||null,plan:chosen,storeSlots:branches,months,status:'trialing',createdAt:now,trialEndsAt:new Date(Date.now()+TRIAL_DAYS*86400000).toISOString(),trialUsed:true,acknowledgedAt:now,noticeVersion:'pricing-2026-10',dpa:{version:LEGAL.dpa.version,agreedAt:now,by:id},autoRenew:false,...(bizCheck?{bizCheck}:{})},_audit:[],_outbox:[],_members:[],_invitations:[]};
   const result=await env.DB.prepare('INSERT OR IGNORE INTO stores(owner,data,version,updated_at) VALUES(?,?,?,?)').bind(id,JSON.stringify(next),1,now).run();
   if(!result.meta.changes)return json({error:'이미 매장이 생성되었습니다. 새로고침해 주세요.'},409);
   return json(view(next),201);
  }
  if(b.action==='agreeNotice'){
   if(linked?.access!=='owner')return json({error:'변경 안내 동의는 사장님 계정에서 해 주세요.'},403);
   const n=await env.DB.prepare('SELECT id FROM service_notices WHERE id=?').bind(typeof b.id==='string'?b.id:'').first();if(!n)return json({error:'안내를 찾을 수 없어요. 새로고침해 주세요.'},404);
   await env.DB.prepare('INSERT INTO service_notice_consents(notice_id,user_id,agreed_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(b.id,id,new Date().toISOString()).run();return json({ok:true});
  }
  if(b.action==='transferAccept'){
   // 작업 057: 넘겨받는 쪽 확인(이메일 확인된 계정 + 비밀번호)
   if(linked?.access==='owner')return json({error:'이미 내 가게가 있는 계정은 다른 가게를 넘겨받을 수 없어요. 다른 계정으로 로그인해 주세요.'},409);
   if(typeof b.owner!=='string')return json({error:'넘겨받을 가게를 골라 주세요.'},400);
   try{const who=await confirmSigner(request,env as any,b.password,true);if(who.email.toLowerCase()!==email.toLowerCase())throw Error('로그인 계정을 확인해 주세요.')}catch(e){return json({error:(e as Error).message||'비밀번호를 확인해 주세요.'},400)}
   const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(b.owner).first<any>();const d=row?JSON.parse(row.data):null,t=d?._account?.transfer;
   if(!t||t.toEmail.toLowerCase()!==email.toLowerCase()||Date.parse(t.expiresAt)<=Date.now())return json({error:'넘겨받을 수 있는 가게가 없어요. 이전 대표님께 다시 요청해 달라고 해 주세요.'},404);
   if(linked&&linked.owner!==b.owner)return json({error:'다른 가게에 직원으로 연결된 계정이에요. 그 가게에서 나간 뒤 다시 시도해 주세요.'},409);
   const now=new Date().toISOString();d._members=(d._members||[]).filter((m:any)=>m.userId!==id);delete d._account.transfer;
   d._account.transferHistory=[...(d._account.transferHistory||[]),{from:b.owner,fromEmail:t.fromEmail,to:id,toEmail:email,at:now}].slice(-20);
   d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:now,actor:{id,name:email,email},action:'가게 대표 변경',target:'이용권',before:{owner:t.fromEmail},after:{owner:email},reason:'양쪽 확인(요청·수락)'}];
   const saved=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),now,b.owner,row.version).run();if(!saved.meta.changes)return json({error:'다른 변경이 있어요. 새로고침한 뒤 다시 시도해 주세요.'},409);
   await env.DB.prepare('SELECT transfer_store(?,?) AS r').bind(b.owner,id).first();
   return json({ok:true,message:'가게 대표가 되었어요.'});
  }
  if(!linked)return json({error:'매장 등록을 먼저 완료해 주세요.'},409);
  if(linked.access!=='owner')return json({error:'요금제는 사장님만 바꿀 수 있어요.'},403);
  if(b.action==='checkout')return json({error:'아직 결제를 받지 않아요. 지금은 무료·체험으로 계속 이용하시면 돼요.',code:'BILLING_NOT_READY'},503);
  if(!data._account)return json({error:'기존 매장은 지금 이용 상태 그대로 쓸 수 있어요. 요금제는 정식 판매 전에 따로 안내할게요.'},409);
  if(b.action==='changePlan'){
   const chosen=planId(b.plan);if(!chosen)return json({error:'요금제(베이직·프로)를 골라 주세요.'},400);
   const branches=b.storeSlots===undefined?branchCount(data._account):Math.floor(Number(b.storeSlots));if(!Number.isInteger(branches)||branches<1||branches>MAX_BRANCHES)return json({error:`지점 수를 1~${MAX_BRANCHES}곳으로 정해 주세요.`},400);
   const months=[1,6,12].includes(Number(b.months))?Number(b.months):(data._account.months||1);
   const nextAccount={...data._account,plan:chosen,storeSlots:branches,months};const exceeded=capacityError(data,nextAccount);if(exceeded)return json({error:exceeded},409);
   data._account=nextAccount;
  }else if(b.action==='billingInfo'){
   // 작업 069: 세금계산서용 사업자 정보
   const t=(v:any,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';const info={bizNo:t(b.bizNo,12).replace(/\D/g,''),company:t(b.company,100),ceo:t(b.ceo,50),email:t(b.email,200).toLowerCase(),address:t(b.address,300),bizType:t(b.bizType,50),bizItem:t(b.bizItem,50)};
   if(!validBizNo(info.bizNo))return json({error:'사업자등록번호 10자리를 다시 확인해 주세요.'},400);
   if(!info.company||!info.ceo)return json({error:'상호와 대표자 이름을 입력해 주세요.'},400);
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email))return json({error:'세금계산서를 받을 이메일을 확인해 주세요.'},400);
   data._account.billing={...info,updatedAt:new Date().toISOString()};
  }else if(b.action==='taxInvoiceRequest'){
   if(!data._account.billing)return json({error:'먼저 세금계산서용 사업자 정보를 저장해 주세요.'},400);
   if(typeof b.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month))return json({error:'발행받을 달을 골라 주세요.'},400);
   const list=data._account.invoiceRequests||[];if(list.some((r:any)=>r.month===b.month&&r.status!=='취소'))return json({error:'그 달은 이미 요청했어요. 요청 내역을 확인해 주세요.'},409);
   data._account.invoiceRequests=[...list,{id:crypto.randomUUID(),month:b.month,at:new Date().toISOString(),status:'요청',bizNo:data._account.billing.bizNo}].slice(-60);
  }else if(b.action==='bizCheck'){
   if(!validBizNo(String(b.bizNo||'')))return json({error:'사업자등록번호 10자리를 다시 확인해 주세요.'},400);
   data._account.bizCheck=await checkBusiness(String(b.bizNo),env);
  }else if(b.action==='cancelSubscription'){
   // 작업 018: 해지 신청 — 이번 결제 기간이 끝날 때까지 쓰고, 그 뒤로는 조회·내려받기만
   if(trialStatus(data._account)!=='active'||!data._account.periodStart)return json({error:'결제 중인 이용권이 없어요. 체험 중이면 \'체험 그만두기\'를 이용해 주세요.'},400);
   if(typeof b.reason!=='string'||b.reason.length>500)return json({error:'해지 사유는 500자 이내로 적어 주세요.'},400);
   const end=new Date(Date.parse(data._account.periodStart));end.setUTCMonth(end.getUTCMonth()+(data._account.months||1));
   data._account.cancelAt=end.toISOString();data._account.cancelRequestedAt=new Date().toISOString();data._account.cancelReason=b.reason.trim();
  }else if(b.action==='undoCancel'){
   if(!data._account.cancelAt||Date.parse(data._account.cancelAt)<=Date.now())return json({error:'되돌릴 해지 예약이 없어요. 새로고침해서 상태를 확인해 주세요.'},400);
   delete data._account.cancelAt;delete data._account.cancelRequestedAt;delete data._account.cancelReason;
  }else if(b.action==='transferStart'){
   const to=typeof b.email==='string'?b.email.trim().toLowerCase():'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||to.length>200)return json({error:'넘겨받을 분의 이메일을 확인해 주세요.'},400);
   if(to===email.toLowerCase())return json({error:'지금 계정과 다른 이메일을 입력해 주세요.'},400);
   if(b.confirmName!==data.store?.name)return json({error:'확인을 위해 가게 이름을 그대로 입력해 주세요.'},400);
   try{await confirmSigner(request,env as any,b.password,false)}catch(e){return json({error:(e as Error).message||'비밀번호를 확인해 주세요.'},400)}
   data._account.transfer={toEmail:to,fromEmail:email,at:new Date().toISOString(),expiresAt:new Date(Date.now()+7*86400000).toISOString()};
  }else if(b.action==='transferCancel'){
   if(!data._account.transfer)return json({error:'진행 중인 대표 변경 요청이 없어요. 새로고침해서 상태를 확인해 주세요.'},400);delete data._account.transfer;
  }else if(b.action==='endTrial'){
   if(b.confirm!==true)return json({error:'체험 종료 확인이 필요합니다.'},400);
   if(trialStatus(data._account)!=='trialing')return json({error:'진행 중인 체험이 없어요. 지금 상태 그대로 조회와 내려받기를 이용하시면 돼요.'},400);data._account.status='cancelled';data._account.cancelledAt=new Date().toISOString();
  }else return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
  data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id,name:email,email},action:b.action==='endTrial'?'체험 종료':b.action==='billingInfo'?'세금계산서 정보 저장':b.action==='taxInvoiceRequest'?'세금계산서 발행 요청':b.action==='bizCheck'?'사업자 상태 조회':b.action==='cancelSubscription'?'해지 신청':b.action==='undoCancel'?'해지 취소':b.action==='transferStart'?'가게 대표 변경 요청':b.action==='transferCancel'?'가게 대표 변경 취소':'요금제 변경',target:'이용권',before:null,after:{plan:data._account.plan,status:trialStatus(data._account)},reason:'계정 관리'}];
  const saved=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),linked.row.version+1,new Date().toISOString(),id,linked.row.version).run();
  return saved.meta.changes?json(view(data)):json({error:'다른 변경이 있습니다. 새로고침해 주세요.'},409);
 }catch(error){return serverError('account',error,'계정 정보를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
