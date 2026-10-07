// 작업 096 오늘 할 일 · 작업 097 월말 마감 체크리스트 · 작업 035 지급일 경고
// 화면과 테스트가 같은 계산을 쓴다. 입력은 가게 상태(Team)와 화면이 따로 받아 온 운영 정보(휴가·대타).
import {type Team,kdate,ordinaryHourly,missing,duration} from './team-model';
import {ratesFor} from './pay-rules';
import {holidaysFor} from './holidays';
export type Target='attendance'|'employees'|'operations'|'contracts'|'payroll'|'schedule'|'reports';
export type Task={key:string,label:string,count:number,target:Target};
export type Extras={pendingLeaves?:number,pendingSwaps?:number,unsentPayslips?:number};
const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function todayTasks(s:Team,branch:string,today:string,x:Extras={}):Task[]{
 const es=s.employees.filter(e=>e.branchId===branch),ids=new Set(es.map(e=>e.id)),active=es.filter(e=>e.status!=='퇴사');
 const list:Task[]=[
  {key:'corrections',label:'출퇴근 수정 요청 승인',count:s.requests.filter(r=>r.status==='승인 대기'&&ids.has(r.before.employeeId)).length,target:'attendance'},
  {key:'leaves',label:'휴가 승인',count:x.pendingLeaves||0,target:'operations'},
  {key:'swaps',label:'대타·교대 승인',count:x.pendingSwaps||0,target:'operations'},
  {key:'clockout',label:'퇴근 기록 누락(어제 이전)',count:s.attendance.filter(a=>ids.has(a.employeeId)&&!a.end&&kdate(a.start)<today).length,target:'attendance'},
  {key:'contracts',label:'근로계약서 미체결',count:active.filter(e=>e.employment!=='독립 용역'&&e.contract.status!=='체결 완료').length,target:'contracts'},
  {key:'payslips',label:'보낼 급여명세서',count:x.unsentPayslips||0,target:'payroll'},
  {key:'ending',label:'30일 안에 끝나는 기간제 계약',count:active.filter(e=>e.endDate&&e.endDate>=today&&e.endDate<=addDays(today,30)).length,target:'employees'},
  // 가이드 83: 음식점 직원 건강진단결과서(보건증) 만료일. 사장님이 넣은 날짜만 본다(검진 결과는 저장하지 않음).
  {key:'budget',label:'이번 달 예상 인건비가 예산의 90%를 넘음',count:budgetStatus(s,branch,today.slice(0,7))?.near?1:0,target:'reports'},
  {key:'healthCert',label:'30일 안에 끝나거나 지난 보건증',count:active.filter(e=>(e as any).healthCertUntil&&(e as any).healthCertUntil<=addDays(today,30)).length,target:'employees'},
  {key:'profile',label:'직원 정보 확인',count:es.filter(e=>missing(e).length).length,target:'employees'},
 ];
 return list.filter(t=>t.count>0);
}
export type Check={key:string,label:string,ok:boolean,detail:string,target:Target};
/** 급여 마감 전 확인: 퇴근 누락·정정 대기·최저시급·보험·계약·휴가 대기·지급일 */
export function monthChecklist(s:Team,branch:string,month:string,payDate?:string,x:{pendingLeavesInMonth?:number}={}):Check[]{
 const es=s.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사'),ids=new Set(s.employees.filter(e=>e.branchId===branch).map(e=>e.id)),year=Number(month.slice(0,4)),min=ratesFor(year).minimumWage;
 const inMonth=(iso:string)=>kdate(iso).startsWith(month);
 const open=s.attendance.filter(a=>ids.has(a.employeeId)&&!a.end&&inMonth(a.start));
 const pending=s.requests.filter(r=>r.status==='승인 대기'&&ids.has(r.before.employeeId)&&(inMonth(r.before.start)||inMonth(r.after?.start||r.before.start)));
 const low=es.filter(e=>{try{const h=ordinaryHourly(e as any).hourly;return h>0&&h<min}catch{return false}});
 const ins=es.filter(e=>e.income==='미검토'||Object.values(e.insurances||{}).some((i:any)=>i.status==='확인 필요'));
 const nocontract=es.filter(e=>e.employment!=='독립 용역'&&e.contract.status!=='체결 완료');
 const names=(l:{name:string}[])=>l.slice(0,5).map(e=>e.name).join(', ')+(l.length>5?` 외 ${l.length-5}명`:'');
 const pd=payDateIssue(payDate);
 return [
  {key:'clockout',label:'퇴근 누락',ok:!open.length,detail:open.length?`${open.length}건 — 퇴근 시각을 넣어야 근무시간이 계산돼요.`:'없음',target:'attendance'},
  {key:'corrections',label:'출퇴근 정정 대기',ok:!pending.length,detail:pending.length?`${pending.length}건 — 승인 또는 반려해 주세요.`:'없음',target:'attendance'},
  {key:'leaves',label:'휴가 승인 대기',ok:!x.pendingLeavesInMonth,detail:x.pendingLeavesInMonth?`${x.pendingLeavesInMonth}건 — 연차 차감·근무표에 영향을 줘요.`:'없음',target:'operations'},
  {key:'minwage',label:`${year}년 최저시급(${min.toLocaleString('ko-KR')}원)`,ok:!low.length,detail:low.length?`미달 ${names(low)} — 통상시급 기준으로 확인해 주세요.`:'모두 이상',target:'employees'},
  {key:'insurance',label:'소득 구분·4대보험 상태',ok:!ins.length,detail:ins.length?`확인 필요 ${names(ins)}`:'모두 확인됨',target:'employees'},
  {key:'contract',label:'근로계약서',ok:!nocontract.length,detail:nocontract.length?`미체결 ${names(nocontract)}`:'모두 체결',target:'contracts'},
  ...(payDate?[{key:'paydate',label:'지급일',ok:!pd,detail:pd||payDate+' 평일',target:'payroll' as Target}]:[]),
 ];
}
/** 작업 035: 지급일이 주말·공휴일이면 경고(근로기준법상 정기 지급일 원칙 — 미리 지급하는 것이 안전) */
export function payDateIssue(date?:string){
 if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
 const wd=new Date(date+'T00:00:00Z').getUTCDay(),hol=holidaysFor(Number(date.slice(0,4)),true).get(date);
 if(hol)return `${date}은 ${hol}(공휴일)이에요. 은행 이체가 늦어질 수 있으니 전 영업일에 지급하는 것을 권해요.`;
 if(wd===0||wd===6)return `${date}은 ${wd===0?'일요일':'토요일'}이에요. 전 영업일(금요일)에 지급하는 것을 권해요.`;
 return '';
}

