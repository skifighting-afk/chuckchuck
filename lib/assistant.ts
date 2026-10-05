// 척척 비서: 화면마다 가게 데이터를 읽고 '지금 볼 것'을 짧게 알려 준다.
// 실제 대화형 AI가 아니라 정해진 규칙으로 계산한다(같은 데이터면 늘 같은 답). 숫자는 화면과 같은 함수를 쓴다.
import {type Team,kdate,missing,calculate} from './team-model';
import {todayTasks,todayBoard,homeAlerts,budgetStatus,type Target} from './close-check';
import {checkDay} from './attendance-check';

export type Brief={text:string,tone?:'red'|'amber'|'ok',target?:Target};
const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const mondayOf=(d:string)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));return t.toISOString().slice(0,10)};
const won=(n:number)=>Math.round(n).toLocaleString('ko-KR');

export function assistantBrief(s:Team,branch:string,page:string,date:string,now=Date.now()):Brief[]{
 const es=s.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사'),ids=new Set(es.map(e=>e.id));
 if(!es.length)return [{text:'등록된 직원이 없어요. 직원에게 가입 링크를 보내면 신청이 홈 승인함에 바로 떠요.',tone:'amber',target:'employees'}];
 const tol=((s.settings as any).attendanceTolerance||'normal');
 const findings=checkDay(date,s.shifts.filter(x=>ids.has(x.employeeId)),s.attendance.filter(a=>ids.has(a.employeeId)),tol,now);
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
  if(alerts.length)for(const a of alerts.slice(0,4))out.push({text:a.title+'. '+a.detail+'.',tone:a.tone});
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
