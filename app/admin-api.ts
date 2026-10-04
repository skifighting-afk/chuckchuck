import {mailReady} from '../lib/mail';
import {adminProjection,summarizeStore,adminOverview,filterAdminStores} from '../lib/admin-overview';
export type AdminEnv={DB:D1Database,HQ_ADMIN_EMAIL?:string,HQ_NATIVE_USER_ID?:string,RESEND_API_KEY?:string,EMAIL_FROM?:string};
export function isHQ(request:Request,env:AdminEnv){const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase(),verified=request.headers.get('oai-authenticated-user-email-verified')==='true';if(!id)return false;if(env.HQ_NATIVE_USER_ID&&id===env.HQ_NATIVE_USER_ID)return true;return !!env.HQ_ADMIN_EMAIL&&verified&&email===env.HQ_ADMIN_EMAIL.trim().toLowerCase()}
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function adminApi(request:Request,env:AdminEnv){
 if(!isHQ(request,env))return json({error:'본사 운영 계정만 쓸 수 있어요. 본사 계정으로 로그인해 주세요.'},403);
 try{
 if(request.method==='GET'){
 const params=new URL(request.url).searchParams,now=Date.now();
 const rows=await env.DB.prepare(adminProjection).all<any>();
 const stores=rows.results.map((row:any)=>summarizeStore(row,now)),filtered=filterAdminStores(stores,params);
 const requested=Math.floor(Math.max(0,Math.min(100000,Number(params.get('page'))||0)));
 const page=Math.min(requested,Math.max(0,Math.ceil(filtered.length/50)-1));
 return json({adminAuthMethod:request.headers.get('oai-authenticated-user-id')?.startsWith('native:')?'email':'platform',total:stores.length,matched:filtered.length,page,pageSize:50,stores:filtered.slice(page*50,(page+1)*50),overview:adminOverview(stores,now),billingEnabled:false,payments:{connected:false,paidRevenue:null,paidCustomers:null},emailReady:mailReady(env),generatedAt:new Date(now).toISOString()});
 }
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청 출처를 확인해 주세요.'},403);
 const raw=await request.text();if(raw.length>6000)return json({error:'입력이 너무 깁니다.'},413);const b=JSON.parse(raw);
 if(b.action!=='support'||typeof b.id!=='string'||typeof b.note!=='string'||b.note.length>2000||!['미확인','확인 중','처리 완료'].includes(b.status))return json({error:'관리 상태와 메모를 확인해 주세요.'},400);
 const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(b.id).first<any>();if(!row)return json({error:'가게를 찾지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},404);
 if(row.version!==b.version)return json({error:'매장 내용이 바뀌었습니다. 새로 확인한 뒤 저장해 주세요.'},409);
 const d=JSON.parse(row.data),now=new Date().toISOString();d._hq={status:b.status,note:b.note.trim(),history:[...(d._hq?.history||[]),{at:now,status:b.status,actor:request.headers.get('oai-authenticated-user-id')}].slice(-100)};
 const result=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),now,b.id,row.version).run();return result.meta.changes?json({ok:true}):json({error:'동시 변경이 있습니다. 새로 확인해 주세요.'},409);
 }catch{return json({error:'운영 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'},400)}
}
