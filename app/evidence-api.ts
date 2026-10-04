import {resolveStore} from './saas-api';
import {serverError,reportError} from '../lib/errors';
import {canWrite,hasFeature} from '../lib/plans';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function evidenceApi(request:Request,env:{DB:D1Database}){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인이 필요해요.'},401);
 try{
 const linked=await resolveStore(env.DB,user);if(!linked||linked.access==='revoked')return json({error:'볼 권한이 없어요. 내 계정으로 로그인했는지 확인해 주세요.'},403);
 const data=JSON.parse(linked.row.data),self=data._members?.find((m:any)=>m.userId===user)?.employeeId,url=new URL(request.url);
 const leaveId=url.searchParams.get('leave'),leave=data._operations?.leaves?.find((l:any)=>l.id===leaveId);
 if(!leave||(linked.access!=='owner'&&leave.employeeId!==self))return json({error:'볼 수 없는 신청이에요. 목록을 새로고침해 주세요.'},404);
 const now=new Date().toISOString(),id=url.searchParams.get('id');
 if(request.method==='GET'){
  if(id){const file=await env.DB.prepare('SELECT mime,body,bytes FROM leave_evidence WHERE owner=? AND leave_id=? AND id=? AND expires_at>?').bind(linked.owner,leaveId,id,now).first();return file?json(file):json({error:'파일이 없거나 30일 보관 기간이 끝났어요. 필요하면 직원에게 다시 받아 주세요.'},404)}
  const list=await env.DB.prepare('SELECT id,mime,bytes,created_at,expires_at FROM leave_evidence WHERE owner=? AND leave_id=? AND expires_at>? ORDER BY created_at').bind(linked.owner,leaveId,now).all();return json({files:list.results});
 }
 if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요.'},403);
 if(request.method==='DELETE'){if(!id)return json({error:'파일을 선택해 주세요.'},400);await env.DB.prepare('DELETE FROM leave_evidence WHERE owner=? AND leave_id=? AND id=?').bind(linked.owner,leaveId,id).run();return json({ok:true})}
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(!canWrite(data._account)||!hasFeature(data._account,'leave'))return json({error:'휴가 기능을 이용할 수 있는 요금제를 확인해 주세요.'},403);
 if(leave.status!=='승인 대기')return json({error:'승인 대기 중인 신청에만 낼 수 있어요. 새로 신청한 뒤 제출해 주세요.'},409);
 const reader=request.body?.getReader();if(!reader)return json({error:'파일을 선택해 주세요.'},400);let raw='',size=0;const decoder=new TextDecoder();while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>750000){await reader.cancel();return json({error:'파일은 500KB 이하로 제출해 주세요.'},413)}raw+=decoder.decode(r.value,{stream:true})}raw+=decoder.decode();
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'파일을 다시 선택해 주세요.'},400)}
 if(b.consent!==true||typeof b.body!=='string'||!['application/pdf','image/png','image/jpeg'].includes(b.mime)||!/^[-A-Za-z0-9+/]*={0,2}$/.test(b.body))return json({error:'PDF·JPG·PNG 파일과 제출 동의를 확인해 주세요.'},400);
 let binary:string;try{binary=atob(b.body)}catch{return json({error:'파일을 읽을 수 없어요. PDF·JPG·PNG 파일인지 확인하고 다시 올려 주세요.'},400)}
 const valid=b.mime==='application/pdf'?binary.startsWith('%PDF-'):b.mime==='image/png'?binary.startsWith('\x89PNG\r\n\x1a\n'):binary.startsWith('\xff\xd8\xff');
 if(!valid||!binary.length||binary.length>512000)return json({error:'올바른 PDF·JPG·PNG 파일(500KB 이하)을 선택해 주세요.'},400);
 await env.DB.prepare('DELETE FROM leave_evidence WHERE owner=? AND expires_at<=?').bind(linked.owner,now).run();
 const expiry=new Date(Date.now()+30*86400000).toISOString();
 const result=await env.DB.prepare('INSERT INTO leave_evidence (id,owner,leave_id,employee_id,mime,body,bytes,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM leave_evidence WHERE owner=? AND leave_id=?)<3 AND (SELECT COUNT(*) FROM leave_evidence WHERE owner=?)<100').bind(crypto.randomUUID(),linked.owner,leaveId,leave.employeeId,b.mime,b.body,binary.length,now,expiry,linked.owner,leaveId,linked.owner).run();
 return result.meta.changes?json({ok:true}):json({error:'파일은 신청당 3개, 가게 전체 100개까지 올릴 수 있어요. 필요 없는 파일을 지운 뒤 다시 올려 주세요.'},409);
 }catch(e){return serverError('evidence',e,'증빙을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
