import {readFile,writeFile,mkdir,readdir,copyFile,access} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const manifestName='asset-releases.json';
const allowed=/^(?:app-[A-Za-z0-9_-]{8,}\.(?:js|css)|chunks\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.js)$/;
const digest=data=>createHash('sha256').update(data).digest('hex');
async function capture(dir,id){
 const files={};for(const entry of await readdir(dir,{withFileTypes:true})){
  const names=entry.isFile()?[entry.name]:entry.isDirectory()&&entry.name==='chunks'?(await readdir(path.join(dir,'chunks'))).map(n=>'chunks/'+n):[];
  for(const name of names)if(allowed.test(name))files[name]=digest(await readFile(path.join(dir,name)));
 }
 if(!Object.keys(files).some(n=>/^app-.*\.js$/.test(n)))throw Error('No hashed client entry');
 return {id:id||'legacy-'+digest(JSON.stringify(files)).slice(0,16),files};
}
export async function recordClientRelease(dir,id){await writeFile(path.join(dir,manifestName),JSON.stringify({releases:[await capture(dir,id)]},null,2)+'\n')}
async function manifest(dir){try{return JSON.parse(await readFile(path.join(dir,manifestName),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;return {releases:[await capture(dir)]}}}
export async function retainClientAssets(previous,current){
 const old=await manifest(previous),now=await manifest(current);
 for(const m of [now,old]){
  if(!Array.isArray(m.releases)||!m.releases.length||m.releases.length>3)throw Error('Invalid asset manifest');
  for(const r of m.releases){if(typeof r.id!=='string'||r.id.length>100||!r.files||typeof r.files!=='object')throw Error('Invalid release');
   for(const [name,hash] of Object.entries(r.files))if(!allowed.test(name)||!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid asset path or hash');
  }
 }
 const releases=[now.releases[0],...old.releases.filter(r=>r.id!==now.releases[0].id)].slice(0,3);
 for(const release of releases.slice(1))for(const [name,hash] of Object.entries(release.files)){
  const src=path.join(previous,name),dest=path.join(current,name),data=await readFile(src);
  if(digest(data)!==hash)throw Error('Asset integrity failed: '+name);
  let exists=true;try{await access(dest)}catch(e){if(e.code!=='ENOENT')throw e;exists=false}
  if(exists){if(digest(await readFile(dest))!==hash)throw Error('Asset collision: '+name)}
  else{await mkdir(path.dirname(dest),{recursive:true});await copyFile(src,dest)}
 }
 await writeFile(path.join(current,manifestName),JSON.stringify({releases},null,2)+'\n');
 console.log('Client asset generations: '+releases.map(r=>r.id).join(', '));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){if(!process.argv[2]||!process.argv[3])throw Error('Usage: client-assets.mjs PREVIOUS CURRENT');await retainClientAssets(process.argv[2],process.argv[3])}
