import type {DayRow} from '../lib/attendance-check';
import {attendanceEvidence,attendanceStatusLabel} from '../lib/attendance-display';
export function AttendanceEvidence({row,toleranceMinutes}:{row:DayRow,toleranceMinutes:number}){
 return <div className="attendance-evidence"><div className="attendance-evidence-status">{row.statuses.map((x,i)=><span className={'badge '+(['결근','미출근','미퇴근','지각','조퇴'].includes(x.kind)?'amber':'neutral')} key={i}>{attendanceStatusLabel(x)}</span>)}</div><p>{attendanceEvidence(row,toleranceMinutes)}</p></div>;
}
