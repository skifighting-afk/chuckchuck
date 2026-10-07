import {sendAlimtalk} from '../lib/alimtalk-send';
import {notifyUser} from './push-api';
import type {PushEnv} from '../lib/webpush';
import {resolveStore} from './saas-api';
import {serverError,reportError} from '../lib/errors';
import {hasFeature,canWrite} from '../lib/plans';
import {payslipText,payslipMissing} from '../lib/payslip';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const ACTIVITY="COALESCE(json_build_object('viewed_at',a.viewed_at,'download_requested_at',a.download_requested_at,'saved_at',a.saved_at),'{}'::json) AS activity";
export async function documentActivity(db:D1Database,kind:string,id:string){return await db.prepare('SELECT viewed_at,download_requested_at,saved_at FROM document_activity WHERE kind=? AND document_id=?').bind(kind,id).first()||{};}
const asObject=(v:any)=>typeof v==='string'?JSON.parse(v):v||{};

/** 명세서가 지금 급여 확정본과 같은지. 급여를 다시 열거나 새로 확정하면 예전 명세서는 '지난 수정본'이 된다. */
export function payslipState(state:any,doc:{run_key:string,revision:number}){
 const run=state?.payrollRuns?.[doc.run_key];
 if(!run)return 'replaced';
 const current=run.revision||1;
 if(current>doc.revision)return 'replaced';
 if(!run.locked)return 'reopened';
 return 'current';
}


