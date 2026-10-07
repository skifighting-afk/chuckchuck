// 척척 비서: 화면마다 가게 데이터를 읽고 '지금 볼 것'을 짧게 알려 준다.
// 실제 대화형 AI가 아니라 정해진 규칙으로 계산한다(같은 데이터면 늘 같은 답). 숫자는 화면과 같은 함수를 쓴다.
import {type Team,kdate,missing,calculate,duration} from './team-model';
import {monthPatterns} from './attendance-check';
import {ratesFor} from './pay-rules';
import {parse,type Parsed} from './assistant-intents';
import {matchKB,answerKB} from './assistant-kb';
import {todayTasks,todayBoard,homeAlerts,budgetStatus,plannedLabor,type Target} from './close-check';
import {checkDay} from './attendance-check';

export type Brief={text:string,tone?:'red'|'amber'|'ok',target?:Target};
const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const mondayOf=(d:string)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));return t.toISOString().slice(0,10)};
const won=(n:number)=>Math.round(n).toLocaleString('ko-KR');

export function assistantBrief(s:Team,branch:string,page:string,date:string,now=Date.now()):Brief[]{
 const es=s.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사'),ids=new Set(es.map(e=>e.id));
 if(!es.length)return [{text:'등록된 직원이 없어요. 직원에게 가입 링크를 보내면 신청이 홈 승인함에 바로 떠요.',tone:'amber',target:'employees'}];
 const tol=((s.settings as any).attendanceTolerance||'normal');
 const findings=checkDay(date,s.shifts.filter(x=>ids.has(x.employeeId)),s.attendance.filter(a=>ids.has(a.employeeId)),tol,now,((s as any).approvedLeaves||[]));
 const board=todayBoard(s,branch,date,findings,now,tol==='lenient'?10:tol==='strict'?0:5),alerts=homeAlerts(s,branch,date,board);
 const out:Brief[]=[];
 const pendingFix=s.requests.filter(r=>r.status==='승인 대기'&&ids.has(r.before?.employeeId)).length;
 if(page==='홈'){
  const total=board.rows.length;
  out.push({text:total?`오늘 근무 ${total}명 중 ${board.working}명이 지금 일하고 있어요${board.left?`, ${board.left}명은 아직 출근 전이에요`:''}.`:'오늘은 근무표에 잡힌 근무가 없어요.',tone:'ok',target:'schedule'});
  for(const a of alerts.slice(0,3))out.push({text:a.title+'. '+a.detail+'.',tone:a.tone,target:a.target});
  const tasks=todayTasks(s,branch,date);if(tasks.length)out.push({text:`처리할 일이 ${tasks.reduce((n,t)=>n+t.count,0)}건 있어요. 가장 많은 건 '${tasks.slice().sort((a,b)=>b.count-a.count)[0].label}'이에요.`,tone:'amber',target:tasks.slice().sort((a,b)=>b.count-a.count)[0].target});
  const b=budgetStatus(s,branch,date.slice(0,7));if(b)out.push({text:`이번 달 근무표대로면 인건비가 예산의 ${Math.round(b.ratio*100)}%(${won(b.planned)}원)예요.`,tone:b.over?'red':b.near?'amber':'ok',target:'reports'});
 }else if(page==='출퇴근 기록'){
  // 화면의 '확인 권장'과 같은 판정(checkDay)을 그대로 쓴다: 건수와 이름이 화면과 같아야 한다.
  if(findings.length){
   const nm=(id:string)=>es.find(e=>e.id===id)?.name||'직원';
   out.push({text:`확인 권장 ${findings.length}건: `+findings.slice(0,4).map(f=>`${nm(f.employeeId)} ${f.kind}${f.minutes?` ${f.minutes}분`:''}`).join(', ')+(findings.length>4?` 외 ${findings.length-4}건`:'')+'.',tone:findings.some(f=>f.kind==='미출근')?'red':'amber'});
   for(const a of alerts.filter(a=>a.key.startsWith('noshow')).slice(0,2))out.push({text:a.title+'. '+a.detail+'.',tone:a.tone});
  }else if(alerts.length)for(const a of alerts.slice(0,4))out.push({text:a.title+'. '+a.detail+'.',tone:a.tone});
  else out.push({text:'오늘은 출퇴근 문제가 없어요. 근무표대로 찍혔어요.',tone:'ok'});
  if(pendingFix)out.push({text:`직원이 보낸 출퇴근 수정 요청 ${pendingFix}건이 수정 승인함에서 기다려요.`,tone:'amber'});
  out.push({text:'QR을 잘못 찍었다면 그 줄의 수정 요청으로 고치세요. 누가 언제 무엇을 바꿨는지 변경 이력에 남아요.'});
 }else if(page==='근무 스케줄'){
  const mon=mondayOf(date),next=addDays(mon,7);
  const thisWeek=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=mon&&x.date<next),nextWeek=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=next&&x.date<addDays(next,7));
  const empty=Array.from({length:7},(_,i)=>addDays(mon,i)).filter(d=>d>=date&&!thisWeek.some(x=>x.date===d));
  out.push({text:`이번 주 근무 ${thisWeek.length}개가 잡혀 있어요.`,tone:'ok'});
  if(empty.length)out.push({text:`이번 주 ${empty.map(d=>Number(d.slice(8))+'일').join('·')}에 근무가 없어요. 쉬는 날이 아니라면 채워 주세요.`,tone:'amber'});
  if(!nextWeek.length)out.push({text:'다음 주 근무표가 비어 있어요. 지난주 복사나 템플릿으로 한 번에 채울 수 있어요.',tone:'amber'});
  const noShift=es.filter(e=>!thisWeek.some(x=>x.employeeId===e.id)&&e.status==='재직');if(noShift.length)out.push({text:`이번 주 근무가 없는 직원: ${noShift.slice(0,4).map(e=>e.name).join(', ')}${noShift.length>4?` 외 ${noShift.length-4}명`:''}.`});
 }else if(page==='급여·명세서'){
  const month=date.slice(0,7),run=(s.payrollRuns as any)[month+':'+branch],rows=calculate(s,month).filter(r=>ids.has(r.employeeId));
  out.push({text:run?.locked?`${Number(month.slice(5))}월 급여는 확정됐어요. 아직 안 보낸 명세서가 있으면 아래에서 보내세요.`:`${Number(month.slice(5))}월 예상 실수령 합계는 ${won(rows.reduce((n,r)=>n+r.net,0))}원이에요. 아직 확정 전이에요.`,tone:run?.locked?'ok':'amber'});
  const open=s.attendance.filter(a=>ids.has(a.employeeId)&&!a.end&&kdate(a.start)<date).length;if(open)out.push({text:`퇴근 기록이 빠진 근무가 ${open}건 있어요. 확정 전에 고쳐야 급여가 맞아요.`,tone:'red',target:'attendance'});
  if(pendingFix)out.push({text:`승인 안 된 출퇴근 수정 요청 ${pendingFix}건이 있어요. 먼저 처리하면 급여에 반영돼요.`,tone:'amber',target:'attendance'});
  const minWage=(rows as any[]).filter(r=>(r.warnings||[]).some((w:string)=>w.includes('보다 낮은'))).length;if(minWage)out.push({text:`최저임금 확인이 필요한 직원이 ${minWage}명 있어요.`,tone:'red'});
 }else if(page==='직원 관리'){
  const miss=es.filter(e=>missing(e).length);if(miss.length)out.push({text:`정보가 덜 채워진 직원 ${miss.length}명: ${miss.slice(0,3).map(e=>e.name+'('+missing(e).slice(0,2).join('·')+')').join(', ')}${miss.length>3?' 외':''}.`,tone:'amber'});
  const ready=es.filter(e=>e.status!=='재직').length;if(ready)out.push({text:`'입사 준비' 상태 직원 ${ready}명은 근로조건을 확인한 뒤 재직으로 바꿔 주세요.`,tone:'amber'});
  const cert=es.filter(e=>(e as any).healthCertUntil&&(e as any).healthCertUntil<=addDays(date,30));if(cert.length)out.push({text:`보건증이 30일 안에 끝나거나 지난 직원: ${cert.map(e=>e.name).join(', ')}.`,tone:'red'});
  if(!out.length)out.push({text:`직원 ${es.length}명 정보가 모두 채워져 있어요.`,tone:'ok'});
 }else{
  for(const t of todayTasks(s,branch,date).slice(0,3))out.push({text:`${t.label} ${t.count}건이 남아 있어요.`,tone:'amber',target:t.target});
 }
 return out;
}

