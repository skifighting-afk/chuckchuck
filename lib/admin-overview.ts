import {planId,monthlyPrice,planLimits,plans,trialStatus,branchCount} from './plans';
import {industryName,industries} from './industries';

// Project aggregate counts in SQL; never load employee profiles or contracts into the HQ response.
export const adminProjection=`WITH records AS (
 SELECT owner, coalesce(try_jsonb(data),'{}'::jsonb) AS doc,
 (try_jsonb(data) IS NOT NULL) AS valid, version, updated_at FROM stores
) SELECT owner,version,updated_at,valid,
 doc#>>'{store,name}' AS name,
 doc->'_account' AS account,
 doc->'_hq' AS support,
 CASE WHEN jsonb_typeof(doc->'branches')='array' AND jsonb_array_length(doc->'branches')>0 THEN
 (SELECT jsonb_agg(jsonb_build_object('name',b.value->>'name','employees',
   (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.doc->'employees')='array' THEN r.doc->'employees' ELSE '[]'::jsonb END) e
    WHERE coalesce(e.value->>'status','')<>'퇴사'
    AND e.value->>'branchId'=b.value->>'id')))
  FROM jsonb_array_elements(r.doc->'branches') b)
 ELSE jsonb_build_array(jsonb_build_object('name',coalesce(doc#>>'{store,branch}','본점'),'employees',
   (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.doc->'employees')='array' THEN r.doc->'employees' ELSE '[]'::jsonb END) e WHERE coalesce(e.value->>'status','')<>'퇴사'))) END AS branches,
 (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(doc->'_joinApplications')='array' THEN doc->'_joinApplications' ELSE '[]'::jsonb END) j WHERE j.value->>'status'='pending') AS "pendingJoins",
 (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(doc->'requests')='array' THEN doc->'requests' ELSE '[]'::jsonb END) q WHERE q.value->>'status'='승인 대기') AS "pendingCorrections",
 (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(doc->'_outbox')='array' THEN doc->'_outbox' ELSE '[]'::jsonb END) m WHERE m.value->>'status' IN ('발송 실패','결과 확인 필요','수신 주소 필요')) AS "failedMail"
 FROM records r ORDER BY updated_at DESC,owner ASC`;

