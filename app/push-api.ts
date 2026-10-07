// 작업 092: 웹 푸시 구독 관리와 알림 보내기
import {serverError} from '../lib/errors';
import {sendPush,type PushEnv} from '../lib/webpush';
import {guessKind,NOTIFY_KINDS,type NotifyKind} from '../lib/notify-kinds';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
type Env=PushEnv&{DB:D1Database};
export async function pushApi(request:Request,env:Env){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 try{
  if(request.method==='GET'){const n=await env.DB.prepare('SELECT count(*) AS n FROM push_subscriptions WHERE user_id=?').bind(user).first<any>();return json({publicKey:env.VAPID_PUBLIC_KEY||null,devices:Number(n?.n||0)})}
  if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청을 확인할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},403);
  const raw=await request.text();if(raw.length>4000)return json({error:'요청이 너무 커요. 새로고침한 뒤 다시 시도해 주세요.'},413);const b=JSON.parse(raw);
  const ok=(s:unknown,max:number)=>typeof s==='string'&&s.length>0&&s.length<=max;
  if(b.action==='subscribe'){
   if(!env.VAPID_PUBLIC_KEY)return json({error:'알림 설정이 아직 준비되지 않았어요. 사장님께 확인해 주세요.'},503);
   const s=b.subscription;if(!ok(s?.endpoint,1000)||!/^https:\/\//.test(s.endpoint)||!ok(s?.keys?.p256dh,200)||!ok(s?.keys?.auth,100))return json({error:'알림 구독 정보를 다시 만들어 주세요.'},400);
   const count=await env.DB.prepare('SELECT count(*) AS n FROM push_subscriptions WHERE user_id=?').bind(user).first<any>();if(Number(count?.n||0)>=10)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint IN (SELECT endpoint FROM push_subscriptions WHERE user_id=? ORDER BY created_at LIMIT 1)').bind(user).run();
   await env.DB.prepare('INSERT INTO push_subscriptions(endpoint,user_id,p256dh,auth,created_at) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth').bind(s.endpoint,user,s.keys.p256dh,s.keys.auth,new Date().toISOString()).run();
   return json({ok:true});
  }
  if(b.action==='unsubscribe'){await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND (endpoint=? OR ?=1)').bind(user,typeof b.endpoint==='string'?b.endpoint:'',b.all===true?1:0).run();return json({ok:true})}
  return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 }catch(e){return serverError('push',e,'알림 설정을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
/** 사용자에게 알림 보내기(기기 여러 대). 알림함(131)에 남기고, 사용자가 끈 종류(132)는 보내지 않는다. 실패해도 본래 작업은 막지 않는다. */
export async function notifyUser(env:Env,userId:string|null|undefined,message:{title:string,body:string,url:string,kind?:NotifyKind},fetcher?:typeof fetch){
 if(!userId)return 0;
 const kind=message.kind||guessKind(message.title);
 try{
  const pref=await env.DB.prepare('SELECT prefs FROM notification_prefs WHERE user_id=?').bind(userId).first<any>().catch(()=>null);
  const prefs=pref?JSON.parse(pref.prefs||'{}'):{};if(prefs[kind]===false)return 0;
  let sent=0;
  if(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY){
   const subs=(await env.DB.prepare('SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?').bind(userId).all<any>()).results;
   for(const s of subs){const r=await sendPush(env,s,message,fetcher).catch(()=>({status:'failed' as const}));if(r.status==='sent')sent++;if(r.status==='gone')await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(s.endpoint).run()}
  }
  await env.DB.prepare('INSERT INTO notifications(id,user_id,kind,title,body,url,created_at,pushed) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,kind,message.title.slice(0,120),message.body.slice(0,500),message.url||'/app',new Date().toISOString(),sent).run().catch(()=>{});
  return sent;
 }catch{return 0}
}
/** 알림함 읽기·읽음 처리·받을 알림 고르기 */
export async function notificationsApi(request:Request,env:Env){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 try{
  const view=async()=>{const list=(await env.DB.prepare('SELECT id,kind,title,body,url,created_at,read_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user).all<any>()).results;const p=await env.DB.prepare('SELECT prefs FROM notification_prefs WHERE user_id=?').bind(user).first<any>();return json({items:list,unread:list.filter((x:any)=>!x.read_at).length,prefs:p?JSON.parse(p.prefs||'{}'):{}})};
  if(request.method==='GET')return view();
  if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'요청을 확인할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},403);
  const raw=await request.text();if(raw.length>4000)return json({error:'요청이 너무 커요. 새로고침한 뒤 다시 시도해 주세요.'},413);const b=JSON.parse(raw),now=new Date().toISOString();
  if(b.action==='read'&&typeof b.id==='string')await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND id=? AND read_at IS NULL').bind(now,user,b.id).run();
  else if(b.action==='readAll')await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(now,user).run();
  else if(b.action==='prefs'&&b.prefs&&typeof b.prefs==='object'){const clean:Record<string,boolean>={};for(const k of Object.keys(NOTIFY_KINDS))if(typeof b.prefs[k]==='boolean')clean[k]=b.prefs[k];await env.DB.prepare('INSERT INTO notification_prefs(user_id,prefs,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET prefs=excluded.prefs,updated_at=excluded.updated_at').bind(user,JSON.stringify(clean),now).run()}
  else return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
  return view();
 }catch(e){return serverError('notifications',e,'알림을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
