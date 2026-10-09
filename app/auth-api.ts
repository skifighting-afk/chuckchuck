// 로그인·가입·비밀번호는 Supabase Auth가 맡는다. 이 파일은
// 1) 요청의 Supabase 토큰을 확인해 기존 코드가 쓰던 oai-authenticated-user-* 헤더로 바꿔 주고
// 2) 화면의 /api/auth 요청(가입·로그인·비밀번호 찾기·이메일 확인)을 Supabase Auth로 중계한다.
import {verifyTotp,newSecret,otpauthUri,backupCodes,sessionKeyOf} from '../lib/totp';
import {digest,randomToken,validPassword} from '../lib/password';
import {serverError,reportError} from '../lib/errors';
import {mailReady,sendMail} from '../lib/mail';
import {LEGAL,consentCurrent} from '../lib/legal';
export type AuthEnv={DB:D1Database,SUPABASE_URL?:string,SUPABASE_ANON_KEY?:string,SUPABASE_SERVICE_ROLE_KEY?:string,RESEND_API_KEY?:string,EMAIL_FROM?:string,AUTH_FETCH?:typeof fetch};
type Env=AuthEnv;
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const goodEmail=(v:unknown)=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const bearer=(r:Request)=>{const m=/^Bearer\s+(.+)$/i.exec(r.headers.get('authorization')||'');return m?m[1].trim():'';};

const deviceName=(ua:string)=>{const os=/iPhone|iPad/.test(ua)?'iPhone·iPad':/Android/.test(ua)?'Android':/Mac OS X/.test(ua)?'Mac':/Windows/.test(ua)?'Windows':/Linux/.test(ua)?'Linux':'알 수 없는 기기',br=/SamsungBrowser/.test(ua)?'삼성 인터넷':/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'';return br?os+' · '+br:os};
/** Supabase Auth(GoTrue) 호출. admin=true면 service role 키를 쓴다. */
async function gotrue(env:Env,path:string,init:{method?:string,body?:any,token?:string,admin?:boolean}={}){
 if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)throw Error('SUPABASE_URL/SUPABASE_ANON_KEY 설정이 필요해요.');
 const key=init.admin?env.SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_ANON_KEY;
 if(!key)throw Error('SUPABASE_SERVICE_ROLE_KEY 설정이 필요해요.');
 const response=await (env.AUTH_FETCH||fetch)(env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1'+path,{method:init.method||'GET',headers:{apikey:key,Authorization:'Bearer '+(init.token||key),'Content-Type':'application/json'},body:init.body===undefined?undefined:JSON.stringify(init.body),signal:AbortSignal.timeout(12000)});
 const data:any=await response.json().catch(()=>({}));
 return {ok:response.ok,status:response.status,data};
}
const session=(d:any)=>d?.access_token?{access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Math.floor(Date.now()/1000)+(Number(d.expires_in)||3600)}:null;

export async function authLimit(env:Env,key:string,max:number,window:number){
 const now=Date.now(),bucket=await digest(key+':'+Math.floor(now/window));
 const row=await env.DB.prepare('INSERT INTO auth_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=auth_limits.hits+1 RETURNING hits').bind(bucket,now+window*2).first<any>();
 return row.hits<=max;
}

/** Supabase 사용자에 대응하는 앱 계정(이름·역할·이메일 확인 여부). 없으면 가입 정보로 만든다. */
async function appUser(env:Env,user:any){
 const found=await env.DB.prepare('SELECT * FROM app_users WHERE auth_id=?').bind(user.id).first<any>();
 if(found)return found;
 const meta=user.user_metadata||{},role=meta.role==='employee'?'employee':'owner',name=String(meta.name||user.email||'').slice(0,80)||'사용자';
 await env.DB.prepare('INSERT OR IGNORE INTO app_users(id,auth_id,email,name,role,email_verified,created_at) VALUES(?,?,?,?,?,0,?)').bind('native:'+user.id,user.id,String(user.email).toLowerCase(),name,role,Date.now()).run();
 return env.DB.prepare('SELECT * FROM app_users WHERE auth_id=?').bind(user.id).first<any>();
}

