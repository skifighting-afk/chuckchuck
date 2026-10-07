// 지시서 5주차 041: 직원 서류 보관함 — 사장님은 우리 가게 직원 것, 직원은 자기 것만 보고 올린다.
// 주민등록번호가 보이는 서류(신분증·등본)는 받지 않는다. 사진은 400KB 이하 JPG·PNG.
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {canWrite} from '../lib/plans';
export const DOC_KINDS=['보건증','통장 사본','자격증','친권자 동의서','교육 수료증','기타'] as const;
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function staffDocsApi(request:Request,env:{DB:D1Database}){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 try{
  const linked=await resolveStore(env.DB,uid);if(!linked||linked.access==='revoked')return json({error:'볼 권한이 없어요. 내 계정으로 로그인했는지 확인해 주세요.'},403);
  const data=JSON.parse(linked.row.data),owner=linked.access==='owner',self=data._members?.find((m:any)=>m.userId===uid)?.employeeId as string|undefined;
  const allowed=(emp:string)=>owner?data.employees?.some((e:any)=>e.id===emp):emp===self;
  const url=new URL(request.url);
  if(request.method==='GET'){
   const id=url.searchParams.get('id');
   if(id){const f=await env.DB.prepare('SELECT employee_id,mime,body FROM staff_documents WHERE owner=? AND id=?').bind(linked.owner,id).first<any>();if(!f||!allowed(f.employee_id))return json({error:'볼 수 없는 서류예요. 목록을 새로고침해 주세요.'},404);
    const bin=Uint8Array.from(atob(f.body),c=>c.charCodeAt(0));return new Response(bin,{headers:{'Content-Type':f.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}})}
   const emp=url.searchParams.get('employee')||self||'';if(!allowed(emp))return json({error:'볼 수 없는 직원이에요. 직원 목록을 새로고침해 주세요.'},403);
   const rows=(await env.DB.prepare('SELECT id,kind,mime,bytes,uploaded_by,created_at FROM staff_documents WHERE owner=? AND employee_id=? ORDER BY created_at DESC').bind(linked.owner,emp).all<any>()).results;
   return json({docs:rows,kinds:DOC_KINDS});
  }
  if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);
  if(!canWrite(data._account))return json({error:'체험이 끝나 지금은 조회만 할 수 있어요. 계정·요금제에서 요금제를 결제해 주세요.'},403);
  const raw=await request.text();if(raw.length>600000)return json({error:'사진이 너무 커요. 줄여서 다시 올려 주세요.'},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:'요청 내용을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
  if(b.action==='delete'){const f=await env.DB.prepare('SELECT employee_id,uploaded_by FROM staff_documents WHERE owner=? AND id=?').bind(linked.owner,String(b.id||'')).first<any>();if(!f||!allowed(f.employee_id)||(!owner&&f.uploaded_by!==uid))return json({error:'지울 수 없는 서류예요. 사장님께 요청해 주세요.'},403);await env.DB.prepare('DELETE FROM staff_documents WHERE owner=? AND id=?').bind(linked.owner,String(b.id)).run();return json({ok:true})}
  if(b.action!=='upload')return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
  const emp=String(b.employeeId||self||'');if(!allowed(emp))return json({error:'우리 가게 직원 서류만 올릴 수 있어요. 직원을 다시 골라 주세요.'},403);
  if(!(DOC_KINDS as readonly string[]).includes(b.kind))return json({error:'서류 종류를 골라 주세요.'},400);
  if(!['image/jpeg','image/png'].includes(b.mime)||typeof b.body!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.body))return json({error:'JPG·PNG 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.'},400);
  const bin=atob(b.body);if(bin.length>400000)return json({error:'사진이 너무 커요. 400KB 이하로 줄여서 올려 주세요.'},413);
  if(!(b.mime==='image/png'?bin.startsWith('\x89PNG\r\n\x1a\n'):bin.startsWith('\xff\xd8\xff')))return json({error:'사진 형식이 맞지 않아요. JPG·PNG 사진을 골라 주세요.'},400);
  const n=await env.DB.prepare('SELECT count(*) AS n FROM staff_documents WHERE owner=? AND employee_id=?').bind(linked.owner,emp).first<any>();if(Number(n?.n||0)>=20)return json({error:'한 직원에 서류는 20장까지예요. 지난 서류를 지운 뒤 올려 주세요.'},400);
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO staff_documents(owner,id,employee_id,kind,mime,body,bytes,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(linked.owner,id,emp,b.kind,b.mime,b.body,bin.length,uid,new Date().toISOString()).run();
  return json({ok:true,id},201);
 }catch(e){return serverError('staff-docs',e,'서류를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
