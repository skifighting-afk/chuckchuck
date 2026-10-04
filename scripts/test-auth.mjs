// 테스트용 가짜 Supabase Auth(GoTrue)와 요청 도우미.
// 앱은 env.AUTH_FETCH로 GoTrue를 부르므로, 전역 fetch(이메일 발송 등)와 섞이지 않는다.
// 사용자 이름(name)마다 app_users 행(id='native:'+name)과 GoTrue 계정·토큰을 만들어 Bearer 토큰으로 요청한다.
import {testDB} from './test-db.mjs';

export const TEST_PASSWORD='Synthetic pass 2026!';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

/** DB 하나에 묶인 가짜 GoTrue. */
export function fakeGoTrue(DB,{domain='example.invalid'}={}){
 const SUPA='https://auth.test.invalid',ANON='anon-test-key',SERVICE='service-test-key';
 const users=new Map(),tokens=new Map(),named=new Map(),calls=[];
 const state={recoverStatus:200};
 const issue=u=>{const t='tok_'+crypto.randomUUID();tokens.set(t,u.id);return {access_token:t,refresh_token:'r_'+t,expires_in:3600,user:view(u)};};
 const view=u=>({id:u.id,email:u.email,user_metadata:u.user_metadata});
 const AUTH_FETCH=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.origin!==SUPA)throw Error('unexpected auth host '+url.origin);
  const h=new Headers(init.headers),apikey=h.get('apikey'),token=(h.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const p=url.pathname.replace(/^\/auth\/v1/,''),method=init.method||'GET',body=init.body?JSON.parse(init.body):{};
  calls.push({path:p,method,search:url.search,body});
  if(apikey!==ANON&&apikey!==SERVICE)return reply(401,{msg:'no apikey'});
  if(p==='/admin/users'&&method==='POST'){
   if(apikey!==SERVICE||token!==SERVICE)return reply(403,{msg:'service role required'});
   if([...users.values()].some(u=>u.email===body.email))return reply(422,{msg:'email_exists'});
   const u={id:crypto.randomUUID(),email:body.email,password:body.password,user_metadata:body.user_metadata||{}};users.set(u.id,u);return reply(200,view(u));
  }
  if(p.startsWith('/admin/users/')&&method==='DELETE'){
   if(apikey!==SERVICE||token!==SERVICE)return reply(403,{msg:'service role required'});
   const id=p.slice('/admin/users/'.length);if(!users.delete(id))return reply(404,{msg:'user not found'});
   for(const [t,u] of [...tokens])if(u===id)tokens.delete(t);
   return reply(200,{});
  }
  if(p==='/token'&&url.searchParams.get('grant_type')==='password'){
   const u=[...users.values()].find(u=>u.email===String(body.email).toLowerCase()&&u.password===body.password);
   return u?reply(200,issue(u)):reply(400,{error:'invalid_grant'});
  }
  if(p==='/token'&&url.searchParams.get('grant_type')==='refresh_token'){
   const old=String(body.refresh_token||'').replace(/^r_/,''),id=tokens.get(old),u=users.get(id);
   return u?reply(200,issue(u)):reply(400,{error:'invalid_grant'});
  }
  if(p==='/user'){
   const u=users.get(tokens.get(token));if(!u)return reply(401,{msg:'invalid JWT'});
   if(method==='PUT'&&body.password)u.password=body.password;
   return reply(200,view(u));
  }
  if(p==='/logout'){
   const owner=tokens.get(token);if(!owner)return reply(401,{msg:'invalid JWT'});
   const scope=url.searchParams.get('scope')||'global';
   for(const [t,id] of [...tokens])if(id===owner&&(scope==='global'||scope==='local'&&t===token||scope==='others'&&t!==token))tokens.delete(t);
   return reply(204,{});
  }
  if(p==='/recover')return reply(state.recoverStatus,{});
  return reply(404,{msg:'not found'});
 };
 const env={SUPABASE_URL:SUPA,SUPABASE_ANON_KEY:ANON,SUPABASE_SERVICE_ROLE_KEY:SERVICE,AUTH_FETCH};
 /** 이름으로 테스트 계정을 만들고(한 번만) 로그인 토큰을 돌려준다. 기본: 이메일 확인 완료, 사장님 역할. */
 async function user(name,{email,verified=true,role='owner',fullName,password=TEST_PASSWORD}={}){
  if(named.has(name))return named.get(name);
  email=(email||name+'@'+domain).toLowerCase();
  const u={id:crypto.randomUUID(),email,password,user_metadata:{name:fullName||name,role}};users.set(u.id,u);
  await DB.prepare('INSERT INTO app_users(id,auth_id,email,name,role,email_verified,created_at) VALUES(?,?,?,?,?,?,?)').bind('native:'+name,u.id,email,fullName||name,role,verified?1:0,Date.now()).run();
  const out={id:'native:'+name,authId:u.id,email,token:issue(u).access_token};named.set(name,out);return out;
 }
 /** 토큰 만료(GoTrue가 더 이상 인정하지 않음). */
 const expire=token=>tokens.delete(token);
 return {env,users,tokens,calls,state,user,expire,ANON};
}

/** 새 테스트 DB + 가짜 GoTrue + 요청 도우미. */
export async function authedTest({origin='https://test.local',domain='example.invalid',env:extra={}}={}){
 const db=await testDB();
 const auth=fakeGoTrue(db.DB,{domain});
 const env={DB:db.DB,...auth.env,...extra};
 /** 사용자 이름 → Authorization 헤더(빈 이름은 익명) */
 const headersFor=async(name,opts)=>name?{authorization:'Bearer '+(await auth.user(name,opts)).token}:{};
 const id=name=>'native:'+name;
 return {...db,auth,env,headersFor,id,origin};
}
