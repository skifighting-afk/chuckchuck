// 지시서 100: 개인정보 열람 기록 — 사장님·공동 관리자·매니저가 직원 연락처·이메일·주소 '보기'를 누르면 변경 이력에 남긴다.
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function piiLogApi(request:Request,env:{DB:D1Database}){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 const url=new URL(request.url);if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({error:'척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 try{
  const b:any=await request.json().catch(()=>({}));const kind=({phone:'연락처',email:'이메일',address:'주소',bank:'계좌'} as any)[b.kind];if(!kind)return json({error:'무엇을 봤는지 알 수 없어요. 새로고침한 뒤 다시 눌러 주세요.'},400);
  for(let i=0;i<3;i++){const linked=await resolveStore(env.DB,user);if(!linked||linked.access==='revoked')return json({error:'먼저 매장에 연결해 주세요.'},403);
   const d=JSON.parse(linked.row.data),self=d.employees.find((e:any)=>e.id===d._members?.find((m:any)=>m.userId===user)?.employeeId);
   const ok=linked.access==='owner'||(self&&self.access==='중간관리자');if(!ok)return json({error:'열람 기록은 관리자만 남겨요. 사장님 계정으로 로그인해 주세요.'},403);
   const e=d.employees.find((x:any)=>x.id===b.employeeId);if(!e)return json({error:'직원을 찾을 수 없어요. 새로고침해 주세요.'},404);
   const raw=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(linked.owner).first<any>();const dd=JSON.parse(raw.data);
   const name=linked.access==='owner'?((linked as any).coowner?'공동 관리자':'사장님'):self?.name||'관리자';
   dd._audit=[...(dd._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id:user,name},action:'개인정보 열람',target:e.name,before:null,after:{kind},reason:''}].slice(-1000);
   const u=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(dd),raw.version+1,new Date().toISOString(),linked.owner,raw.version).run();
   if(u.meta.changes)return json({ok:true})}
  return json({error:'잠시 뒤 다시 눌러 주세요.'},409);
 }catch(e){return serverError('pii-log',e,'열람 기록을 남기지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