/** 가이드 77: 그달 근무표 기준 예상 인건비(인건비 리포트의 '계획 인건비'와 같은 식) */
export function plannedLabor(s:Team,branch:string,month:string){
 const employees=s.employees.filter(e=>e.branchId===branch),ids=new Set(employees.map(e=>e.id)),shifts=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date.startsWith(month));
 return shifts.reduce((n,x)=>{const e=employees.find(e=>e.id===x.employeeId)!;return n+(e.payType==='시급'?duration(x.start,x.end,x.breakMinutes)*e.wage:e.payType==='일급'&&shifts.find(y=>y.employeeId===x.employeeId&&y.date===x.date)?.id===x.id?e.wage:0)},0)+employees.filter(e=>e.payType==='월급'&&e.status!=='퇴사').reduce((n,e)=>n+e.wage,0);
}
export function budgetStatus(s:Team,branch:string,month:string){
 const budget=(s.settings as any).laborBudget;if(!budget)return null;
 const planned=Math.round(plannedLabor(s,branch,month));return {budget,planned,ratio:planned/budget,over:planned>budget,near:planned>=budget*0.9};
}

// 새 홈 화면(시안 A+B): 오늘 근무 막대. 근무표 한 줄마다 지금 상태를 붙이고, 막대를 그릴 시간 범위를 정한다.
export type BoardStatus='working'|'late'|'done'|'missed'|'noshow'|'planned'|'extra';
export type BoardRow={id:string,employeeId:string,name:string,start:string,end:string,from:number,to:number,status:BoardStatus,label:string};
const hourOf=(t:string)=>Number(t.slice(0,2))+Number(t.slice(3,5))/60;
const kTime=(iso:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
export function todayBoard(s:Team,branch:string,date:string,findings:{kind:string,employeeId:string,shiftId?:string,minutes?:number,attendanceId?:string}[],now=Date.now(),tolMinutes=5){
 const people=s.employees.filter(e=>e.branchId===branch),ids=new Set(people.map(e=>e.id)),name=(id:string)=>people.find(e=>e.id===id)?.name||'직원';
 const recs=s.attendance.filter(a=>ids.has(a.employeeId)&&kdate(a.start)===date);
 const rows:BoardRow[]=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date===date).sort((a,b)=>a.start.localeCompare(b.start)).map(x=>{
  const from=hourOf(x.start),to=hourOf(x.end)+(x.end<=x.start?24:0),f=findings.filter(f=>f.shiftId===x.id);
  const late=f.find(f=>f.kind==='지각'),mine=recs.filter(a=>a.employeeId===x.employeeId).sort((a,b)=>a.start.localeCompare(b.start)),att=mine.find(a=>!a.end||Date.parse(a.end)>now)||mine[mine.length-1];
  const open=att&&(!att.end||Date.parse(att.end)>now),status:BoardStatus=f.some(f=>f.kind==='결근')?'missed':open?(late?'late':'working'):att?'done':late?'late':'planned';
  // 출근 시각이 지났는데 아직 기록이 없으면(근무가 끝나기 전) '출근 기록 없음'
  const startMs=Date.parse(x.date+'T'+x.start+':00+09:00'),waited=Math.floor((now-startMs)/60000);
  if(status==='planned'&&waited>tolMinutes){const label=waited>=60?Math.floor(waited/60)+'시간 '+(waited%60)+'분째 출근 기록 없음':waited+'분째 출근 기록 없음';return {id:x.id,employeeId:x.employeeId,name:name(x.employeeId),start:x.start,end:x.end,from,to,status:'noshow' as BoardStatus,label};}
  const label=status==='missed'?'결근(기록 없음)':status==='late'?(late?.minutes||0)+'분 늦음':status==='working'?kTime(att!.start)+' 출근 · 근무 중':status==='done'?'퇴근 '+kTime(att!.end!):x.start+' 출근 예정';
  return {id:x.id,employeeId:x.employeeId,name:name(x.employeeId),start:x.start,end:x.end,from,to,status,label};
 });
 // 근무표에 없던 출근도 막대로 보여 준다
 for(const f of findings)if(f.kind==='예정 외 출근'){const a=recs.find(a=>a.id===f.attendanceId);if(!a)continue;const st=kTime(a.start),en=a.end?kTime(a.end):kTime(new Date(Math.max(now,Date.parse(a.start)+3600000)).toISOString());const from=hourOf(st);let to=hourOf(en);if(to<=from)to=from+1;rows.push({id:a.id,employeeId:a.employeeId,name:name(a.employeeId),start:st,end:a.end?en:'',from,to,status:a.end?'done':'extra',label:a.end?'예정 외 · 퇴근 '+en:'예정 외 출근 · 근무 중'})}
 const nowH=hourOf(kTime(new Date(now).toISOString()));
 let lo=Math.floor(Math.min(9,...rows.map(r=>r.from))),hi=Math.ceil(Math.max(lo+8,...rows.map(r=>r.to)));if(hi-lo>24)hi=lo+24;
 // 한 직원은 한 번만 센다(홈 제목과 '일하는 중' 묶음이 같은 숫자를 쓴다)
 const working=new Set(rows.filter(r=>r.status==='working'||r.status==='late'||r.status==='extra').map(r=>r.employeeId)).size;
 const left=rows.filter(r=>r.status==='planned').length;
 return {rows,lo,hi,now:nowH>=lo&&nowH<=hi?nowH:null,working,left,attention:rows.filter(r=>r.status==='late'||r.status==='missed'||r.status==='noshow').length};
}

