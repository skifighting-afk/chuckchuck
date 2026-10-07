// 지시서 094 본사 공지·매뉴얼 일괄 배포 · 095 표준 템플릿 복제(필요 인원·출퇴근 규칙·매뉴얼) — 한 계정이 관리하는 여러 가게(내 가게 + 공동 관리)에 한 번에
import {storesForUser} from './saas-api';
import {serverError} from '../lib/errors';
import {notifyUser} from './push-api';
import type {PushEnv} from '../lib/webpush';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const str=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
export async function multiStoreApi(request:Request,env:{DB:D1Database}&PushEnv){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 try{
 const mine=(await storesForUser(env.DB,user)).filter(x=>x.access!=='staff');
 if(request.method==='GET')return json({stores:mine.map(x=>({owner:x.owner,name:x.name,access:x.access}))});
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 const url=new URL(request.url);if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const b:any=await request.json().catch(()=>({}));
 const targets=(Array.isArray(b.targets)?b.targets:[]).filter((o:any)=>mine.some(x=>x.owner===o)).slice(0,20) as string[];
 if(!targets.length)return json({error:'보낼 가게를 하나 이상 골라 주세요. 내가 관리하는 가게만 고를 수 있어요.'},400);
 const now=new Date().toISOString(),done:string[]=[],failed:string[]=[];
 let src:any=null;
 if(b.action==='copy'){const from=String(b.from||'');if(!mine.some(x=>x.owner===from))return json({error:'복사할 가게를 골라 주세요.'},400);const r=await env.DB.prepare('SELECT data FROM stores WHERE owner=?').bind(from).first<any>();if(!r)return json({error:'복사할 가게를 찾을 수 없어요. 새로고침해 주세요.'},404);src=JSON.parse(r.data)}
 const kinds=new Set(Array.isArray(b.kinds)?b.kinds:[]);
 if(b.action==='notice'){const title=str(b.title,80),body=str(b.body,2000);if(!title||!body)return json({error:'공지 제목과 내용을 적어 주세요.'},400)}
 else if(b.action==='copy'){if(!kinds.size)return json({error:'복사할 것을 골라 주세요(필요 인원·출퇴근 규칙·매뉴얼).'},400)}
 else return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 for(const owner of targets){if(src&&owner===b.from)continue;
  for(let attempt=0;attempt<3;attempt++){const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(owner).first<any>();if(!row){failed.push(owner);break}
   const d=JSON.parse(row.data);let label='';const notify:string[]=[];
   if(b.action==='notice'){const ops=d._operations||{leaves:[],notices:[]};ops.notices=[...(ops.notices||[]),{id:crypto.randomUUID(),title:str(b.title,80),body:str(b.body,2000),branchId:'all',target:{type:'all'},author:'본사',createdAt:now,reads:[],publishAt:null,photo:null}].slice(-300);d._operations=ops;label='본사 공지 배포';for(const m of d._members||[])if(m.userId&&(d.employees||[]).some((e:any)=>e.id===m.employeeId&&e.status!=='퇴사'))notify.push(m.userId)}
   else{const parts:string[]=[];
    if(kinds.has('needs')&&Array.isArray(src.staffingNeeds)){const bs=(d.branches||[]).map((x:any)=>x.id);const base=src.staffingNeeds.filter((n:any)=>!n.branchId||n.branchId===(src.branches?.[0]?.id));d.staffingNeeds=bs.flatMap((id:string)=>base.map((n:any)=>({...n,branchId:id})));parts.push('필요 인원')}
    if(kinds.has('rules')){d.settings={...(d.settings||{}),...Object.fromEntries(['attendanceRule','attendanceTolerance','weekStart','autoPublish'].filter(k=>src.settings?.[k]!==undefined).map(k=>[k,src.settings[k]]))};parts.push('출퇴근 규칙')}
    if(kinds.has('manuals')&&Array.isArray(src._manuals)){const have=new Set((d._manuals||[]).map((m:any)=>m.title));const add:any[]=[];
     for(const m of src._manuals){if(have.has(m.title))continue;const steps:any[]=[];for(const st of m.steps||[]){let imageId=st.imageId||null;if(imageId&&!String(imageId).startsWith('data:')){const nid=crypto.randomUUID();const ok=await env.DB.prepare('INSERT INTO store_manual_images(owner,id,mime,body,bytes,created_at) SELECT ?,?,mime,body,bytes,? FROM store_manual_images WHERE owner=? AND id=?').bind(owner,nid,now,b.from,imageId).run().catch(()=>null);imageId=ok?.meta?.changes?nid:null}steps.push({text:st.text,imageId})}
      add.push({id:crypto.randomUUID(),title:m.title,branchId:'all',steps,category:m.category||'기타',roles:[],note:'',createdAt:now,updatedAt:now,reads:[],...(m.quiz?{quiz:m.quiz}:{})})}
     d._manuals=[...(d._manuals||[]),...add].slice(0,100);parts.push(`매뉴얼 ${add.length}개`)}
    label='표준 템플릿 복제: '+parts.join('·')}
   d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:now,actor:{id:user,name:'본사'},action:label,target:b.action==='notice'?str(b.title,80):String(src?.store?.name||''),before:null,after:null,reason:''}].slice(-1000);
   const u=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),row.version+1,now,owner,row.version).run();
   if(u.meta.changes){done.push(owner);for(const uid of notify)await notifyUser(env as any,uid,{title:'본사 공지',body:str(b.title,60),url:'/app',kind:'notice'}).catch(()=>null);break}
   if(attempt===2)failed.push(owner)}}
 const nm=(o:string)=>mine.find(x=>x.owner===o)?.name||'가게';
 return json({done:done.map(nm),failed:failed.map(nm)});
 }catch(e){return serverError('multi-store',e,'여러 가게에 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
