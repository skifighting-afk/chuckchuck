import {resolveStore} from './saas-api';
import {hasFeature,canWrite} from '../lib/plans';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function documentActivity(db:D1Database,kind:string,id:string){return await db.prepare('SELECT viewed_at,download_requested_at,saved_at FROM document_activity WHERE kind=? AND document_id=?').bind(kind,id).first()||{};}
export async function documentsApi(request:Request,env:{DB:D1Database}){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인해 주세요.'},401);
 const url=new URL(request.url);let b:any={};
 if(request.method==='POST'){if(request.headers.get('origin')!==url.origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);const text=await request.text();if(text.length>4000)return json({error:'요청이 너무 커요.'},413);try{b=JSON.parse(text)}catch{return json({error:'요청을 확인해 주세요.'},400)}}
 else if(request.method!=='GET')return json({error:'지원하지 않는 요청이에요.'},405);
 try{
 if(b.action==='send'){
  const linked=await resolveStore(env.DB,uid);if(linked?.access!=='owner')return json({error:'사장님만 보낼 수 있어요.'},403);
  const state=JSON.parse(linked.row.data),run=state.payrollRuns?.[b.runKey];
  if(!hasFeature(state._account,'payroll')||!canWrite(state._account))return json({error:'급여명세서 이용권을 확인해 주세요.'},403);
  if(!run?.locked)return json({error:'급여를 먼저 확정해 주세요.'},409);
  const row=run.rows.find((r:any)=>r.employeeId===b.employeeId),member=state._members?.find((m:any)=>m.employeeId===b.employeeId&&m.userId!==uid);
  if(!row||!member)return json({error:'직원 계정을 먼저 연결해 주세요.'},409);
  const money=(v:number)=>v.toLocaleString('ko-KR')+'원';
  const text=[state.store.name+' · '+run.month+' 급여명세서','성명: '+row.name,'지급일: '+run.payDate,...row.earnings.map((i:any)=>i.name+': '+money(i.amount)+' ('+i.formula+')'),'지급 합계: '+money(row.gross),...row.deductions.map((i:any)=>i.name+': '+money(i.amount)+' ('+i.formula+')'),'공제 합계: '+money(row.deduction),'실수령액: '+money(row.net),row.note||''].join('\n');
  await env.DB.prepare('INSERT OR IGNORE INTO payslip_documents(id,owner_id,employee_id,employee_user_id,run_key,revision,document_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM stores WHERE owner=? AND version=?)').bind(crypto.randomUUID(),uid,row.employeeId,member.userId,b.runKey,run.revision||1,JSON.stringify({text,name:row.name,month:run.month}),new Date().toISOString(),uid,linked.row.version).run();
  const sent=await env.DB.prepare('SELECT id FROM payslip_documents WHERE owner_id=? AND employee_id=? AND run_key=? AND revision=?').bind(uid,row.employeeId,b.runKey,run.revision||1).first();
  return sent?json({ok:true}):json({error:'급여가 변경되었어요. 새로 확인해 주세요.'},409);
 }
 const id=b.id||url.searchParams.get('id'),kind=b.kind||url.searchParams.get('kind')||'payslip';
 if(!['contract','payslip'].includes(kind))return json({error:'문서 종류를 확인해 주세요.'},400);
 if(!id&&request.method==='GET'){
  const rows=await env.DB.prepare('SELECT * FROM payslip_documents WHERE owner_id=? OR employee_user_id=? ORDER BY created_at DESC LIMIT 200').bind(uid,uid).all<any>();
  return json({documents:await Promise.all(rows.results.map(async r=>({...r,document:JSON.parse(r.document_json),activity:await documentActivity(env.DB,'payslip',r.id)})))});
 }
 const table=kind==='contract'?'contract_envelopes':'payslip_documents';
 const row=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND (owner_id=? OR employee_user_id=?)`).bind(id||'',uid,uid).first<any>();
 if(!row)return json({error:'내 문서를 찾을 수 없어요.'},404);
 const employee=row.employee_user_id===uid,ready=kind==='payslip'||row.status==='signed';
 if(request.method==='GET'){
  if(!ready)return json({error:'두 분이 서명하면 사본을 저장할 수 있어요.'},409);
  const doc=JSON.parse(row.document_json);let text=doc.text;
  if(kind==='contract')for(const [label,key] of [['사장님','owner_signature'],['직원','employee_signature']]){const s=JSON.parse(row[key]);text+='\n\n'+label+' 서명: '+s.name+'\n'+s.at+'\n'+s.statement;} 
  return json({text:text+'\n\n문서번호: '+row.id+(row.document_hash?'\nSHA-256: '+row.document_hash:''),employee,activity:await documentActivity(env.DB,kind,id)});
 }
 if(!employee)return json({error:'직원 본인만 확인할 수 있어요.'},403);
 if(!['view','download','saved'].includes(b.action))return json({error:'지원하지 않는 요청이에요.'},400);
 if(b.action!=='view'&&!ready)return json({error:'서명을 먼저 완료해 주세요.'},409);
 const activity:any=await documentActivity(env.DB,kind,id);
 if(b.action==='saved'&&!activity.download_requested_at)return json({error:'파일을 내려받은 뒤 저장을 확인해 주세요.'},409);
 const column=({view:'viewed_at',download:'download_requested_at',saved:'saved_at'} as any)[b.action];
 await env.DB.prepare(`INSERT INTO document_activity(kind,document_id,${column}) VALUES(?,?,?) ON CONFLICT(kind,document_id) DO UPDATE SET ${column}=COALESCE(document_activity.${column},excluded.${column})`).bind(kind,id,new Date().toISOString()).run();
 return json({ok:true,activity:await documentActivity(env.DB,kind,id)});
 }catch{return json({error:'문서를 처리하지 못했어요. 잠시 뒤 다시 확인해 주세요.'},500)}
}
