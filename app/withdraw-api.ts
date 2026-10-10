// 작업 056: 회원 탈퇴 (docs/DECISIONS.md 1·2번 추천안)
// - 사장님: 최근 7일 안에 가게 데이터를 내려받아야 탈퇴를 예약할 수 있다. 30일 뒤 가게 데이터·서류·로그인 계정을 지운다.
//   그 사이에는 가게가 읽기 전용이 되고, 사장님은 언제든 취소할 수 있다. 법정 보존 서류(근로기준법 제42조)는 사장님이 내려받은 파일로 보관한다.
// - 직원·매니저: 가게와의 연결을 끊고 로그인 계정을 바로 지운다. 가게 쪽 근무·급여 기록과 계약서는 사장님의 보존 서류로 남는다.
import {confirmSigner,deleteAuthUser,type AuthEnv} from './auth-api';
import {serverError,reportError} from '../lib/errors';
import {resolveStore} from './saas-api';
import {notifyUser} from './push-api';

export const WITHDRAW_GRACE_DAYS = 30;
export const EXPORT_FRESH_DAYS = 7;
const DAY = 86400000;
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function withdrawAction(request:Request,env:AuthEnv,b:any,linked:any){
 const id=request.headers.get('oai-authenticated-user-id')!;
 const user=await env.DB.prepare('SELECT id,auth_id,last_export_at FROM app_users WHERE id=?').bind(id).first<any>();
 if(!user)return json({error:'이 계정은 여기서 탈퇴할 수 없어요. 운영팀에 탈퇴를 요청해 주세요.'},400);
 // 지시서 145: 공동 관리자로 보고 있는 가게는 '내 가게'가 아니다 — 탈퇴는 내가 대표인 가게(있으면) 기준으로, 공동 관리 가게에서는 빠지기만 한다
 if(linked?.coowner){const own=await env.DB.prepare('SELECT owner,data,version,updated_at FROM stores WHERE owner=?').bind(id).first<any>();linked=own?{row:own,owner:id,access:'owner'}:null;}
 if(b.action==='cancelWithdraw'){
  if(linked?.access!=='owner')return json({error:'취소할 탈퇴 예약이 없어요. 지금처럼 이용하시면 돼요.'},404);
  const data=JSON.parse(linked.row.data);
  if(!data._account?.deletion)return json({error:'취소할 탈퇴 예약이 없어요. 지금처럼 이용하시면 돼요.'},404);
  const gone=await env.DB.prepare('DELETE FROM account_deletions WHERE user_id=? AND data_purged_at IS NULL RETURNING user_id').bind(id).first();
  if(!gone)return json({error:'이미 삭제가 진행돼 취소할 수 없어요. 내려받은 데이터 파일을 확인해 주세요.'},409);
  delete data._account.deletion;
  data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id,name:'사장님',email:request.headers.get('oai-authenticated-user-email')||''},action:'탈퇴 예약 취소',target:'계정',before:null,after:null,reason:'사장님 요청'}];
  await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=?').bind(JSON.stringify(data),new Date().toISOString(),id).run();
  return json({ok:true,cancelled:true});
 }
 if(b.confirm!=='탈퇴')return json({error:"확인란에 '탈퇴'라고 입력해 주세요."},400);
 try{await confirmSigner(request,env,b.password,false)}catch(e){return json({error:e instanceof Error?e.message:'현재 비밀번호를 확인해 주세요.'},400)}
 if(linked?.access==='owner'){
  const data=JSON.parse(linked.row.data);
  if(!data._account)return json({error:'기존 매장은 운영팀에 탈퇴를 요청해 주세요.'},409);
  if(data._account.deletion)return json({error:'이미 탈퇴를 예약했어요. 취소하려면 \'탈퇴 예약 취소\'를 눌러 주세요.',purgeAt:data._account.deletion.purgeAt},409);
  const exported=Date.parse(user.last_export_at||'');
  if(!Number.isFinite(exported)||Date.now()-exported>EXPORT_FRESH_DAYS*DAY)return json({error:'탈퇴 전에 가게 데이터를 먼저 내려받아 주세요. 근로계약서·임금대장 등은 3년간 보존해야 해요(근로기준법 제42조).',code:'EXPORT_REQUIRED'},409);
  const now=new Date(),purgeAt=new Date(now.getTime()+WITHDRAW_GRACE_DAYS*DAY);
  data._account.deletion={requestedAt:now.toISOString(),purgeAt:purgeAt.toISOString()};
  data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:now.toISOString(),actor:{id,name:'사장님',email:request.headers.get('oai-authenticated-user-email')||''},action:'탈퇴 예약',target:'계정',before:null,after:data._account.deletion,reason:'사장님 요청'}];
  await env.DB.batch([
   env.DB.prepare('INSERT INTO account_deletions(user_id,auth_id,requested_at,purge_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET requested_at=excluded.requested_at,purge_at=excluded.purge_at,data_purged_at=NULL,done_at=NULL').bind(id,user.auth_id,now.toISOString(),purgeAt.getTime()),
   env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=?').bind(JSON.stringify(data),now.toISOString(),id),
  ]);
  return json({ok:true,scheduled:true,purgeAt:purgeAt.toISOString()});
 }
 // 직원·매니저·퇴사자·가게 없는 계정: 연결을 끊고 바로 지운다.
 if(linked){
  const data=JSON.parse(linked.row.data);
  const member=(data._members||[]).find((m:any)=>m.userId===id);
  data._members=(data._members||[]).filter((m:any)=>m.userId!==id);
  data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id,name:'직원',email:''},action:'직원 계정 탈퇴',target:member?.employeeId||'',before:null,after:null,reason:'직원 본인 탈퇴. 근무·급여 기록과 계약서는 사장님 보존 서류로 남음'}];
  // The database trigger atomically revokes linked HR grants with membership removal.
  await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=?').bind(JSON.stringify(data),new Date().toISOString(),linked.owner).run();
  // 지시서 200: 직원이 계정을 지우면 사장님께 알림(기록은 보존 서류로 남음)
  const nm=(data.employees||[]).find((e:any)=>e.id===member?.employeeId)?.name||'직원';await notifyUser(env as any,linked.owner,{title:`${nm}님이 앱 계정을 지웠어요`,body:'근무·급여 기록과 계약서는 보존 서류로 남아요. 퇴사했다면 직원 관리에서 퇴사 처리해 주세요.',url:'/app?screen=employees',kind:'staff'}).catch(()=>null);
 }
 {const co=(await env.DB.prepare("SELECT owner,data FROM stores WHERE try_jsonb(data)->'_coowners' @> jsonb_build_array(jsonb_build_object('userId',CAST(? AS text)))").bind(id).all<any>()).results||[];for(const r of co){const d=JSON.parse(r.data);d._coowners=(d._coowners||[]).filter((c:any)=>c.userId!==id);await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=?').bind(JSON.stringify(d),new Date().toISOString(),r.owner).run()}}
 if(!await deleteAuthUser(env,user.auth_id))return json({error:'계정을 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.'},502);
 await env.DB.prepare('DELETE FROM app_users WHERE id=?').bind(id).run();
 return json({ok:true,deleted:true});
}

/** 기한이 지난 탈퇴 예약을 마무리한다: 가게 데이터 삭제(아직이면) → 로그인 계정 삭제 → 앱 계정 삭제. 요청마다 몇 건씩만. */
export async function processDeletions(env:AuthEnv,limit=3){
 const due=(await env.DB.prepare('SELECT user_id,auth_id,data_purged_at FROM account_deletions WHERE purge_at<=? AND done_at IS NULL LIMIT ?').bind(Date.now(),limit).all<any>()).results;
 for(const d of due){
  if(!d.data_purged_at){await env.DB.prepare('SELECT purge_store(?) AS r').bind(d.user_id).first();await env.DB.prepare('UPDATE account_deletions SET data_purged_at=? WHERE user_id=?').bind(new Date().toISOString(),d.user_id).run();}
  if(!await deleteAuthUser(env,d.auth_id))continue;
  await env.DB.batch([env.DB.prepare('DELETE FROM app_users WHERE id=?').bind(d.user_id),env.DB.prepare('UPDATE account_deletions SET done_at=? WHERE user_id=?').bind(new Date().toISOString(),d.user_id)]);
 }
 return due.length;
}

/** POST /api/withdraw {action:'withdraw',password,confirm:'탈퇴'} 또는 {action:'cancelWithdraw'} */
export async function withdrawApi(request:Request,env:AuthEnv){
 const id=request.headers.get('oai-authenticated-user-id');
 if(!id)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);
 const raw=await request.text();if(raw.length>2000)return json({error:'보낸 내용이 너무 커요. 내용을 줄여서 다시 시도해 주세요.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'요청 내용이 올바르지 않아요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
 if(!b||!['withdraw','cancelWithdraw'].includes(b.action))return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 try{return await withdrawAction(request,env,b,await resolveStore(env.DB,id))}
 catch(e){return serverError('withdraw',e,'탈퇴를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
