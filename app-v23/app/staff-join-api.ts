import {newJoinCode,normalizeJoinCode} from '../lib/join-code';
import {joinTermsSchema,joinProfileSchema,joinMember,joinContractText} from '../lib/join-terms';
import {resolveStore} from './saas-api';
import {newMember,teamSchema} from '../lib/team-model';
import {capacityError,canWrite,hasFeature} from '../lib/plans';
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function staffJoinApi(request:Request,env:{DB:D1Database}){
 const uid=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
 if(!uid||!email)return reply({error:'본인 계정으로 로그인해 주세요.'},401);
 try{
 const linked=await resolveStore(env.DB,uid);
 if(request.method==='GET'){
  if(linked?.access==='owner'){
   const data=JSON.parse(linked.row.data);
   return reply({owner:true,version:linked.row.version,codes:data._joinCodes||[],terms:data._joinTerms||[],contractsEnabled:hasFeature(data._account,'contracts'),branches:data.branches,requests:(data._joinApplications||[]).filter((x:any)=>x.status==='pending'),employees:data.employees.filter((x:any)=>x.status!=='퇴사').map((x:any)=>({id:x.id,name:x.name,email:x.email,branchId:x.branchId})),linkedIds:(data._members||[]).map((x:any)=>x.employeeId)});
  }
  const rows=await env.DB.prepare("SELECT owner,data FROM stores WHERE EXISTS (SELECT 1 FROM json_each(stores.data,'$._joinApplications') j WHERE json_extract(j.value,'$.userId')=?)").bind(uid).all<any>();
  return reply({owner:false,email,name:displayName(request),connected:!!linked&&linked.access!=='revoked',requests:(rows.results||[]).flatMap((row:any)=>{const d=JSON.parse(row.data);return (d._joinApplications||[]).filter((a:any)=>a.userId===uid).map((a:any)=>({id:a.id,name:a.name,status:a.status,storeName:d.store.name,branchName:d.branches.find((b:any)=>b.id===a.branchId)?.name,createdAt:a.createdAt,profile:a.profile,contractText:a.contractText,confirmedAt:a.confirmedAt}))})});
 }
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'올바르지 않은 요청입니다.'},403);
 const raw=await request.text();if(raw.length>16000)return reply({error:'입력 내용이 너무 깁니다.'},413);
 const b=JSON.parse(raw);if(b.action==='preview'||b.action==='apply')b.code=normalizeJoinCode(b.code);
 if(b.action==='preview'){
  if(!b.code)return reply({error:'가게 코드를 다시 확인해 주세요.'},400);
  const row=await env.DB.prepare("SELECT owner,data,version FROM stores WHERE EXISTS (SELECT 1 FROM json_each(stores.data,'$._joinCodes') c WHERE json_extract(c.value,'$.code')=? OR json_extract(c.value,'$.legacyCode')=?) LIMIT 1").bind(b.code,b.code).first<any>();
  if(!row)return reply({error:'가게 코드를 찾지 못했어요. 사장님께 확인해 주세요.'},404);
  const d=JSON.parse(row.data),code=d._joinCodes.find((x:any)=>x.code===b.code||x.legacyCode===b.code),branch=d.branches.find((x:any)=>x.id===code.branchId);
  if(!branch)return reply({error:'운영하지 않는 가게예요.'},409);
  const terms=hasFeature(d._account,'contracts')?(d._joinTerms||[]).find((x:any)=>x.branchId===branch.id):null;
  const profile=b.profile?joinProfileSchema.parse(b.profile):null;
  const draft=terms&&profile?joinContractText(d,{branchId:branch.id,name:String(b.name||'').slice(0,80),email,phone:String(b.phone||'').slice(0,30),profile,terms}):null;
  return reply({storeName:d.store.name,branchName:branch.name,branchId:branch.id,terms:terms?{revision:terms.revision,fields:terms.fields}:null,contractText:draft});
 }
 if(b.action==='withdraw'){
  const row=await env.DB.prepare("SELECT owner,data,version FROM stores WHERE EXISTS (SELECT 1 FROM json_each(stores.data,'$._joinApplications') j WHERE json_extract(j.value,'$.id')=? AND json_extract(j.value,'$.userId')=?) LIMIT 1").bind(b.id,uid).first<any>();
  if(!row)return reply({error:'본인의 신청만 취소할 수 있어요.'},404);
  const d=JSON.parse(row.data),a=d._joinApplications.find((x:any)=>x.id===b.id&&x.userId===uid);
  if(a.status!=='pending')return reply({error:'사장님 확인 전의 신청만 취소할 수 있어요.'},409);
  a.status='withdrawn';a.reviewedAt=new Date().toISOString();
  const result=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),a.reviewedAt,row.owner,row.version).run();
  return result.meta.changes?reply({ok:true}):reply({error:'신청 상태가 바뀌었어요. 새로 확인해 주세요.'},409);
 }
 if(b.action==='apply'){

  if(linked)return reply({error:'이미 매장에 연결된 계정입니다. 기존 매장으로 들어가 주세요.'},409);
  if(!b.code)return reply({error:'가게 코드를 다시 확인해 주세요.'},400);
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.phone!=='string'||!b.phone.trim()||b.phone.length>30||!/^[0-9+() -]{8,30}$/.test(b.phone)||b.phone.replace(/\D/g,'').length<8)return reply({error:'이름과 연락처를 입력해 주세요.'},400);
  const row=await env.DB.prepare("SELECT owner,data,version FROM stores WHERE EXISTS (SELECT 1 FROM json_each(stores.data,'$._joinCodes') c WHERE json_extract(c.value,'$.code')=? OR json_extract(c.value,'$.legacyCode')=?) LIMIT 1").bind(b.code,b.code).first<any>();
  if(!row)return reply({error:'사용할 수 없는 가게 코드입니다. 사장님께 확인해 주세요.'},404);
  const d=JSON.parse(row.data),code=d._joinCodes.find((x:any)=>x.code===b.code||x.legacyCode===b.code);
  if(!d.branches.some((x:any)=>x.id===code.branchId))return reply({error:'운영하지 않는 지점입니다.'},409);
  const items=d._joinApplications||[],prev=items.find((x:any)=>x.userId===uid);
  if(prev?.status==='pending')return reply({ok:true,status:'pending'});
  if(items.filter((x:any)=>x.status==='pending').length>=100)return reply({error:'신청이 많아 사장님의 확인이 필요합니다.'},409);
  const terms=hasFeature(d._account,'contracts')?(d._joinTerms||[]).find((x:any)=>x.branchId===code.branchId):null;
  const profile=b.profile?joinProfileSchema.parse(b.profile):null;
  if(terms&&(!profile||b.termsRevision!==terms.revision||b.confirmed!==true))return reply({error:'근로조건이 바뀌었거나 아직 확인하지 않았어요. 계약 내용을 다시 확인한 뒤 신청해 주세요.',code:'TERMS_CHANGED'},409);
  const application={id:crypto.randomUUID(),userId:uid,email,emailVerified:!uid.startsWith('native:')||request.headers.get('oai-authenticated-user-email-verified')==='true',name:b.name.trim(),phone:b.phone.trim(),profile,branchId:code.branchId,status:'pending',createdAt:new Date().toISOString(),terms:terms?structuredClone(terms):null,contractText:'',confirmedAt:terms?new Date().toISOString():null};
  if(terms)application.contractText=joinContractText(d,application);
  d._joinApplications=[...items.filter((x:any)=>x.userId!==uid),application];
  const r=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),new Date().toISOString(),row.owner,row.version).run();
  return r.meta.changes?reply({ok:true,status:'pending'}):reply({error:'다른 변경이 있어요. 다시 신청해 주세요.'},409);
 }
 if(linked?.access!=='owner')return reply({error:'사장님만 신청을 처리할 수 있습니다.'},403);
 const d=JSON.parse(linked.row.data);let assignedCode:string|null=null;
 if(b.version!==linked.row.version)return reply({error:'새 신청이 도착했거나 내용이 변경됐어요. 새로고침 후 확인해 주세요.'},409);
 if(b.action==='terms'){
  if(!canWrite(d._account)||!hasFeature(d._account,'contracts'))return reply({error:'가입 시 근로계약 확인은 사장님 5부터 이용할 수 있어요.'},403);
  if(!d.branches.some((x:any)=>x.id===b.branchId))return reply({error:'매장을 확인해 주세요.'},400);
  const fields=joinTermsSchema.parse(b.fields);
  d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id:uid,name:email,email},action:'가입용 근로조건 변경',target:b.branchId,before:null,after:fields,reason:'사장님 설정'}];
  d._joinTerms=[...(d._joinTerms||[]).filter((x:any)=>x.branchId!==b.branchId),{branchId:b.branchId,revision:crypto.randomUUID(),fields,updatedAt:new Date().toISOString()}];
 }else if(b.action==='code'){
  if(!d.branches.some((x:any)=>x.id===b.branchId))return reply({error:'지점을 확인해 주세요.'},400);
  const existing=(d._joinCodes||[]).find((x:any)=>x.branchId===b.branchId);
  if(!existing||existing.code.length!==8){assignedCode=newJoinCode();d._joinCodes=[...(d._joinCodes||[]).filter((x:any)=>x.branchId!==b.branchId),{branchId:b.branchId,code:assignedCode,...(existing?{legacyCode:existing.code}:{})}];}
 }else if(b.action==='review'){
  const a=d._joinApplications?.find((x:any)=>x.id===b.id&&x.status==='pending');
  if(!a||typeof b.approve!=='boolean')return reply({error:'처리할 신청을 찾을 수 없습니다.'},409);
  if(b.approve){
   if(!canWrite(d._account))return reply({error:'현재 요금제의 저장 가능 상태를 확인해 주세요.'},403);
   if(a.terms&&!hasFeature(d._account,'contracts'))return reply({error:'계약 내용을 반영하려면 사장님 5 이상이 필요해요. 계정·요금제를 확인해 주세요.'},403);
   if(await resolveStore(env.DB,a.userId))return reply({error:'신청자가 이미 다른 매장에 연결되어 있습니다.'},409);
   if(a.terms&&a.terms.revision!==(d._joinTerms||[]).find((x:any)=>x.branchId===a.branchId)?.revision)return reply({error:'신청 뒤 근로조건이 바뀌었어요. 직원이 신청을 취소하고 새 조건을 확인해 다시 신청하도록 안내해 주세요.'},409);
   let employee;
   if(b.employeeId){employee=d.employees.find((x:any)=>x.id===b.employeeId&&x.branchId===a.branchId&&x.status!=='퇴사'&&x.email.toLowerCase()===a.email);if(!employee)return reply({error:'기존 직원의 지점과 이메일이 신청 계정과 같아야 합니다.'},400);}
   else {
    if(d.employees.some((x:any)=>x.email.toLowerCase()===a.email))return reply({error:'이미 입력한 직원이 있어요. 해당 직원과 연결해 주세요.'},409);
    employee=joinMember(d,a);
    if(a.contractText)employee.contract.draftText=a.contractText;
    d.employees.push(employee);
   }
   if(b.employeeId&&a.profile){employee.address=a.profile.address;employee.phone=a.phone;}
   if(b.employeeId&&a.terms){const reviewed=joinMember(d,a);employee.endDate=reviewed.endDate;employee.payType=reviewed.payType;employee.employment=reviewed.employment;employee.wage=reviewed.wage;employee.weeklyHours=reviewed.weeklyHours;employee.payDay=reviewed.payDay;employee.contract={...reviewed.contract,draftText:a.contractText};}
   if((d._members||[]).some((m:any)=>m.employeeId===employee.id))return reply({error:'이미 계정이 연결된 직원입니다.'},409);
   const exceeded=capacityError(d,d._account);if(exceeded)return reply({error:exceeded,code:'CAPACITY_EXCEEDED'},409);
   teamSchema.parse(d);d._members=[...(d._members||[]),{userId:a.userId,employeeId:employee.id}];a.status='approved';
  }else a.status='rejected';
  a.reviewedAt=new Date().toISOString();
  d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:a.reviewedAt,actor:{id:uid,name:email,email},action:b.approve?'직원 가입 승인':'직원 가입 반려',target:a.id,before:{status:'pending'},after:{status:a.status},reason:'사장님 확인'}];
 }else return reply({error:'지원하지 않는 요청입니다.'},400);
 const approved=b.action==='review'&&b.approve?d._joinApplications.find((x:any)=>x.id===b.id).userId:null;
 // One conditional SQL write prevents cross-store simultaneous approvals.
 const r=await env.DB.prepare("UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=? AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM stores other, json_each(other.data,'$._joinCodes') codes WHERE (other.owner<>? OR json_extract(codes.value,'$.branchId')<>?) AND json_extract(codes.value,'$.code')=?)) AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM stores s WHERE s.owner=? OR EXISTS (SELECT 1 FROM json_each(s.data,'$._members') m WHERE json_extract(m.value,'$.userId')=?)))").bind(JSON.stringify(d),new Date().toISOString(),uid,linked.row.version,assignedCode,uid,b.branchId||'',assignedCode,approved,approved,approved).run();
 return r.meta.changes?reply({ok:true}):reply({error:'계정 연결이나 신청 상태가 변경됐어요. 새로고침해 주세요.'},409);
 }catch{return reply({error:'신청을 처리하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.'},400);}
}

function displayName(request:Request){const name=request.headers.get('oai-authenticated-user-full-name')||'';try{return request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'?decodeURIComponent(name):name}catch{return ''}}
