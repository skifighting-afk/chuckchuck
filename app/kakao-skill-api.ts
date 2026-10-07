// 지시서 084: 카카오톡에서 척척 비서 — 카카오 i 오픈빌더 '스킬' 서버.
// 1) 앱(설정)에서 연결 코드 6자리를 받는다 → 2) 카카오톡 채널에 "연결 123456" → 3) 그다음부터 "오늘 누가 근무해?" 같은 질문에 답한다.
// 오픈빌더 스킬 설정의 헤더 x-skill-key 값이 KAKAO_SKILL_KEY(비밀값)와 같아야 받는다. 바꾸는 일(근무 넣기 등)은 앱에서만 한다.
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {reply} from '../lib/assistant';
import {normalizeTeam} from '../lib/team-model';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const say=(text:string,quick:string[]=[])=>json({version:'2.0',template:{outputs:[{simpleText:{text:text.slice(0,990)}}],...(quick.length?{quickReplies:quick.map(q=>({label:q,action:'message',messageText:q}))}:{})}});
const hash=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('kakao:'+t)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const kst=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export async function kakaoSkillApi(request:Request,env:{DB:D1Database,KAKAO_SKILL_KEY?:string,SUPABASE_URL?:string}){
 try{
 const url=new URL(request.url);
 // 앱에서: 연결 코드 받기·연결 끊기(로그인 필요)
 const user=request.headers.get('oai-authenticated-user-id');
 if(url.searchParams.get('link')!==null){if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({error:'척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
  const b:any=await request.json().catch(()=>({}));
  if(b.action==='unlink'){await env.DB.prepare('DELETE FROM kakao_links WHERE user_id=?').bind(user).run();return json({ok:true,linked:false})}
  if(b.action==='status'){const r=await env.DB.prepare('SELECT created_at FROM kakao_links WHERE user_id=? LIMIT 1').bind(user).first<any>();return json({linked:!!r,since:r?.created_at||null,ready:!!env.KAKAO_SKILL_KEY,skillUrl:env.SUPABASE_URL?`${env.SUPABASE_URL.replace(/\/$/,'')}/functions/v1/api/kakao-skill`:null})}
  const code=String(100000+(crypto.getRandomValues(new Uint32Array(1))[0]%900000));
  await env.DB.prepare('DELETE FROM kakao_link_codes WHERE user_id=? OR expires_at<?').bind(user,Date.now()).run();
  await env.DB.prepare('INSERT INTO kakao_link_codes(code,user_id,expires_at) VALUES(?,?,?)').bind(await hash(code),user,Date.now()+10*60000).run();
  return json({code,expiresInMinutes:10});
 }
 // 카카오 오픈빌더가 부르는 스킬
 if(request.method!=='POST')return json({error:'POST로 불러 주세요.'},405);
 if(!env.KAKAO_SKILL_KEY||request.headers.get('x-skill-key')!==env.KAKAO_SKILL_KEY)return json({error:'스킬 키가 맞지 않아요. 오픈빌더 스킬 헤더를 확인해 주세요.'},403);
 const b:any=await request.json().catch(()=>({}));const kid=String(b?.userRequest?.user?.id||'').slice(0,200),text=String(b?.userRequest?.utterance||'').trim().slice(0,300);
 if(!kid)return say('카카오 사용자 정보를 받지 못했어요. 잠시 뒤 다시 보내 주세요.');
 const m=text.match(/^연결\s*(\d{6})$/);
 if(m){const row=await env.DB.prepare('SELECT user_id,expires_at FROM kakao_link_codes WHERE code=?').bind(await hash(m[1])).first<any>();if(!row||Number(row.expires_at)<Date.now())return say('코드가 맞지 않거나 10분이 지났어요. 척척사장 앱 설정에서 새 코드를 받아 주세요.');
  await env.DB.prepare('DELETE FROM kakao_link_codes WHERE code=?').bind(await hash(m[1])).run();await env.DB.prepare('INSERT INTO kakao_links(kakao_user,user_id,created_at) VALUES(?,?,?) ON CONFLICT (kakao_user) DO UPDATE SET user_id=excluded.user_id,created_at=excluded.created_at').bind(kid,row.user_id,new Date().toISOString()).run();
  return say('척척사장 계정과 연결했어요. 이제 물어보세요.',['오늘 누가 근무해?','이번 달 인건비','할 일'])}
 const link=await env.DB.prepare('SELECT user_id FROM kakao_links WHERE kakao_user=?').bind(kid).first<any>();
 if(!link)return say('먼저 척척사장 계정과 연결해 주세요. 앱 설정 → 카카오톡 비서에서 코드 6자리를 받은 뒤 "연결 123456"처럼 보내 주세요.');
 if(/^연결\s*끊기$/.test(text)){await env.DB.prepare('DELETE FROM kakao_links WHERE kakao_user=?').bind(kid).run();return say('연결을 끊었어요. 다시 쓰려면 앱에서 새 코드를 받아 주세요.')}
 const linked=await resolveStore(env.DB,link.user_id);if(!linked||linked.access!=='owner')return say('사장님 계정만 카카오톡 비서를 쓸 수 있어요. 직원은 앱에서 확인해 주세요.');
 const raw=JSON.parse(linked.row.data);const st=normalizeTeam(raw);
 const r=reply(text||'할 일',st,st.branches[0]?.id||'',kst());
 const lines=r.lines.filter(Boolean).slice(0,12);
 return say((lines.join('\n')||'잘 모르겠어요. "오늘 누가 근무해?", "이번 달 인건비"처럼 물어봐 주세요.')+(r.actions?.length?'\n\n근무 넣기·승인 같은 일은 앱에서 해 주세요.':''),['오늘 누가 근무해?','할 일']);
 }catch(e){return serverError('kakao-skill',e,'지금 답하지 못했어요. 잠시 뒤 다시 보내 주세요.')}
}
