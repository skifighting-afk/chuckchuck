type ClockRecord={id:string,employeeId:string,start:string,end:string|null};
export function latestClockRecord<T extends ClockRecord>(records:T[],employeeId:string):T|null{
 return records.reduce<T|null>((latest,record)=>record.employeeId===employeeId&&Number.isFinite(Date.parse(record.start))&&(!latest||Date.parse(record.start)>Date.parse(latest.start))?record:latest,null);
}
export function clockRecordTime(value:string):string{
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '확인 필요';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 return `${p('year')}. ${p('month')}. ${p('day')}. ${p('hour')}:${p('minute')}`;
}
