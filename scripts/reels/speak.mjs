// 나레이션 대사를 목소리 모델이 읽기 좋게 바꾼다.
// 목소리 모델은 숫자·소수·기호를 어색하게 읽어서(1.5 → "1 5"), 우리가 먼저 한글로 풀어 준다.
//   8시간 → 여덟 시간, 5명 → 다섯 명, 1.5배 → 일 점 오 배, 30일 → 삼십 일, 9900원 → 구천구백 원, 5월 → 오월
const D='영일이삼사오육칠팔구';
export const sino=n=>{n=Number(n);if(!n)return '영';let r='';
 const man=Math.floor(n/10000);if(man){r+=(man===1?'':sino(man))+'만';n%=10000}
 for(const [v,w] of [[1000,'천'],[100,'백'],[10,'십']]){const q=Math.floor(n/v);if(q){r+=(q===1?'':D[q])+w;n%=v}}
 return r+(n?D[n]:'')};
const T=['','열','스물','서른','마흔','쉰','예순','일흔','여든','아흔'],O=['','한','두','세','네','다섯','여섯','일곱','여덟','아홉'];
export const native=n=>n===20?'스무':T[Math.floor(n/10)]+O[n%10];
// 고유어로 세는 말(1~99일 때)
const NATIVE=['시간','명','개','살','번','시','배','달','곳','장','군데','잔','가지'];
const MONTH={6:'유월',10:'시월'};
const WORDS={QR:'큐알',PDF:'피디에프',CSV:'씨에스브이',CCTV:'씨씨티비',PC:'피씨',VAT:'부가세',xlsx:'엑셀',csv:'씨에스브이',A4:'에이포',OK:'오케이',X:'엑스',vs:'대',VS:'대'};

export function speak(s){
 s=s.replace(/(\d),(?=\d{3})/g,'$1');
 s=s.replace(/(\d+)월\s*(\d+)일/g,(_,m,d)=>(MONTH[m]||sino(m)+'월')+' '+sino(d)+'일');
 s=s.replace(/A4|[A-Za-z]{2,}|\bX\b/g,w=>WORDS[w]||w);
 s=s.replace(/(\d+)\.(\d+)\s*(%|배|시간|년|개월)?/g,(_,a,b,u)=>`${sino(a)} 점 ${[...b].map(d=>D[d]).join('')}${u?' '+(u==='%'?'퍼센트':u):''}`);
 s=s.replace(/(\d+)\s*(%|시간|개월|군데|명|개|살|번|시|배|달|곳|장|잔|가지|월|일|년|주|분|초|원|만 원|만원)?/g,(m,num,u)=>{const n=Number(num);
  if(u==='월')return MONTH[n]||sino(n)+'월';
  if(u&&NATIVE.includes(u)&&n>0&&n<100)return native(n)+' '+u;
  if(u==='%')return sino(n)+' 퍼센트';
  if(u==='만 원'||u==='만원')return sino(n)+'만 원';
  return sino(n)+(u?' '+u:'')});
 return s.replace(/×/g,' 곱하기 ').replace(/÷/g,' 나누기 ').replace(/=/g,' 은 ').replace(/~/g,'부터 ')
  .replace(/[\[\]"“”>]/g,' ').replace(/[()]/g,', ').replace(/[·→👉※]/g,', ')
  .replace(/\s*,\s*([.!?])/g,'$1').replace(/(,\s*){2,}/g,', ').replace(/\s+/g,' ').trim();
}