export async function documentsApi(request:Request,env:{DB:D1Database}&PushEnv){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 const url=new URL(request.url);let b:any={};
 if(request.method==='POST'){if(request.headers.get('origin')!==url.origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);const text=await request.text();if(text.length>4000)return json({error:'보낸 내용이 너무 커요. 내용을 줄여서 다시 시도해 주세요.'},413);try{b=JSON.parse(text)}catch{return json({error:'요청 내용이 올바르지 않아요. 새로고침한 뒤 다시 시도해 주세요.'},400)}}
 else if(request.method!=='GET')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 try{
 if(b.action==='send'){
  const linked=await resolveStore(env.DB,uid);if(linked?.access!=='owner')return json({error:'명세서는 사장님만 보낼 수 있어요.'},403);
  const state=JSON.parse(linked.row.data),run=state.payrollRuns?.[b.runKey];
  if(!hasFeature(state._account,'payroll')||!canWrite(state._account))return json({error:'급여명세서 이용권을 확인해 주세요.'},403);
  if(!run?.locked)return json({error:'급여를 먼저 확정해 주세요.'},409);
  const row=run.rows.find((r:any)=>r.employeeId===b.employeeId);
  if(!row)return json({error:'이번 급여 확정에 없는 직원이에요. 급여를 다시 확정한 뒤 보내 주세요.'},404);
  const member=state._members?.find((m:any)=>m.employeeId===b.employeeId);
  if(!member)return json({error:'이 직원은 아직 앱 계정이 연결되지 않았어요. 직원 정보에서 계정을 연결해 주세요.',code:'NOT_LINKED'},409);
  if(member.userId===uid)return json({error:'사장님 본인 계정과 연결된 직원 기록에는 보낼 수 없어요. 직원 본인 계정을 연결해 주세요.'},409);
  const revision=run.revision||1;
  const text=payslipText(state.store.name,run.month,run.payDate,row);
  {const miss=payslipMissing(text);if(miss.length)return json({error:`명세서에 필수 기재사항이 빠져 있어요(${miss.join(', ')}). 급여 확정을 풀고 다시 확정해 주세요.`},409)}
  // 매장 데이터의 다른 부분(출퇴근 등)이 바뀌어도 이 급여 확정본이 그대로면 보낸다.
  await env.DB.prepare(`INSERT OR IGNORE INTO payslip_documents(id,owner_id,employee_id,employee_user_id,run_key,revision,document_json,created_at)
   SELECT ?,?,?,?,?,CAST(? AS integer),?,? WHERE EXISTS(SELECT 1 FROM stores WHERE owner=? AND (data::jsonb #> ARRAY['payrollRuns',CAST(? AS text),'locked'])='true'::jsonb AND COALESCE((data::jsonb #>> ARRAY['payrollRuns',CAST(? AS text),'revision'])::integer,1)=CAST(? AS integer))`)
   .bind(crypto.randomUUID(),uid,row.employeeId,member.userId,b.runKey,revision,JSON.stringify({text,name:row.name,month:run.month}),new Date().toISOString(),uid,b.runKey,b.runKey,revision).run();
  const sent=await env.DB.prepare('SELECT id,created_at FROM payslip_documents WHERE owner_id=? AND employee_id=? AND run_key=? AND revision=?').bind(uid,row.employeeId,b.runKey,revision).first<any>();
  if(sent)await notifyUser(env,member.userId,{title:'급여명세서가 도착했어요',body:`${state.store.name} ${run.month} 급여명세서 · 실수령 ${Number(row.net).toLocaleString('ko-KR')}원`,url:'/app'});
  // 지시서 2주차 032: 알림톡(설정돼 있을 때만)
  if(sent){const e=state.employees.find((x:any)=>x.id===row.employeeId);await sendAlimtalk(env as any,e?.phone,'PAYSLIP_SENT',{이름:row.name,가게:state.store.name,월:run.month,실수령액:Number(row.net).toLocaleString('ko-KR'),지급일:run.payDate}).catch(()=>null)}
  return sent?json({ok:true,id:sent.id,sentAt:sent.created_at}):json({error:'급여 확정이 바뀌었어요. 새로 확인해 주세요.'},409);
 }
 const id=b.id||url.searchParams.get('id'),kind=b.kind||url.searchParams.get('kind')||'payslip';
 if(!['contract','payslip'].includes(kind))return json({error:'문서 종류를 확인해 주세요.'},400);
 const linked=await resolveStore(env.DB,uid),state=linked?JSON.parse(linked.row.data):null;
 if(!id&&request.method==='GET'){
  if(kind!=='payslip')return json({error:'계약서 목록은 계약서 화면에서 확인해 주세요.'},400);
  const rows=await env.DB.prepare(`SELECT p.*,${ACTIVITY} FROM payslip_documents p LEFT JOIN document_activity a ON a.kind='payslip' AND a.document_id=p.id WHERE p.owner_id=? OR p.employee_user_id=? ORDER BY p.created_at DESC LIMIT 500`).bind(uid,uid).all<any>();
  const documents=rows.results
   .map(r=>({...r,document_json:undefined,document:JSON.parse(r.document_json),activity:asObject(r.activity),state:linked?.owner===r.owner_id?payslipState(state,r):'replaced'}));
  return json({documents});
 }
 const table=kind==='contract'?'contract_envelopes':'payslip_documents';
 const row=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND (owner_id=? OR employee_user_id=?)`).bind(id||'',uid,uid).first<any>();
 if(!row)return json({error:'문서를 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
 const employee=row.employee_user_id===uid&&row.owner_id!==uid;
  // 받은 사람 본인의 사본이므로 퇴사 뒤에도 볼 수 있다(근로계약서·임금명세서 교부 취지).
 const ready=kind==='payslip'||row.status==='signed';
 if(request.method==='GET'){
  if(!ready)return json({error:'사장님과 직원이 모두 서명해야 사본을 저장할 수 있어요. 서명이 끝난 뒤 다시 눌러 주세요.'},409);
  const doc=JSON.parse(row.document_json);let text=doc.text;
  if(kind==='contract')for(const [label,key] of [['사장님','owner_signature'],['직원','employee_signature']]){const s=JSON.parse(row[key]);text+='\n\n'+label+' 서명: '+s.name+'\n'+s.at+'\n'+s.statement;}
  return json({text:text+'\n\n문서번호: '+row.id+(row.document_hash?'\nSHA-256: '+row.document_hash:''),employee,activity:await documentActivity(env.DB,kind,id),state:kind==='payslip'&&linked?.owner===row.owner_id?payslipState(state,row):null});
 }
 if(!employee)return json({error:'직원 본인만 확인할 수 있어요.'},403);
 if(!['view','download','saved'].includes(b.action))return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 if(b.action!=='view'&&!ready)return json({error:'서명을 먼저 완료해 주세요.'},409);
 const activity:any=await documentActivity(env.DB,kind,id);
 if(b.action==='saved'&&!activity.download_requested_at)return json({error:'파일을 내려받은 뒤 저장을 확인해 주세요.'},409);
 const column=({view:'viewed_at',download:'download_requested_at',saved:'saved_at'} as any)[b.action];
 await env.DB.prepare(`INSERT INTO document_activity(kind,document_id,${column}) VALUES(?,?,?) ON CONFLICT(kind,document_id) DO UPDATE SET ${column}=COALESCE(document_activity.${column},excluded.${column})`).bind(kind,id,new Date().toISOString()).run();
 return json({ok:true,activity:await documentActivity(env.DB,kind,id)});
 }catch(e){return serverError('documents',e,'문서를 처리하지 못했어요. 잠시 뒤 다시 확인해 주세요.')}
}
