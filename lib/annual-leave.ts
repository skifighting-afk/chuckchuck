// 작업 029: 연차 자동 발생 (근로기준법 제60조, 입사일 기준)
// - 상시 5명 이상 사업장만 적용(제11조), 주 15시간 미만 초단시간 근로자 제외(제18조 제3항)
// - 1년 미만: 1개월 개근마다 1일, 최대 11일. 각 1일은 발생 후 1년 안에 사용(제60조 제7항 단서)
// - 1년 이상(80% 이상 출근): 15일, 최초 1년을 넘는 매 2년마다 1일 가산, 최대 25일. 발생 후 1년 안에 사용
// - 단시간 근로자: 통상 근로자 연차 × (주 소정근로시간 ÷ 40) × 8시간을 시간 단위로 부여(시행령 별표2 제4호)
// 출근율(개근·80%)은 기록만으로 확정할 수 없으므로 '개근 가정' 값이며 사장님이 확인 후 반영한다.
export type LeaveInput={joined:string,endDate?:string,status?:string,weeklyHours:number};
export type Grant={at:string,days:number,expires:string,kind:'월 개근'|'1년 근속'};
export type LeaveResult={eligible:boolean,reason:string,grants:Grant[],earned:number,ratio:number,hours:number,next:{at:string,days:number}|null};
const add=(d:string,months:number)=>{const [y,m,day]=d.split('-').map(Number),t=new Date(Date.UTC(y,m-1+months,1)),last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();t.setUTCDate(Math.min(day,last));return t.toISOString().slice(0,10)};
const half=(v:number)=>Math.round(v*2)/2;
/** asOf 날짜에 유효한(발생했고 아직 소멸하지 않은) 연차 발생분 */
export function annualLeave(e:LeaveInput,asOf:string,fivePlus:boolean):LeaveResult{
 const none=(reason:string):LeaveResult=>({eligible:false,reason,grants:[],earned:0,ratio:0,hours:0,next:null});
 if(!fivePlus)return none('상시 근로자 5명 미만 사업장은 연차 규정이 적용되지 않아요.');
 if(!(e.weeklyHours>=15))return none('주 15시간 미만 근로자는 연차가 발생하지 않아요.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.joined||'')||e.joined>asOf)return none('입사 전이에요.');
 const end=e.status==='퇴사'&&e.endDate&&e.endDate<asOf?e.endDate:asOf,ratio=Math.min(1,e.weeklyHours/40),all:Grant[]=[];
 // 1년 미만 월 개근분: 입사 n개월 다음 날 발생(n=1..11)
 for(let n=1;n<=11;n++){const at=add(e.joined,n);all.push({at,days:half(ratio),expires:add(at,12),kind:'월 개근'})}
 // 1년 이상: 매 입사 기념일 발생
 for(let y=1;y<=60;y++){const at=add(e.joined,12*y);all.push({at,days:half(Math.min(25,15+Math.floor((y-1)/2))*ratio),expires:add(at,12),kind:'1년 근속'})}
 const grants=all.filter(g=>g.at<=end&&g.expires>end),next=all.filter(g=>g.at>end).sort((a,b)=>a.at<b.at?-1:1)[0];
 const earned=grants.reduce((n,g)=>n+g.days,0);
 return {eligible:true,reason:ratio<1?`주 ${e.weeklyHours}시간 단시간 근로자라 통상 근로자의 ${Math.round(ratio*1000)/10}%로 비례 계산했어요.`:'개근(1년 이상은 80% 이상 출근)을 가정한 값이에요.',grants,earned,ratio,hours:earned*8,next:e.status==='퇴사'||!next?null:{at:next.at,days:next.days}};
}
/** 유효 발생분 중 이미 승인된 연차를 빼고 남은 일수 */
export function leaveBalanceFor(e:LeaveInput,leaves:{kind:string,status:string,start:string,days:number}[],asOf:string,fivePlus:boolean){
 const r=annualLeave(e,asOf,fivePlus);if(!r.eligible)return {...r,used:0,remaining:0};
 const from=r.grants.reduce((m,g)=>g.at<m?g.at:m,'9999-12-31'),used=leaves.filter(l=>l.kind==='연차'&&l.status==='승인'&&l.start>=from&&l.start<=asOf).reduce((n,l)=>n+l.days,0);
 return {...r,used,remaining:Math.max(0,half(r.earned-used))};
}
/** 미사용 연차수당 추정: 남은 일수(단시간은 이미 비례 환산) × 8시간 × 통상시급 */
export function unusedLeavePay(remaining:number,hourly:number){return Math.round(remaining*8*hourly)}
