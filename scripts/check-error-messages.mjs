// 작업 085: 서버가 돌려주는 오류 문구는 "다음에 무엇을 하면 되는지"를 담아야 한다.
import {readFileSync,readdirSync} from 'node:fs';
const dir=new URL('../app/',import.meta.url).pathname;
const next=/(주세요|하세요|해 줘|요청해|돼요|되요|있어요|부터|로그인|새로고침|다시|확인|골라|입력|눌러|바꾸|올려|받아|들어가|열어|이용해|안내해|문의|기다려|쓸 수|할 수 있|볼 수 있|받을 수|내려받|취소하)/;
const bad=[];let count=0;
for(const f of readdirSync(dir).filter(f=>/\.ts$/.test(f))){
 const text=readFileSync(dir+f,'utf8');
 for(const m of text.matchAll(/error:\s*'((?:[^'\\]|\\.)*)'/g)){count++;if(!next.test(m[1]))bad.push(`${f}: ${m[1]}`)}
}
if(bad.length){console.error('다음 행동이 없는 오류 문구:\n'+bad.join('\n'));process.exitCode=1}
else console.log(`PASS: 오류 문구 ${count}개 모두 다음 행동 안내 포함.`);
