// 가이드 97: 문의하기. 회원은 자기 문의만 보고, 본사는 모두 보고 답한다. 새 문의·답변은 휴대폰 알림으로.
import {isHQ,type AdminEnv} from './admin-api';
import {notifyUser} from './push-api';
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const SUPPORT_CATEGORIES=['사용 방법','오류·문제','요금·결제','계정·개인정보','제안','기타'] as const;
export async function supportApi(request:Request,env:AdminEnv&{VAPID_PUBLIC_KEY?:string,VAPID_PRIVATE_KEY?:string,VAPID_SUBJECT?:string}){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 const hq=isHQ(request,env),url=new URL(request.url);
 try{
  if(request.method==='GET'){
   if(hq&&url.searchParams.get('all')==='1'){const rows=(await env.DB.prepare("SELECT t.id,t.role,t.category,t.body,t.status,t.reply,t.created_at,t.replied_at,(SELECT data::jsonb#>>'{store,name}' FROM stores s WHERE s.owner=t.store_owner) AS store FROM support_tickets t ORDER BY (t.status='접수') DESC, t.created_at DESC LIMIT 200").all<any>()).results;return json({tickets:rows})}
   const rows=(await env.DB.prepare('SELECT id,category,body,status,reply,created_at,replied_at FROM support_tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(uid).all<any>()).results;
   return json({tickets:rows,categories:SUPPORT_CATEGORIES});
  }
  if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
  let b:any;try{b=JSON.parse(await request.text())}catch{return json({error:'요청 내용이 올바르지 않아요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
  const now=new Date().toISOString();
  if(b.action==='reply'){
   if(!hq)return json({error:'답변은 본사 계정만 할 수 있어요.'},403);
   if(typeof b.reply!=='string'||!b.reply.trim()||b.reply.length>3000)return json({error:'답변을 1~3,000자로 적어 주세요.'},400);
   const t=await env.DB.prepare("UPDATE support_tickets SET reply=?,status='답변 완료',replied_at=? WHERE id=? RETURNING user_id,category").bind(b.reply.trim(),now,String(b.id||'')).first<any>();
   if(!t)return json({error:'문의를 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
   await notifyUser(env as any,t.user_id,{title:'문의에 답변이 왔어요',body:`[${t.category}] 답변을 확인해 주세요.`,url:'/support'});
   return json({ok:true});
  }
  if(b.action!=='create')return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
  if(!(SUPPORT_CATEGORIES as readonly string[]).includes(b.category))return json({error:'문의 종류를 골라 주세요.'},400);
  if(typeof b.body!=='string'||b.body.trim().length<5||b.body.length>3000)return json({error:'문의 내용을 5~3,000자로 적어 주세요.'},400);
  const today=(await env.DB.prepare('SELECT count(*) AS n FROM support_tickets WHERE user_id=? AND created_at>?').bind(uid,new Date(Date.now()-86400000).toISOString()).first<any>())?.n||0;
  if(Number(today)>=10)return json({error:'하루에 문의는 10건까지 남길 수 있어요. 앞서 남긴 문의 답변을 기다려 주세요.'},429);
  const linked=await resolveStore(env.DB as any,uid).catch(()=>null);
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO support_tickets(id,user_id,store_owner,role,category,body,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,uid,linked?.owner||null,linked?.access==='owner'?'사장님':linked?'직원':'회원',b.category,b.body.trim(),now).run();
  await notifyUser(env as any,env.HQ_NATIVE_USER_ID,{title:'새 문의가 왔어요',body:`[${b.category}] ${b.body.trim().slice(0,40)}`,url:'/admin#support'});
  return json({ok:true,id},201);
 }catch(e){return serverError('support',e,'문의를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
