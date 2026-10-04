import fs from 'node:fs';
import path from 'node:path';
import git from '../work/publish-tools/node_modules/isomorphic-git/index.js';
import http from '../work/publish-tools/node_modules/isomorphic-git/http/node/index.js';
process.on('uncaughtException',e=>{console.error('Source sync failed:',e.code||e.name);process.exit(1)});
let input='';process.stdin.setEncoding('utf8');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for credential JSON on stdin (not echoed).');
for await(const chunk of process.stdin){input+=chunk;if(/[\r\n]/.test(input))break}
const credential=JSON.parse(input.trim());input='';
if(process.stdin.isTTY)process.stdin.setRawMode(false);
const securedHttp={request:args=>http.request({...args,headers:{...args.headers,Authorization:'Bearer '+credential.token}})};
const dir=process.cwd(),gitdir=path.resolve('work/publish-repository');if(!fs.existsSync(gitdir))fs.cpSync('.git',gitdir,{recursive:true});
const onAuth=()=>credential.auth_mode==='bearer'?{username:credential.token,password:''}:{username:'x-access-token',password:credential.token};
if(!fs.existsSync(gitdir))await git.init({fs,dir,gitdir,defaultBranch:credential.branch});
await git.addRemote({fs,dir,gitdir,remote:'origin',url:credential.remote_url,force:true});
// The Site is new. Fetch first to preserve any remote initial commit.
const refs=await git.listServerRefs({http:securedHttp,url:credential.remote_url,onAuth});
if(refs.some(r=>r.ref==='refs/heads/'+credential.branch)){
await git.fetch({fs,http:securedHttp,dir,gitdir,remote:'origin',ref:credential.branch,onAuth});
let head;try{head=await git.resolveRef({fs,dir,gitdir,ref:'HEAD'})}catch{}
const remoteHead=await git.resolveRef({fs,dir,gitdir,ref:'refs/remotes/origin/'+credential.branch});
if(head&&head!==remoteHead)throw Error('Remote source changed; reconcile before publishing');
if(!head){const oid=await git.resolveRef({fs,dir,gitdir,ref:'refs/remotes/origin/'+credential.branch});await git.writeRef({fs,dir,gitdir,ref:'refs/heads/'+credential.branch,value:oid});}
}
const exclude=new Set(['.git','node_modules','work','outputs','dist','.sites-runtime','.wrangler','.next','.vinext','.agents','.codex']);
async function add(folder=''){for(const entry of fs.readdirSync(path.join(dir,folder),{withFileTypes:true})){if(!folder&&exclude.has(entry.name))continue;if(entry.name.startsWith('.env'))continue;const file=path.posix.join(folder,entry.name);if(entry.isDirectory())await add(file);else if(entry.isFile())await git.add({fs,dir,gitdir,filepath:file})}}
await add();
const commit_sha=await git.commit({fs,dir,gitdir,author:{name:'Codex',email:'codex@openai.com'},message:'Build Onjang restaurant operations platform'});
await git.push({fs,http:securedHttp,dir,gitdir,remote:'origin',ref:credential.branch,onAuth});
const confirmed=await git.listServerRefs({http:securedHttp,url:credential.remote_url,onAuth});
if(!confirmed.some(r=>r.ref==='refs/heads/'+credential.branch&&r.oid===commit_sha))throw Error('Remote commit verification failed');
console.log(JSON.stringify({commit_sha}));