/** 질문 글자와 자주 묻는 질문을 맞춰 가까운 답 3개. 띄어쓰기 단위로 겹치는 말이 많을수록 앞. */
export function searchAnswers<T extends {q:string,a:string}>(items:T[],query:string,limit=3):T[]{
 const words=query.replace(/[?？.!,]/g,' ').split(/\s+/).map(w=>w.replace(/(은|는|이|가|을|를|에|에서|으로|로|도|요|나요|까요|해요|하나요)$/,'')).filter(w=>w.length>=2);
 if(!words.length)return [];
 return items.map(i=>({i,score:words.reduce((n,w)=>n+(i.q.includes(w)?3:0)+(i.a.includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.i);
}

/** 가게 기록 분석: 사장님이 판단할 거리(인건비 흐름, 주 15시간 경계, 1년 근속, 지각 반복, 52시간). */
export function analyze(s:Team,branch:string,date:string,now=Date.now()):Brief[]{
 const es=s.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사'),ids=new Set(es.map(e=>e.id)),out:Brief[]=[];
 if(!es.length)return out;
 const month=date.slice(0,7),prev=new Date(Date.parse(month+'-01T00:00:00Z')-86400000).toISOString().slice(0,7);
 const cur=calculate(s,month).filter(r=>ids.has(r.employeeId)).reduce((n,r)=>n+r.gross,0),last=calculate(s,prev).filter(r=>ids.has(r.employeeId)).reduce((n,r)=>n+r.gross,0);
 const plan=plannedLabor(s,branch,month);
 if(last>0){const day=Number(date.slice(8)),days=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
  if(day>=7&&cur>0){const pace=Math.round(cur/day*days),diff=(pace-last)/last;out.push({text:`이번 달 지금까지 인건비 ${won(cur)}원(${day}일치)이에요. 이 속도면 한 달 약 ${won(pace)}원으로 지난달(${won(last)}원)보다 ${Math.abs(Math.round(diff*100))}% ${diff>=0?'많아요':'적어요'}.${diff>0.15?' 근무 시간이 늘었는지 근무표를 확인해 보세요.':''}`,tone:diff>0.15?'amber':'ok',target:'reports'})}
  else out.push({text:`지난달 인건비는 ${won(last)}원이었어요. 이번 달은 ${day}일째라 일주일이 지나면 비교해 드릴게요. 지금 근무표대로면 약 ${won(plan)}원이 잡혀 있어요.`,tone:'ok',target:'reports'})}
 // 이번 주 근무표 시간
 const mon=mondayOf(date),sun=addDays(mon,6),fivePlus=!!(s.settings as any).fivePlus;
 for(const e of es){
  const h=s.shifts.filter(x=>x.employeeId===e.id&&x.date>=mon&&x.date<=sun).reduce((n,x)=>n+duration(x.start,x.end,x.breakMinutes),0);
  if(h>=13&&h<15)out.push({text:`${e.name}님 이번 주 근무표가 ${h.toFixed(1)}시간이에요. 15시간을 넘기면 주휴수당이 생기고, 계속되면 퇴직금·4대보험 대상이 될 수 있어요.`,tone:'amber',target:'schedule'});
  else if(h>52)out.push({text:`${e.name}님 이번 주 근무표가 ${h.toFixed(1)}시간이에요. 주 52시간(연장 포함)을 넘어요.${fivePlus?' 5명 이상 사업장은 법 위반이 될 수 있어요.':''}`,tone:'red',target:'schedule'});
  else if(fivePlus&&h>40)out.push({text:`${e.name}님 이번 주 ${h.toFixed(1)}시간 → 40시간을 넘는 ${(h-40).toFixed(1)}시간은 연장근로 가산(1.5배) 대상이에요.`,tone:'amber',target:'payroll'});
  // 1년 근속(퇴직금) 다가옴
  if(e.joined&&e.weeklyHours>=15){const one=(Number(e.joined.slice(0,4))+1)+e.joined.slice(4,10);if(one>=date&&one<=addDays(date,30))out.push({text:`${e.name}님이 ${Number(one.slice(5,7))}월 ${Number(one.slice(8))}일이면 1년을 채워요. 주 15시간 이상이라 퇴직금 대상이 되고, 연차도 새로 생겨요.`,tone:'amber',target:'employees'})}
 }
 // 지각 반복
 const pats=monthPatterns(month,s.shifts.filter(x=>ids.has(x.employeeId)),s.attendance.filter(a=>ids.has(a.employeeId)),((s.settings as any).attendanceTolerance||'normal'),now);
 for(const p of pats.filter(p=>p.지각>=3).slice(0,2)){const n=es.find(e=>e.id===p.employeeId)?.name;out.push({text:`${n}님이 이번 달 ${p.지각}번 늦었어요(합계 ${p.lateMinutes}분)${p.repeatDay?`. 주로 ${p.repeatDay}요일이에요`:''}. 출근 시간을 다시 맞춰 보면 좋겠어요.`,tone:'amber',target:'attendance'})}
 // 다음 주 근무표
 const nextMon=addDays(mon,7);if(!s.shifts.some(x=>ids.has(x.employeeId)&&x.date>=nextMon&&x.date<=addDays(nextMon,6)))out.push({text:'다음 주 근무표가 아직 비어 있어요. 지난주 복사로 한 번에 채울 수 있어요.',tone:'amber',target:'schedule'});
 if(!out.length)out.push({text:'특별히 걱정할 점은 안 보여요. 근무표·출퇴근·급여가 고르게 들어와 있어요.',tone:'ok'});
 return out;
}

export type Action=
 {type:'setWage',employeeId:string,payType:'시급'|'일급'|'월급',wage:number,label:string}|
 {type:'addShift',employeeId:string,date:string,start:string,end:string,breakMinutes:number,label:string}|
 {type:'register',name:string,payType:'시급'|'일급'|'월급',wage:number,label:string}|
 {type:'sendPayslip',runKey:string,employeeIds:string[],label:string}|
 {type:'openPayslip',employeeId:string,month:string,label:string}|
 {type:'go',target:Target,label:string}|
 {type:'qr',label:string}|
 {type:'link',href:string,label:string};
export type Memo={employeeId?:string,pending?:string,lastVerb?:string};
export type Reply={lines:string[],actions:Action[],tone?:'red'|'amber'|'ok',memo?:Memo};
const dlabel=(d:string)=>`${Number(d.slice(5,7))}월 ${Number(d.slice(8))}일(${'일월화수목금토'[new Date(d+'T00:00:00Z').getUTCDay()]})`;

/** 사장님 말 → 답과 실행할 일. faq는 화면이 넘겨 준 자주 묻는 질문(없으면 생략). */
export function reply(text:string,s:Team,branch:string,date:string,now=Date.now(),faq:{q:string,a:string}[]=[],memo:Memo={}):Reply{
 const es=s.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사'),ids=new Set(es.map(e=>e.id));
 const p:Parsed=parse(text,es.map(e=>({id:e.id,name:e.name})),date);
 // 이름을 한 글자 틀리게 쓴 경우(김예지 → 김예시): 이름만 쓴 짧은 말이면 가장 비슷한 직원으로
 let guessed='';
 if(!p.employeeId){const word=text.trim().replace(/(님|씨)$/,'');if(/^[가-힣]{2,4}$/.test(word)){const near=es.filter(e=>e.name.length===word.length&&[...e.name].filter((c,i)=>c!==word[i]).length===1);if(near.length===1){p.employeeId=near[0].id;p.name=near[0].name;guessed=`'${word}'를 ${near[0].name}님으로 알아들었어요.`}}}
 // 앞 대화 기억: 이름 없이 말하면 방금 이야기한 직원, 이름만 말하면 아까 이름이 빠졌던 부탁에 붙인다.
 const nameOnly=!!p.employeeId&&!p.wage&&!p.shift&&!p.verb&&!p.topic;
 if(nameOnly&&memo.pending){const again=reply(memo.pending+' '+p.name,s,branch,date,now,faq,{...memo,pending:undefined});if(guessed)again.lines.unshift(guessed);return again}
 if(!p.employeeId&&memo.employeeId&&es.some(e=>e.id===memo.employeeId)&&(p.wage||p.shift||p.verb==='payslip-send'||p.verb==='payslip-view'||p.verb==='contract'||p.topic==='pay'||p.topic==='juhu'||/그\s*(사람|친구|직원)|걔|이\s*직원/.test(text))){p.employeeId=memo.employeeId;p.name=es.find(e=>e.id===memo.employeeId)!.name;if(!p.topic&&/급여|얼마/.test(text)&&!p.wage)p.topic='pay'}
 const who=es.find(e=>e.id===p.employeeId);
 const r:Reply={lines:[],actions:[]};
 const done=(x:Reply)=>{x.memo={employeeId:who?.id||memo.employeeId,lastVerb:p.verb||(p.wage?'wage':p.shift?'shift':memo.lastVerb),pending:x.lines.some(l=>l.includes('이름을 같이 말해')||l.includes('이름을 말해'))?text:undefined};return x};
 {const kb=!who&&!p.wage&&!p.shift?matchKB(text):null;if(kb){const o=answerKB(kb,{s,branch,date,now,es,ids,who,text});r.lines.push(...o.lines);r.actions.push(...o.actions);return done(r)}}
 if(nameOnly&&who){if(guessed)r.lines.push(guessed);const row=calculate(s,date.slice(0,7)).find(x=>x.employeeId===who.id);r.lines.push(`${who.name}님 · ${who.payType} ${won(who.wage)}원 · 주 ${who.weeklyHours}시간 · ${who.employment} · 계약 ${who.contract.status}`);if(row)r.lines.push(`이번 달 ${row.hours.toFixed(1)}시간 일했고 실수령 ${won(row.net)}원(확정 전 포함)이에요.`);if(missing(who).length)r.lines.push('덜 채워진 정보: '+missing(who).join(', '));r.lines.push('이어서 "시급 11000", "내일 9시부터 6시", "명세서 보내줘", "계약서 써줘"처럼 말하면 이 직원으로 처리해요.');r.actions.push({type:'openPayslip',employeeId:who.id,month:date.slice(0,7),label:'명세서 보기'},{type:'link',href:'/contracts',label:'계약서 만들기·보내기'});return done(r)}
 const month=date.slice(0,7),run=(s.payrollRuns as any)[month+':'+branch],prevMonth=new Date(Date.parse(month+'-01T00:00:00Z')-86400000).toISOString().slice(0,7),prevRun=(s.payrollRuns as any)[prevMonth+':'+branch];
 if(p.wage){
  if(who){r.lines.push(`${who.name}님 ${p.wage.payType}을 ${won(who.wage)}원 → ${won(p.wage.wage)}원으로 바꿀까요?`);{const min=ratesFor(Number(date.slice(0,4))).minimumWage;if(p.wage.payType==='시급'&&p.wage.wage<min)r.lines.push(`${date.slice(0,4)}년 최저시급(${won(min)}원)보다 낮아요. 다시 확인해 주세요.`)}r.actions.push({type:'setWage',employeeId:who.id,...p.wage,label:'임금 바꾸기'});if(memo.lastVerb==='contract'||/계약/.test(text)){r.lines.push('임금을 바꾼 뒤 계약서를 만들면 이 금액이 계약서에 들어가요.');r.actions.push({type:'link',href:'/contracts',label:'계약서 만들기·보내기'})}}
  else{const nm=/([가-힣]{2,4})\s*(?:님|씨)?\s*(?:시급|일급|월급|일당)/.exec(text)?.[1];if(nm){r.lines.push(`'${nm}'님은 아직 직원 목록에 없어요. 이 조건으로 새 직원 등록 화면을 열까요?`);r.actions.push({type:'register',name:nm,...p.wage,label:'새 직원 등록하기'})}else r.lines.push('누구의 임금인지 이름을 같이 말해 주세요. 예: 김민지 시급 10500')}
 }
 if(p.shift){
  if(who){const x=p.shift,clash=s.shifts.find(y=>y.employeeId===who.id&&y.date===x.date);r.lines.push(`${who.name}님 ${dlabel(x.date)} ${x.start}–${x.end} 근무(휴게 ${x.breakMinutes}분)를 근무표에 넣을까요?${x.guessedDate?' 날짜를 말하지 않아서 오늘로 넣었어요.':''}`);if(clash)r.lines.push(`그날 이미 ${clash.start}–${clash.end} 근무가 있어요. 하나 더 넣어져요.`);r.actions.push({type:'addShift',employeeId:who.id,date:x.date,start:x.start,end:x.end,breakMinutes:x.breakMinutes,label:'근무표에 넣기'})}
  else if(!p.wage)r.lines.push('누구의 근무인지 이름을 같이 말해 주세요. 예: 김민지 내일 9시부터 6시 근무');
 }
 if(p.verb==='payslip-send'){
  const target=run?.locked?run:prevRun?.locked?prevRun:null,key=target?(target===run?month:prevMonth)+':'+branch:'';
  if(!target){r.lines.push('확정된 급여가 없어서 보낼 명세서가 없어요. 급여를 먼저 검토·확정해 주세요.');r.actions.push({type:'go',target:'payroll',label:'급여 화면 열기'})}
  else{const rows=(target.rows as any[]).filter(x=>!who||x.employeeId===who.id);if(!rows.length)r.lines.push(`${who?.name}님은 ${target.month} 확정 급여에 없어요.`);else{r.lines.push(`${target.month} 확정 명세서를 ${who?who.name+'님에게':`${rows.length}명 모두에게`} 직원 앱으로 보낼까요? 이미 보낸 사람에게는 다시 가지 않아요.`);r.actions.push({type:'sendPayslip',runKey:key,employeeIds:rows.map(x=>x.employeeId),label:'명세서 보내기'})}}
 }
 if(p.verb==='payslip-view'){if(who){r.lines.push(`${who.name}님 ${Number(month.slice(5))}월 명세서를 열게요.`);r.actions.push({type:'openPayslip',employeeId:who.id,month,label:'명세서 보기'})}else{r.lines.push('누구 명세서인지 이름을 말해 주세요. 급여 화면에서 전체를 볼 수도 있어요.');r.actions.push({type:'go',target:'payroll',label:'급여 화면 열기'})}}
 if(p.verb==='contract'){r.lines.push(who?`${who.name}님 전자근로계약서를 만들고 서명 요청을 보낼 수 있어요. 입력된 근로조건이 그대로 들어가요.`:'전자근로계약서 화면에서 직원을 고르면 입력된 근로조건으로 계약서가 만들어져요.');r.actions.push({type:'link',href:'/contracts',label:'계약서 만들기·보내기'})}
 if(p.verb==='qr'){r.lines.push('매장 출퇴근 QR을 띄울게요. 직원은 이 QR을 찍어야 출근·퇴근·휴게가 기록돼요.');r.actions.push({type:'qr',label:'QR 띄우기'})}
 if(p.verb==='register'){r.lines.push('새 직원은 가입 링크를 보내면 직원이 직접 정보를 넣고, 사장님은 승인함에서 수락만 하면 돼요. 직접 입력할 수도 있어요.');r.actions.push({type:'go',target:'employees',label:'직원 관리 열기'})}
 if(r.lines.length)return done(r);
 // 질문 100가지(가게 기록 답 · 노무 상식 · 사용법). 특정 직원의 주휴·급여 질문은 아래 개인 답이 먼저.
 {const kb=matchKB(text);if(kb&&!(who&&(p.topic==='juhu'||p.topic==='pay'))){const o=answerKB(kb,{s,branch,date,now,es,ids,who,text});r.lines.push(...o.lines);r.actions.push(...o.actions);return done(r)}}
 const tol=((s.settings as any).attendanceTolerance||'normal'),f=checkDay(date,s.shifts.filter(x=>ids.has(x.employeeId)),s.attendance.filter(a=>ids.has(a.employeeId)),tol,now),board=todayBoard(s,branch,date,f,now,tol==='lenient'?10:tol==='strict'?0:5);
 switch(p.topic){
  case 'working':{const w=board.rows.filter(x=>['working','late','extra'].includes(x.status)),left=board.rows.filter(x=>['planned','noshow'].includes(x.status));
   r.lines.push(w.length?`지금 ${w.length}명 일하고 있어요: ${w.map(x=>x.name).join(', ')}.`:'지금 일하는 사람은 없어요.');if(left.length)r.lines.push(`아직 출근 전: ${left.map(x=>x.name+'('+x.start+')').join(', ')}.`);r.actions.push({type:'go',target:'attendance',label:'출퇴근 기록 보기'});break}
  case 'alerts':{const al=homeAlerts(s,branch,date,board);if(al.length){r.lines.push(...al.slice(0,5).map(a=>a.title+' — '+a.detail));r.tone='amber'}else r.lines.push('오늘은 지각·QR 누락이 없어요.');r.actions.push({type:'go',target:'attendance',label:'출퇴근 기록 보기'});break}
  case 'labor':{const rows=calculate(s,month).filter(x=>ids.has(x.employeeId));r.lines.push(`${Number(month.slice(5))}월 지금까지 지급 합계 ${won(rows.reduce((n,x)=>n+x.gross,0))}원, 실수령 합계 ${won(rows.reduce((n,x)=>n+x.net,0))}원이에요${run?.locked?' (확정)':' (확정 전)'}.`);r.lines.push(`근무표대로 다 일하면 이번 달 인건비는 약 ${won(plannedLabor(s,branch,month))}원이에요.`);r.actions.push({type:'go',target:'payroll',label:'급여 화면 열기'});break}
  case 'pay':{const row=calculate(s,month).find(x=>x.employeeId===who!.id);r.lines.push(row?`${who!.name}님 ${Number(month.slice(5))}월: ${row.hours.toFixed(1)}시간 · 지급 ${won(row.gross)}원 · 공제 ${won(row.deduction)}원 · 실수령 ${won(row.net)}원${run?.locked?'':' (확정 전)'}.`:`${who!.name}님 이번 달 급여 기록이 없어요.`);r.actions.push({type:'openPayslip',employeeId:who!.id,month,label:'명세서 보기'});break}
  case 'juhu':{const mon=mondayOf(date),h=s.shifts.filter(x=>x.employeeId===who!.id&&x.date>=mon&&x.date<=addDays(mon,6)).reduce((n,x)=>n+duration(x.start,x.end,x.breakMinutes),0);r.lines.push(`${who!.name}님 이번 주 근무표는 ${h.toFixed(1)}시간이에요. ${h>=15?'15시간 이상이라 주휴수당 대상이에요(그 주 소정근로일을 다 나오면).':'15시간 미만이라 주휴수당은 없어요.'}`);break}
  case 'schedule':{const nextMon=addDays(mondayOf(date),7),n=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=nextMon&&x.date<=addDays(nextMon,6)).length;r.lines.push(n?`다음 주 근무 ${n}개가 잡혀 있어요.`:'다음 주 근무표가 비어 있어요. 지난주 복사로 채울 수 있어요.');r.actions.push({type:'go',target:'schedule',label:'근무표 열기'});break}
  case 'leave':{r.lines.push('휴가와 대타·교대 요청은 직원이 올리면 휴가·공지 화면에서 승인해요. 승인하면 근무표가 바뀌어요.');r.actions.push({type:'go',target:'operations',label:'휴가·공지 열기'});break}
  case 'analyze':{const a=analyze(s,branch,date,now);r.lines.push(...a.map(x=>x.text));const t=a.find(x=>x.target);if(t)r.actions.push({type:'go',target:t.target!,label:'관련 화면 열기'});break}
  case 'help':r.lines.push('이렇게 말해 보세요.','· 김민지 시급 10500','· 김민지 내일 9시부터 6시 근무','· 김민지 명세서 보내줘 / 명세서 다 보내줘','· 오늘 누가 일해? · 누가 지각했어?','· 이번 달 인건비 · 김민지 이번 달 급여','· 분석해줘 · QR 띄워줘','한 번 말한 직원은 기억해서, 다음엔 이름 없이 "시급 11000"처럼 말해도 돼요.');break;
 }
 if(!r.lines.length){const hits=searchAnswers(faq,text,2);if(hits.length)for(const h of hits)r.lines.push(h.q+' — '+h.a);else r.lines.push('그 말은 아직 잘 모르겠어요. "도움말"이라고 쓰면 제가 할 수 있는 일을 알려 드려요.')}
 return done(r);
}
export {KB,matchKB,answerKB} from './assistant-kb';
