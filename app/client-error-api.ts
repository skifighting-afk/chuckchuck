// 개선 2차 B196 화면 오류 자동 보고(개인정보 지움) · B198 느린 요청 기록 — 본사 화면에서 최근 것만 본다.
import {isHQ,type AdminEnv} from './admin-api';
import {scrubError} from '../lib/improve2';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function clientErrorApi(request:Request,env:AdminEnv){
 const url=new URL(request.url);
 if(request.method==='GET'){if(!isHQ(request,env))return json({error:'본사 계정으로 로그인해 주세요.'},403);
  const rows=((await env.DB.prepare('SELECT kind,message,path,at FROM client_errors ORDER BY at DESC LIMIT 100').all().catch(()=>({results:[]}))).results||[]);return json({rows})}
 if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({error:'척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const b:any=await request.json().catch(()=>({}));const kind=b.kind==='slow'?'slow':'error';
 const message=scrubError(String(b.message||'')).slice(0,600),path=String(b.path||'').replace(/[?#].*$/,'').slice(0,120);if(!message)return json({ok:true});
 // 같은 기기에서 쏟아지지 않게: 최근 1분 안 같은 메시지는 버린다, 전체는 하루 2,000건까지만 남긴다
 const now=new Date(),minute=new Date(Date.now()-60000).toISOString();
 // 기록은 최선만: 2초 안에 못 끝내면 그냥 받았다고 답한다(화면을 붙잡지 않게)
 const work=(async()=>{const dup=await env.DB.prepare('SELECT 1 AS x FROM client_errors WHERE message=? AND at>? LIMIT 1').bind(message,minute).first().catch(()=>null);if(dup)return;
  await env.DB.prepare('INSERT INTO client_errors(kind,message,path,at) VALUES(?,?,?,?)').bind(kind,message,path,now.toISOString()).run().catch(()=>null);
  if(Math.random()<0.05)await env.DB.prepare('DELETE FROM client_errors WHERE at<?').bind(new Date(Date.now()-14*86400000).toISOString()).run().catch(()=>null)})();
 await Promise.race([work,new Promise(r=>setTimeout(r,2000))]);
 return json({ok:true});
}
