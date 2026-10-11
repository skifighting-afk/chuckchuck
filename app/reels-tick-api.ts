// 인스타 릴스 자동 올리기 깨우기. GitHub 예약 실행이 자주 밀리거나 빠져서(하루 2번만 도는 날도 있음),
// DB의 pg_cron이 10:07~23:37(한국) 30분마다 이 주소를 부르고, 여기서 GitHub 워크플로(reels.yml)를 깨운다.
// 워크플로는 "올릴 차례인지"만 먼저 보고(due.mjs), 차례가 아니면 20초 안에 끝나므로 여러 번 불려도 한 번만 올라간다.
// 아무나 불러도 20분에 한 번만 깨우게 막는다. GitHub 열쇠(REELS_DISPATCH_TOKEN)가 없으면 아무것도 안 한다.
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export const REELS_REPO='skifighting-afk/chuckchuck';
export async function reelsTickApi(request:Request,env:any,f:typeof fetch=fetch){
 if(request.method!=='POST')return json({error:'릴스 자동 올리기 전용 주소예요.'},405);
 const token=env.REELS_DISPATCH_TOKEN;
 if(!token)return json({ok:false,reason:'GitHub 열쇠가 아직 없어요'});
 await env.DB.prepare('INSERT INTO reels_tick (id,last_at) VALUES (1,NULL) ON CONFLICT (id) DO NOTHING').run();
 const claimed=await env.DB.prepare("UPDATE reels_tick SET last_at=now() WHERE id=1 AND (last_at IS NULL OR last_at < now() - interval '20 minutes') RETURNING id").first();
 if(!claimed)return json({ok:true,skipped:'20분 안에 이미 깨웠어요'});
 const r=await f(`https://api.github.com/repos/${REELS_REPO}/actions/workflows/reels.yml/dispatches`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'chukchuk-reels-tick','Content-Type':'application/json'},body:JSON.stringify({ref:'main',inputs:{post:'true',auto:'true'}})});
 if(r.status!==204)return json({ok:false,status:r.status,error:(await r.text()).slice(0,200)},502);
 return json({ok:true,dispatched:true});
}
