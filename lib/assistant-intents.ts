// 척척 비서 말 알아듣기: "김민지 시급 10500", "김민지 내일 9시부터 6시 근무", "명세서 보내줘" 같은 문장을 할 일로 바꾼다.
// 외부 AI 없이 정해진 규칙으로 읽는다. 읽은 내용은 화면에 확인 카드로 보여 주고, 사장님이 [실행]을 눌러야 반영한다.

export type Person={id:string,name:string};
export type Parsed={
 employeeId?:string,name?:string,
 wage?:{payType:'시급'|'일급'|'월급',wage:number},
 shift?:{date:string,start:string,end:string,breakMinutes:number,guessedDate:boolean},
 verb?:'payslip-send'|'payslip-view'|'contract'|'qr'|'register',
 topic?:'working'|'alerts'|'labor'|'pay'|'juhu'|'analyze'|'help'|'schedule'|'leave',
};
const pad=(n:number)=>String(n).padStart(2,'0');
const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const WD='일월화수목금토';

export function findPerson(text:string,people:Person[]){
 return [...people].sort((a,b)=>b.name.length-a.name.length).find(p=>p.name.length>=2&&text.includes(p.name));
}
/** 날짜: 오늘·내일·모레, 10월 8일, 10/8, 8일, (다음 주) 수요일 */
export function parseDate(text:string,today:string):string|null{
 if(/모레/.test(text))return addDays(today,2);
 if(/내일/.test(text))return addDays(today,1);
 if(/오늘/.test(text))return today;
 let m=/(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(text)||/(?:^|\s)(\d{1,2})[/.](\d{1,2})(?:\s|$|에|일)/.exec(text);
 if(m){let y=Number(today.slice(0,4));const mo=Number(m[1]),d=Number(m[2]);if(mo<1||mo>12||d<1||d>31)return null;if(`${y}-${pad(mo)}-${pad(d)}`<addDays(today,-60))y++;return `${y}-${pad(mo)}-${pad(d)}`}
 m=/(다음\s*주|담주|이번\s*주)?\s*([월화수목금토일])요일/.exec(text);
 if(m){const want=WD.indexOf(m[2]),cur=new Date(today+'T00:00:00Z').getUTCDay();
  if(m[1]&&/다음|담/.test(m[1])){const mon=addDays(today,-((cur+6)%7)+7);return addDays(mon,(want+6)%7)}
  return addDays(today,(want-cur+7)%7)}
 m=/(?:^|\s)(\d{1,2})\s*일(?!\s*(급|간|당))/.exec(text);
 if(m&&!/\d\s*일\s*(급|간)/.test(text)){const d=Number(m[1]);if(d>=1&&d<=31){let t=today.slice(0,8)+pad(d);if(t<today)t=addDays(today.slice(0,8)+'01',32).slice(0,8)+pad(d);return t}}
 return null;
}
/** 시간: 9시부터 6시, 오전 9시~오후 3시, 09:00-15:00, 9시 반부터 */
export function parseTimes(text:string):{start:string,end:string}|null{
 const t=text.replace(/\s+/g,' ');
 const re=/(오전|오후|아침|낮|저녁|밤|새벽)?\s?(\d{1,2})(?:\s?시|:(\d{2}))\s?(반|\d{1,2}\s?분)?\s?(?:부터|에서|~|-|–|—)\s?(오전|오후|아침|낮|저녁|밤|새벽)?\s?(\d{1,2})(?:\s?시|:(\d{2}))?\s?(반|\d{1,2}\s?분)?/;
 const m=re.exec(t);if(!m)return null;
 const min=(colon?:string,extra?:string)=>colon?Number(colon):extra==='반'?30:extra?Number(extra.replace(/\D/g,'')):0;
 let sh=Number(m[2]),eh=Number(m[6]);const sm=min(m[3],m[4]),em=min(m[7],m[8]);
 const pm=(w?:string)=>!!w&&/오후|저녁|밤/.test(w);
 if(pm(m[1])&&sh<12)sh+=12;if(m[1]==='낮'&&sh<6)sh+=12;
 if(pm(m[5])&&eh<12)eh+=12;
 else if(!m[5]&&eh<12&&eh*60+em<=sh*60+sm&&(eh+12)*60+em>sh*60+sm)eh+=12; // 9시부터 6시 → 18시
 if(sh>23||eh>24||sm>59||em>59)return null;if(eh===24)eh=0;
 const start=`${pad(sh)}:${pad(sm)}`,end=`${pad(eh)}:${pad(em)}`;if(start===end)return null;
 return {start,end};
}
export function legalBreak(start:string,end:string){let m=(Number(end.slice(0,2))*60+Number(end.slice(3)))-(Number(start.slice(0,2))*60+Number(start.slice(3)));if(m<=0)m+=1440;return m>=480?60:m>=240?30:0}
export function parseWage(text:string):Parsed['wage']|undefined{
 const m=/(시급|일급|월급|일당)\s*(?:은|는|을|를|이|가|으로|로)?\s*(\d[\d,]*)\s*(만)?\s*원?/.exec(text);
 if(!m)return;let w=Number(m[2].replace(/,/g,''));if(m[3])w*=10000;const payType=(m[1]==='일당'?'일급':m[1]) as '시급'|'일급'|'월급';
 if(!Number.isFinite(w)||w<1000||w>100000000)return;return {payType,wage:Math.round(w)};
}
export function parse(text:string,people:Person[],today:string):Parsed{
 const p:Parsed={},who=findPerson(text,people);if(who){p.employeeId=who.id;p.name=who.name}
 const w=parseWage(text);if(w)p.wage=w;
 const times=parseTimes(text);
 if(times){const d=parseDate(text,today);const br=/휴게\s*(\d+)\s*(분|시간)/.exec(text);p.shift={date:d||today,...times,breakMinutes:br?Number(br[1])*(br[2]==='시간'?60:1):legalBreak(times.start,times.end),guessedDate:!d}}
 if(/명세서/.test(text))p.verb=/보내|전송|발송|줘\b|주세요|돌려/.test(text)&&!/보여|보기|열어/.test(text)?'payslip-send':'payslip-view';
 else if(/계약서/.test(text))p.verb='contract';
 else if(/QR|큐알|qr/.test(text))p.verb='qr';
 else if(/(새|신규)\s*직원|등록해|추가해/.test(text)&&!who&&!times)p.verb='register';
 if(!p.verb&&!p.wage&&!p.shift){
  if(/분석|판단|어때|진단|점검|조언|요약|브리핑/.test(text))p.topic='analyze';
  else if(/지각|늦|안\s*왔|안\s*찍|미출근|결근|빠진/.test(text))p.topic='alerts';
  else if(/주휴/.test(text)&&who)p.topic='juhu';
  else if(/누가|몇\s*명|일하|근무\s*중|출근했/.test(text))p.topic='working';
  else if(/인건비|급여|월급|얼마|실수령|총액/.test(text))p.topic=who?'pay':'labor';
  else if(/근무표|스케줄|다음\s*주/.test(text))p.topic='schedule';
  else if(/휴가|연차|대타|교대/.test(text))p.topic='leave';
  else if(/뭐\s*(할|해)|도움|기능|사용법|어떻게\s*써/.test(text))p.topic='help';
 }
 return p;
}
