import {mailReady} from '../lib/mail';
import {serverError} from '../lib/errors';
import {adminProjection,summarizeStore,adminOverview,filterAdminStores} from '../lib/admin-overview';
export type AdminEnv={DB:D1Database,HQ_ADMIN_EMAIL?:string,HQ_NATIVE_USER_ID?:string,RESEND_API_KEY?:string,EMAIL_FROM?:string};
export function isHQ(request:Request,env:AdminEnv){const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase(),verified=request.headers.get('oai-authenticated-user-email-verified')==='true';if(!id)return false;if(env.HQ_NATIVE_USER_ID&&id===env.HQ_NATIVE_USER_ID)return true;return !!env.HQ_ADMIN_EMAIL&&verified&&email===env.HQ_ADMIN_EMAIL.trim().toLowerCase()}
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
/** 운영 현황: 회원(계정) 수·최근 가입·최근 7일 활동 가게·오늘 출퇴근한 직원 — 숫자만, 개인정보 없음 */
async function memberStats(env:AdminEnv,now:number){
 try{
  const u=await env.DB.prepare("SELECT count(*)::int AS total,count(*) FILTER (WHERE role='owner')::int AS owners,count(*) FILTER (WHERE role='employee')::int AS employees,count(*) FILTER (WHERE created_at>?)::int AS new7d,count(*) FILTER (WHERE created_at>?)::int AS new30d FROM app_users").bind(now-7*86400000,now-30*86400000).first<any>();
  const active=await env.DB.prepare('SELECT count(*)::int AS n FROM stores WHERE updated_at>?').bind(new Date(now-7*86400000).toISOString()).first<any>();
  const today=new Date(now+9*3600000).toISOString().slice(0,10),from=new Date(Date.parse(today+'T00:00:00+09:00')).toISOString();
  const clocked=await env.DB.prepare('SELECT count(DISTINCT owner||employee_id)::int AS n, count(DISTINCT owner)::int AS stores FROM attendance_records WHERE start_at>=?').bind(from).first<any>();
  return {...u,activeStores7d:active?.n??0,clockedToday:clocked?.n??0,clockedStoresToday:clocked?.stores??0};
 }catch{return null}
}
export async function adminApi(request:Request,env:AdminEnv){
 if(!isHQ(request,env))return json({error:'본사 운영 계정만 쓸 수 있어요. 본사 계정으로 로그인해 주세요.'},403);
 const actor=request.headers.get('oai-authenticated-user-email')||request.headers.get('oai-authenticated-user-id')||'';
 const audit=(action:string,target:string|null,detail:any)=>env.DB.prepare('INSERT INTO hq_access_log(at,actor,action,target,detail) VALUES(?,?,?,?,?)').bind(new Date().toISOString(),actor,action,target,JSON.stringify(detail)).run();
 try{
 if(request.method==='GET'){
 const params=new URL(request.url).searchParams,now=Date.now();
 if(params.get('notices')==='1'){const rows=await env.DB.prepare('SELECT n.id,n.kind,n.title,n.effective_at,n.created_at,(SELECT count(*) FROM service_notice_consents c WHERE c.notice_id=n.id)::int AS agreed FROM service_notices n ORDER BY n.created_at DESC LIMIT 50').all<any>();return json({notices:rows.results})}
 if(params.get('log')==='1'){await env.DB.prepare("DELETE FROM hq_access_log WHERE at<?").bind(new Date(now-366*86400000).toISOString()).run();const rows=await env.DB.prepare('SELECT at,actor,action,target,detail FROM hq_access_log ORDER BY id DESC LIMIT 200').all<any>();return json({log:rows.results.map((r:any)=>({...r,detail:typeof r.detail==='string'?JSON.parse(r.detail):r.detail}))})}
 const rows=await env.DB.prepare(adminProjection).all<any>();
 const stores=rows.results.map((row:any)=>summarizeStore(row,now)),filtered=filterAdminStores(stores,params);
 const requested=Math.floor(Math.max(0,Math.min(100000,Number(params.get('page'))||0)));
 const page=Math.min(requested,Math.max(0,Math.ceil(filtered.length/50)-1));
 await audit('가게 목록 열람',null,{filters:Object.fromEntries([...params].filter(([k])=>['q','plan','status','attention','biz','page'].includes(k))),shown:Math.min(50,filtered.length)});
 return json({adminAuthMethod:request.headers.get('oai-authenticated-user-id')?.startsWith('native:')?'email':'platform',total:stores.length,matched:filtered.length,page,pageSize:50,stores:filtered.slice(page*50,(page+1)*50),overview:adminOverview(stores,now),members:await memberStats(env,now),billingEnabled:false,payments:{connected:false,paidRevenue:null,paidCustomers:null},emailReady:mailReady(env),generatedAt:new Date(now).toISOString()});
 }
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청 출처를 확인해 주세요.'},403);
 const raw=await request.text();if(raw.length>6000)return json({error:'입력이 너무 깁니다.'},413);const b=JSON.parse(raw);
 if(b.action==='serviceNotice'){
  // 작업 066: 가격·약관 변경은 시행 30일 전까지 고지
  if(!['가격','약관'].includes(b.kind)||typeof b.title!=='string'||!b.title.trim()||b.title.length>100||typeof b.body!=='string'||!b.body.trim()||b.body.length>3000||typeof b.effectiveAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.effectiveAt))return json({error:'종류·제목·내용·시행일을 확인해 주세요.'},400);
  if(Date.parse(b.effectiveAt+'T00:00:00+09:00')-Date.now()<30*86400000)return json({error:'시행일은 오늘부터 30일 뒤 이후로 정해 주세요.'},400);
  const nid=crypto.randomUUID();await env.DB.prepare('INSERT INTO service_notices(id,kind,title,body,effective_at,created_at,created_by) VALUES(?,?,?,?,?,?,?)').bind(nid,b.kind,b.title.trim(),b.body.trim(),b.effectiveAt,new Date().toISOString(),actor).run();
  await audit('서비스 변경 고지',nid,{kind:b.kind,effectiveAt:b.effectiveAt});return json({ok:true,id:nid});
 }
 if(b.action==='bizCheck'){
  // 작업 012: 사업자 확인 수동 처리(사유 기록)
  if(typeof b.id!=='string'||!['확인 전','수동 확인','불일치'].includes(b.status)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>500)return json({error:'확인 상태와 사유를 입력해 주세요.'},400);
  const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(b.id).first<any>();if(!row)return json({error:'가게를 찾지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},404);
  if(row.version!==b.version)return json({error:'매장 내용이 바뀌었습니다. 새로 확인한 뒤 저장해 주세요.'},409);
  const d=JSON.parse(row.data),now=new Date().toISOString(),entry={status:b.status,reason:b.reason.trim(),at:now,actor};d._hq={...(d._hq||{}),biz:entry,bizHistory:[...(d._hq?.bizHistory||[]),entry].slice(-50)};
  const r=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),now,b.id,row.version).run();if(!r.meta.changes)return json({error:'동시 변경이 있습니다. 새로 확인해 주세요.'},409);
  await audit('사업자 확인 처리',b.id,{status:b.status});return json({ok:true});
 }
 if(b.action!=='support'||typeof b.id!=='string'||typeof b.note!=='string'||b.note.length>2000||!['미확인','확인 중','처리 완료'].includes(b.status))return json({error:'관리 상태와 메모를 확인해 주세요.'},400);
 const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(b.id).first<any>();if(!row)return json({error:'가게를 찾지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},404);
 if(row.version!==b.version)return json({error:'매장 내용이 바뀌었습니다. 새로 확인한 뒤 저장해 주세요.'},409);
 const d=JSON.parse(row.data),now=new Date().toISOString();d._hq={...(d._hq||{}),status:b.status,note:b.note.trim(),history:[...(d._hq?.history||[]),{at:now,status:b.status,actor:request.headers.get('oai-authenticated-user-id')}].slice(-100)};
 const result=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),now,b.id,row.version).run();if(result.meta.changes)await audit('가게 상세 메모 저장',b.id,{status:b.status});return result.meta.changes?json({ok:true}):json({error:'동시 변경이 있습니다. 새로 확인해 주세요.'},409);
 }catch(e){return serverError('admin',e,'운영 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
