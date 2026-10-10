import {ZodError} from 'zod';
import {serverError} from '../../lib/errors';
import {asHrDatabase,resolveHrContext,contextView,HrError} from './context';
import {grantsRead,grantsWrite} from './grants-api';
import {hiringRead,hiringWrite} from './hiring-api';
import {trainingRead,trainingWrite} from './training-api';
import {staffingRead,staffingWrite} from './staffing-api';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function hrApi(request:Request,env:{DB:D1Database}):Promise<Response>{
 try{
  const url=new URL(request.url),db=asHrDatabase(env.DB);let body:any;
  if(request.method!=='GET'&&request.method!=='POST')return json({error:'화면을 새로고침하고 다시 시도해 주세요.'},405);
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return json({error:'화면을 새로고침하고 다시 저장해 주세요.'},403);
   const raw=await request.text();if(raw.length>65536)return json({error:'내용이 너무 길어요. 나눠서 입력해 주세요.'},413);
   try{body=JSON.parse(raw)}catch{return json({error:'입력 내용을 확인하고 다시 저장해 주세요.'},400)}
  }
  const ctx=await resolveHrContext(request,{DB:db},body?.branchId||url.searchParams.get('branch')||undefined);
  if(url.pathname==='/api/hr/context'&&request.method==='GET')return json(contextView(ctx));
  if(url.pathname==='/api/hr/grants'){
   if(request.method==='GET')return json(await grantsRead(db,ctx));
   const result=await grantsWrite(db,ctx,body);return json(result,!result.replayed&&body.action==='grant'?201:200);
  }
  if(url.pathname==='/api/hr/hiring'){
   if(request.method==='GET')return json(await hiringRead(db,ctx));
   const result=await hiringWrite(db,ctx,body);return json(result,!result.replayed&&body.action==='save'&&!body.id?201:200);
  }
  if(url.pathname==='/api/hr/training'){
   if(request.method==='GET')return json(await trainingRead(db,ctx));
   const result=await trainingWrite(db,ctx,body);return json(result,!result.replayed&&['assignBuddy','saveSkill'].includes(body.action)&&!body.id?201:200);
  }
  if(url.pathname==='/api/hr/staffing'){
   if(request.method==='GET')return json(await staffingRead(db,ctx,url));
   return json(await staffingWrite(db,ctx,body));
  }
  return json({error:'화면 주소를 확인하고 다시 열어 주세요.'},404);
 }catch(e){if(e instanceof HrError)return json({error:e.message},e.status);if(e instanceof ZodError)return json({error:'입력 항목과 날짜를 확인해 주세요.',fields:e.issues.map(i=>({path:i.path.join('.'),message:i.message}))},400);return serverError('hr',{name:e instanceof Error?e.name:'Error',code:(e as any)?.code,message:'HR operation failed'})}
}
