import {api} from '../dist/server/index.js';
import {newMember} from '../dist/server/team-model.js';
import {authedTest} from './test-auth.mjs';
import {closeAll} from './test-db.mjs';
import postgres from 'postgres';
import {PgD1,pgTypes} from '../lib/pg-d1.ts';

export async function createHrFixture(){
 const T=await authedTest();
 const schema=(await T.sql.unsafe('SHOW search_path'))[0].search_path;
 const sql=postgres(process.env.TEST_DATABASE_URL||'postgres://postgres:postgres@localhost:5432/chuck_test',{max:4,types:pgTypes,onnotice(){},connection:{search_path:schema}});
 const DB=new PgD1(sql),env={...T.env,DB};
 const call=async(actor,path,body)=>{const r=await api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await T.headersFor(actor))},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,body:await r.json(),headers:r.headers}};
 for(const actor of ['boss','outsider']){
  const r=await call(actor,'/api/account',{action:'onboard',storeName:'HR 시험 매장',branchName:'본점',ownerName:'가상 사장',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
  if(r.status!==200&&r.status!==201)throw Error('Fixture onboard: '+JSON.stringify(r.body));
 }
 const owner=T.id('boss'),store=async()=>JSON.parse((await DB.prepare('SELECT data FROM stores WHERE owner=?').bind(owner).first()).data);
 const patchStore=async(fn)=>{const d=await store();await fn(d);await DB.prepare('UPDATE stores SET data=?,version=version+1 WHERE owner=?').bind(JSON.stringify(d),owner).run()};
 const ids={};
 await patchStore(async d=>{
  d.branches.push({id:'branch-other',name:'2호점',address:''});d.employees=[];d._members=[];
  for(const actor of ['staff','peer','manager','foreign']){
   await T.headersFor(actor,{role:'employee'});const e={...newMember(actor==='foreign'?'branch-other':'branch-main'),name:actor,status:'재직',...(actor==='manager'?{access:'중간관리자',managerPermissions:['schedule']}:{} )};
   ids[actor]=e.id;d.employees.push(e);d._members.push({userId:T.id(actor),employeeId:e.id});
  }
 });
 return {...T,DB,env,sql,owner,call,store,patchStore,employeeId:a=>ids[a],q:(query,...args)=>DB.prepare(query).bind(...args),command:(action,extra={})=>({action,branchId:'branch-main',requestId:crypto.randomUUID(),...extra}),close:async()=>{await sql.end();await closeAll()}};
}
