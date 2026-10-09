// 작업 014·015: lib/legal-docs.ts → docs/legal/terms.md, docs/legal/privacy.md
// 사용: (빌드 후) node scripts/legal-md.mjs        → 파일을 다시 쓴다
//       node scripts/legal-md.mjs --check          → 문서가 코드와 다르면 실패
import {TERMS,PRIVACY,POLICY,ACCESSIBILITY,legalMarkdown} from '../dist/server/legal-docs.js';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
mkdirSync('docs/legal',{recursive:true});
const check=process.argv.includes('--check');let bad=0;
for(const d of [TERMS,PRIVACY,POLICY,ACCESSIBILITY]){const f=`docs/legal/${d.key}.md`,md=legalMarkdown(d);
 if(check){if(!existsSync(f)||readFileSync(f,'utf8')!==md){console.error(`${f}가 lib/legal-docs.ts와 달라요. node scripts/legal-md.mjs로 다시 만드세요.`);bad++}}
 else{writeFileSync(f,md);console.log('wrote',f)}}
if(bad)process.exit(1);
