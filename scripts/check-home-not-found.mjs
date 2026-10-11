import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';
import {buildHomeSite,APP_ORIGIN} from './build-home.mjs';
const out=await mkdtemp(path.join(tmpdir(),'chuk-404-'));
try{
 await buildHomeSite(out);const html=await readFile(path.join(out,'404.html'),'utf8'),script=await readFile(path.join(out,'home/go-app.js'),'utf8');
 assert(html.includes('요청하신 페이지를 찾을 수 없어요.'));
 assert(html.includes('name="robots" content="noindex"'));
 assert(!/http-equiv="refresh"/.test(html),'unknown pages must not refresh into the app');
 assert(html.includes('href="/"')&&html.includes('href="'+APP_ORIGIN+'/app"'));
 const run=(pathname,search='',hash='')=>{const calls=[];vm.runInNewContext(script,{location:{pathname,search,hash,replace:u=>calls.push(u)}});return calls};
 for(const p of ['/ux-unknown','/features/unknown','/home/missing.js','/app/missing','/j/','/j/x/other','//evil.invalid','/login/other'])assert.deepEqual(run(p,'?code=private','#token'),[],p);
 for(const p of ['/app','/login/','/signup','/employee','/pricing','/billing/success','/j/ABCD2345','/j/ABCD-2345','/j/ABCD%202345','/j/%20ABCD2345%20','/j/12345678-1234-1234-1234-123456789abc'])assert.deepEqual(run(p,'?role=owner','#next'),[APP_ORIGIN+p+'?role=owner#next'],p);
 console.log('PASS: missing homepage stays404, branded recovery and bounded legacy app links preserve query/hash.');
}finally{await rm(out,{recursive:true,force:true})}
