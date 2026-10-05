// 작업 099: 급여 요율·보험 계산(lib/pay-rules.ts)을 +EV(plus-ev 저장소)와 같이 쓴다.
// +EV는 빌드 없는 정적 웹앱이라, 이 파일을 순수 JS(pay-rules.js)로 만들어 그 저장소에 넣는다.
// 사용: node scripts/sync-plus-ev.mjs ../plus-ev   (요율을 바꾸면 두 앱 모두 같은 값을 쓰도록 다시 실행)
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const target=process.argv[2]||'../plus-ev';
if(!existsSync(target+'/engine.js'))throw Error(target+'에 plus-ev 저장소가 없어요.');
let js;
try{const {build}=await import('rolldown');const out=await build({input:'lib/pay-rules.ts',write:false,output:{format:'esm'}});js=out.output[0].code}
catch{const r=spawnSync('bun',['build','lib/pay-rules.ts','--format=esm','--target=browser'],{encoding:'utf8'});if(r.status)throw Error(r.stderr);js=r.stdout}
const src=readFileSync('lib/pay-rules.ts','utf8'),hash=createHash('sha256').update(src).digest('hex').slice(0,12);
writeFileSync(target+'/pay-rules.js',`// 생성 파일 — 고치지 마세요. 원본: chuckchuck/lib/pay-rules.ts (sha256 ${hash})\n// 다시 만들기: chuckchuck에서 node scripts/sync-plus-ev.mjs ../plus-ev\nexport const PAY_RULES_SOURCE='${hash}';\n`+js);
console.log('plus-ev/pay-rules.js 갱신 ('+hash+')');