function parsed(value:any,fallback:any){try{return typeof value==='string'?JSON.parse(value):value??fallback}catch{return fallback}}
export function summarizeStore(row:any,now=Date.now()){
 const a=parsed(row.account,null),plan=planId(a?.plan)||'legacy',limits=planLimits(a);
 const branches=(parsed(row.branches,[]) as any[]).map(b=>({name:String(b.name||'매장'),employees:Number(b.employees)||0,limit:limits.employees}));
 const remaining=a?.trialEndsAt?(Date.parse(a.trialEndsAt)-now)/86400000:null;
 const status=trialStatus(a,now),support=parsed(row.support,null);
 return {id:row.owner,name:row.name||'가게 이름 확인 필요',version:row.version,updatedAt:row.updated_at,
  plan,status,industry:industryName(a?.industry),createdAt:Number.isFinite(Date.parse(a?.createdAt))?a.createdAt:null,
  trialEndsAt:status==='trialing'||status==='expired'?a?.trialEndsAt||null:null,
  daysLeft:status==='trialing'&&remaining!==null?Math.max(0,Math.ceil(remaining)):null,
  trialEnding:status==='trialing'&&remaining!==null&&remaining<=7,
  monthlyQuote:plan!=='legacy'?monthlyPrice(plan,branchCount(a)):null,
  branchLimit:limits.branches,branches,employees:branches.reduce((n,b)=>n+b.employees,0),
  atCapacity:branches.length>=limits.branches||branches.some(b=>b.employees>=b.limit),
  employeeCapacity:branches.some(b=>b.employees>=b.limit),
  overCapacity:branches.length>limits.branches||branches.some(b=>b.employees>b.limit),
  pendingJoins:Number(row.pendingJoins)||0,pendingCorrections:Number(row.pendingCorrections)||0,failedMail:Number(row.failedMail)||0,
  dataIssue:!row.valid||!row.name,
  support:{status:['미확인','확인 중','처리 완료'].includes(support?.status)?support.status:'미확인',note:typeof support?.note==='string'?support.note:'',history:Array.isArray(support?.history)?support.history:[]}};
}
export type AdminStore=ReturnType<typeof summarizeStore>;
export function needsAttention(s:AdminStore){return !!(s.pendingJoins+s.pendingCorrections+s.failedMail||s.trialEnding||s.overCapacity||s.dataIssue||s.support.status==='확인 중')}
export function adminOverview(stores:AdminStore[],now=Date.now()){
 const current=new Date(now+9*3600000);
 const months=Array.from({length:6},(_,i)=>({month:new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()-5+i,1)).toISOString().slice(0,7),count:0}));
 const distribution=[...Object.values(plans).map(p=>({id:p.id,name:p.name,count:0,trialing:0,expired:0,monthlyQuote:0})),{id:'legacy',name:'기존 매장',count:0,trialing:0,expired:0,monthlyQuote:0}];
 const totals={customers:stores.length,branches:0,employees:0,newCustomers30d:0,unknownCreatedAt:0,trialing:0,trialEnding:0,expired:0,free:0,pendingJoins:0,pendingCorrections:0,failedMail:0,employeeCapacity:0,overCapacity:0,attentionStores:0,supportOpen:0,dataIssues:0,trialMonthlyQuote:0};
 for(const s of stores){
  totals.branches+=s.branches.length;totals.employees+=s.employees;
  totals.pendingJoins+=s.pendingJoins;totals.pendingCorrections+=s.pendingCorrections;totals.failedMail+=s.failedMail;
  totals.trialing+=Number(s.status==='trialing');totals.free+=Number(s.status==='active');totals.expired+=Number(['expired','cancelled'].includes(s.status));
  totals.trialEnding+=Number(s.trialEnding);totals.employeeCapacity+=Number(s.employeeCapacity);totals.overCapacity+=Number(s.overCapacity);totals.attentionStores+=Number(needsAttention(s));totals.supportOpen+=Number(s.support.status==='확인 중');totals.dataIssues+=Number(s.dataIssue);
  const p=distribution.find(p=>p.id===s.plan)!;p.count++;p.trialing+=Number(s.status==='trialing');p.expired+=Number(['expired','cancelled'].includes(s.status));
  if(s.status==='trialing'){totals.trialMonthlyQuote+=s.monthlyQuote||0;p.monthlyQuote+=s.monthlyQuote||0}
  const created=Date.parse(s.createdAt||'');
  if(Number.isFinite(created)&&created<=now){if(created>=now-30*86400000)totals.newCustomers30d++;const m=months.find(m=>m.month===new Date(created+9*3600000).toISOString().slice(0,7));if(m)m.count++}else totals.unknownCreatedAt++;
 }
 return {totals,distribution,months,industries:[...industries.map(i=>i.name),'미선택'].map(name=>({name,count:stores.filter(s=>s.industry===name).length}))};
}
export function filterAdminStores(stores:AdminStore[],params:URLSearchParams){
 const q=(params.get('q')||'').trim().slice(0,100).toLocaleLowerCase();
 const plan=params.get('plan')||'',status=params.get('status')||'',attention=params.get('attention')||'';
 return stores.filter(s=>(!q||[s.name,...s.branches.map(b=>b.name)].some(n=>n.toLocaleLowerCase().includes(q)))&&(!plan||s.plan===plan)&&(!status||s.status===status)&&(
 !attention||attention==='all'&&needsAttention(s)||attention==='joins'&&s.pendingJoins>0||attention==='corrections'&&s.pendingCorrections>0||attention==='mail'&&s.failedMail>0||attention==='trial'&&s.trialEnding||attention==='capacity'&&s.employeeCapacity||attention==='support'&&s.support.status==='확인 중'||attention==='data'&&s.dataIssue));
}
