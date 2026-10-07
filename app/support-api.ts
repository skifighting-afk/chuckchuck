// 가이드 97: 문의하기. 회원은 자기 문의만 보고, 본사는 모두 보고 답한다. 새 문의·답변은 휴대폰 알림으로.
import {isHQ,type AdminEnv} from './admin-api';
import {notifyUser} from './push-api';
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {parseThread} from '../lib/faq-suggest';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// 예전 문의(대화 기록 전)는 마지막 답변을 대화 첫 줄로 넣는다
const seed=(r:any)=>{const th=parseThread(r?.thread);return th.length||!r?.reply?th:[{from:'본사' as const,body:r.reply,at:r.replied_at||''}]};
export const SUPPORT_CATEGORIES=['사용 방법','오류·문제','요금·결제','계정·개인정보','제안','기타'] as const;
export async function supportApi(request:Request,env:AdminEnv&{VAPID_PUBLIC_KEY?:string,VAPID_PRIVATE_KEY?:string,VAPID_SUBJECT?:string}){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 const hq=isHQ(request,env),url=new URL(request.url);
 try{
  if(request.method==='GET'){
   if(hq&&url.searchParams.get('all')==='1'){const rows=(await env.DB.prepare("SELECT t.id,t.role,t.category,t.body,t.status,t.reply,t.thread,t.created_at,t.replied_at,(SELECT data::jsonb#>>'{store,name}' FROM stores s WHERE s.owner=t.store_owner) AS store FROM support_tickets t ORDER BY (t.status='접수') DESC, t.created_at DESC LIMIT 200").all<any>()).results;return json({tickets:rows})}
   const rows=(await env.DB.prepare('SELECT id,category,body,status,reply,thread,created_at,replied_at FROM support_tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(uid).all<any>()).results;
   return json({tickets:rows,categories:SUPPORT_CATEGORIES});
  }
  if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
  let b:any;try{b=JSON.parse(await request.text())}catch{return json({error:'요청 내용이 올바르지 않아요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
  const now=new Date().toISOString();
  if(b.action==='reply'){
   if(!hq)return json({error:'답변은 본사 계정만 할 수 있어요.'},403);
   if(typeof b.reply!=='string'||!b.reply.trim()||b.reply.length>3000)return json({error:'답변을 1~3,000자로 적어 주세요.'},400);
   const cur=await env.DB.prepare('SELECT thread,reply,replied_at FROM support_tickets WHERE id=?').bind(String(b.id||'')).first<any>();
   const th=[...seed(cur),{from:'본사',body:b.reply.trim(),at:now}].slice(-50);
   const t=await env.DB.prepare("UPDATE support_tickets SET reply=?,status='답변 완료',replied_at=?,thread=? WHERE id=? RETURNING user_id,category").bind(b.reply.trim(),now,JSON.stringify(th),String(b.id||'')).first<any>();
   if(!t)return json({error:'문의를 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
   await notifyUser(env as any,t.user_id,{title:'문의에 답변이 왔어요',body:`[${t.category}] 답변을 확인해 주세요.`,url:'/support'});
   return json({ok:true});
  }
  // 지시서 10주차: 답변 받은 문의에 추가로 묻기 / 해결됐다고 표시
  if(b.action==='followup'||b.action==='resolve'){
   const t=await env.DB.prepare('SELECT id,status,thread,reply,replied_at,category FROM support_tickets WHERE id=? AND user_id=?').bind(String(b.id||''),uid).first<any>();
   if(!t)return json({error:'문의를 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
   if(b.action==='resolve'){await env.DB.prepare("UPDATE support_tickets SET status='해결됨' WHERE id=?").bind(t.id).run();return json({ok:true})}
   if(t.status==='접수')return json({error:'아직 답변을 기다리는 문의예요. 답변이 온 뒤 추가로 물어봐 주세요.'},409);
   if(typeof b.body!=='string'||b.body.trim().length<2||b.body.length>3000)return json({error:'추가 질문을 2~3,000자로 적어 주세요.'},400);
   const th=seed(t);if(th.length>=50)return json({error:'대화가 길어졌어요. 새 문의로 남겨 주세요.'},400);
   th.push({from:'회원',body:b.body.trim(),at:now});
   await env.DB.prepare("UPDATE support_tickets SET status='접수',thread=? WHERE id=?").bind(JSON.stringify(th),t.id).run();
   await notifyUser(env as any,env.HQ_NATIVE_USER_ID,{title:'문의에 추가 질문이 왔어요',body:`[${t.category}] ${b.body.trim().slice(0,40)}`,url:'/admin#support'});
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
