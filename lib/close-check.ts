// 작업 096 오늘 할 일 · 작업 097 월말 마감 체크리스트 · 작업 035 지급일 경고
// 화면과 테스트가 같은 계산을 쓴다. 입력은 가게 상태(Team)와 화면이 따로 받아 온 운영 정보(휴가·대타).
import {type Team,kdate,ordinaryHourly,missing} from './team-model';
import {ratesFor} from './pay-rules';
import {holidaysFor} from './holidays';
export type Target='attendance'|'employees'|'operations'|'contracts'|'payroll'|'schedule';
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