/** 요청의 Supabase 토큰을 확인해 신원 헤더를 붙인다. 브라우저가 보낸 신원 헤더는 항상 지운다. */
const sessionHash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('mfa:'+sessionKeyOf(token))))).map(n=>n.toString(16).padStart(2,'0')).join('');
const codeHash=async(c:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('backup:'+c.toUpperCase().replace(/[\s-]/g,''))))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function withNativeIdentity(request:Request,env:Env){
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-user-'))headers.delete(name);headers.delete('x-cc-mfa-required');
 const token=bearer(request);
 if(token&&token!==env.SUPABASE_ANON_KEY&&token.length<4096){
  const r=await gotrue(env,'/user',{token}).catch(()=>null);
  const user=r?.ok&&r.data?.id&&r.data?.email?await appUser(env,r.data):null;
  // 지시서 098: 2단계 인증을 켠 사람은 인증 코드를 넣은 세션만 들어온다(비밀번호만으로 받은 토큰은 막음)
  if(user&&user.totp_enabled&&!await env.DB.prepare('SELECT 1 FROM mfa_sessions WHERE session_key=?').bind(await sessionHash(token)).first().catch(()=>null)){headers.set('x-cc-mfa-required','1')}
  else if(user){headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email);headers.set('oai-authenticated-user-full-name',encodeURIComponent(user.name));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');headers.set('oai-authenticated-user-native-role',user.role);headers.set('oai-authenticated-user-email-verified',String(!!user.email_verified));}
 }
 return new Request(request,{headers});
}

