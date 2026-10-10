// 앱에 담을 화면(www)을 만든다: 웹 빌드(dist/client)를 복사하고, 첫 화면을 앱 화면(app.html)으로 바꾼다.
// 먼저 저장소 루트에서 `node scripts/portable-build.mjs`를 돌려 dist/client를 만든다.
import {cp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,src=root+'dist/client',www=new URL('../www/',import.meta.url).pathname;
if(!existsSync(src+'/app.html'))throw Error('dist/client/app.html이 없어요. 루트에서 node scripts/portable-build.mjs를 먼저 돌려 주세요.');
await rm(www,{recursive:true,force:true});await mkdir(www,{recursive:true});
await cp(src,www,{recursive:true,filter:p=>!/\/(CNAME|404\.html|robots\.txt|sitemap\.xml|\.nojekyll|\.well-known)(\/|$)/.test(p)});
// 앱 안 첫 화면은 로그인·내 가게(홈페이지 소개 화면이 아님). 공개 화면 파일은 그대로 둬도 앱 라우터가 처리한다.
let html=await readFile(www+'app.html','utf8');
html=html.replace('<meta name="robots" content="noindex,nofollow">','');
await writeFile(www+'index.html',html);
await writeFile(www+'version.json',JSON.stringify({sha:process.env.GITHUB_SHA||'local',builtAt:new Date().toISOString(),app:true})+'\n');
console.log('www 준비 완료:',www);
