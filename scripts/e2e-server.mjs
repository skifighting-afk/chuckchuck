// 작업 080: 화면 E2E용 로컬 서버 — 화면(dist/client) + 서버 코드(dist/server) + 가짜 Supabase Auth + 테스트 Postgres(새 스키마)
// 화면은 SUPABASE_URL=이 서버 주소, SUPABASE_ANON_KEY=anon-test-key로 빌드해야 한다(scripts/e2e.mjs가 안내).
import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {extname,join,normalize} from 'node:path';
import {testDB} from './test-db.mjs';
import {fakeGoTrue} from './test-auth.mjs';
import {api} from '../dist/server/index.js';

export async function startE2EServer({port=Number(process.env.E2E_PORT||8790),www=process.env.E2E_WWW||'dist/client'}={}){
 const ORIGIN=`http://localhost:${port}`;
 const db=await testDB();const auth=fakeGoTrue(db.DB);
 const env={DB:db.DB,...auth.env,HQ_ADMIN_EMAIL:'hq@example.invalid'};
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'};
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,ORIGIN);const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks);
   if(url.pathname.startsWith('/auth/v1/')){
    const r=await auth.env.AUTH_FETCH(auth.env.SUPABASE_URL+url.pathname+url.search,{method:req.method,headers:req.headers,body:raw.length?raw.toString():undefined});
    res.writeHead(r.status,{'content-type':'application/json'});return res.end(await r.text());
   }
   if(url.pathname.startsWith('/functions/v1/')){
    // Supabase 함수 입구(entry.ts)와 같게: 신원 헤더·쿠키를 지우고 /api 경로로 넘긴다.
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string'&&!k.startsWith('oai-authenticated-user-')&&k!=='cookie')headers.set(k,v);
    const path='/api'+url.pathname.replace(/^\/functions\/v1(\/api)?/,'');
    const r=await api(new Request(ORIGIN+path+url.search,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:raw}),env);
    const out=Object.fromEntries(r.headers);out['cache-control']??='no-store';
    res.writeHead(r.status,out);return res.end(Buffer.from(await r.arrayBuffer()));
   }
   let file=normalize(join(www,decodeURIComponent(url.pathname)));
   if(!file.startsWith(normalize(www))||!existsSync(file)||!extname(file))file=join(www,url.pathname==='/'?'index.html':'app.html');
   res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
  }catch(e){console.error(e);res.writeHead(500);res.end('server error')}
 });
 await new Promise(r=>server.listen(port,r));
 return {ORIGIN,db,auth,env,close:async()=>{server.close();await db.close?.()}};
}
if(import.meta.url===`file://${process.argv[1]}`){const s=await startE2EServer();console.log('E2E 서버: '+s.ORIGIN)}
