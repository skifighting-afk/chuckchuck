'use client';
// 개선 2차 직원 화면 묶음: 오늘 한 장(B091·B092·B095·B010·B094·B124·B115), 칭찬 카드(B078), 매장 정보(B109·B123·B110),
// 근무 전 알림 시간(B101), 쉬고 싶은 날(B036), 근무표 나오는 날(B026), 직원 도움말(B100)
import {useState} from 'react';
import {L} from '../lib/staff-i18n';
import {type Team} from '../lib/team-model';
import {untilNext,payDayLeft,punctuality} from '../lib/improve2';

const W='일월화수목금토';
const todayK=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;

export function StaffToday2({state,selfId}:{state:Team,selfId:string}){
 const me:any=state.employees.find(e=>e.id===selfId);if(!me)return null;
 const t=todayK(),now=Date.now(),nx=untilNext(state.shifts as any,selfId,now),pd=payDayLeft(t,me.payDay||10),p=punctuality(state.shifts as any,state.attendance as any,selfId,t.slice(0,7),5,now);
 const note=(state.settings as any).more?.todayNote,evs=((state as any).events||[]).filter((x:any)=>x.date>=t&&x.date<=new Date(Date.parse(t)+6*86400000).toISOString().slice(0,10));
 const praise=(me.extra?.praise||[]).slice(-3).reverse(),b:any=state.branches[0],due=(state.settings as any).more?.scheduleDue;
 const first=!state.attendance.some(a=>a.employeeId===selfId)&&b?.info?.firstDay;
 return <section className="panel t-gap staff-today2" aria-labelledby="st2-title"><div className="panel-heading"><h2 id="st2-title">{L('오늘 한눈에')}</h2></div><div className="t-panelbody">
  {note?.date===t&&<p className="notice" role="note">📌 <b>{L('오늘 사장님 지시')}</b> {note.text}</p>}
  {first&&<p className="notice">👋 <b>{L('첫 출근 안내')}</b> {b.info.firstDay}</p>}
  <div className="staff-stats">
   <div><span>{L('다음 근무까지')}</span><b>{nx?nx.text:L('없음')}</b>{nx&&<small>{md(nx.shift.date)} {nx.shift.start}–{nx.shift.end}</small>}</div>
   <div><span>{L('급여일')}</span><b>{pd.left?`D-${pd.left}`:L('오늘')}</b><small>{md(pd.date)}</small></div>
   <div><span>{L('이번 달 지각·조퇴')}</span><b>{p.late}·{p.early}</b><small>{p.count}{L('번 근무 중')}</small></div>
   <div><span>{L('남은 연차')}</span><b>{me.leaveBalance??0}<small>{L('일')}</small></b></div>
  </div>
  {evs.length>0&&<p>📅 {evs.map((x:any)=>`${md(x.date)} ${x.title}`).join(' · ')}</p>}
  {typeof due==='number'&&<p className="footnote">{L('다음 주 근무표는 매주')} {W[due]}{L('요일에 나와요.')}</p>}
  {praise.length>0&&<div className="praise-cards">{praise.map((x:any,i:number)=><p key={i} className="praise-card">💛 {x.text}<small> · {x.at.slice(5,10).replace('-','/')}</small></p>)}</div>}
 </div></section>;
}

/** B109 매장 전화 · B123 와이파이 · B121 비품 위치 */
export function StaffStoreInfo({state}:{state:Team}){
 const b:any=state.branches[0];if(!b)return null;const i=b.info||{};
 if(!b.phone&&!i.wifi&&!i.supplies)return null;
 return <section className="panel t-gap" aria-labelledby="ssi-title"><div className="panel-heading"><h2 id="ssi-title">{L('매장 정보')}</h2></div><div className="t-panelbody">
  {b.phone&&<p><a className="secondary" href={'tel:'+b.phone}>📞 {L('매장에 전화')} {b.phone}</a></p>}
  {i.wifi&&<p>📶 {i.wifi}{i.wifiPw&&<> · <button type="button" className="link-btn" onClick={()=>{void navigator.clipboard?.writeText(i.wifiPw)}}>{L('비밀번호 복사')}</button></>}</p>}
  {i.supplies&&<details><summary>{L('비품 위치')}</summary><p style={{whiteSpace:'pre-wrap'}}>{i.supplies}</p></details>}
 </div></section>;
}

