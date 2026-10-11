import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import {recordClientRelease,retainClientAssets} from './client-assets.mjs';
import {checkPublicAssets} from './check-public-assets.mjs';
const root=await mkdtemp(path.join(tmpdir(),'chuk-assets-'));
async function release(name){const dir=path.join(root,name);await mkdir(path.join(dir,'chunks'),{recursive:true});await writeFile(path.join(dir,'app-'+name.repeat(8)+'.js'),'import "./chunks/team-'+name.repeat(8)+'.js"');await writeFile(path.join(dir,'chunks/team-'+name.repeat(8)+'.js'),'export const version="'+name+'"');await writeFile(path.join(dir,'app-'+name.repeat(16)+'.css'),'body{color:'+name+'}');await writeFile(path.join(dir,'app.html'),'private html must not be copied');await recordClientRelease(dir,name);return dir}
try{
 const a=await release('a'),b=await release('b'),c=await release('c'),d=await release('d');
 await retainClientAssets(a,b);await retainClientAssets(b,c);await retainClientAssets(c,d);
 const manifest=JSON.parse(await readFile(path.join(d,'asset-releases.json'),'utf8'));
 assert.deepEqual(manifest.releases.map(r=>r.id),['d','c','b']);
 assert.equal(await readFile(path.join(d,'chunks/team-bbbbbbbb.js'),'utf8'),'export const version="b"','open tab can resolve previous lazy chunk');
 await assert.rejects(access(path.join(d,'app-aaaaaaaa.js')),'oldest generation expires');
 assert.equal(await readFile(path.join(d,'app.html'),'utf8'),'private html must not be copied');
 const request=async url=>url.includes('asset-releases.json')?new Response(JSON.stringify(manifest),{headers:{'content-type':'application/json'}}):new Response(await readFile(path.join(d,new URL(url).pathname.slice(1))),{headers:{'content-type':url.endsWith('.css')?'text/css':'application/javascript'}});
 assert.equal((await checkPublicAssets('https://test.invalid',request)).generations,3);
 await assert.rejects(checkPublicAssets('https://test.invalid',async url=>url.includes('asset-releases.json')?request(url):new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}})),/HTML fallback/);
 await assert.rejects(checkPublicAssets('https://test.invalid',async url=>url.includes('asset-releases.json')?request(url):new Response('wrong file',{headers:{'content-type':url.endsWith('.css')?'text/css':'application/javascript'}})),/public integrity/);
 const legacy=path.join(root,'legacy');await mkdir(path.join(legacy,'chunks'),{recursive:true});await writeFile(path.join(legacy,'app-legacy88.js'),'old entry');await writeFile(path.join(legacy,'chunks/team-legacy88.js'),'old chunk');await retainClientAssets(legacy,a);await access(path.join(a,'chunks/team-legacy88.js'));
 await writeFile(path.join(b,'chunks/team-bbbbbbbb.js'),'tampered');await assert.rejects(retainClientAssets(b,c),/integrity/);
 const unsafe=JSON.parse(await readFile(path.join(b,'asset-releases.json'),'utf8'));unsafe.releases[0].files['../secret.js']='a'.repeat(64);await writeFile(path.join(b,'asset-releases.json'),JSON.stringify(unsafe));await assert.rejects(retainClientAssets(b,c),/asset path/);
 console.log('PASS: retain two previous asset generations, bootstrap Pages artifacts, reject integrity/path violations and preserve current HTML.');
}finally{await rm(root,{recursive:true,force:true})}
