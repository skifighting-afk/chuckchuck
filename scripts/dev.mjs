// 작업 002: 로컬 개발 환경 — `npm run dev` 하나로
// 1) Supabase 로컬 스택(supabase start: Postgres·Auth·Edge Runtime, Docker 필요)
// 2) 화면·서버 함수 빌드와 파일 감시(바꾸면 다시 빌드)
// 3) 서버 함수 실행(supabase functions serve api)
// 4) 화면 서버 http://localhost:5173 (모든 주소 → index.html)
// 옵션: --reset  로컬 DB를 지우고 마이그레이션을 처음부터 다시 적용
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync,readFileSync,writeFileSync,watch} from 'node:fs';
import {extname,join,normalize} from 'node:path';

const PORT=Number(process.env.PORT||5173),ORIGIN=`http://localhost:${PORT}`;
const say=(...a)=>console.log('\x1b[32m[dev]\x1b[0m',...a);
const cli=spawnSync('supabase',['--version'],{encoding:'utf8'}).status===0?['supabase']:['npx','--yes','supabase'];
const sb=(args,opts={})=>spawnSync(cli[0],[...cli.slice(1),...args],{encoding:'utf8',stdio:opts.inherit?'inherit':'pipe',env:{...process.env,APP_ORIGIN_PRIMARY:ORIGIN}});

if(spawnSync('docker',['info'],{stdio:'ignore'}).status!==0){console.error('Docker가 실행 중이어야 해요. Docker Desktop을 켠 뒤 다시 실행해 주세요.');process.exit(1)}
say('Supabase 로컬 스택을 켜요… (처음에는 이미지를 받느라 몇 분 걸려요)');
if(sb(['start'],{inherit:true}).status!==0){console.error('supabase start에 실패했어요. 위 메시지를 확인해 주세요.');process.exit(1)}
if(process.argv.includes('--reset')){say('로컬 DB를 초기화해요');sb(['db','reset','--local'],{inherit:true})}
const status=Object.fromEntries(sb(['status','-o','env']).stdout.split('\n').map(l=>l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map(m=>[m[1],m[2]]));
const api=status.API_URL,anon=status.ANON_KEY;
if(!api||!anon){console.error('supabase status에서 API_URL/ANON_KEY를 읽지 못했어요.');process.exit(1)}

// 서버 함수 환경값(커밋하지 않음)
writeFileSync('supabase/functions/.env.local',`APP_ORIGIN=${ORIGIN}\n`);

const env={...process.env,SUPABASE_URL:api,SUPABASE_ANON_KEY:anon,APP_DOMAIN:'',GITHUB_SHA:'local-dev'};
let building=false,again=false;
function rebuild(){
 if(building){again=true;return}
 building=true;const t=Date.now();
 const r=spawnSync(process.execPath,['scripts/portable-build.mjs'],{env,stdio:['ignore','pipe','pipe'],encoding:'utf8'});
 building=false;
 if(r.status===0)say(`빌드 완료 (${Date.now()-t}ms)`);else console.error(r.stderr||r.stdout);
 if(again){again=false;rebuild()}
}
rebuild();
let timer;
for(const dir of ['app','lib','components','supabase/functions/api/entry.ts'])if(existsSync(dir))watch(dir,{recursive:true},(_,f)=>{if(f&&/index\.js$/.test(f))return;clearTimeout(timer);timer=setTimeout(rebuild,200)});

say('서버 함수를 켜요');
const fn=spawn(cli[0],[...cli.slice(1),'functions','serve','api','--no-verify-jwt','--env-file','supabase/functions/.env.local'],{stdio:'inherit',env:{...process.env,APP_ORIGIN_PRIMARY:ORIGIN}});

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain; charset=utf-8'};
createServer((req,res)=>{
 const url=new URL(req.url,ORIGIN);let file=normalize(join('dist/client',decodeURIComponent(url.pathname)));
 if(!file.startsWith('dist/client')||!existsSync(file)||!extname(file))file=url.pathname==='/'?'dist/client/index.html':'dist/client/app.html';
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));
}).listen(PORT,()=>{say(`화면: ${ORIGIN}`);say(`Supabase Studio: ${status.STUDIO_URL||'http://127.0.0.1:54323'} · 메일 확인(Inbucket/Mailpit): ${status.INBUCKET_URL||status.MAILPIT_URL||'http://127.0.0.1:54324'}`);say('끝내려면 Ctrl+C (Supabase 스택은 `npx supabase stop`으로 끔)')});
const stop=()=>{fn.kill();process.exit(0)};process.on('SIGINT',stop);process.on('SIGTERM',stop);
