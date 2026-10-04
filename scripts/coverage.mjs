// 작업 088: 급여·계약 모듈 테스트 커버리지(V8 블록 커버리지, 외부 도구 없이).
// 테스트를 NODE_V8_COVERAGE로 돌린 뒤, 서버 묶음(dist/server/*.js) 안의 '// lib/xxx.ts' 구간별로
// 실행되지 않은 블록이 차지하는 글자 수를 빼서 '실행된 코드 비율'을 계산한다(주석·빈 줄 제외).
// 사용: node scripts/coverage.mjs [--min 90]   (먼저 서버 묶음을 빌드해 둘 것)
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const TARGETS=['lib/team-model.ts','lib/pay-rules.ts','lib/income-tax.ts','lib/holidays.ts','lib/annual-leave.ts','lib/close-check.ts','lib/employer-insurance.ts','lib/payslip.ts','lib/wage-ledger.ts','lib/contract-template.ts','lib/labor-checks.ts','app/contracts-api.ts','lib/signature-image.ts','lib/pdf.ts'];
const TESTS=(process.env.COVERAGE_TESTS||'check-pay-rules,check-team,check-verified-contracts,check-simulation').split(',');
const min=Number(process.argv[process.argv.indexOf('--min')+1])||0;
const dir=mkdtempSync(join(tmpdir(),'cov-'));
for(const t of TESTS){const r=spawnSync(process.execPath,[...process.execArgv,`scripts/${t}.mjs`],{stdio:['ignore','ignore','inherit'],env:{...process.env,NODE_V8_COVERAGE:dir}});if(r.status!==0){console.error(`${t} 실패 — 커버리지 측정 중단`);process.exit(1)}}
// 파일별 실행 안 된 범위 모으기(같은 파일이 여러 프로세스에 나오면 한 번이라도 실행된 곳은 실행된 것으로)
const files=new Map();
for(const f of readdirSync(dir)){for(const s of JSON.parse(readFileSync(join(dir,f),'utf8')).result){
 if(!/\/(dist\/server\/[^/]+\.js|lib\/[^/]+\.ts|app\/[^/]+\.ts)$/.test(s.url))continue;const path=new URL(s.url).pathname,src=files.get(path)?.src||readFileSync(path,'utf8');
 const hit=files.get(path)?.hit||new Uint8Array(src.length);const counts=new Int32Array(src.length).fill(-1);
 // 바깥 범위부터 안쪽으로 덮어써서 각 글자의 실행 횟수를 정한다
 const ranges=s.functions.flatMap(fn=>fn.ranges).sort((a,b)=>(a.startOffset-b.startOffset)||(b.endOffset-a.endOffset));
 for(const r of ranges)counts.fill(r.count,r.startOffset,Math.min(src.length,r.endOffset));
 for(let i=0;i<src.length;i++)if(counts[i]>0)hit[i]=1;
 files.set(path,{src,hit});}}
const best=new Map(),root=resolve('.')+'/';
for(const [path,{src,hit}] of files){
 const own=path.startsWith(root)&&!path.includes('/dist/')?path.slice(root.length):null;
 const marks=own?[{name:own,at:0}]:[...src.matchAll(/^\/\/(?:#region)? ?((?:lib|app)\/[^\n]+?\.tsx?)$/gm)].map(m=>({name:m[1],at:m.index}));
 marks.forEach((m,i)=>{if(!TARGETS.includes(m.name))return;const end=i+1<marks.length?marks[i+1].at:src.length;let code=0,run=0;
  const text=src.slice(m.at,end).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,x=>' '.repeat(x.length));
  for(let k=0;k<text.length;k++){if(/\s/.test(text[k]))continue;code++;if(hit[m.at+k])run++}
  if(process.env.COVERAGE_SHOW===m.name){let k=m.at,out=[];while(k<end){if(!hit[k]&&!/\s/.test(text[k-m.at])){let e=k;while(e<end&&!hit[e])e++;const seg=src.slice(k,e).trim();if(seg.length>25)out.push(seg.replace(/\s+/g,' ').slice(0,160));k=e}else k++}console.log('— 실행 안 된 부분 —\n'+out.join('\n'))}
  const pct=code?Math.round(run/code*1000)/10:0;if(!best.has(m.name)||best.get(m.name)<pct)best.set(m.name,pct)});
}
const rows=[...best].map(([name,pct])=>({name,pct}));
rows.sort((a,b)=>a.name.localeCompare(b.name));
for(const r of rows)console.log(`${r.pct>=min?'PASS':'LOW '} ${r.pct.toFixed(1).padStart(5)}%  ${r.name}`);
const missing=TARGETS.filter(t=>!rows.some(r=>r.name===t));if(missing.length){console.log('측정되지 않음(묶음에 없음):',missing.join(', '));for(const [p,{src}] of files)if(p.includes('/dist/'))console.log(p.split('/').pop(),'구간 표시 예:',[...src.matchAll(/^\/\/.{0,60}$/gm)].slice(0,3).map(m=>m[0]).join(' | '));if(min){console.error('측정되지 않은 모듈이 있어 실패');process.exit(1)}}
writeFileSync('coverage-summary.json',JSON.stringify(rows,null,1));
const low=rows.filter(r=>r.pct<min);if(min&&low.length){console.error(`${min}% 미만: ${low.map(r=>r.name).join(', ')}`);process.exit(1)}
