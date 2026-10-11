import {workPeriod,type WorkView} from '../lib/work-context';
export function WorkContext({branchName,...period}:{branchName:string;page:string;month:string;day:string;week:string;scheduleView:WorkView;attendanceView:WorkView;weekStart:'mon'|'sun'}){
 const text=workPeriod(period);return text?<div className="owner-work-context" aria-label="현재 매장과 조회 기간"><b>{branchName}</b><span>{text}</span></div>:<span>{branchName} / {period.page}</span>;
}
