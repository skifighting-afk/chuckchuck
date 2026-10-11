/** Presentation only: calculations and exported decimal hours keep their precision. */
export function durationLabel(hours:number):string {
 if(!Number.isFinite(hours))return '—';
 const minutes=Math.round(Math.abs(hours)*60),h=Math.floor(minutes/60),m=minutes%60;
 return (hours<0&&minutes?'−':'')+(h?`${h}시간`:'')+(h&&m?' ':'')+(m||!h?`${m}분`:'');
}
type DisplayRow={employeeId?:string;payType?:string;warnings?:unknown[]};
type DisplayRun={locked?:boolean;paid?:Record<string,string>;at?:string};
export function payrollStage(row:DisplayRow,run?:DisplayRun):{label:string;tone:'muted'|'amber'|'green'} {
 if(run?.locked){const paid=row.employeeId?run.paid?.[row.employeeId]:undefined;return {label:paid?`지급 기록 · ${paid}`:'확정 · 지급 기록 전',tone:'green'}}
 return row.warnings?.length?{label:'예상 · 확인 필요',tone:'amber'}:{label:'예상 · 검토 전',tone:'muted'};
}
export function payrollTypeLabel(row:DisplayRow,employee?:{payType?:string},locked=false):string {
 const type=row.payType||(!locked?employee?.payType:undefined);
 return type==='시급'?'시급 · 출퇴근 기록 기준':type==='월급'?'월급 · 등록 조건 기준':type==='일급'?'일급 · 근무일 기준':'급여 유형 확인 필요';
}
export function payrollBasisLabel(run?:DisplayRun):string {
 if(!run?.locked)return '현재 저장된 기록 기준';
 const at=run.at?Date.parse(run.at):NaN;
 return Number.isFinite(at)?`${new Date(at+9*3600000).toISOString().slice(0,10)} 확정 기준`:'확정 당시 기록 기준';
}
