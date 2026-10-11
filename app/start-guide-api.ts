import {resolveStore} from './saas-api';
import {digest} from '../lib/password';
import {staffGone} from '../lib/staff-access';
import {QUESTS} from '../lib/quests';
import {managerPermissions} from '../lib/manager-permissions';
import {START_GUIDE_VERSION,defaultGuidePreferences,guideScopeKey,validateGuidePatch,type GuideIdentity,type GuideKind,type GuidePreferences} from '../lib/start-guide';
import type {PgD1} from '../lib/pg-d1';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
class GuideError extends Error{constructor(public status:number,public code:string,message:string){super(message)}}
const deny=()=>{throw new GuideError(403,'GUIDE_FORBIDDEN','현재 매장과 맡은 역할의 안내만 볼 수 있어요.')};
const managementSteps:Record<string,number>={'manager-schedule':4,'manager-attendance':1,'manager-leave':1,'manager-notices':2};
function identity(uid:string,owner:string,d:any,branch:string,kind:GuideKind){
 const own=owner===uid||(d._coowners||[]).some((c:any)=>c.userId===uid);
 const self=d.employees?.find((e:any)=>e.id===d._members?.find((m:any)=>m.userId===uid)?.employeeId);
 if(!own&&staffGone(self))return deny();
 const role=own?'owner':self.access==='중간관리자'?'manager':'employee';
 if(!d.branches?.some((b:any)=>b.id===branch)||(!own&&self.branchId!==branch)||kind==='management'&&role!=='manager')return deny();
 const qs=QUESTS[own?'owner':'staff'];
 const ids=kind==='management'?managerPermissions(d,self).permissions.filter(p=>['schedule','attendance','leave','notices'].includes(p)).map(p=>'manager-'+p):qs.map(q=>q.id);
 const ack=kind==='management'?['tour']:qs.filter(q=>q.doneSel||q.doneOnLastClick).map(q=>q.id).concat('tour');
 return {scope:{userId:uid,owner,branchId:branch,role,kind,guideVersion:START_GUIDE_VERSION} as GuideIdentity,ids:[...ids,'tour'],ack,steps:kind==='management'?managementSteps:Object.fromEntries(qs.map(q=>[q.id,q.steps.length]))};
}
const where='user_id=? AND owner=? AND branch_id=? AND role=? AND guide_kind=? AND guide_version=?';
const args=(s:GuideIdentity)=>[s.userId,s.owner,s.branchId,s.role,s.kind,s.guideVersion];
const prefs=(raw:any,c:ReturnType<typeof identity>):GuidePreferences=>{
 const p={...defaultGuidePreferences(),...(typeof raw==='string'?JSON.parse(raw):raw||{})};
 p.acknowledged=(p.acknowledged||[]).filter((id:string)=>c.ack.includes(id));
 if(p.active&&(!c.ids.includes(p.active.questId)||p.active.step>=(c.steps[p.active.questId]||1)))p.active=null;
 return p;
};
const view=async(c:ReturnType<typeof identity>,row:any)=>({scope:{key:await digest(guideScopeKey(c.scope)),branchId:c.scope.branchId,role:c.scope.role,kind:c.scope.kind,guideVersion:START_GUIDE_VERSION},preferences:prefs(row?.preferences,c),revision:row?.revision||0,availableQuestIds:c.ids});
export async function startGuideApi(request:Request,env:{DB:D1Database}){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인한 뒤 안내를 이어가 주세요.'},401);
 try{
  const url=new URL(request.url),branch=url.searchParams.get('branchId')||'',kind=url.searchParams.get('kind')||'personal';
  if(!branch||branch.length>150||!['personal','management'].includes(kind))return json({error:'안내할 매장을 선택해 주세요.'},400);
  const link=await resolveStore(env.DB,uid);if(!link||link.access==='revoked')return deny();
  if(request.method==='GET'){const c=identity(uid,link.owner,JSON.parse(link.row.data),branch,kind as GuideKind);const row=await env.DB.prepare('SELECT preferences,revision FROM start_guide_preferences WHERE '+where).bind(...args(c.scope)).first();return json(await view(c,row))}
  if(request.method!=='PATCH')return json({error:'지원하지 않는 요청이에요.'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'앱에서 다시 시도해 주세요.'},403);
  const raw=await request.text();if(raw.length>8000)return json({error:'안내 설정이 너무 길어요.'},413);
  const b=JSON.parse(raw);if(!b||!Number.isSafeInteger(b.revision)||b.revision<0||typeof b.scopeKey!=='string'||typeof b.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(b.requestId))return json({error:'안내 설정을 다시 확인해 주세요.'},400);
  const db=env.DB as unknown as PgD1;
  return await db.transaction(async tx=>{
   // Business lock serializes preference writes with transfer/revocation and role edits.
   const business=await tx.prepare('SELECT data FROM stores WHERE owner=? FOR UPDATE').bind(link.owner).first<any>();if(!business)return deny();
   const c=identity(uid,link.owner,JSON.parse(business.data),branch,kind as GuideKind),key=await digest(guideScopeKey(c.scope));
   if(b.scopeKey!==key)return json({code:'GUIDE_SCOPE_CHANGED',error:'매장이나 역할이 바뀌었어요. 안내를 다시 확인해 주세요.'},409);
   const p=validateGuidePatch(b.patch,c.ids);
   if(p.acknowledged?.some(id=>!c.ack.includes(id))||p.active&&p.active.step>=(c.steps[p.active.questId]||1))return json({error:'현재 역할에 맞는 안내 단계를 선택해 주세요.'},400);
   const hash=await digest(JSON.stringify(p));
   let row=await tx.prepare('SELECT * FROM start_guide_preferences WHERE '+where+' FOR UPDATE').bind(...args(c.scope)).first<any>();
   if(row?.last_request_id===b.requestId){if(row.last_request_hash!==hash)return json({error:'이미 처리한 요청의 내용이 바뀌었어요.',code:'GUIDE_REQUEST_CHANGED'},409);return json(await view(c,row))}
   if((row?.revision||0)!==b.revision)return json({code:'GUIDE_CHANGED',error:'다른 기기에서 안내를 바꿨어요. 최신 상태를 확인해 주세요.',latest:await view(c,row)},409);
   const next={...prefs(row?.preferences,c),...p},revision=b.revision+1;
   await tx.prepare('INSERT INTO start_guide_preferences(user_id,owner,branch_id,role,guide_kind,guide_version,preferences,revision,last_request_id,last_request_hash) VALUES(?,?,?,?,?,?,?::text::jsonb,?,?,?) ON CONFLICT(user_id,owner,branch_id,role,guide_kind,guide_version) DO UPDATE SET preferences=excluded.preferences,revision=excluded.revision,last_request_id=excluded.last_request_id,last_request_hash=excluded.last_request_hash,updated_at=now()').bind(...args(c.scope),JSON.stringify(next),revision,b.requestId,hash).run();
   return json(await view(c,{preferences:next,revision}));
  });
 }catch(e){if(e instanceof GuideError)return json({error:e.message,code:e.code},e.status);if(e instanceof SyntaxError||e instanceof Error&&e.message==='안내 설정을 확인해 주세요.')return json({error:'안내 설정을 확인해 주세요.'},400);return json({error:'안내를 저장하지 못했어요. 업무는 계속 이용할 수 있어요.'},503)}
}
