import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export async function checkPublicAssets(base,request=fetch){
 const root=base.replace(/\/$/,'');
 const response=await request(root+'/asset-releases.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200,'public asset manifest must exist');
 const manifest=await response.json();
 assert.ok(Array.isArray(manifest.releases)&&manifest.releases.length>0&&manifest.releases.length<=3,'valid retained generations');
 const files=new Map();
 for(const release of manifest.releases)for(const [name,hash] of Object.entries(release.files)){
  assert.match(name,/^(?:app-[A-Za-z0-9_-]{8,}\.(?:js|css)|chunks\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.js)$/);
  assert.match(hash,/^[a-f0-9]{64}$/);
  if(files.has(name))assert.equal(files.get(name),hash,'shared asset integrity');
  files.set(name,hash);
 }
 assert.ok(files.size>0,'asset manifest cannot be empty');
 const pending=[...files];
 await Promise.all(Array.from({length:Math.min(6,pending.length)},async()=>{
  while(pending.length){const [name,hash]=pending.shift();
   const r=await request(root+'/'+name,{cache:'no-store',signal:AbortSignal.timeout(30000)});
   assert.equal(r.status,200,name+' must remain available');
   assert.match(r.headers.get('content-type')||'',name.endsWith('.css')?/text\/css/:/(?:javascript|ecmascript)/,name+' cannot be an HTML fallback');
   assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),hash,name+' public integrity');
  }
 }));
 return {generations:manifest.releases.length,files:files.size};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const result=await checkPublicAssets(process.env.SMOKE_URL||'https://chukchukapp.kr');
 console.log('PASS: public immutable assets, '+result.generations+' generations / '+result.files+' files, HTTP 200 + MIME + SHA-256.');
}
