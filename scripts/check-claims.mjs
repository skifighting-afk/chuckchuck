// 작업 020: 과장·허위 문구 검사 (표시·광고의 공정화에 관한 법률 취지, homepage/project_plan.md 원칙)
// 화면(app, lib, components)과 홈페이지(homepage/src)에서 "제공한다"고 쓰면 안 되는 표현을 찾는다.
// 같은 문장 근처에 부정·한계 표현(아님, 않, 없, 준비, 예정, 전, 별도 …)이 있으면 안내 문구로 보고 통과시킨다.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';

const root=new URL('..',import.meta.url).pathname;
const targets=['app','lib','components','homepage/src'];
const exts=/\.(tsx?|jsx?|html|md)$/;
const banned=[
 ['법정수당 완전 자동',/법정\s?수당[^.。\n]{0,12}(완전|100%|모두)\s?자동|완전\s?자동[^.。\n]{0,8}법정\s?수당/],
 ['공인 인증·법적 효력 보장',/공인\s?(인증|전자서명)|법적\s?효력[^.。\n]{0,6}(보장|인정)/],
 ['급여 송금',/급여\s?(송금|이체)\s?(해|대행|기능)/],
 ['세금 신고 대행',/세금\s?신고\s?(대행|해\s?드|자동)/],
 ['카카오 로그인',/카카오\s?(로그인|간편\s?가입)/],
 ['GPS·위치 인증',/(GPS|위치)\s?(인증|확인)/],
 ['ERP·POS 연동',/(ERP|POS)\s?(연동|연결)/],
 ['가짜 실적',/(\d[\d,]*\s?(개|곳|명)\s?(의\s?)?(매장|사장님|고객)(이|가)?\s?(사용|선택|이용))|만족도\s?\d|1위/],
];
// 근처에 이런 말이 있으면 '제공하지 않는다'는 안내로 본다.
const negation=/(아님|아니|아닙|적용 전|않|없|금지|준비|예정|전이|연결 전|별도|제외|못|불가|주장|직접|확인 필요|대신|아직|하지 마|쓰지 마|Not|not )/;

function* walk(dir){for(const name of readdirSync(dir)){if(name==='node_modules'||name.startsWith('.'))continue;const p=join(dir,name),st=statSync(p);if(st.isDirectory())yield* walk(p);else if(exts.test(name))yield p}}

const hits=[];
for(const t of targets){
 let base;try{base=join(root,t);statSync(base)}catch{continue}
 for(const file of walk(base)){
  const text=readFileSync(file,'utf8');
  for(const [label,re] of banned){
   const g=new RegExp(re.source,'g');let m;
   while((m=g.exec(text))){
    const around=text.slice(Math.max(0,m.index-60),m.index+m[0].length+60);
    if(negation.test(around))continue;
    // '제공하지 않는 것' 목록 안(예: NOT_INCLUDED = [ ... ])이면 통과
    const before=text.slice(Math.max(0,m.index-800),m.index),open=before.lastIndexOf('NOT_INCLUDED');
    if(open>=0&&!before.slice(open).includes(']'))continue;
    const line=text.slice(0,m.index).split('\n').length;
    hits.push(`${relative(root,file)}:${line} [${label}] …${around.replace(/\s+/g,' ').trim()}…`);
   }
  }
 }
}
if(hits.length){console.error('과장·허위로 보일 수 있는 문구가 있어요. 사실이 아니면 고치고, 안내 문구라면 같은 문장에 한계를 적어 주세요:\n'+hits.join('\n'));process.exitCode=1}
else console.log('PASS: 과장·허위 문구 검사 (화면·홈페이지).');
