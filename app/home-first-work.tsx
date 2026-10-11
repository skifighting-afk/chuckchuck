import {homeFirstWork} from '../lib/home-first-work';
import type {Team} from '../lib/team-model';
import {useStartGuide} from './start-guide-store';
import {questHidden} from './quests';
export function HomeFirstWork({state,branch,onRegister,onSchedule,onAttendance}:{state:Team;branch:string;onRegister:()=>void;onSchedule:()=>void;onAttendance:()=>void}){
 const guide=useStartGuide(),{steps,next}=homeFirstWork(state,branch);
 if(!next||questHidden(guide.data?.preferences))return null;
 const act=next.id==='employees'?onRegister:next.id==='schedule'?onSchedule:onAttendance;
 return <section className="home-first-work" aria-label="우리 매장 시작 순서"><p className="home-first-kicker">처음이라면, 여기부터</p><ol>{steps.map((s,i)=><li key={s.id} className={s.done?'done':s.id===next.id?'current':''} aria-current={s.id===next.id?'step':undefined}><span aria-hidden="true">{s.done?'✓':i+1}</span>{s.label}{s.done&&<span className="sr-only"> · 기록 있음</span>}</li>)}</ol><h2>{next.label}부터 해 볼까요?</h2><p>{next.reason}</p>{next.id==='attendance'&&<p className="home-first-note">첫 출근 전에는 기록이 없어도 괜찮아요. 안내를 끝내기 위해 출근 기록을 만들 필요는 없어요.</p>}<button type="button" className="home-main-action" onClick={act}>{next.action} →</button></section>;
}
