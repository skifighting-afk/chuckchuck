export function koreanInstant(value:string):string|null{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
 const date=new Date(value+':00+09:00');if(!Number.isFinite(date.getTime()))return null;
 return new Date(date.getTime()+9*3600000).toISOString().slice(0,16)===value?date.toISOString():null;
}
export function correctionInputError(f:{start:string,end:string,breakMinutes:number,reason:string}):string|null{
 const start=koreanInstant(f.start),end=f.end?koreanInstant(f.end):null;
 if(!start)return '출근 날짜와 시간을 모두 입력해 주세요.';
 if(f.end&&!end)return '퇴근 날짜와 시간을 확인해 주세요.';
 if(end&&Date.parse(end)<=Date.parse(start))return '퇴근은 출근보다 뒤여야 해요. 밤샘 근무라면 다음 날 날짜를 골라 주세요.';
 if(!Number.isFinite(f.breakMinutes)||f.breakMinutes<0||f.breakMinutes>1440)return '휴게시간은 0~1440분으로 입력해 주세요.';
 if(end&&f.breakMinutes>=(Date.parse(end)-Date.parse(start))/60000)return '휴게시간이 전체 근무시간보다 길거나 같아요.';
 if(!f.reason.trim())return '바꾸는 이유를 짧게 적어 주세요.';
 return null;
}
