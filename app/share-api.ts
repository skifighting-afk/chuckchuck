// 가이드 68: 세무사 공유 링크. 사장님이 확정한 급여 한 달치를 읽기 전용 링크로 보낸다.
// 링크는 7일 뒤 끝나고, 사장님이 언제든 끌 수 있으며, 열 때마다 시각을 남긴다. 토큰 원문은 저장하지 않는다(해시만).
import {serverError} from '../lib/errors';
import {employeeNumber} from '../lib/payslip';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('share:'+t)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
export function shareCsv(store:string,run:any){
 const names=[...new Set((run.rows||[]).flatMap((r:any)=>(r.deductions||[]).map((d:any)=>d.name)))] as string[];
 const head=['성명','직원번호','근무시간','총지급',...names,'공제 합계','실지급'];
 const body=(run.rows||[]).map((r:any)=>[r.name,employeeNumber(r.employeeId),Number(r.hours||0).toFixed(2),r.gross,...names.map(n=>(r.deductions||[]).find((d:any)=>d.name===n)?.amount||0),r.deduction,r.net]);
 return '﻿'+[[`${store} ${run.month} 급여 자료 (지급일 ${run.payDate||''}) · 척척사장 읽기 전용 링크`],head,...body].map(r=>r.map(cell).join(',')).join('\r\n');
}
export async function shareApi(request:Request,env:{DB:D1Database}){
 const url=new URL(request.url);
 try{
  // 세무사(로그인 없음): 링크로 열기
  if(request.method==='GET'&&url.searchParams.get('t')){
   const h=await hash(url.searchParams.get('t')!),s=await env.DB.prepare('SELECT * FROM accountant_shares WHERE hash=?').bind(h).first<any>();
   if(!s||s.revoked_at||Date.parse(s.expires_at)<Date.now())return json({error:'링크가 끝났거나 꺼졌어요. 사장님께 새 링크를 요청해 주세요.'},410);
   const row=await env.DB.prepare('SELECT data FROM stores WHERE owner=?').bind(s.owner).first<any>();const data=row?JSON.parse(row.data):null,run=data?.payrollRuns?.[s.run_key];
   if(!run?.locked)return json({error:'사장님이 급여 확정을 풀어서 지금은 볼 수 없어요. 다시 확정한 뒤 새 링크를 받아 주세요.'},409);
   await env.DB.prepare("UPDATE accountant_shares SET views=views||jsonb_build_array(?::text) WHERE hash=?").bind(new Date().toISOString(),h).run();
   if(url.searchParams.get('format')==='csv')return new Response(shareCsv(data.store?.name||'',run),{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(`급여자료-${run.month}.csv`)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   return json({store:data.store?.name||'',month:run.month,payDate:run.payDate,people:(run.rows||[]).length,label:s.label,expiresAt:s.expires_at});
  }
  // 사장님: 만들기·목록·끄기
  const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
  const own=await env.DB.prepare('SELECT data FROM stores WHERE owner=?').bind(uid).first<any>();if(!own)return json({error:'세무사 링크는 사장님만 만들 수 있어요.'},403);
  if(request.method==='GET'){const rows=(await env.DB.prepare('SELECT hash,run_key,label,created_at,expires_at,revoked_at,views FROM accountant_shares WHERE owner=? ORDER BY created_at DESC LIMIT 30').bind(uid).all<any>()).results;return json({shares:rows.map((r:any)=>({id:r.hash.slice(0,16),runKey:r.run_key,label:r.label,createdAt:r.created_at,expiresAt:r.expires_at,revoked:!!r.revoked_at,views:(typeof r.views==='string'?JSON.parse(r.views):r.views||[]).length,active:!r.revoked_at&&Date.parse(r.expires_at)>Date.now()}))})}
  if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
  let b:any;try{b=JSON.parse(await request.text())}catch{return json({error:'요청 내용이 올바르지 않아요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
  if(b.action==='revoke'){const r=await env.DB.prepare("UPDATE accountant_shares SET revoked_at=? WHERE owner=? AND substr(hash,1,16)=? AND revoked_at IS NULL RETURNING hash").bind(new Date().toISOString(),uid,String(b.id||'')).first();return r?json({ok:true}):json({error:'끌 링크를 찾지 못했어요. 목록을 새로고침해 주세요.'},404)}
  if(b.action!=='create')return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
  const data=JSON.parse(own.data),run=data.payrollRuns?.[b.runKey];
  if(!run?.locked)return json({error:'급여를 먼저 확정한 뒤 링크를 만들어 주세요.'},409);
  const token=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,''),now=new Date();
  await env.DB.prepare('INSERT INTO accountant_shares(hash,owner,run_key,label,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(await hash(token),uid,b.runKey,`${run.month} 급여`,now.toISOString(),new Date(now.getTime()+7*86400000).toISOString()).run();
  return json({url:`${url.origin}/share?t=${token}`,expiresAt:new Date(now.getTime()+7*86400000).toISOString()},201);
 }catch(e){return serverError('share',e,'세무사 링크를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