export async function nativeAuth(request:Request,env:Env){
 if(request.method==='GET'){
  const r=await withNativeIdentity(request,env),id=r.headers.get('oai-authenticated-user-id');
  return json({authenticated:!!id,email:id?r.headers.get('oai-authenticated-user-email'):null,verified:!!id&&r.headers.get('oai-authenticated-user-email-verified')==='true',mailReady:mailReady(env),native:!!id});
 }
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);
 try{
  const raw=await request.text();if(raw.length>5000)return json({error:'입력 내용이 너무 길어요. 줄여서 다시 저장해 주세요.'},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:'입력 내용을 확인해 주세요.'},400)}if(!b||typeof b!=='object')return json({error:'입력 내용을 확인해 주세요.'},400);const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(b.action==='logout'||b.action==='legacy'){
   // 작업 060: 기본은 이 기기만, everywhere=true면 모든 기기에서 로그아웃
   const token=bearer(request);if(token&&token!==env.SUPABASE_ANON_KEY)await gotrue(env,'/logout?scope='+(b.everywhere===true?'global':'local'),{method:'POST',token}).catch(()=>null);
   return json({ok:true,session:null});
  }
  if(['totpStatus','totpSetup','totpEnable','totpVerify','totpDisable'].includes(b.action)){// 지시서 098: 2단계 인증
   const token=bearer(request);if(!token||token===env.SUPABASE_ANON_KEY)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
   const me=await gotrue(env,'/user',{token}).catch(()=>null);if(!(me as any)?.ok||!(me as any).data?.id)return json({error:'다시 로그인해 주세요.'},401);
   const u=await appUser(env,(me as any).data);if(!u)return json({error:'계정을 찾을 수 없어요. 다시 로그인해 주세요.'},401);
   const sk=await sessionHash(token),verified=!u.totp_enabled||!!await env.DB.prepare('SELECT 1 FROM mfa_sessions WHERE session_key=?').bind(sk).first();
   if(b.action==='totpStatus')return json({enabled:!!u.totp_enabled,verified,backupLeft:JSON.parse(u.totp_backup||'[]').length});
   if(!await authLimit(env,'totp:'+u.id,8,15*60000))return json({error:'코드를 여러 번 틀렸어요. 15분 뒤 다시 해 주세요.'},429);
   const check=async(code:string)=>{const c=String(code||'').trim();const step=u.totp_secret?await verifyTotp(u.totp_secret,c.replace(/\s/g,''),Date.now(),Number(u.totp_step??-1)):-1;if(step>=0){await env.DB.prepare('UPDATE app_users SET totp_step=? WHERE id=?').bind(step,u.id).run();return true}
    if(u.totp_enabled&&/^[0-9A-Za-z-]{8,12}$/.test(c)){const list:string[]=JSON.parse(u.totp_backup||'[]'),h=await codeHash(c);if(list.includes(h)){await env.DB.prepare('UPDATE app_users SET totp_backup=? WHERE id=?').bind(JSON.stringify(list.filter(x=>x!==h)),u.id).run();return true}}return false};
   if(b.action==='totpSetup'){if(u.totp_enabled)return json({error:'이미 켜져 있어요. 끄려면 먼저 끄기를 눌러 주세요.'},400);const secret=newSecret();await env.DB.prepare('UPDATE app_users SET totp_secret=?,totp_step=-1 WHERE id=?').bind(secret,u.id).run();return json({secret,uri:otpauthUri(secret,u.email)})}
   if(b.action==='totpEnable'){if(u.totp_enabled)return json({error:'이미 켜져 있어요.'},400);if(!u.totp_secret)return json({error:'먼저 인증 앱 등록을 시작해 주세요.'},400);if(!await check(b.otp))return json({error:'코드가 맞지 않아요. 인증 앱의 지금 6자리를 넣어 주세요.'},400);
    const codes=backupCodes();await env.DB.prepare('UPDATE app_users SET totp_enabled=?,totp_backup=? WHERE id=?').bind(true,JSON.stringify(await Promise.all(codes.map(codeHash))),u.id).run();await env.DB.prepare('INSERT INTO mfa_sessions(session_key,user_id,created_at) VALUES(?,?,?) ON CONFLICT (session_key) DO NOTHING').bind(sk,u.id,new Date().toISOString()).run();
    return json({ok:true,enabled:true,backupCodes:codes})}
   if(b.action==='totpVerify'){if(!u.totp_enabled)return json({ok:true});if(!await check(b.otp))return json({error:'코드가 맞지 않아요. 인증 앱의 지금 6자리나 비상 코드를 넣어 주세요.'},400);await env.DB.prepare('INSERT INTO mfa_sessions(session_key,user_id,created_at) VALUES(?,?,?) ON CONFLICT (session_key) DO NOTHING').bind(sk,u.id,new Date().toISOString()).run();await env.DB.prepare('DELETE FROM mfa_sessions WHERE user_id=? AND created_at<?').bind(u.id,new Date(Date.now()-90*86400000).toISOString()).run();return json({ok:true})}
   if(b.action==='totpDisable'){if(!u.totp_enabled)return json({ok:true,enabled:false});if(!verified||!await check(b.otp))return json({error:'코드가 맞지 않아요. 인증 앱의 지금 6자리나 비상 코드를 넣어 주세요.'},400);await env.DB.prepare("UPDATE app_users SET totp_enabled=?,totp_secret='',totp_backup='[]',totp_step=-1 WHERE id=?").bind(false,u.id).run();await env.DB.prepare('DELETE FROM mfa_sessions WHERE user_id=?').bind(u.id).run();return json({ok:true,enabled:false})}
  }
  if(b.action==='loginHistory'){// 지시서 098: 내 최근 로그인 기록(성공·실패)
   const token=bearer(request);if(!token||token===env.SUPABASE_ANON_KEY)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
   const me=await gotrue(env,'/user',{token}).catch(()=>null);const authId=(me as any)?.data?.id;if(!(me as any)?.ok||!authId)return json({error:'다시 로그인해 주세요.'},401);
   const u=await env.DB.prepare('SELECT id FROM app_users WHERE auth_id=? OR id=?').bind(authId,'native:'+authId).first<any>().catch(()=>null);
   const rows=u?(await env.DB.prepare('SELECT at,ok,device,ip FROM login_events WHERE user_id=? ORDER BY at DESC LIMIT 30').bind(u.id).all<any>()).results:[];
   return json({events:(rows||[]).map((r:any)=>({at:r.at,ok:!!r.ok,device:r.device,ip:r.ip}))});
  }
  if(b.action==='sessions'){
   const token=bearer(request);if(!token||token===env.SUPABASE_ANON_KEY)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
   const me=await gotrue(env,'/user',{token}).catch(()=>null);const authId=(me as any)?.data?.id;if(!(me as any)?.ok||!authId)return json({error:'다시 로그인해 주세요.'},401);
   try{const rows=await env.DB.prepare('SELECT created_at,updated_at,user_agent FROM auth.sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 20').bind(authId).all<any>();
    return json({sessions:(rows.results||[]).map((r:any)=>({createdAt:r.created_at,lastUsedAt:r.updated_at||r.created_at,device:deviceName(r.user_agent||'')}))})}
   catch{return json({sessions:null})}
  }
  const ip=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim()||request.headers.get('cf-connecting-ip')||'local';
  await env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now()).run();
  if(!await authLimit(env,'ip:'+ip,60,15*60000))return json({error:'시도가 많아요. 15분 뒤 다시 시도해 주세요.'},429);
  if(b.action==='consent'){
   const current=await withNativeIdentity(new Request(request.url,{headers:request.headers}),env),id=current.headers.get('oai-authenticated-user-id');
   if(!id)return json({error:'로그인한 뒤 동의해 주세요.'},401);
   if(b.agree!==true)return json({error:'이용약관과 개인정보 처리방침에 동의해 주세요.'},400);
   await env.DB.prepare('UPDATE app_users SET terms_version=?,privacy_version=?,consented_at=? WHERE id=?').bind(LEGAL.terms.version,LEGAL.privacy.version,new Date().toISOString(),id).run();
   return json({ok:true});
  }
  if(b.action==='verifyEmail'){
   if(typeof b.token!=='string'||!/^([a-f0-9]{64})$/.test(b.token))return json({error:'인증 주소를 다시 확인해 주세요.'},400);
   const proof=await env.DB.prepare('DELETE FROM auth_verifications WHERE token_hash=? AND expires_at>? RETURNING user_id,email').bind(await digest(b.token),Date.now()).first<any>();
   if(!proof)return json({error:'만료되었거나 사용한 인증 주소예요. 새 인증메일을 받아 주세요.'},400);
   const changed=await env.DB.prepare('UPDATE app_users SET email_verified=1 WHERE id=? AND email=?').bind(proof.user_id,proof.email).run();
   if(!changed.meta.changes)return json({error:'계정 정보가 바뀌었어요. 다시 인증해 주세요.'},409);
   await env.DB.prepare('DELETE FROM auth_verifications WHERE user_id=?').bind(proof.user_id).run();
   return json({ok:true,message:'이메일 확인을 마쳤어요.'});
  }
  if(b.action==='sendVerification'){
   const current=await withNativeIdentity(new Request(request.url,{headers:request.headers}),env),id=current.headers.get('oai-authenticated-user-id');
   if(!id)return json({error:'로그인한 뒤 이메일을 확인해 주세요.'},401);
   const user=await env.DB.prepare('SELECT id,email,email_verified FROM app_users WHERE id=?').bind(id).first<any>();
   if(!user)return json({error:'다시 로그인해 주세요.'},401);
   if(user.email_verified)return json({ok:true,verified:true});
   if(!mailReady(env))return json({error:'이메일 발송을 준비하고 있어요. 지금은 앱에서 서류를 확인하도록 안내해 주세요.',code:'EMAIL_NOT_READY'},503);
   if(!await authLimit(env,'verify-minute:'+id,1,60000)||!await authLimit(env,'verify-hour:'+id,5,3600000))return json({error:'메일함을 확인해 주세요. 다시 받기는 1분 뒤, 한 시간에 최대 5번 가능해요.'},429);
   const token=randomToken(),hash=await digest(token);
   await env.DB.prepare('INSERT INTO auth_verifications(token_hash,user_id,email,expires_at,created_at) VALUES(?,?,?,?,?)').bind(hash,id,user.email,Date.now()+30*60000,Date.now()).run();
   try{await sendMail(env,{to:user.email,subject:'척척사장 · 이메일을 확인해 주세요',text:'본인이 만든 척척사장 계정이라면 아래 주소에서 이메일 확인을 눌러 주세요. 30분 동안 사용할 수 있어요. 요청하지 않았다면 누르지 않아도 됩니다.\n\n'+new URL('/verify-email#token='+token,request.url).href,key:'verify-'+hash});}
   catch{await env.DB.prepare('DELETE FROM auth_verifications WHERE token_hash=?').bind(hash).run();return json({error:'인증메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'},503)}
   await env.DB.prepare('DELETE FROM auth_verifications WHERE user_id=? AND token_hash<>?').bind(id,hash).run();
   return json({ok:true,message:'인증메일을 보냈어요. 메일함과 스팸함을 확인해 주세요.'});
  }
  if(b.action==='reset'){
   // b.token은 비밀번호 재설정 메일 링크로 받은 Supabase 접근 토큰이다.
   if(!validPassword(b.password)||typeof b.token!=='string'||b.token.length<20||b.token.length>4096)return json({error:'비밀번호는 8~128자로 입력해 주세요. 단순 반복이나 연속 숫자는 피해 주세요.'},400);
   const changed=await gotrue(env,'/user',{method:'PUT',token:b.token,body:{password:b.password}});
   if(!changed.ok||!changed.data?.id)return json({error:'만료되었거나 사용한 주소예요. 비밀번호 찾기를 다시 해 주세요.'},400);
   const user=await appUser(env,changed.data);
   // 메일 링크로 들어왔으니 이메일 주인임이 확인됐다.
   if(user&&String(changed.data.email).toLowerCase()===user.email)await env.DB.prepare('UPDATE app_users SET email_verified=1 WHERE id=?').bind(user.id).run();
   await gotrue(env,'/logout?scope=others',{method:'POST',token:b.token}).catch(()=>null);
   return json({ok:true});
  }
  if(!goodEmail(email))return json({error:'이메일 주소를 확인해 주세요.'},400);
  if(!await authLimit(env,'email:'+email,10,15*60000))return json({error:'시도가 많아요. 15분 뒤 다시 시도해 주세요.'},429);
  if(b.action==='recover'){
   const sent=await gotrue(env,'/recover?redirect_to='+encodeURIComponent(new URL('/login?mode=reset',request.url).href),{method:'POST',body:{email}});
   if(!sent.ok&&sent.status>=500)return json({error:'비밀번호 찾기 이메일 연결을 준비 중이에요. 지금은 비밀번호를 안전한 곳에 보관해 주세요.',code:'EMAIL_NOT_READY'},503);
   return json({ok:true,message:'가입한 이메일이라면 비밀번호 설정 주소를 보내드렸어요.'});
  }
  if(b.action==='register'){
   if(!validPassword(b.password))return json({error:'비밀번호는 8~128자로 입력해 주세요. 단순 반복이나 연속 숫자는 피해 주세요.'},400);
   if(!['owner','employee'].includes(b.role)||typeof b.name!=='string'||!b.name.trim()||b.name.length>80)return json({error:'이름과 가입할 역할을 확인해 주세요.'},400);
   if(b.agree!==true)return json({error:'만 14세 이상인지 확인하고 이용약관과 개인정보 처리방침에 동의해 주세요.',code:'CONSENT_REQUIRED'},400);
   if(await env.DB.prepare('SELECT 1 AS x FROM app_users WHERE email=?').bind(email).first())return json({error:'이 이메일로 가입할 수 없어요. 기존 회원이라면 로그인해 주세요.'},409);
   // 가입 즉시 쓸 수 있게 만든다. 이메일 확인은 앱의 '이메일 확인' 단계에서 따로 한다.
   const created=await gotrue(env,'/admin/users',{method:'POST',admin:true,body:{email,password:b.password,email_confirm:true,user_metadata:{name:b.name.trim(),role:b.role}}});
   if(!created.ok||!created.data?.id)return created.status===422?json({error:'이 이메일로 가입할 수 없어요. 기존 회원이라면 로그인해 주세요.'},409):json({error:'가입을 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},502);
   const made=await appUser(env,created.data);
   await env.DB.prepare('UPDATE app_users SET terms_version=?,privacy_version=?,consented_at=? WHERE id=?').bind(LEGAL.terms.version,LEGAL.privacy.version,new Date().toISOString(),made.id).run();
   const login=await gotrue(env,'/token?grant_type=password',{method:'POST',body:{email,password:b.password}});
   if(!login.ok)return json({error:'가입은 됐어요. 로그인해 주세요.'},409);
   return json({ok:true,role:b.role,emailVerified:false,session:session(login.data)});
  }
  if(b.action==='login'){
   if(typeof b.password!=='string'||b.password.length>128)return json({error:'이메일 또는 비밀번호를 확인해 주세요.'},401);
   const login=await gotrue(env,'/token?grant_type=password',{method:'POST',body:{email,password:b.password}});
   // 지시서 098: 로그인 기록(실패는 그 이메일 계정에, IP는 앞자리만)
   const note=async(uid:string|undefined,ok:boolean)=>{if(!uid)return;const ipShort=ip.includes(':')?ip.split(':').slice(0,3).join(':')+':…':ip.split('.').slice(0,2).join('.')+'.*.*';await env.DB.prepare('INSERT INTO login_events(id,user_id,at,ok,device,ip) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),uid,new Date().toISOString(),ok,deviceName(request.headers.get('user-agent')||''),ipShort).run().catch(()=>null);await env.DB.prepare("DELETE FROM login_events WHERE user_id=? AND at<?").bind(uid,new Date(Date.now()-90*86400000).toISOString()).run().catch(()=>null)};
   if(!login.ok||!login.data?.user){const u=await env.DB.prepare('SELECT id FROM app_users WHERE lower(email)=?').bind(email).first<any>().catch(()=>null);await note(u?.id,false);return json({error:'이메일 또는 비밀번호를 확인해 주세요.'},401);}
   const user=await appUser(env,login.data.user);await note(user.id,true);
   if(user.totp_enabled)return json({ok:true,mfaRequired:true,role:user.role,emailVerified:!!user.email_verified,session:session(login.data)});
   return json({ok:true,role:user.role,emailVerified:!!user.email_verified,session:session(login.data)});
  }
  return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 }catch(e){return serverError('auth',e,'계정 처리를 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}

/** 서명 직전 본인 확인: 현재 비밀번호를 다시 확인하고, 이메일 확인 여부를 사실대로 기록한다. */
export async function confirmSigner(request:Request,env:Env,password:unknown,requireVerified=true){
 const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!id||!email)throw Error('로그인한 계정으로 서명해 주세요.');
 if(!await authLimit(env,'signer:'+id,10,15*60000))throw Error('시도가 많아요. 15분 뒤 다시 서명해 주세요.');
 const user=await env.DB.prepare('SELECT * FROM app_users WHERE id=?').bind(id).first<any>();
 if(!user)throw Error('로그인 계정을 확인해 주세요.');
 if(requireVerified&&!user.email_verified)throw Error('계약서 사본을 이메일로 받으려면 먼저 내 이메일을 확인해 주세요.');
 if(typeof password!=='string'||!password||password.length>128)throw Error('현재 비밀번호를 확인해 주세요.');
 const check=await gotrue(env,'/token?grant_type=password',{method:'POST',body:{email:user.email,password}});
 if(!check.ok||check.data?.user?.id!==user.auth_id)throw Error('현재 비밀번호를 확인해 주세요.');
 return {userId:id,email:user.email,authMethod:'email-password',emailVerified:!!user.email_verified};
}

/** 작업 056: Supabase Auth 로그인 계정 삭제(서비스 키). 이미 없으면 성공으로 본다. */
export async function deleteAuthUser(env:Env,authId:string){
 const r=await gotrue(env,'/admin/users/'+encodeURIComponent(authId),{method:'DELETE',admin:true});
 return r.ok||r.status===404;
}

/** 메일 없이 비밀번호 찾기: 임시 비밀번호로 바꾸고 다음 로그인 때 새 비밀번호를 정하게 한다. 임시 비밀번호는 저장하지 않는다. */
const TEMP_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function tempPassword(){const b=crypto.getRandomValues(new Uint8Array(10));return [...b].map(x=>TEMP_ALPHABET[x%TEMP_ALPHABET.length]).join('').replace(/^(.{5})/,'$1-')}
export async function setTempPassword(env:Env,appUserId:string){
 const u=await env.DB.prepare('SELECT auth_id FROM app_users WHERE id=?').bind(appUserId).first<any>();if(!u)return null;
 const pw=tempPassword(),r=await gotrue(env,'/admin/users/'+encodeURIComponent(u.auth_id),{method:'PUT',admin:true,body:{password:pw}});
 if(!r.ok)throw Error('임시 비밀번호를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
 await env.DB.prepare('UPDATE app_users SET must_change_password=1 WHERE id=?').bind(appUserId).run();
 return pw;
}
/** 로그인한 사람이 임시 비밀번호를 새 비밀번호로 바꾼다(지금 로그인 토큰으로). */
export async function changeOwnPassword(env:Env,request:Request,password:unknown){
 const id=request.headers.get('oai-authenticated-user-id'),token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!id||!token)throw Error('로그인한 뒤 다시 시도해 주세요.');
 if(!validPassword(password))throw Error('비밀번호는 8~128자로 입력해 주세요. 단순 반복이나 연속 숫자는 피해 주세요.');
 const r=await gotrue(env,'/user',{method:'PUT',token,body:{password}});
 if(!r.ok)throw Error('비밀번호를 바꾸지 못했어요. 다시 로그인한 뒤 시도해 주세요.');
 await env.DB.prepare('UPDATE app_users SET must_change_password=0 WHERE id=?').bind(id).run();
}
