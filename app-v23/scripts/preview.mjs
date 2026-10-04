import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
await mkdir('work',{recursive:true});
const db=new DatabaseSync('work/preview.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS stores (owner TEXT PRIMARY KEY NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL)');
db.exec((await readFile('drizzle/0001_leave_evidence.sql','utf8')).replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ').replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS '));
const adapter={prepare(sql){let args=[];return {bind(...v){args=v;return this},async all(){return {results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}}}}}};
const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://127.0.0.1').pathname;if(p.startsWith('/api/')){const {api}=await import('../dist/server/index.js');const chunks=[];for await(const c of req)chunks.push(c);const h=new Headers();for(const [k,v]of Object.entries(req.headers))if(v&&!k.startsWith('oai-authenticated-user-'))h.set(k,Array.isArray(v)?v.join(','):v);h.set('oai-authenticated-user-id','local-owner');h.set('oai-authenticated-user-email','local@example.invalid');const r=new Request('http://127.0.0.1:5187'+req.url,{method:req.method,headers:h,...(['PUT','POST'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const result=await api(r,{DB:adapter});res.statusCode=result.status;result.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await result.text());return}const file=path.resolve('dist/client','.'+(!path.extname(p)?'/index.html':p));if(!file.startsWith(path.resolve('dist/client')+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch(error){console.error(error);res.statusCode=500;res.end('Preview error');}}).listen(5187,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5187'));