/** B101 근무 전 알림 시간 · B036 쉬고 싶은 날 */
export function StaffPrefs({state,selfId,busy,mutate}:{state:Team,selfId:string,busy:boolean,mutate:(b:any)=>Promise<boolean>}){
 const me:any=state.employees.find(e=>e.id===selfId),[d,setD]=useState(''),[note,setNote]=useState(''),[msg,setMsg]=useState('');
 const wishes=((state as any).dayOffWishes||[]).filter((w:any)=>w.date>=todayK()).sort((a:any,b:any)=>a.date.localeCompare(b.date));
 return <section className="panel t-gap" aria-labelledby="sp-title"><div className="panel-heading"><h2 id="sp-title">{L('알림·쉬는 날')}</h2></div><div className="t-panelbody">
  <label>{L('근무 전 알림')} <select value={me?.extra?.beforeMin??''} disabled={busy} onChange={async e=>{if(await mutate({action:'setPref',beforeMin:Number(e.target.value)}))setMsg(L('알림 시간을 바꿨어요.'))}}><option value="" disabled>{L('매장 기본값')}</option><option value={0}>{L('받지 않기')}</option><option value={30}>30{L('분 전')}</option><option value={60}>1{L('시간 전')}</option><option value={120}>2{L('시간 전')}</option><option value={180}>3{L('시간 전')}</option></select></label>
  <h3>{L('쉬고 싶은 날')}</h3>
  {wishes.length>0&&<ul>{wishes.map((w:any)=><li key={w.id}>{md(w.date)}({W[new Date(w.date+'T00:00:00Z').getUTCDay()]}){w.note&&` · ${w.note}`} <button type="button" className="link-btn" disabled={busy} onClick={()=>mutate({action:'dayOffWish',date:w.date})}>{L('취소')}</button></li>)}</ul>}
  <div className="t-inline"><input type="date" aria-label={L('날짜')} min={todayK()} value={d} onChange={e=>setD(e.target.value)}/><input aria-label={L('메모')} maxLength={100} placeholder={L('예: 시험')} value={note} onChange={e=>setNote(e.target.value)}/><button type="button" className="secondary" disabled={busy||!d} onClick={async()=>{if(await mutate({action:'dayOffWish',date:d,note})){setD('');setNote('');setMsg(L('사장님께 알렸어요. 근무표를 짤 때 참고해요.'))}}}>{L('내기')}</button></div>
  <p className="footnote">{L('휴가 신청과 달라요. 근무표를 짜기 전에 참고용으로 알려 주는 날이에요.')}</p>
  {msg&&<p role="status" className="saas-success">{msg}</p>}
 </div></section>;
}

/** B100 직원 자주 묻는 10가지 */
const FAQ:[string,string][]=[
 ['QR이 안 찍혀요','매장 화면의 QR이 바뀌었을 수 있어요. 새로 고친 QR을 찍거나, 매장 코드 6자리를 입력하세요. 그래도 안 되면 사장님께 말하고 정정 요청을 보내세요.'],
 ['퇴근을 깜빡했어요','내 근무 화면 맨 위 안내에서 실제 퇴근 시각을 적어 정정 요청을 보내세요. 사장님이 승인하면 바뀌어요.'],
 ['주휴수당은 언제 받아요?','한 주에 15시간 이상 일하기로 했고, 그 주 정해진 날을 다 나오면 받아요. 내 근무 화면에서 이번 주 진행을 볼 수 있어요.'],
 ['급여가 이상해요','내 급여 → 명세서에서 이상한 항목 옆 "물어보기"를 누르세요. 사장님께 바로 전달돼요.'],
 ['대타를 구하고 싶어요','내 근무표에서 "대타·교대 구하기"를 누르세요. 동료가 맡고 사장님이 승인하면 근무표가 바뀌어요.'],
 ['연차는 몇 개예요?','오늘 한눈에의 "남은 연차"에 보여요. 1년 미만은 한 달 개근마다 1일씩 생겨요(5명 이상 매장).'],
 ['계약서·명세서는 어디서 봐요?','내 서류에서 계약서·명세서·증명서를 열고 저장할 수 있어요.'],
 ['연락처·계좌를 바꾸고 싶어요','내 정보에서 "정보 변경 요청"을 보내면 사장님이 반영해요.'],
 ['쉬고 싶은 날을 알리고 싶어요','알림·쉬는 날에서 날짜를 내면 사장님이 근무표 짤 때 참고해요. 확정된 휴가는 휴가 신청으로 내세요.'],
 ['그만두면 내 정보는요?','퇴사하면 매장 접근이 끝나요. 법으로 3년 보관하는 근로 서류 말고는 지울 수 있고, 내 자료는 미리 내려받을 수 있어요.'],
];
export function StaffFaq(){
 return <section className="panel t-gap" aria-labelledby="sfaq-title"><div className="panel-heading"><h2 id="sfaq-title">{L('자주 묻는 질문')}</h2></div><div className="t-panelbody">{FAQ.map(([q,a])=><details key={q}><summary>{L(q)}</summary><p>{L(a)}</p></details>)}</div></section>;
}
