import {documentActivity} from './documents-api';
import {serverError} from '../lib/errors';
import {resolveStore} from './saas-api';
import {contractMissing} from '../lib/labor-checks';
import {authLimit,confirmSigner} from './auth-api';
import {digest} from '../lib/password';
import {mailReady,sendMail,utf8Base64,type MailEnv} from '../lib/mail';
import {normalizeTeam,type Member} from '../lib/team-model';
import {standardContractDraft} from '../lib/contract-template';
import {hasFeature,canWrite} from '../lib/plans';
import {checkDrawing} from '../lib/signature-image';
type Env=MailEnv&{DB:D1Database};
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const lite=(e:any)=>({...e,ownerSignature:e.ownerSignature&&{...e.ownerSignature,drawing:undefined,hasDrawing:!!e.ownerSignature.drawing},employeeSignature:e.employeeSignature&&{...e.employeeSignature,drawing:undefined,hasDrawing:!!e.employeeSignature.drawing}});
const parse=(row:any)=>({...row,document:JSON.parse(row.document_json),ownerSignature:JSON.parse(row.owner_signature),employeeSignature:row.employee_signature?JSON.parse(row.employee_signature):null});
const source=(e:Member)=>JSON.stringify({name:e.name,email:e.email,address:e.address,phone:e.phone,joined:e.joined,endDate:e.endDate,payType:e.payType,wage:e.wage,weeklyHours:e.weeklyHours,payDay:e.payDay,contract:e.contract});
const clean=(text:string)=>text.replace(/검토용 초안입니다[^\n]*/g,'').replace(/전자서명된 문서가 아닙니다\.?/g,'').replace('근로계약서 · 고용노동부 표준서식 참고 초안','근로계약서').trim();
// 작업 040: 서명 이후 바뀐 근로조건(연락처·주소 같은 개인정보 변경은 제외)
const TERMS:[string,(v:any)=>any][]=[['임금',v=>v.payType+' '+Number(v.wage).toLocaleString('ko-KR')+'원'],['주 소정근로시간',v=>v.weeklyHours+'시간'],['임금 지급일',v=>'매월 '+v.payDay+'일'],['근무일',v=>v.contract?.workDays],['근무시간',v=>`${v.contract?.start}~${v.contract?.end} (휴게 ${v.contract?.breakMinutes}분)`],['근무장소',v=>v.contract?.workplace],['업무',v=>v.contract?.duties],['휴일',v=>v.contract?.holiday],['계약 종료일',v=>v.endDate||'정함 없음'],['사업주',v=>v.contract?.employer]];
export function termChanges(before:any,after:any){return TERMS.map(([label,f])=>({label,from:String(f(before)??''),to:String(f(after)??'')})).filter(c=>c.from!==c.to)}
export function contractCopy(row:any){const e=parse(row),s=(v:any)=>v?`${v.name} · ${v.email}\n${v.at}\n확인 방식: ${v.authMethod}${v.drawing?' + 손서명':''}\n동의 문구: ${v.statement}`:'아직 서명하지 않았습니다.',img=(v:any)=>v?.drawing&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.drawing)?`<img alt="${esc(v.name)} 손서명" src="${v.drawing}" style="max-width:260px;height:auto;border-bottom:1px solid #999">`:'';return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>척척사장봇 근로계약서 사본</title><style>body{font-family:Arial,sans-serif;color:#183d32;max-width:800px;margin:32px auto;padding:24px;line-height:1.8}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:25px}section{border-top:1px solid #ccc;margin-top:24px;padding-top:12px}small{overflow-wrap:anywhere}@media print{body{margin:0;padding:0;font-size:11pt}section{break-inside:avoid}}</style></head><body><h1>근로계약서 · ${e.status==='signed'?'양측 서명 완료':'서명 진행 중'}</h1><pre>${esc(e.document.text)}</pre><section><h2>사장님 서명 기록</h2>${img(e.ownerSignature)}<pre>${esc(s(e.ownerSignature))}</pre></section><section><h2>직원 서명 기록</h2>${img(e.employeeSignature)}<pre>${esc(s(e.employeeSignature))}</pre></section><section><small>문서번호: ${esc(e.id)}<br>문서 SHA-256: ${esc(e.document_hash)}<br>본문과 서명 기록을 함께 보관하세요. 계정 인증과 성명 입력으로 동의를 기록한 앱 전자서명이며, 공인 인증서나 제3자 본인확인 서비스의 인증은 아닙니다.</small></section></body></html>`}
async function deliver(env:Env,row:any){
 if(row.delivery_status==='accepted'||row.received_at)return;
 if(!mailReady(env)){await env.DB.prepare("UPDATE contract_envelopes SET delivery_status='setup_required',version=version+1 WHERE id=? AND status='signed' AND delivery_status<>'accepted'").bind(row.id).run();return;}
 const recent=row.delivery_at&&Date.now()-Date.parse(row.delivery_at)<30000;
 if(row.delivery_status==='sending'&&recent)throw Error('사본을 보내고 있어요. 잠시 뒤 확인해 주세요.');
 const claim=await env.DB.prepare("UPDATE contract_envelopes SET delivery_status='sending',delivery_at=?,version=version+1 WHERE id=? AND version=? AND status='signed' AND delivery_status<>'accepted'").bind(new Date().toISOString(),row.id,row.version).run();
 if(!claim.meta.changes)throw Error('발송 상태가 바뀌었어요. 새로 확인해 주세요.');
 try{const d=JSON.parse(row.document_json),id=await sendMail(env,{to:JSON.parse(row.employee_signature).email,subject:'척척사장봇 · 서명한 근로계약서 사본',text:'사장님과 직원이 확인하고 서명한 계약서 사본을 첨부합니다. 첨부파일을 내려받아 보관해 주세요. 인쇄 창에서 PDF로도 저장할 수 있습니다.\n문서번호: '+row.id,key:'contract-copy-'+row.id,attachments:[{filename:'contract-'+row.id+'.html',content:utf8Base64(contractCopy(row))}]});await env.DB.prepare("UPDATE contract_envelopes SET delivery_status='accepted',delivery_provider_id=?,delivery_at=?,version=version+1 WHERE id=? AND delivery_status='sending'").bind(id,new Date().toISOString(),row.id).run();}
 catch{await env.DB.prepare("UPDATE contract_envelopes SET delivery_status='failed',version=version+1 WHERE id=? AND delivery_status='sending'").bind(row.id).run();}
}
export async function contractsApi(request:Request,env:Env){
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)return json({error:'로그인한 뒤 계약서를 확인해 주세요.'},401);
 try{
  const url=new URL(request.url),id=url.searchParams.get('id'),linked=await resolveStore(env.DB,uid);
  const own=linked?.access==='owner',raw=linked?JSON.parse(linked.row.data):null,team=raw?normalizeTeam(raw):null;
  if(request.method==='GET'){
   if(id){const row=await env.DB.prepare('SELECT * FROM contract_envelopes WHERE id=? AND (owner_id=? OR employee_user_id=?)').bind(id,uid,uid).first<any>();if(!row)return json({error:'계약서를 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
    if(url.searchParams.get('download')==='1')return new Response(contractCopy(row),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="contract-'+row.id+'.html"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    const events=await env.DB.prepare('SELECT version,status,recorded_at,record_json FROM contract_events WHERE envelope_id=? ORDER BY id').bind(id).all<any>();return json({envelope:{...parse(row),activity:await documentActivity(env.DB,'contract',row.id)},events:events.results.map(e=>({...e,record:JSON.parse(e.record_json)}))});
   }
   const page=Math.max(0,Math.floor(Number(url.searchParams.get('page'))||0));
   const signed=own?(await env.DB.prepare("SELECT employee_id,document_json,completed_at FROM contract_envelopes WHERE owner_id=? AND status='signed' ORDER BY completed_at DESC").bind(uid).all<any>()).results:[];
   const signedChange=async(e:Member)=>{const last=signed.find((r:any)=>r.employee_id===e.id);if(!last)return null;const d=JSON.parse(last.document_json);if(d.sourceHash===await digest(source(e)))return null;
    if(!d.source)return {signedAt:last.completed_at,changes:[],note:''};const changes=termChanges(d.source,JSON.parse(source(e)));if(!changes.length)return null;
    return {signedAt:last.completed_at,changes,note:`■ 변경 근로계약서 · ${new Date().toISOString().slice(0,10)} 변경\n`+changes.map(c=>`· ${c.label}: ${c.from} → ${c.to}`).join('\n')+`\n(${String(last.completed_at).slice(0,10)} 체결한 계약을 위 내용으로 변경하며, 나머지 조건은 아래와 같습니다.)\n\n`};};
   const rows=await env.DB.prepare("SELECT c.*,COALESCE(json_build_object('viewed_at',a.viewed_at,'download_requested_at',a.download_requested_at,'saved_at',a.saved_at),'{}'::json) AS activity FROM contract_envelopes c LEFT JOIN document_activity a ON a.kind='contract' AND a.document_id=c.id WHERE (c.owner_id=? OR c.employee_user_id=?) ORDER BY c.created_at DESC LIMIT 20 OFFSET ?").bind(uid,uid,page*20).all<any>();
   return json({owner:own,canCreate:!!own&&hasFeature(raw?._account,'contracts')&&canWrite(raw?._account),mailReady:mailReady(env),native:uid.startsWith('native:'),verified:!uid.startsWith('native:')||request.headers.get('oai-authenticated-user-email-verified')==='true',page,envelopes:rows.results.map(row=>({...lite(parse(row)),activity:typeof row.activity==='string'?JSON.parse(row.activity):row.activity||{}})),employees:own?await Promise.all(team!.employees.filter(e=>e.status!=='퇴사').map(async e=>({change:await signedChange(e),id:e.id,name:e.name,linked:!!raw._members?.find((m:any)=>m.employeeId===e.id&&m.userId!==uid),employer:e.contract.employer||team!.settings.employerName,draft:clean(e.contract.draftText||standardContractDraft(team!,e))}))):[]});
  }
  if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);
  const body=await request.text();if(body.length>120000)return json({error:'계약 내용이 너무 길어요. 기타 사항을 줄여서 다시 저장해 주세요.'},413);let b:any;try{b=JSON.parse(body)}catch{return json({error:'입력 내용을 확인해 주세요.'},400)}
  if(!await authLimit(env,'contract:'+uid,40,15*60000))return json({error:'시도가 많아요. 잠시 뒤 다시 해 주세요.'},429);
  if(b.action==='create'){
   if(!own||!team)return json({error:'계약서 요청은 사장님만 할 수 있어요. 사장님께 요청해 주세요.'},403);
   if(!hasFeature(raw._account,'contracts')||!canWrite(raw._account))return json({error:'전자계약은 베이직 이상에서 이용할 수 있어요.'},403);
   const e=team.employees.find(e=>e.id===b.employeeId&&e.status!=='퇴사'),m=raw._members?.find((m:any)=>m.employeeId===b.employeeId&&m.userId!==uid);
   if(!e||!m)return json({error:'직원의 가입 신청을 먼저 수락해 계정을 연결해 주세요.'},409);
   if(typeof b.text!=='string'||b.text.trim().length<200||b.text.length>30000||/\[[^\]]+\]/.test(b.text))return json({error:'계약서의 대괄호 빈칸을 모두 채우고 실제 조건을 확인해 주세요.'},400);
   const missing=contractMissing(e as any);if(missing.length)return json({error:'계약서 필수 항목을 먼저 채워 주세요: '+missing.join(', '),code:'CONTRACT_INCOMPLETE',missing},400);
   if(b.consent!==true||b.name?.trim()!==e.contract.employer.trim())return json({error:'사업주 성명을 그대로 입력하고 계약 내용에 동의해 주세요.'},400);
   const drawing=checkDrawing(b.drawing);if(!drawing.ok)return json({error:drawing.error},400);
   const identity=await confirmSigner(request,env,b.password,false),now=new Date().toISOString();
   const doc={text:clean(b.text.trim()),employeeName:e.name,employeeEmail:e.email,employeeId:e.id,employer:e.contract.employer,storeName:team.store.name,sourceHash:await digest(source(e)),source:JSON.parse(source(e)),formatVersion:1},document_json=JSON.stringify(doc),hash=await digest(document_json);
   const signature={...identity,name:b.name.trim(),at:now,documentHash:hash,statement:'계약 내용을 확인했고, 사업주로서 이 문서에 전자서명합니다.',statementVersion:1,...(drawing.value?{drawing:drawing.value,drawingHash:await digest(drawing.value)}:{})};
   const contractId=crypto.randomUUID();
   const inserted=await env.DB.prepare("INSERT OR IGNORE INTO contract_envelopes(id,owner_id,employee_id,employee_user_id,document_json,document_hash,owner_signature,status,created_at) VALUES(?,?,?,?,?,?,?,'waiting',?)").bind(contractId,uid,e.id,m.userId,document_json,hash,JSON.stringify(signature),now).run();
   if(!inserted.meta.changes)return json({error:'이 직원에게 이미 확인 중인 계약서가 있어요. 철회한 뒤 새로 요청해 주세요.'},409);
   return json({ok:true,id:contractId,message:'직원 화면에 서명 요청을 보냈어요.'},201);
  }
  const row=await env.DB.prepare('SELECT * FROM contract_envelopes WHERE id=? AND (owner_id=? OR employee_user_id=?)').bind(b.id||'',uid,uid).first<any>();
  if(!row)return json({error:'계약서를 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
  if(row.version!==b.version)return json({error:'계약서 상태가 바뀌었어요. 새로 확인해 주세요.'},409);
  const isOwner=row.owner_id===uid,isEmployee=row.employee_user_id===uid,now=new Date().toISOString();
  if(b.action==='sign'){
   if(!isEmployee||row.status!=='waiting')return json({error:'본인 계약서만 서명할 수 있어요. 내 계정으로 로그인했는지 확인해 주세요.'},403);
   const d=JSON.parse(row.document_json);
   if(b.documentHash!==row.document_hash||await digest(row.document_json)!==row.document_hash)return json({error:'문서가 일치하지 않아요. 새로 확인해 주세요.'},409);
   if(b.consent!==true||b.name?.trim()!==d.employeeName.trim()||!['app','email','paper'].includes(b.deliveryMethod))return json({error:'본인 성명과 계약 동의, 사본 받는 방법을 확인해 주세요.'},400);
   const drawing=checkDrawing(b.drawing);if(!drawing.ok)return json({error:drawing.error},400);
   const identity=await confirmSigner(request,env,b.password,b.deliveryMethod==='email');
   if(identity.email.toLowerCase()!==d.employeeEmail.toLowerCase())return json({error:'계약서 이메일과 로그인 이메일이 달라요. 사장님께 다시 요청해 주세요.'},409);
   if(!linked||linked.owner!==row.owner_id||linked.access==='revoked')return json({error:'매장 소속을 다시 확인해 주세요.'},403);
   const e=team!.employees.find(e=>e.id===row.employee_id);if(!e||await digest(source(e))!==d.sourceHash)return json({error:'직원 정보나 근로조건이 바뀌었어요. 사장님께 기존 요청을 철회하고 새로 보내 달라고 요청해 주세요.'},409);
   const signature={...identity,name:b.name.trim(),at:now,documentHash:row.document_hash,statement:'계약 내용을 확인했고, 본인 의사로 이 문서에 전자서명합니다.',statementVersion:1,...(drawing.value?{drawing:drawing.value,drawingHash:await digest(drawing.value)}:{}),deliveryConsent:b.deliveryMethod==='app'?'앱에서 서명한 계약서 사본을 확인하고 저장하겠습니다.':b.deliveryMethod==='email'?'확인한 내 이메일로 계약서 사본 수신에 동의합니다.':'사장님에게 종이 계약서 사본을 받겠습니다.'};
   const saved=JSON.parse(linked.row.data),employee=saved.employees.find((e:any)=>e.id===row.employee_id);employee.contract={...employee.contract,status:'체결 완료',draftText:d.text,signedAt:now,signedBy:'앱 전자서명: '+signature.name+' / 문서 '+row.id};
   saved._audit=[...(saved._audit||[]),{id:crypto.randomUUID(),at:now,action:'전자계약 양측 서명',actor:{id:uid,name:b.name},target:e.name,after:{envelopeId:row.id,hash:row.document_hash},reason:'계정 확인 후 성명 입력·동의'}].slice(-1000);
   const results=await env.DB.batch([
    env.DB.prepare("UPDATE contract_envelopes SET employee_signature=?,status='signed',completed_at=?,delivery_method=?,delivery_status=?,version=version+1 WHERE id=? AND version=? AND status='waiting' AND EXISTS(SELECT 1 FROM stores WHERE owner=? AND version=?)").bind(JSON.stringify(signature),now,b.deliveryMethod,b.deliveryMethod==='app'?'app_ready':b.deliveryMethod==='email'?'pending':'paper_pending',row.id,row.version,linked.owner,linked.row.version),
    env.DB.prepare("UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=? AND EXISTS(SELECT 1 FROM contract_envelopes WHERE id=? AND version=? AND status='signed')").bind(JSON.stringify(saved),now,linked.owner,linked.row.version,row.id,row.version+1)
   ]);
   if(!results[0].meta.changes||!results[1].meta.changes)return json({error:'동시 변경이 있었어요. 새로 확인한 뒤 서명해 주세요.'},409);
   if(b.deliveryMethod==='email')await deliver(env,await env.DB.prepare('SELECT * FROM contract_envelopes WHERE id=?').bind(row.id).first<any>());
   return json({ok:true,message:'두 분의 서명을 기록했어요. 사본 받기 상태도 확인해 주세요.'});
  }
  if(b.action==='decline'||b.action==='withdraw'){
   if(row.status!=='waiting'||(b.action==='decline'?!isEmployee:!isOwner))return json({error:'이 계약서는 지금 상태에서 처리할 수 없어요. 새로고침해서 상태를 확인해 주세요.'},403);
   if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>500)return json({error:'사유를 500자 이내로 적어 주세요.'},400);
   const r=await env.DB.prepare("UPDATE contract_envelopes SET status=?,reason=?,version=version+1 WHERE id=? AND version=? AND status='waiting'").bind(b.action==='decline'?'declined':'withdrawn',b.reason.trim(),row.id,row.version).run();return r.meta.changes?json({ok:true}):json({error:'그 사이 처리 상태가 바뀌었어요. 새로고침해서 확인해 주세요.'},409);
  }
  if(b.action==='receipt'){
   if(!isEmployee||row.status!=='signed'||b.confirmed!==true)return json({error:'사본을 받은 직원 본인이 확인해 주세요.'},403);
   const r=await env.DB.prepare("UPDATE contract_envelopes SET received_at=?,received_by=?,version=version+1 WHERE id=? AND version=? AND received_at IS NULL").bind(now,uid,row.id,row.version).run();return r.meta.changes?json({ok:true}):json({error:'이미 확인했거나 상태가 바뀌었어요.'},409);
  }
  if(b.action==='deliver'){
   if(row.status!=='signed'||row.delivery_method!=='email')return json({error:'서명이 끝나고 직원이 이메일 수신에 동의한 계약서만 보낼 수 있어요. 앱에서 사본을 확인하도록 안내해 주세요.'},400);
   if(!await authLimit(env,'copy:'+row.id,3,3600000))return json({error:'한 시간에 세 번까지 다시 시도할 수 있어요.'},429);
   await deliver(env,row);return json({ok:true,message:'사본 발송 상태를 확인해 주세요.'});
  }
  return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 }catch(e){return e instanceof Error&&e.name!=='PostgresError'&&!/D1|SQLITE|constraint|database/i.test(e.message)?json({error:e.message},400):serverError('contracts',e,'계약 처리를 완료하지 못했어요. 새로고침해서 확인해 주세요.',400)}
}
