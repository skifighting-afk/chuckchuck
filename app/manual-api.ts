// 매장 매뉴얼: 사장님이 단계별(글·사진)로 만들고, 직원은 자기 지점 것을 바로 본다.
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {canWrite} from '../lib/plans';
import type {StoreData,Manual} from '../lib/store-data';
import {manualVisibleTo,MANUAL_CATEGORIES} from '../lib/manual-view';
import {notifyUser} from './push-api';
import type {PushEnv} from '../lib/webpush';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const MANUAL_LIMITS={manuals:100,steps:30,title:80,text:1000,imageBytes:400000,images:500};
type Step={text:string,imageId?:string|null};
export async function manualApi(request:Request,env:{DB:D1Database}&PushEnv){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 try{
 const linked=await resolveStore(env.DB,user);if(!linked||linked.access==='revoked')return json({error:'먼저 매장에 연결해 주세요. 사장님께 초대를 요청해 주세요.'},403);
 const {row,access}=linked,data:StoreData=JSON.parse(row.data),owner=access==='owner',url=new URL(request.url);
 const self=data.employees.find((e)=>e.id===data._members?.find((m)=>m.userId===user)?.employeeId);
 const manuals:Manual[]=data._manuals||[],visible=(m:Manual)=>owner||manualVisibleTo(m,self);
 // 사장님 화면: 그 매뉴얼을 받는 직원 수(지점·업무 기준)와 그중 읽은 수
 const audience=(m:Manual)=>(data._members||[]).map((x)=>({uid:x.userId,e:data.employees.find((e)=>e.id===x.employeeId)})).filter((x)=>x.e&&x.e.status!=='퇴사'&&manualVisibleTo(m,x.e));
 const view=()=>({checkRuns:(data._checkRuns||[]).filter((r)=>owner?r.at>=new Date(Date.now()-7*86400000).toISOString():r.byId===user&&r.at>=new Date(Date.now()-86400000).toISOString()).slice(-100).reverse(),version:row.version,owner,branches:owner?data.branches.map((b)=>({id:b.id,name:b.name})):[],roles:owner?[...new Set(data.employees.map((e)=>e.role).filter(Boolean))]:[],manuals:manuals.filter(visible).map(m=>({...m,category:m.category||'기타',roles:m.roles||[],note:m.note||'',read:(m.reads||[]).includes(user),reads:undefined,quiz:(m as any).quiz?.length?(owner?(m as any).quiz:(m as any).quiz.map((x:any)=>({q:x.q,options:x.options}))):undefined,quizPass:undefined,quizPassed:!!(m as any).quizPass?.[user],...(owner&&(m as any).quiz?.length?{quizPassed:undefined,quizPasses:audience(m).filter(x=>(m as any).quizPass?.[x.uid]).map(x=>x.e!.name),quizPending:audience(m).filter(x=>!(m as any).quizPass?.[x.uid]).map(x=>x.e!.name)}:{}),...(owner?(()=>{const a=audience(m);return {audience:a.length,readCount:a.filter((x)=>(m.reads||[]).includes(x.uid)).length,unread:a.filter((x)=>!(m.reads||[]).includes(x.uid)).map((x)=>x.e!.name)}})():{})}))});
 if(request.method==='GET'){
  const image=url.searchParams.get('image');
  if(image){const run=(data._checkRuns||[]).find((r)=>r.photoId===image);if(!owner&&!(run&&run.byId===user)&&!manuals.some(m=>visible(m)&&m.steps.some((s:Step)=>s.imageId===image)))return json({error:'볼 수 없는 사진이에요. 매뉴얼 목록을 새로고침해 주세요.'},404);const f=await env.DB.prepare('SELECT mime,body FROM store_manual_images WHERE owner=? AND id=?').bind(linked.owner,image).first<any>();if(!f)return json({error:'사진을 찾을 수 없어요. 사장님께 다시 올려 달라고 해 주세요.'},404);const bin=Uint8Array.from(atob(f.body),c=>c.charCodeAt(0));return new Response(bin,{headers:{'Content-Type':f.mime,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}})}
  return json(view());
 }
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const raw=await request.text();if(raw.length>MANUAL_LIMITS.imageBytes*1.4+2000)return json({error:'보낸 내용이 너무 커요. 사진을 줄여서 다시 올려 주세요.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'요청을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
 const now=new Date().toISOString();
 if(b.action==='read'){const m=manuals.find(m=>m.id===b.id&&visible(m));if(!m)return json({error:'매뉴얼을 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);if(!(m.reads||[]).includes(user)){m.reads=[...(m.reads||[]),user].slice(-500);await save()}return json(view())}
 // 지시서 5주차 061: 오픈·마감 체크 실행 — 직원도 할 수 있다. 단계마다 체크하고 사진 한 장으로 인증
 if(b.action==='checkRun'){
  const m=manuals.find(m=>m.id===b.id&&visible(m));if(!m)return json({error:'매뉴얼을 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
  const done=Array.isArray(b.done)?[...new Set(b.done.filter((i:any)=>Number.isInteger(i)&&i>=0&&i<m.steps.length))].sort((x:any,y:any)=>x-y) as number[]:[];
  if(!done.length)return json({error:'한 단계 이상 체크해 주세요.'},400);
  let photoId:string|null=null;
  if(b.photo){const p=b.photo;if(!['image/jpeg','image/png'].includes(p.mime)||typeof p.body!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.body))return json({error:'JPG·PNG 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.'},400);const bin=atob(p.body);if(bin.length>MANUAL_LIMITS.imageBytes)return json({error:'사진이 너무 커요. 400KB 이하로 줄여서 올려 주세요.'},413);if(!(p.mime==='image/png'?bin.startsWith('\x89PNG\r\n\x1a\n'):bin.startsWith('\xff\xd8\xff')))return json({error:'사진 형식이 맞지 않아요. JPG·PNG 사진을 골라 주세요.'},400);
   photoId='chk-'+crypto.randomUUID();await env.DB.prepare('INSERT INTO store_manual_images(owner,id,mime,body,bytes,created_at) VALUES(?,?,?,?,?,?)').bind(linked.owner,photoId,p.mime,p.body,bin.length,now).run();}
  const runs=data._checkRuns||[],cut=new Date(Date.now()-60*86400000).toISOString(),keep=runs.filter((r)=>r.at>=cut).slice(-300),drop=runs.filter((r)=>!keep.includes(r));
  keep.push({id:crypto.randomUUID(),manualId:m.id,title:m.title,category:m.category||'기타',branchId:self?.branchId||m.branchId,byId:user!,by:owner?'사장님':self?.name||'',at:now,done,total:m.steps.length,photoId,note:typeof b.note==='string'?b.note.trim().slice(0,200):''});
  data._checkRuns=keep;await save();for(const r of drop)if(r.photoId)await env.DB.prepare('DELETE FROM store_manual_images WHERE owner=? AND id=?').bind(linked.owner,r.photoId).run();
  if(!owner&&done.length<m.steps.length)await notifyUser(env as any,linked.owner,{title:`${m.title} 체크가 덜 끝났어요`,body:`${self?.name||'직원'}님이 ${m.steps.length}단계 중 ${done.length}단계만 체크했어요.`,url:'/app?screen=manual',kind:'manual'}).catch(()=>null);
  return json(view());
 }
 // 지시서 066: 신입 교육 퀴즈 — 다 맞히면 이수(틀린 번호만 알려 주고 정답은 안 보여 준다)
 if(b.action==='quiz'){const m:any=manuals.find(m=>m.id===b.id&&visible(m));if(!m?.quiz?.length)return json({error:'퀴즈가 없는 매뉴얼이에요. 목록을 새로고침해 주세요.'},404);const ans=Array.isArray(b.answers)?b.answers:[];const wrong=m.quiz.map((x:any,i:number)=>ans[i]===x.answer?-1:i+1).filter((i:number)=>i>0);
  if(!wrong.length){m.quizPass={...(m.quizPass||{}),[user]:{at:now,score:m.quiz.length}};data._manuals=manuals;await save()}
  return json({...view(),quizResult:{total:m.quiz.length,correct:m.quiz.length-wrong.length,wrong,pass:!wrong.length}})}
 if(!owner)return json({error:'매뉴얼은 사장님만 만들고 고칠 수 있어요.'},403);
 if(data._account&&!canWrite(data._account))return json({error:'체험이 끝나 지금은 조회만 할 수 있어요. 요금제를 고르면 다시 저장할 수 있어요.'},403);
 if(b.action==='image'){
  if(!['image/jpeg','image/png'].includes(b.mime)||typeof b.body!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.body))return json({error:'JPG·PNG 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.'},400);
  let bin:string;try{bin=atob(b.body)}catch{return json({error:'사진을 읽을 수 없어요. 다른 사진을 골라 주세요.'},400)}
  if(bin.length>MANUAL_LIMITS.imageBytes)return json({error:'사진이 너무 커요. 400KB 이하로 줄여서 올려 주세요.'},413);
  const magic=b.mime==='image/png'?bin.startsWith('\x89PNG\r\n\x1a\n'):bin.startsWith('\xff\xd8\xff');if(!magic)return json({error:'사진 형식이 맞지 않아요. JPG·PNG 사진을 골라 주세요.'},400);
  const count=await env.DB.prepare('SELECT count(*) AS n FROM store_manual_images WHERE owner=?').bind(linked.owner).first<any>();if(Number(count?.n||0)>=MANUAL_LIMITS.images)return json({error:'사진을 더 저장할 수 없어요. 쓰지 않는 매뉴얼을 지운 뒤 다시 올려 주세요.'},400);
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO store_manual_images(owner,id,mime,body,bytes,created_at) VALUES(?,?,?,?,?,?)').bind(linked.owner,id,b.mime,b.body,bin.length,now).run();return json({id},201);
 }
 if(b.version!==row.version)return json({error:'새로운 변경이 있어요. 새로고침하고 다시 저장해 주세요.'},409);
 if(b.action==='save'){
  const title=typeof b.title==='string'?b.title.trim():'',branchId=b.branchId;
  if(!title||title.length>MANUAL_LIMITS.title)return json({error:'제목을 80자 이내로 입력해 주세요.'},400);
  if(branchId!=='all'&&!data.branches.some((x)=>x.id===branchId))return json({error:'없는 지점이에요. 지점을 다시 골라 주세요.'},400);
  if(!Array.isArray(b.steps)||!b.steps.length||b.steps.length>MANUAL_LIMITS.steps)return json({error:'단계를 1~30개로 만들어 주세요.'},400);
  const steps:Step[]=[];for(const s of b.steps){const text=typeof s?.text==='string'?s.text.trim():'';if(!text&&!s?.imageId)return json({error:'빈 단계가 있어요. 내용을 쓰거나 사진을 넣어 주세요.'},400);if(text.length>MANUAL_LIMITS.text)return json({error:'한 단계는 1000자 이내로 써 주세요.'},400);if(s.imageId&&(typeof s.imageId!=='string'||!await env.DB.prepare('SELECT 1 FROM store_manual_images WHERE owner=? AND id=?').bind(linked.owner,s.imageId).first()))return json({error:'사진을 다시 올려 주세요.'},400);steps.push({text,imageId:s.imageId||null})}
  const category=MANUAL_CATEGORIES.includes(b.category)?b.category:'기타';
  const roles=Array.isArray(b.roles)?[...new Set(b.roles.filter((r:any)=>typeof r==='string'&&r.length<=20))].slice(0,10) as string[]:[];
  const note=typeof b.note==='string'?b.note.trim().slice(0,200):'';
  let quiz:any[]|undefined;if(Array.isArray(b.quiz)&&b.quiz.length){if(b.quiz.length>10)return json({error:'퀴즈는 10문제까지 만들 수 있어요.'},400);quiz=[];for(const x of b.quiz){const q=typeof x?.q==='string'?x.q.trim().slice(0,200):'',opts=Array.isArray(x?.options)?x.options.map((o:any)=>typeof o==='string'?o.trim().slice(0,100):'').filter(Boolean).slice(0,4):[];if(!q||opts.length<2||!Number.isInteger(x.answer)||x.answer<0||x.answer>=opts.length)return json({error:'퀴즈마다 질문, 보기 2~4개, 정답 하나를 정해 주세요.'},400);quiz.push({q,options:opts,answer:x.answer})}}
  const existing=b.id?manuals.find(m=>m.id===b.id):null;if(b.id&&!existing)return json({error:'매뉴얼을 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);
  if(!existing&&manuals.length>=MANUAL_LIMITS.manuals)return json({error:'매뉴얼은 100개까지 만들 수 있어요. 쓰지 않는 것을 지워 주세요.'},400);
  const before=existing?.steps.map((s:Step)=>s.imageId).filter((x):x is string=>!!x)||[];
  if(existing){const sameQuiz=JSON.stringify((existing as any).quiz||null)===JSON.stringify(quiz||null);Object.assign(existing,{title,branchId,steps,category,roles,note,createdAt:existing.createdAt||existing.updatedAt,updatedAt:now,reads:[],quiz,...(sameQuiz?{}:{quizPass:{}})})}else manuals.push({id:crypto.randomUUID(),title,branchId,steps,category,roles,note:'',createdAt:now,updatedAt:now,reads:[],...(quiz?{quiz}:{})} as any);
  data._manuals=manuals;await save();await dropUnused(before);
  // 대상 직원에게 알림(새 매뉴얼·바뀐 매뉴얼)
  if(b.notify!==false){const m=existing||manuals.at(-1)!;for(const x of audience(m))await notifyUser(env as any,x.uid,{title:existing?'매뉴얼이 바뀌었어요':'새 매뉴얼',body:m.title+(note&&existing?' · '+note:''),url:'/app'}).catch(()=>{})}
  return json(view());
 }
 if(b.action==='delete'){const m=manuals.find(m=>m.id===b.id);if(!m)return json({error:'매뉴얼을 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);data._manuals=manuals.filter(x=>x.id!==b.id);manuals.splice(manuals.indexOf(m),1);await save();await dropUnused(m.steps.map((s:Step)=>s.imageId).filter((x):x is string=>!!x));return json(view())}
 return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 async function save(){data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:now,actor:{id:user!,name:owner?'사장님':self?.name||''},action:b.action==='read'?'매뉴얼 확인':b.action==='quiz'?'교육 퀴즈 통과':b.action==='checkRun'?'오픈·마감 체크':b.action==='delete'?'매뉴얼 삭제':'매뉴얼 저장',target:b.title||b.id||'',before:null,after:null,reason:''}].slice(-1000);const r=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),row.version+1,now,linked!.owner,row.version).run();if(!r.meta.changes)throw new Conflict();row.version++}
 async function dropUnused(ids:string[]){const used=new Set((data._manuals||[]).flatMap((m)=>m.steps.map((s:Step)=>s.imageId)));for(const id of ids)if(!used.has(id))await env.DB.prepare('DELETE FROM store_manual_images WHERE owner=? AND id=?').bind(linked!.owner,id).run()}
 }catch(e){if(e instanceof Conflict)return json({error:'동시 변경이 있어요. 새로고침해 주세요.'},409);return serverError('manual',e,'매뉴얼을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
class Conflict extends Error{}
