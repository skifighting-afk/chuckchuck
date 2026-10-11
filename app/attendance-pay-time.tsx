import {attendancePayTime} from '../lib/work-context';
import {durationLabel} from '../lib/payroll-display';
import {type Team,clock,kdate} from '../lib/team-model';
export function AttendancePayTime({record,locked}:{record:Team['attendance'][number];locked:boolean}){
 const t=attendancePayTime(record,locked),label=(minutes:number|null)=>minutes===null?'계산 대기':durationLabel(minutes/60);
 return <details className="attendance-pay-time"><summary>급여 시간 확인 · {label(t.paidMinutes)}</summary><dl><div><dt>찍힌 전체 구간</dt><dd>{label(t.rawMinutes)}{record.end&&<small>{clock(record.start)}–{clock(record.end)}{kdate(record.start)!==kdate(record.end)?' · 다음 날 퇴근':''}</small>}</dd></div><div><dt>기록된 휴게</dt><dd>{durationLabel(t.breakMinutes/60)}</dd></div><div><dt>급여 계산용 인정 시간</dt><dd>{label(t.paidMinutes)}{t.changed&&<small>저장된 인정 규칙 적용</small>}</dd></div><div><dt>급여 상태</dt><dd>{t.status}</dd></div></dl><p>{locked?'아래는 현재 출퇴근 기록이에요. 확정한 급여는 해당 월 명세서에 보관된 금액과 근거를 확인해 주세요.':'퇴근을 마친 인정 시간에서 휴게를 빼서 계산해요. 시급·일급은 기록을, 월급은 등록 금액과 재직 기간 등을 함께 반영해요. 수당·공제를 검토한 뒤 급여를 확정해요.'}</p></details>;
}
