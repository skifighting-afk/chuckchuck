import type {DayRow} from './attendance-check';

/** Presentation only. Missing punches cannot establish an employee's absence. */
export function attendanceStatusLabel(x:{kind:string;minutes?:number}){
 if(x.kind==='결근')return '기록 누락 확인';
 if(x.kind==='미출근')return '출근 기록 대기';
 if(x.kind==='출근 전')return '예정 · 출근 대기';
 return x.kind+(x.minutes?` ${x.minutes}분`:'');
}
const hm=(ms:number)=>Number.isFinite(ms)?new Date(ms+9*3600000).toISOString().slice(11,16):'확인 필요';
const elapsed=(ms:number)=>{const seconds=Math.abs(ms)/1000,m=Math.floor(seconds/60),s=Number((seconds-m*60).toFixed(3));return (m?`${m}분`:'')+(s?`${m?' ':''}${s}초`:'')||'0분'};
const delta=(actual:number,planned:number)=>actual===planned?'예정과 같음':`${elapsed(actual-planned)} ${actual>planned?'늦음':'빠름'}`;
export function attendanceEvidence(r:DayRow,toleranceMinutes:number){
 const tol=`현재 허용 ${toleranceMinutes}분 · 지각·조퇴 표시 기준`,kinds=r.statuses.map(x=>x.kind);
 if(!r.records.length){
  if(kinds.includes('휴가'))return '승인된 휴가예요. 출근 기록을 기다리지 않아요.';
  if(kinds.includes('출근 전'))return `예정 시각 전이거나 현재 허용 범위 안이에요. ${tol}`;
  return `출근 기록이 없어요. 결근 여부와 찍기 누락은 확인이 필요해요. ${tol}`;
 }
 if(!r.shift)return `근무표 밖 기록이에요. 예정 근무와 연결되는지 확인해 주세요. ${tol}`;
 const s=r.shift,ss=Date.parse(`${s.date}T${s.start}:00+09:00`),overnight=s.end<=s.start,se=Date.parse(`${s.date}T${s.end}:00+09:00`)+(overnight?86400000:0);
 const records=[...r.records].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)),first=records[0],last=records.at(-1)!;
 const start=`예정 ${s.start} · 출근 ${hm(Date.parse(first.start))} (${delta(Date.parse(first.start),ss)})`;
 const end=records.some(a=>!a.end)?'퇴근 기록 없음 · 근무 중인지 찍기 누락인지 확인해 주세요':`예정 ${overnight?'다음 날 ':''}${s.end} · 퇴근 ${hm(Date.parse(last.end!))} (${delta(Date.parse(last.end!),se)})`;
 const status=kinds.includes('정상')?' · 지각·조퇴 표시 없음':'';
 return `${records.length>1?`기록 ${records.length}건 · 첫 출근 / 마지막 퇴근 기준. `:''}${start} / ${end}. ${tol}${status}`;
}
