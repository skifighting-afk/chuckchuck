import {latestClockRecord,clockRecordTime} from '../lib/clock-receipt';
import type {Team} from '../lib/team-model';
export function ClockReceipt({state,selfId,demo}:{state:Team,selfId:string,demo:boolean}){
 const self=state.employees.find(e=>e.id===selfId),record=latestClockRecord(state.attendance,selfId);
 if(!self||!record)return null;
 const branch=state.branches.find(b=>b.id===self.branchId);
 return <section className="clock-receipt" aria-label="최근 저장된 출퇴근 기록" aria-live="polite" aria-atomic="true"><div><p>{demo?'체험 · 예시 기록':'최근 저장된 출퇴근 기록'}</p><h3>{self.name}</h3><p>현재 소속 매장: {branch?.name||'확인 필요'} · 기록 당시 매장을 뜻하지 않아요.</p></div><dl><div><dt>출근 기록</dt><dd><time dateTime={record.start}>{clockRecordTime(record.start)}</time></dd></div><div><dt>퇴근 기록</dt><dd>{record.end?<time dateTime={record.end}>{clockRecordTime(record.end)}</time>:'아직 퇴근 기록이 없어요'}</dd></div></dl><p className="clock-receipt-note">{demo?'실제 출퇴근 기록이 아닙니다.':'한국 시간 기준 · 저장된 시각입니다. 휴대폰에만 보관한 오프라인 요청은 반영 전까지 여기에 표시되지 않아요.'}</p></section>;
}
