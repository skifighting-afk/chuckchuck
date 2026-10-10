// 개선 2차 B200: 저장소에 비밀값처럼 보이는 글이 들어가면 막는다(공개 저장소). 찾으면 파일 이름과 종류만 알린다(값은 출력하지 않음).
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {findSecrets} from '../lib/improve2.ts';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&!/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|mp4|mp3|zip|pdf)$/i.test(f)&&!f.startsWith('lib/vendor/'));
const hits=[];
for(const f of files){let st;try{st=statSync(f)}catch{continue}if(!st.isFile()||st.size>2_000_000)continue;const found=findSecrets(readFileSync(f,'utf8'));if(found.length&&f!=='scripts/check-improve2.mjs')hits.push(`${f}: ${found.join(', ')}`)}
if(hits.length){console.error('비밀값처럼 보이는 글이 있어요. 값을 지우고 GitHub Secrets로 옮겨 주세요:\n'+hits.join('\n'));process.exitCode=1}
else console.log(`1. PASS 비밀값 검사 ${files.length>0?'완료':'(파일 없음)'}`);