// 홈 알림: 사장님이 지금 알아야 할 출퇴근 문제(QR 안 찍음 등). 급한 순서대로.
export type HomeAlert={key:string,tone:'red'|'amber',title:string,detail:string,target:Target};
export function homeAlerts(s:Team,branch:string,date:string,board:{rows:BoardRow[]}):HomeAlert[]{
 const out:HomeAlert[]=[];const ids=new Set(s.employees.filter(e=>e.branchId===branch).map(e=>e.id)),name=(id:string)=>s.employees.find(e=>e.id===id)?.name||'직원';
 for(const r of board.rows){
  if(r.status==='noshow')out.push({key:'noshow-'+r.id,tone:'red',title:`${r.name}님이 출근 QR을 아직 안 찍었어요`,detail:`${r.start} 출근 예정 · ${r.label}`,target:'attendance'});
  else if(r.status==='missed')out.push({key:'missed-'+r.id,tone:'red',title:`${r.name}님 출근 기록이 없어요`,detail:`${r.start}–${r.end} 근무가 기록 없이 끝났어요`,target:'attendance'});
  else if(r.status==='late')out.push({key:'late-'+r.id,tone:'amber',title:`${r.name}님 ${r.label}`,detail:`${r.start} 출근 예정이었어요`,target:'attendance'});
 }
 for(const a of s.attendance)if(ids.has(a.employeeId)&&!a.end&&kdate(a.start)<date)out.push({key:'out-'+a.id,tone:'amber',title:`${name(a.employeeId)}님이 퇴근 QR을 안 찍었어요`,detail:`${Number(kdate(a.start).slice(5,7))}월 ${Number(kdate(a.start).slice(8))}일 출근 뒤 퇴근 기록이 없어요`,target:'attendance'});
 return out.sort((a,b)=>(a.tone===b.tone?0:a.tone==='red'?-1:1));
}
