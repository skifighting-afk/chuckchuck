'use client';
// 개선 2차(docs/handoff/개선현황표-2차.csv) 사장님 화면 묶음: 직원·근무표·출퇴근·리포트·설정·매장 정보
import {useEffect,useState} from 'react';
import {type Team,datePlus,won} from '../lib/team-model';
import {toXls} from '../lib/xls';
import {PUBLIC_HOLIDAYS} from '../lib/holidays';
import {changedCells,juhuShare,payCalendar,accountChangedSince,transferCheck,leavePayout,durunuri,dailyWorkerReport,holidayPremium,copyMonth,weekLoad,weekendCount,fillCandidates,scheduleGrid,readiness,missingInfo,tenureBadge,workHistory,punctuality,habitText,weekdayCost,ratioState,lateHotspots,swapTrend,riskFlags,yearOverYear,shiftKind,repeatsDue,payDayLeft,usageSummary,type Extra,type Repeat} from '../lib/improve2';

type Save=(n:Team)=>Promise<any>;
/** B028 근무표를 바꿀 때 직원 알림에 함께 보낼 사유(다음 저장 한 번에 쓰고 지움) */
export const changeNote={v:''};
const W='일월화수목금토';
const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;
const todayK=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const xls=(name:string,sheets:{name:string,rows:any[][]}[])=>{const u=URL.createObjectURL(new Blob([toXls(sheets)],{type:'application/vnd.ms-excel'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const ex=(e:any):Extra=>e.extra||{};
const prevMonth=(m:string)=>{const [y,mo]=m.split('-').map(Number);return new Date(Date.UTC(y,mo-2,1)).toISOString().slice(0,7)};
const dayHoliday=(d:string)=>(PUBLIC_HOLIDAYS[Number(d.slice(0,4))]||[]).find(([x])=>x===d)?.[1];
const tol=(s:Team)=>({lenient:10,normal:5,strict:0} as any)[(s.settings as any).attendanceTolerance||'normal'];

/* ───────── 직원 관리 ───────── */
/** B073 준비 배지 · B079 근속 · B086 빠진 정보 · B072 태그 */
export function StaffBadges({e}:{e:any}){
 const t=todayK(),r=readiness(e,t),miss=missingInfo(e),ten=tenureBadge(e.joined,t);
 return <span className="staff-badges">{ten&&<span className="badge-soft">🎉 {ten.label}</span>}<span className={r.done===r.total?'badge-ok':'badge-soft'} title={r.items.map(i=>(i.ok?'✓ ':'· ')+i.k).join(' ')}>준비 {r.done}/{r.total}</span>{miss.length>0&&<span className="badge-warn" title={'빠진 정보: '+miss.join(', ')}>빠짐 {miss.length}</span>}{(ex(e).tags||[]).map(x=><span key={x} className="badge-tag">#{x}</span>)}</span>;
}

/** B071 메모 · B072 태그 · B077 평가 · B078 칭찬 · B080 퇴사 사유 · B081 재입사 · B082 연락 순서 · B083 가능 업무 · B023 주 최대 시간 · B090 체류 기간 · B088 근무 이력 */
export function StaffMore2({s,es,busy,save,demo}:{s:Team,es:Team['employees'],busy:boolean,save:Save,demo?:boolean}){
 const [id,setId]=useState(''),[f,setF]=useState<Extra|null>(null),[msg,setMsg]=useState(''),[tag,setTag]=useState('');
 const e:any=es.find(x=>x.id===id);
 useEffect(()=>{setF(e?{...ex(e)}:null);setMsg('')},[id]);
 const put=async(extra:Extra,m:string)=>{if(await save({...s,employees:s.employees.map(x=>x.id===id?{...x,extra} as any:x)}))setMsg(m)};
 const allTags=[...new Set(es.flatMap(x=>ex(x).tags||[]))];
 const [tf,setTf]=useState('');
 const order=[...es].filter(x=>x.status!=='퇴사').sort((a,b)=>(ex(a).contactOrder??99)-(ex(b).contactOrder??99)).filter(x=>ex(x).contactOrder!=null);
 const exportStaff=()=>xls(`직원목록-${todayK()}.xls`,[{name:'직원',rows:[['이름','상태','업무','고용 형태','입사일','연락처','이메일','급여 형태','금액','급여일','태그','가능 업무','준비','빠진 정보'],...es.map((x:any)=>{const r=readiness(x,todayK());return [x.name,x.status,x.role,x.employment,x.joined,x.phone,x.email,x.payType,x.wage,x.payDay,(ex(x).tags||[]).join(' '),(ex(x).skills||[]).join(' '),`${r.done}/${r.total}`,missingInfo(x).join(', ')]})]}]);
 const history=()=>{const h=workHistory(e,s.shifts as any,s.attendance as any);const w=window.open('','_blank');if(!w)return;w.document.write(`<!doctype html><meta charset="utf-8"><title>${e.name} 근무 이력</title><style>body{font:14px sans-serif;padding:24px}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 10px}</style><h1>${e.name} 근무 이력</h1><p>입사일 ${h.joined||'-'} · 첫 출근 ${h.first||'-'} · ${e.status}${e.endDate?' · 끝 '+e.endDate:''}</p><h2>월별 근무</h2><table><tr><th>월</th><th>출근한 날</th><th>일한 시간</th></tr>${h.months.map(m=>`<tr><td>${m.month}</td><td>${m.days}일</td><td>${m.hours}시간</td></tr>`).join('')||'<tr><td colspan=3>기록 없음</td></tr>'}</table><h2>급여 변경</h2><table><tr><th>적용일</th><th>금액</th></tr>${h.wages.map((x:any)=>`<tr><td>${x.from}</td><td>${Number(x.wage).toLocaleString('ko-KR')}원</td></tr>`).join('')||'<tr><td colspan=2>변경 없음</td></tr>'}</table><p style="color:#666">척척사장에 남은 기록 기준 · ${todayK()} 출력</p>`);w.document.close();w.print()};
 return <section className="panel t-gap" aria-labelledby="sm2-title"><div className="panel-heading"><h2 id="sm2-title">직원 메모·태그·평가</h2><div className="t-inline"><button type="button" className="secondary" disabled={!!demo} onClick={async()=>{try{const r=await fetch('/api/staff-join');const d:any=await r.json();const c=d.codes?.[0]?.code;if(!c){setMsg('먼저 직원 관리 → 직원 가입 주소에서 가입 코드를 만들어 주세요.');return}const text=`[${s.store.name}] 척척사장으로 근무표·출퇴근·급여명세서를 봐요.\n아래 주소에서 이름과 전화번호로 가입해 주세요(1분).\n${location.origin}/j/${c}\n가입하면 사장님이 확인 후 연결해 드려요.`;await navigator.clipboard.writeText(text);setMsg('가입 안내 문구를 복사했어요. 단톡방이나 문자에 붙여 넣으세요.')}catch{setMsg('복사하지 못했어요. 직원 가입 주소 화면에서 직접 복사해 주세요.')}}}>가입 안내 문구 복사</button><button type="button" className="secondary" onClick={exportStaff}>직원 목록 엑셀</button></div></div><div className="t-panelbody">
  {allTags.length>0&&<p className="t-inline" role="group" aria-label="태그로 보기">{['',...allTags].map(t=><button key={t} type="button" className={tf===t?'primary':'secondary'} onClick={()=>setTf(t)}>{t?'#'+t:'전체'}</button>)}</p>}
  {tf&&<p className="footnote">#{tf}: {es.filter(x=>(ex(x).tags||[]).includes(tf)).map(x=>x.name).join(', ')}</p>}
  {order.length>0&&<p className="footnote"><b>급할 때 연락 순서</b> {order.map((x,i)=><span key={x.id}>{i+1}. {x.name}{x.phone&&<> <a href={'tel:'+x.phone}>전화</a></>}{i<order.length-1?' · ':''}</span>)}</p>}
  <label>직원 고르기 <select value={id} onChange={ev=>setId(ev.target.value)}><option value="">— 직원 —</option>{es.map(x=><option key={x.id} value={x.id}>{x.name}{x.status==='퇴사'?' (퇴사)':''}</option>)}</select></label>
  {e&&f&&<form onSubmit={ev=>{ev.preventDefault();void put(f,'저장했어요.')}}>
   <p><StaffBadges e={e}/></p>
   {missingInfo(e).length>0&&<p className="notice">빠진 정보: {missingInfo(e).join(', ')} — 직원 정보에서 채우거나 직원에게 '정보 변경 요청'을 부탁하세요.</p>}
   <div className="t-formgrid">
    <label>태그 <span className="t-inline">{(f.tags||[]).map(t=><button key={t} type="button" className="link-btn" onClick={()=>setF({...f,tags:(f.tags||[]).filter(x=>x!==t)})} aria-label={t+' 태그 지우기'}>#{t} ✕</button>)}<input value={tag} maxLength={12} placeholder="예: 학생, 주말만" onChange={ev=>setTag(ev.target.value)} onKeyDown={ev=>{if(ev.key==='Enter'&&tag.trim()){ev.preventDefault();setF({...f,tags:[...new Set([...(f.tags||[]),tag.trim()])].slice(0,10)});setTag('')}}}/></span></label>
    <label>가능 업무(쉼표로) <input value={(f.skills||[]).join(', ')} placeholder="오픈, 마감, 포스, 주방" onChange={ev=>setF({...f,skills:ev.target.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,10)})}/></label>
    <label>급할 때 연락 순서 <input type="number" min={1} max={99} value={f.contactOrder??''} onChange={ev=>setF({...f,contactOrder:ev.target.value?Number(ev.target.value):undefined})}/></label>
    <label>주 최대 근무 시간 <input type="number" min={0} max={80} value={f.maxWeek??''} placeholder="예: 14" onChange={ev=>setF({...f,maxWeek:ev.target.value?Number(ev.target.value):undefined})}/></label>
    <label>체류 기간 만료일(외국인 직원) <input type="date" value={f.visaUntil||''} onChange={ev=>setF({...f,visaUntil:ev.target.value||undefined})}/></label>
    {e.status==='퇴사'&&<><label>퇴사 사유 <select value={f.exitReason||''} onChange={ev=>setF({...f,exitReason:ev.target.value||undefined})}><option value="">—</option>{['학업·진로','이사','다른 일자리','근무 시간 안 맞음','건강','계약 만료','권고·해고','기타'].map(x=><option key={x}>{x}</option>)}</select></label>
     <label>다시 함께 일하기 <select value={f.rehire||''} onChange={ev=>setF({...f,rehire:ev.target.value as any})}><option value="">—</option><option>가능</option><option>불가</option></select></label></>}
   </div>
   <label>사장님 메모(직원에게 안 보여요) <textarea maxLength={2000} rows={3} value={f.memo||''} onChange={ev=>setF({...f,memo:ev.target.value})}/></label>
   <div className="actions"><button type="submit" className="primary" disabled={busy||demo}>저장</button><button type="button" className="secondary" onClick={history}>근무 이력 한 장</button></div>
   <details><summary>평가 메모 {(f.reviews||[]).length?`· ${(f.reviews||[]).length}개`:''}</summary><ReviewList list={f.reviews||[]} busy={busy||!!demo} placeholder="예: 3분기 — 마감 정리 꼼꼼함, 포스 교육 필요" onAdd={t=>put({...f,reviews:[...(f.reviews||[]),{at:new Date().toISOString(),text:t}].slice(-40)},'평가 메모를 남겼어요.')}/></details>
   <details><summary>칭찬 카드 {(f.praise||[]).length?`· ${(f.praise||[]).length}장`:''}</summary><p className="footnote">직원 화면 '내 근무'에 보여요.</p><ReviewList list={f.praise||[]} busy={busy||!!demo} placeholder="예: 바쁜 주말 대타 고마워요!" onAdd={t=>put({...f,praise:[...(f.praise||[]),{at:new Date().toISOString(),text:t}].slice(-100)},'칭찬 카드를 보냈어요.')}/></details>
  </form>}
  {msg&&<p role="status" className="saas-success">{msg}</p>}
 </div></section>;
}
function ReviewList({list,onAdd,busy,placeholder}:{list:{at:string,text:string}[],onAdd:(t:string)=>void,busy:boolean,placeholder:string}){
 const [t,setT]=useState('');
 return <><ul>{[...list].reverse().map((r,i)=><li key={i}><small>{r.at.slice(0,10)}</small> {r.text}</li>)}</ul><div className="t-inline"><input value={t} maxLength={300} placeholder={placeholder} onChange={e=>setT(e.target.value)} aria-label="새 메모"/><button type="button" className="secondary" disabled={busy||!t.trim()} onClick={()=>{onAdd(t.trim());setT('')}}>남기기</button></div></>;
}

/* ───────── 근무표 ───────── */
/** B022 다음 달 복제 · B034 주 시간 막대 · B023 최대 시간 · B024 주말 횟수 · B033 빈 칸 후보 · B040 엑셀 · B036 휴무 희망 · B026 공개 예정일 · B032 근무 종류 */
export function ScheduleMore2({s,es,branch,week,busy,save,avail}:{s:Team,es:Team['employees'],branch:string,week:string,busy:boolean,save:Save,avail?:Record<string,any>}){
 const month=week.slice(0,7),[msg,setMsg]=useState(''),[gap,setGap]=useState({date:week,start:'10:00',end:'15:00'});
 const load=weekLoad(s.shifts as any,es as any,week),wk=weekendCount(s.shifts as any,es as any,month),hasWk=wk.some(x=>x.n>0);
 const max=Math.max(40,...load.map(x=>x.hours));
 const wishes=((s as any).dayOffWishes||[]).filter((w:any)=>es.some(e=>e.id===w.employeeId)&&w.date>=week&&w.date<=datePlus(week,13));
 const due=(s.settings as any).more?.scheduleDue,ids=new Set(es.map(e=>e.id));
 const dup=async()=>{const r=copyMonth(s.shifts as any,month,ids,()=>crypto.randomUUID());if(!r.shifts.length){setMsg(`${Number(r.next.slice(5))}월에 옮길 근무가 없어요. 이미 있는 근무는 건너뛰어요.`);return}
  if(!confirm(`${Number(month.slice(5))}월 근무 ${r.shifts.length}개를 ${Number(r.next.slice(5))}월 같은 주·같은 요일로 복사할까요?${r.skipped?` (${r.skipped}개는 날짜가 없거나 이미 있어 건너뛰어요)`:''}`))return;
  if(await save({...s,shifts:[...s.shifts,...r.shifts] as any}))setMsg(`${Number(r.next.slice(5))}월 근무표에 ${r.shifts.length}개를 넣었어요. 공휴일·휴가는 확인해 주세요.`)};
 // B031 한 직원이 두 지점에서 겹치는 근무 · B039 공휴일 근무 가산 미리 보기(5명 이상)
 const others=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=week&&x.date<=datePlus(week,6));
 const clash=others.filter((a,i)=>others.some((b,j)=>j!==i&&a.employeeId===b.employeeId&&a.date===b.date&&((a as any).branchId||'')!==((b as any).branchId||'')&&a.start<b.end&&b.start<a.end)).filter((a,i,l)=>l.findIndex(x=>x.employeeId===a.employeeId&&x.date===a.date)===i);
 const hol=(s.settings as any).fivePlus?others.map(x=>({x,name:dayHoliday(x.date)})).filter(o=>o.name):[];
 const cand=fillCandidates(s.shifts as any,es as any,gap.date,gap.start,gap.end,avail||{},week).slice(0,6);
 const kinds=(()=>{const b:any=s.branches.find(b=>b.id===branch);const c:Record<string,number>={오픈:0,미들:0,마감:0};for(const x of s.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=week&&x.date<=datePlus(week,6)))c[shiftKind(x,b?.hours?.open,b?.hours?.close)]++;return c})();
 return <section className="panel t-gap" aria-labelledby="sch2-title"><div className="panel-heading"><h2 id="sch2-title">근무표 도우미</h2><div className="t-inline"><button type="button" className="secondary" onClick={()=>xls(`근무표-${week}.xls`,[{name:'근무표',rows:scheduleGrid(s.shifts as any,es as any,week,datePlus(week,6))}])}>이번 주 엑셀</button><button type="button" className="secondary" onClick={()=>{const [y,m]=month.split('-').map(Number);xls(`근무표-${month}.xls`,[{name:month,rows:scheduleGrid(s.shifts as any,es as any,`${month}-01`,new Date(Date.UTC(y,m,0)).toISOString().slice(0,10))}])}}>이번 달 엑셀</button><button type="button" className="secondary" disabled={busy} onClick={dup}>다음 달로 복제</button></div></div><div className="t-panelbody">
  <ChangeNoteField/>
  {typeof due==='number'&&<p className="notice">직원에게 안내: 다음 주 근무표는 매주 <b>{W[due]}요일</b>에 나와요.</p>}
  <p className="footnote">이번 주 근무 종류 · 오픈 {kinds.오픈} · 미들 {kinds.미들} · 마감 {kinds.마감}</p>
  <h3>직원별 이번 주 시간</h3>
  <ul className="week-load">{load.map(x=><li key={x.id}><span className="wl-name">{x.name}</span><span className="wl-bar" role="img" aria-label={`${x.hours}시간`}><i style={{width:Math.min(100,x.hours/max*100)+'%'}} className={x.over||x.over40?'over':''}/><b style={{left:15/max*100+'%'}} title="15시간(주휴)"/><b style={{left:40/max*100+'%'}} title="40시간"/>{x.max&&<b className="max" style={{left:Math.min(100,x.max/max*100)+'%'}} title={`최대 ${x.max}시간`}/>}</span><span>{x.hours}시간{x.juhu?' · 주휴':''}{x.over?` · ⚠ 최대 ${x.max}시간 넘음`:''}{x.over40?' · ⚠ 40시간 넘음':''}</span></li>)}</ul>
  <p className="footnote">막대 눈금: 15시간(주휴수당 생김) · 40시간(법정 근로시간). 직원별 최대 시간은 직원 관리 → 직원 메모에서 정해요.</p>
  {hasWk&&<><h3>{Number(month.slice(5))}월 주말 근무 횟수</h3><p>{wk.map(x=><span key={x.id} className="badge-soft">{x.name} {x.n}번</span>)}</p></>}
  <details><summary>인원이 모자란 시간에 넣을 사람 찾기</summary><div className="t-formgrid"><label>날짜 <input type="date" value={gap.date} onChange={e=>setGap({...gap,date:e.target.value})}/></label><label>시작 <input type="time" value={gap.start} onChange={e=>setGap({...gap,start:e.target.value})}/></label><label>끝 <input type="time" value={gap.end} onChange={e=>setGap({...gap,end:e.target.value})}/></label></div>
   {cand.length?<ul>{cand.map(c=><li key={c.id}>{c.name} · 이번 주 {c.hours}시간{c.fits?' · ✓ 가능 시간 냄':''}</li>)}</ul>:<p className="footnote">그 시간에 비어 있는 직원이 없어요.</p>}
   <p className="footnote">그 시간에 다른 근무가 없고, 주 최대 시간을 넘지 않는 직원이에요. 가능 시간을 낸 사람이 먼저 나와요.</p></details>
  {clash.length>0&&<p className="notice" role="alert">⚠ 두 지점 근무가 겹쳐요: {clash.map(x=>`${es.find(e=>e.id===x.employeeId)?.name} ${md(x.date)}`).join(', ')}</p>}
  {hol.length>0&&<p className="notice">공휴일 근무 가산(5명 이상 매장, 예상): {hol.map(({x,name})=>{const e:any=es.find(e=>e.id===x.employeeId);return `${e?.name} ${md(x.date)} ${name} +${won(holidayPremium(x as any,e?.payType==='시급'?e.wage:0,true))}원`}).join(' · ')}</p>}
  {(()=>{const prev=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=datePlus(week,-7)&&x.date<=datePlus(week,-1)).map(x=>({...x,date:datePlus(x.date,7)})),cur=others,df=changedCells(prev as any,cur as any);if(!prev.length||(!df.added.length&&!df.removed.length))return null;const nm=(id:string)=>es.find(e=>e.id===id)?.name;
   return <details><summary>지난주와 달라진 칸 {df.added.length+df.removed.length}개</summary><ul>{cur.filter(x=>df.added.includes(x.id)).map(x=><li key={x.id}>＋ {nm(x.employeeId)} {md(x.date)}({W[new Date(x.date+'T00:00:00Z').getUTCDay()]}) {x.start}–{x.end}</li>)}{df.removed.map((x:any,i:number)=><li key={'r'+i}>－ {nm(x.employeeId)} {md(x.date)}({W[new Date(x.date+'T00:00:00Z').getUTCDay()]}) {x.start}–{x.end} <small>(지난주엔 있었음)</small></li>)}</ul></details>})()}
  {wishes.length>0&&<><h3>쉬고 싶은 날 {wishes.length}건</h3><ul>{wishes.sort((a:any,b:any)=>a.date.localeCompare(b.date)).map((w:any)=><li key={w.id}>{md(w.date)}({W[new Date(w.date+'T00:00:00Z').getUTCDay()]}) {es.find(e=>e.id===w.employeeId)?.name}{w.note&&<small> · {w.note}</small>}{s.shifts.some(x=>x.employeeId===w.employeeId&&x.date===w.date)&&<span className="badge-warn"> 근무 있음</span>}</li>)}</ul></>}
  {msg&&<p role="status" className="saas-success">{msg}</p>}
 </div></section>;
}

/* ───────── 출퇴근 ───────── */
/** B017 사장님 메모 · B016 미퇴근 임시 마감 · B018 출근 습관 · B014 긴 기록 */
export function AttendanceMore2({s,es,day,busy,mutate}:{s:Team,es:Team['employees'],day:string,busy:boolean,mutate:(b:any)=>Promise<any>}){
 const now=Date.now(),month=day.slice(0,7),ids=new Set(es.map(e=>e.id));
 const open=s.attendance.filter(a=>!a.end&&ids.has(a.employeeId)).map(a=>{const sh=s.shifts.filter(x=>x.employeeId===a.employeeId).map(x=>{let e=Date.parse(`${x.date}T${x.end}:00+09:00`);if(x.end<=x.start)e+=86400000;return {x,e,st:Date.parse(`${x.date}T${x.start}:00+09:00`)}}).find(o=>o.st<=Date.parse(a.start)+4*3600000&&o.e>Date.parse(a.start));return {a,end:sh?.e}}).filter(o=>o.end&&o.end+30*60000<now);
 const recs=s.attendance.filter(a=>ids.has(a.employeeId)&&new Date(Date.parse(a.start)+9*3600000).toISOString().slice(0,10)===day);
 const [memo,setMemo]=useState<Record<string,string>>({});
 const habits=es.filter(e=>e.status!=='퇴사').map(e=>({e,p:punctuality(s.shifts as any,s.attendance as any,e.id,month,tol(s),now)})).filter(x=>x.p.count>0);
 return <section className="panel t-gap" aria-labelledby="att2-title"><div className="panel-heading"><h2 id="att2-title">기록 메모·미퇴근 정리</h2></div><div className="t-panelbody">
  {open.length>0&&<><h3>예정 퇴근이 30분 넘게 지난 기록</h3><ul>{open.map(({a,end})=><li key={a.id}>{es.find(e=>e.id===a.employeeId)?.name} · {new Date(Date.parse(a.start)+9*3600000).toISOString().slice(5,16).replace('T',' ')} 출근 <button type="button" className="secondary" disabled={busy} onClick={()=>{if(confirm('예정 퇴근 시각으로 임시 마감할까요? 기록에 "임시 마감" 표시가 남고, 직원에게 확인 알림이 가요.'))void mutate({action:'autoClose',id:a.id,end:new Date(end!).toISOString()})}}>예정 퇴근({new Date(end!+9*3600000).toISOString().slice(11,16)})으로 임시 마감</button></li>)}</ul></>}
  <h3>{md(day)} 기록 메모 <small>(사장님만 봐요)</small></h3>
  {recs.length?<ul>{recs.map(a=><li key={a.id}>{es.find(e=>e.id===a.employeeId)?.name} {new Date(Date.parse(a.start)+9*3600000).toISOString().slice(11,16)}{(a as any).autoClosed&&<span className="badge-warn"> 임시 마감</span>}{(a as any).outside&&<span className="badge-soft"> 외근: {(a as any).outside}</span>} <input aria-label="메모" maxLength={200} value={memo[a.id]??(a as any).memo??''} onChange={e=>setMemo({...memo,[a.id]:e.target.value})} placeholder="예: 재고 정리로 늦게 퇴근"/> <button type="button" className="link-btn" disabled={busy||memo[a.id]===undefined} onClick={()=>mutate({action:'attMemo',id:a.id,memo:memo[a.id]})}>저장</button></li>)}</ul>:<p className="footnote">이날 기록이 없어요.</p>}
  {habits.length>0&&<details><summary>{Number(month.slice(5))}월 출근 습관</summary><ul>{habits.map(({e,p})=><li key={e.id}>{e.name} · {habitText(p.avg,p.count)} · 지각 {p.late}번 · 조퇴 {p.early}번 <small>({p.count}번 근무 기준)</small></li>)}</ul></details>}
 </div></section>;
}

/* ───────── 리포트 ───────── */
/** B132 인건비율 목표 · B133 요일별 · B135 지각 많은 때 · B136 대타 추이 · B137·B138 주의 직원 · B140 작년 같은 달 · B194 이번 달 쓴 기능 */
export function ReportMore2({s,es,month,swaps,sales,rows=[]}:{s:Team,es:Team['employees'],month:string,swaps?:any[],sales?:number,rows?:any[]}){
 const [rg,setRg]=useState({from:month+'-01',to:todayK()}),[wdSel,setWdSel]=useState(-1);
 const [sw,setSw]=useState<any[]>(swaps||[]);useEffect(()=>{if(swaps||/^\/(demo|try)/.test(location.pathname))return;fetch('/api/operations').then(r=>r.ok?r.json():null).then((d:any)=>setSw(d?.swaps||[])).catch(()=>{})},[]);// B136 대타 기록
 const ids=new Set(es.map(e=>e.id)),att=s.attendance.filter(a=>ids.has(a.employeeId)),sh=s.shifts.filter(x=>ids.has(x.employeeId));
 const wd=weekdayCost(att as any,es as any,month),maxC=Math.max(1,...wd.map(x=>x.cost)),hot=lateHotspots(sh as any,att as any,month,tol(s)),risk=riskFlags(sh as any,att as any,es as any,month,prevMonth(month));
 const target=(s.settings as any).more?.laborRatioTarget,total=wd.reduce((t,x)=>t+x.cost,0),sale=sales??(s.settings as any).monthlySales?.[month],rs=ratioState(total,sale||0,target);
 const months=[3,2,1,0].map(n=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1-n,1)).toISOString().slice(0,7)}),tr=swapTrend(sw,months),yoy=yearOverYear(s.payrollRuns,month);
 return <section className="panel t-gap" aria-labelledby="rep2-title"><div className="panel-heading"><h2 id="rep2-title">더 보는 리포트</h2><button type="button" className="secondary" onClick={()=>xls(`리포트-${month}.xls`,[{name:'요일별 인건비',rows:[['요일','인건비(시급 직원)','근무 시간','하루 평균'],...wd.map(x=>[W[x.wd],x.cost,x.hours,x.perDay])]},{name:'지각 많은 때',rows:[['요일','지각'],...hot.weekday.map((n,i)=>[W[i],n])]}])}>엑셀</button></div><div className="t-panelbody">
  {rs&&<p className={rs.over?'notice':'footnote'}>매출 대비 인건비 <b>{rs.pct}%</b>{target?` · 목표 ${target}%${rs.over?' — 목표를 넘었어요':' 안'}`:' · 설정에서 목표 비율을 정할 수 있어요'}</p>}
  <h3>요일별 인건비 <small>(시급 직원 · 출퇴근 기준)</small></h3>
  <ul className="week-load">{wd.map(x=><li key={x.wd}><span className="wl-name"><button type="button" className="link-btn" aria-expanded={wdSel===x.wd} onClick={()=>setWdSel(wdSel===x.wd?-1:x.wd)} title="근거 보기">{W[x.wd]}</button></span><span className="wl-bar" role="img" aria-label={`${won(x.cost)}원`}><i style={{width:x.cost/maxC*100+'%'}}/></span><span>{won(x.cost)}원 · {x.hours}시간{x.perDay?` · 하루 ${won(x.perDay)}원`:''}</span></li>)}</ul>
  {wdSel>=0&&(()=>{const rows2=att.filter(a=>a.end&&new Date(Date.parse(a.start)+9*3600000).toISOString().startsWith(month)&&new Date(Date.parse(a.start)+9*3600000).getUTCDay()===wdSel).map(a=>{const e=es.find(x=>x.id===a.employeeId)!,c:any=(a as any).credit||a,h=Math.max(0,(Date.parse(c.end)-Date.parse(c.start))/3600000-a.breakMinutes/60);return {a,e,h:Math.round(h*100)/100,cost:e?.payType==='시급'?Math.round(h*e.wage):0}});
   return <div className="notice" role="region" aria-label={`${W[wdSel]}요일 근거`}><b>{W[wdSel]}요일 근거 {rows2.length}건</b> · 인정 시간 × 시급(시급 직원만)<ul>{rows2.map(r=><li key={r.a.id}>{new Date(Date.parse(r.a.start)+9*3600000).toISOString().slice(5,10).replace('-','/')} {r.e?.name} · {r.h}시간{r.cost?` × ${won(r.e.wage)}원 = ${won(r.cost)}원`:` · ${r.e?.payType}`}</li>)}</ul></div>})()}
  {hot.weekday.some(Boolean)&&<p>지각이 많은 요일: {hot.weekday.map((n,i)=>({n,i})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,3).map(x=>`${W[x.i]} ${x.n}번`).join(' · ')}{hot.slots.length?` · 시간대: ${hot.slots.map(([k,n])=>`${k} ${n}번`).join(' · ')}`:''}</p>}
  {tr.some(x=>x.n)&&<p>대타·교대 승인: {tr.map(x=>`${Number(x.month.slice(5))}월 ${x.n}건`).join(' → ')}</p>}
  {yoy.before!=null&&<p>작년 {Number(yoy.lastYear.slice(5))}월 확정 급여 {won(yoy.before)}원{yoy.now!=null?` → 올해 ${won(yoy.now)}원 (${yoy.pct!>=0?'+':''}${yoy.pct}%)`:''}</p>}
  {risk.length>0&&<><h3>살펴볼 직원</h3><ul>{risk.map(r=><li key={r.id}>{r.name}{r.overWeeks>=2?` · 40시간 넘는 주 ${r.overWeeks}번(과로·연장수당 확인)`:''}{r.leaving?` · 근무가 ${r.prevHours}→${r.hours}시간으로 줄고 지각이 늘었어요(대화를 권해요)`:''}</li>)}</ul></>}
  {(()=>{const gross=rows.reduce((n:number,r:any)=>n+(Number(r.gross)||0),0),juhu=rows.reduce((n:number,r:any)=>n+(r.earnings||[]).filter((x:any)=>/주휴/.test(x.name)).reduce((m:number,x:any)=>m+(Number(x.amount)||0),0),0);return gross?<p>주휴수당 비중 <b>{juhuShare(juhu,gross)}%</b> ({won(juhu)}원 / 임금 총액 {won(gross)}원)</p>:null})()}
  <details><summary>기간 직접 골라 보기</summary><div className="t-inline"><input type="date" aria-label="시작일" value={rg.from} onChange={e=>setRg({...rg,from:e.target.value})}/>~<input type="date" aria-label="끝 날" value={rg.to} onChange={e=>setRg({...rg,to:e.target.value})}/></div>
   {(()=>{const per=es.map(e=>{let h=0,n=0;for(const a of att){if(a.employeeId!==e.id||!a.end)continue;const d=new Date(Date.parse(a.start)+9*3600000).toISOString().slice(0,10);if(d<rg.from||d>rg.to)continue;n++;h+=Math.max(0,(Date.parse(a.end)-Date.parse(a.start))/3600000-a.breakMinutes/60)}return {e,h:Math.round(h*10)/10,n,cost:e.payType==='시급'?Math.round(h*e.wage):0}}).filter(x=>x.n);const tc=per.reduce((n,x)=>n+x.cost,0);
    return per.length?<><ul>{per.map(x=><li key={x.e.id}>{x.e.name} · {x.n}번 · {x.h}시간{x.cost?` · ${won(x.cost)}원`:''}</li>)}</ul><p>합계 {won(tc)}원(시급 직원, 세전·주휴 제외) <button type="button" className="link-btn" onClick={()=>xls(`기간리포트-${rg.from}-${rg.to}.xls`,[{name:'기간',rows:[['직원','출근 횟수','시간','인건비(시급×시간)'],...per.map(x=>[x.e.name,x.n,x.h,x.cost])]}])}>엑셀</button></p></>:<p className="footnote">이 기간 기록이 없어요. 화면에 불러온 기록 범위 안에서 계산해요.</p>})()}</details>
  <details><summary>이번 달 쓴 기능</summary><ul>{usageSummary(s,month).map(u=><li key={u.k}>{u.k} {u.n}건</li>)}</ul></details>
 </div></section>;
}

/* ───────── 설정 ───────── */
/** B101 근무 전 알림 · B157 아침 브리핑 시각 · B015 하루 요약 · B132 인건비율 목표 · B026 근무표 나오는 요일 · B124 오늘 특별 지시 */
export function SettingsMore2({s,busy,save}:{s:Team,busy:boolean,save:Save}){
 const cur=(s.settings as any).more||{},[f,setF]=useState<any>(cur),[msg,setMsg]=useState('');
 const put=async()=>{const more=Object.fromEntries(Object.entries(f).filter(([,v])=>v!==''&&v!=null&&!(typeof v==='number'&&Number.isNaN(v))));if(await save({...s,settings:{...s.settings,more} as any}))setMsg('알림·리포트 설정을 저장했어요.')};
 return <section className="panel t-gap" aria-labelledby="set2-title"><div className="panel-heading"><h2 id="set2-title">알림·리포트 더 고르기</h2></div><form className="t-panelbody" onSubmit={e=>{e.preventDefault();void put()}}><div className="t-formgrid">
  <label>근무 전 직원 알림 <select value={f.beforeMinutes??60} onChange={e=>setF({...f,beforeMinutes:Number(e.target.value)})}><option value={0}>보내지 않기</option><option value={30}>30분 전</option><option value={60}>1시간 전</option><option value={120}>2시간 전</option><option value={180}>3시간 전</option></select></label>
  <label>마감 일과 알림(남은 일과가 있을 때만) <select value={f.routineHour??''} onChange={e=>setF({...f,routineHour:e.target.value===''?undefined:Number(e.target.value)})}><option value="">매장 닫는 시각(없으면 밤 10시)</option>{[18,19,20,21,22,23].map(h=><option key={h} value={h}>오후 {h-12}시</option>)}<option value={-1}>받지 않기</option></select></label>
  <label>아침 브리핑 시각 <select value={f.briefHour??8} onChange={e=>setF({...f,briefHour:Number(e.target.value)})}>{[5,6,7,8,9,10,11].map(h=><option key={h} value={h}>오전 {h}시</option>)}</select></label>
  <label>근무표 나오는 요일(직원 안내) <select value={f.scheduleDue??''} onChange={e=>setF({...f,scheduleDue:e.target.value===''?undefined:Number(e.target.value)})}><option value="">안내 안 함</option>{[...W].map((d,i)=><option key={i} value={i}>{d}요일</option>)}</select></label>
  <label>지각 몇 번이면 직원 메모에 자동 기록 <select value={f.lateMemo??0} onChange={e=>setF({...f,lateMemo:Number(e.target.value)})}><option value={0}>안 함</option>{[2,3,4,5].map(n=><option key={n} value={n}>이번 달 {n}번</option>)}</select></label>
  <label>매출 대비 인건비 목표(%) <input type="number" min={0} max={100} step={0.5} value={f.laborRatioTarget??''} onChange={e=>setF({...f,laborRatioTarget:e.target.value?Number(e.target.value):undefined})} placeholder="예: 25"/></label>
 </div>
  <label className="t-check"><input type="checkbox" checked={!!f.digest} onChange={e=>setF({...f,digest:e.target.checked})}/> 미출근·퇴근 누락 알림을 낱개 대신 저녁 9시에 하루 요약으로 받기</label>
  <label>오늘 특별 지시(직원 첫 화면 맨 위, 오늘만) <input maxLength={200} value={f.todayNote?.date===todayK()?f.todayNote.text:''} onChange={e=>setF({...f,todayNote:e.target.value?{date:todayK(),text:e.target.value}:undefined})} placeholder="예: 오늘 3시 위생 점검 — 주방 정리 먼저"/></label>
  <p className="footnote">직원은 직원 화면에서 근무 전 알림 시간을 따로 고를 수 있어요(직원이 고르면 그 값이 먼저).</p>
  <div className="actions"><button className="primary" disabled={busy}>저장</button></div>{msg&&<p role="status" className="saas-success">{msg}</p>}</form></section>;
}

/* ───────── 매장 정보·일정·반복 할 일 ───────── */
/** B121 비품 위치 · B122 거래처 · B123 와이파이 · B110 첫 출근 안내 · B115 매장 일정 · B127·B153 반복 할 일 · B167 휴점 · B168 근무표 담당 */
export function StoreInfo2({s,branch,busy,save,es}:{s:Team,branch:string,busy:boolean,save:Save,es:Team['employees']}){
 const b:any=s.branches.find(x=>x.id===branch),[info,setInfo]=useState<any>(b?.info||{}),[msg,setMsg]=useState('');
 const [ev,setEv]=useState({date:todayK(),title:''}),[rp,setRp]=useState<any>({title:'',every:'week',weekday:1,day:1});
 useEffect(()=>setInfo(b?.info||{}),[branch]);
 const events=((s as any).events||[]).filter((x:any)=>(!x.branchId||x.branchId===branch)&&x.date>=datePlus(todayK(),-7)).sort((a:any,b:any)=>a.date.localeCompare(b.date));
 const repeats:Repeat[]=((s as any).repeats||[]).filter((x:any)=>!x.branchId||x.branchId===branch);
 const saveInfo=async()=>{if(await save({...s,branches:s.branches.map(x=>x.id===branch?{...x,info} as any:x)}))setMsg('매장 정보를 저장했어요. 와이파이·첫 출근 안내는 직원 화면에 보여요.')};
 const vend=(info.vendors||[]) as any[];
 return <section className="panel t-gap" aria-labelledby="si2-title"><div className="panel-heading"><h2 id="si2-title">매장 정보·일정·반복 할 일</h2>{b?.info?.status==='휴점'&&<span className="badge-warn">휴점 중</span>}</div><div className="t-panelbody">
  <details open={!b?.info}><summary>매장 정보(직원과 함께 보기)</summary><form onSubmit={e=>{e.preventDefault();void saveInfo()}}><div className="t-formgrid">
   <label>와이파이 이름 <input maxLength={60} value={info.wifi||''} onChange={e=>setInfo({...info,wifi:e.target.value})}/></label>
   <label>와이파이 비밀번호 <input maxLength={60} value={info.wifiPw||''} onChange={e=>setInfo({...info,wifiPw:e.target.value})}/></label>
   <label>근무표 담당(알림 받을 사람) <select value={info.scheduler||''} onChange={e=>setInfo({...info,scheduler:e.target.value||undefined})}><option value="">사장님</option>{es.filter(e=>e.access==='중간관리자').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   <label>상태 <select value={info.status||'운영'} onChange={e=>setInfo({...info,status:e.target.value})}><option>운영</option><option>휴점</option></select></label></div>
   <label>비품 위치 메모 <textarea rows={3} maxLength={2000} value={info.supplies||''} onChange={e=>setInfo({...info,supplies:e.target.value})} placeholder="예: 행주 — 싱크대 아래 왼쪽, 영수증 용지 — 포스 서랍"/></label>
   <label>첫 출근 안내(새 직원 화면) <textarea rows={3} maxLength={1000} value={info.firstDay||''} onChange={e=>setInfo({...info,firstDay:e.target.value})} placeholder="예: 10분 일찍, 검은 바지·운동화, 뒷문으로 들어와 주세요"/></label>
   <h3>거래처 연락처</h3>{vend.map((v,i)=><div key={i} className="t-inline"><input aria-label="거래처 이름" maxLength={40} value={v.name} onChange={e=>setInfo({...info,vendors:vend.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/><input aria-label="전화" maxLength={30} value={v.phone} onChange={e=>setInfo({...info,vendors:vend.map((x,j)=>j===i?{...x,phone:e.target.value}:x)})}/><input aria-label="메모" maxLength={100} value={v.memo||''} placeholder="예: 화·금 납품" onChange={e=>setInfo({...info,vendors:vend.map((x,j)=>j===i?{...x,memo:e.target.value}:x)})}/>{v.phone&&<a href={'tel:'+v.phone}>전화</a>}<button type="button" className="link-btn" onClick={()=>setInfo({...info,vendors:vend.filter((_,j)=>j!==i)})}>지우기</button></div>)}
   <button type="button" className="secondary" onClick={()=>setInfo({...info,vendors:[...vend,{name:'',phone:''}].slice(0,50)})}>+ 거래처</button>
   {info.status==='휴점'&&<p className="notice">휴점해도 직원·기록·급여 자료는 그대로 남아요. 다시 '운영'으로 바꾸면 이어서 써요.</p>}
   <div className="actions"><button className="primary" disabled={busy}>매장 정보 저장</button></div></form></details>
  <details><summary>매장 일정 {events.length?`· ${events.length}개`:''}</summary><ul>{events.map((x:any)=><li key={x.id}>{md(x.date)}({W[new Date(x.date+'T00:00:00Z').getUTCDay()]}) {x.title} <button type="button" className="link-btn" disabled={busy} onClick={()=>save({...s,events:((s as any).events||[]).filter((y:any)=>y.id!==x.id)} as any)}>지우기</button></li>)}</ul>
   <div className="t-inline"><input type="date" aria-label="날짜" value={ev.date} onChange={e=>setEv({...ev,date:e.target.value})}/><input aria-label="일정" maxLength={60} placeholder="예: 위생 점검, 회식" value={ev.title} onChange={e=>setEv({...ev,title:e.target.value})}/><button type="button" className="secondary" disabled={busy||!ev.title.trim()} onClick={async()=>{if(await save({...s,events:[...((s as any).events||[]),{id:crypto.randomUUID(),date:ev.date,title:ev.title.trim(),branchId:branch}].slice(-1000)} as any))setEv({...ev,title:''})}}>추가</button></div><p className="footnote">직원 화면에도 보여요.</p></details>
  <details><summary>반복 할 일 {repeats.length?`· ${repeats.length}개 · 오늘 ${repeatsDue(repeats,todayK()).length}개`:''}</summary><ul>{repeats.map(r=><li key={r.id}>{r.title} · {r.every==='day'?'매일':r.every==='week'?`매주 ${W[r.weekday!]}요일`:`매달 ${r.day}일`}{r.to?` · ${es.find(e=>e.id===r.to)?.name||''}`:''} <button type="button" className="link-btn" disabled={busy} onClick={()=>save({...s,repeats:((s as any).repeats||[]).filter((y:any)=>y.id!==r.id)} as any)}>지우기</button></li>)}</ul>
   <div className="t-inline"><input aria-label="할 일" maxLength={80} placeholder="예: 냉장고 청소" value={rp.title} onChange={e=>setRp({...rp,title:e.target.value})}/><select aria-label="반복" value={rp.every} onChange={e=>setRp({...rp,every:e.target.value})}><option value="day">매일</option><option value="week">매주</option><option value="month">매달</option></select>{rp.every==='week'&&<select aria-label="요일" value={rp.weekday} onChange={e=>setRp({...rp,weekday:Number(e.target.value)})}>{[...W].map((d,i)=><option key={i} value={i}>{d}</option>)}</select>}{rp.every==='month'&&<input aria-label="날짜" type="number" min={1} max={31} value={rp.day} onChange={e=>setRp({...rp,day:Number(e.target.value)})}/>}<select aria-label="맡을 사람" value={rp.to||''} onChange={e=>setRp({...rp,to:e.target.value||undefined})}><option value="">그날 근무자 누구나</option>{es.filter(e=>e.status!=='퇴사').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
    <button type="button" className="secondary" disabled={busy||!rp.title.trim()} onClick={async()=>{const r:any={id:crypto.randomUUID(),title:rp.title.trim(),every:rp.every,branchId:branch,...(rp.every==='week'?{weekday:rp.weekday}:{}),...(rp.every==='month'?{day:rp.day}:{}),...(rp.to?{to:rp.to}:{})};if(await save({...s,repeats:[...((s as any).repeats||[]),r].slice(-100)} as any))setRp({...rp,title:''})}}>추가</button></div>
   {repeatsDue(repeats,todayK()).length>0&&<p className="notice">오늘 할 반복 일: {repeatsDue(repeats,todayK()).map(r=>r.title).join(', ')}</p>}</details>
  {msg&&<p role="status" className="saas-success">{msg}</p>}
 </div></section>;
}

/* ───────── 홈 ───────── */
/** B070 급여일 D-day · B124 오늘 특별 지시 · B115 오늘 매장 일정 */
export function HomeMore2({s,es,branch,recent=[],onGo}:{s:Team,es:Team['employees'],branch:string,recent?:string[],onGo?:(p:string)=>void}){
 const t=todayK(),live=es.filter(e=>e.status!=='퇴사');if(!live.length&&!recent.length)return null;
 const pd=payDayLeft(t,Math.min(...(live.length?live.map(e=>e.payDay||10):[10]))),note=(s.settings as any).more?.todayNote,evs=((s as any).events||[]).filter((x:any)=>x.date===t&&(!x.branchId||x.branchId===branch));
 const prev=new Date(Date.UTC(Number(t.slice(0,4)),Number(t.slice(5,7))-2,1)).toISOString().slice(0,7),locked=!!s.payrollRuns[prev+':'+branch]?.locked;
 return <div className="home-more2" role="status">{live.length>0&&pd.left<=7&&<span className={locked?'badge-soft':'badge-warn'}>급여일 {pd.left?`D-${pd.left}`:'오늘'}{locked?' · 확정됨':` · ${Number(prev.slice(5))}월 급여 확정 전`}</span>}{note?.date===t&&<span className="badge-soft">📌 오늘 지시: {note.text}</span>}{evs.map((x:any)=><span key={x.id} className="badge-soft">📅 {x.title}</span>)}{recent.length>0&&onGo&&<span className="recent-pages">최근 본 화면: {recent.map(p=><button key={p} type="button" className="link-btn" onClick={()=>onGo(p)}>{p}</button>)}</span>}</div>;
}

function ChangeNoteField(){const [v,setV]=useState(changeNote.v);return <label className="change-note">근무 바꿀 때 사유(선택, 바뀐 직원 알림에 같이 가요) <input maxLength={80} value={v} placeholder="예: 행사로 마감 1시간 연장" onChange={e=>{setV(e.target.value);changeNote.v=e.target.value}}/></label>}

/* ───────── 급여 ───────── */
/** B044 급여일 달력 · B051 연차수당 예상 · B054 계좌 바뀐 직원 · B055 이체 금액 대조 · B067 두루누리 예상 · B048 보험 고지액 · B050 일용직 신고 자료 · B063 공제 동의 안내 */
export function PayMore2({s,es,month,branch,rows,busy,save}:{s:Team,es:Team['employees'],month:string,branch:string,rows:any[],busy:boolean,save:Save}){
 const t=todayK(),cal=payCalendar(es as any,t,2),live=es.filter(e=>e.status!=='퇴사'),[bank,setBank]=useState(''),[bill,setBill]=useState<string>(String(((s as any).insuranceBills||{})[month+':'+branch]??''));
 const asks=(s as any).staffAsks||[],changed=live.filter(e=>accountChangedSince(asks,s.payrollRuns,e.id));
 const net=rows.reduce((n:number,r:any)=>n+(Number(r.net)||0),0),fileNums=bank.split(/[\s,]+/).map(x=>Number(x.replace(/[^\d-]/g,''))).filter(n=>Number.isFinite(n)&&n>0),tc=transferCheck(rows.map((r:any)=>Math.round(Number(r.net)||0)),fileNums);
 const ins=rows.reduce((n:number,r:any)=>n+(r.deductions||[]).filter((d:any)=>/국민연금|건강|장기요양|고용보험/.test(d.name)).reduce((m:number,d:any)=>m+(Number(d.amount)||0),0),0);
 const lp=live.filter(e=>(e.leaveBalance||0)>0&&e.payType==='시급').map(e=>({e,v:leavePayout(e.leaveBalance,e.wage,(e.weeklyHours||0)/5)}));
 const du=live.filter(e=>e.payType==='월급'||e.payType==='시급').map(e=>{const m=e.payType==='월급'?e.wage:Math.round((e.weeklyHours||0)*4.345*e.wage);return {e,m,v:durunuri(m,live.length)}}).filter(x=>x.v>0);
 const daily=dailyWorkerReport(es as any,s.attendance as any,month);
 return <section className="panel t-gap" aria-labelledby="pay2-title"><div className="panel-heading"><h2 id="pay2-title">급여 도우미</h2>{daily.length>1&&<button type="button" className="secondary" onClick={()=>xls(`일용직-근로내용확인신고-${month}.xls`,[{name:'일용직',rows:daily}])}>일용직 신고 자료</button>}</div><div className="t-panelbody">
  <h3>다가오는 급여일</h3><ul>{cal.slice(0,6).map(c=><li key={c.date}>{md(c.date)}({W[new Date(c.date+'T00:00:00Z').getUTCDay()]}) · {c.names.join(', ')}</li>)}</ul>
  {changed.length>0&&<p className="notice" role="alert">계좌를 바꾼 뒤 아직 급여를 보낸 적 없는 직원: <b>{changed.map(e=>e.name).join(', ')}</b> — 이체 전에 본인에게 계좌를 한 번 더 확인하세요.</p>}
  <details><summary>은행 이체 금액 맞춰 보기</summary><label>은행 파일·이체 내역의 금액(줄마다 하나) <textarea rows={4} value={bank} onChange={e=>setBank(e.target.value)} placeholder={'1,234,000\n987,500'}/></label>{fileNums.length>0&&<p className={tc.ok?'saas-success':'notice'} role="status">명세서 실지급 합계 {won(net)}원 · 이체 합계 {won(tc.file)}원 {tc.ok?'✓ 같아요':`· 차이 ${tc.diff>0?'+':''}${won(tc.diff)}원`}</p>}</details>
  <details><summary>4대보험 고지액과 비교</summary><div className="t-inline"><input type="number" min={0} aria-label="이번 달 고지액(근로자+사업주)" value={bill} onChange={e=>setBill(e.target.value)} placeholder="고지서 합계"/><button type="button" className="secondary" disabled={busy} onClick={()=>save({...s,insuranceBills:{...((s as any).insuranceBills||{}),[month+':'+branch]:Math.max(0,Math.round(Number(bill)||0))}} as any)}>저장</button></div>{bill&&<p className="footnote">명세서 근로자 공제 합계 {won(ins)}원. 고지서는 사업주 부담분도 같이 나와 보통 공제액의 약 2배예요{Number(bill)?` · 지금 ${(Number(bill)/Math.max(1,ins)).toFixed(2)}배`:''}. 크게 다르면 취득·상실 신고나 보수월액을 확인하세요.</p>}</details>
  {lp.length>0&&<details><summary>연차수당 정산 예상(퇴사·1년 만료 때)</summary><ul>{lp.map(({e,v})=><li key={e.id}>{e.name} · 남은 {e.leaveBalance}일 × 하루 {Math.round((e.weeklyHours||0)/5*10)/10}시간 × {won(e.wage)}원 ≈ <b>{won(v)}원</b></li>)}</ul><p className="footnote">5명 이상 매장 · 사용 촉진을 하지 않은 경우 기준의 예상이에요.</p></details>}
  {du.length>0&&<details><summary>두루누리 지원 예상 {du.length}명</summary><ul>{du.map(({e,m,v})=><li key={e.id}>{e.name} · 월 보수 약 {won(m)}원 → 월 약 {won(v)}원 지원(근로자·사업주 합)</li>)}</ul><p className="footnote">10명 미만 사업장, 월 보수 270만 원 미만, 신규 가입 등 조건이 있어요. 근로복지공단(1588-0075)에서 확인하세요.</p></details>}
  {(()=>{const LAW=/국민연금|건강|장기요양|고용보험|소득세|지방소득세|원천징수|가불|선지급|주급|결근|지각/;const own=rows.flatMap((r:any)=>(r.deductions||[]).filter((d:any)=>!LAW.test(d.name)).map((d:any)=>({r,d})));return own.length?<div className="notice" role="note"><b>직접 넣은 공제 {own.length}건</b> — 직원 서면 동의가 필요해요(근로기준법 제43조).<ul>{own.map(({r,d}:any,i:number)=><li key={i}>{r.name} · {d.name} {won(d.amount)}원</li>)}</ul>매장 매뉴얼 → 서명 서류에서 '임금 공제 동의서'로 서명을 받아 두세요.</div>:<p className="footnote">기숙사비·유니폼처럼 법에 없는 공제를 넣을 때는 직원 서면 동의가 필요해요. 서명 서류에 '임금 공제 동의서' 양식이 있어요.</p>})()}
 </div></section>;
}

/* ───────── 지점 ───────── */
/** B139 지점별 인건비 순위 · B169 전 지점 합계 · B162 비교 표 엑셀 · B134 시간당 매출(매출을 넣은 달) */
export function BranchCompare2({s,month}:{s:Team,month:string}){
 const [sort,setSort]=useState<'cost'|'hours'|'ratio'>('cost'),[runs,setRuns]=useState<any[]>([]);
 useEffect(()=>{if(s.branches.length<2||/^\/(demo|try)/.test(location.pathname))return;fetch('/api/manual').then(r=>r.ok?r.json():null).then((d:any)=>setRuns(d?.checkRuns||[])).catch(()=>{})},[s.branches.length]);// B170 최근 7일 체크
 if(s.branches.length<2)return null;
 const sales=(s.settings as any).monthlySales?.[month];
 const rows=s.branches.map(b=>{const es=s.employees.filter(e=>e.branchId===b.id),ids=new Set(es.map(e=>e.id));let hours=0,cost=0;
  for(const a of s.attendance){if(!ids.has(a.employeeId)||!a.end||!new Date(Date.parse(a.start)+9*3600000).toISOString().startsWith(month))continue;const e=es.find(x=>x.id===a.employeeId)!;const h=Math.max(0,(Date.parse(a.end)-Date.parse(a.start))/3600000-a.breakMinutes/60);hours+=h;if(e.payType==='시급')cost+=h*e.wage}
  cost+=es.filter(e=>e.payType==='월급'&&e.status!=='퇴사').reduce((n,e)=>n+e.wage,0);
  return {id:b.id,name:b.name,staff:es.filter(e=>e.status!=='퇴사').length,hours:Math.round(hours),cost:Math.round(cost),perHour:hours?Math.round(cost/hours):0,status:(b as any).info?.status||'운영',checks:(()=>{const r=runs.filter((x:any)=>x.branchId===b.id);return r.length?`${Math.round(r.filter((x:any)=>x.done.length===x.total).length/r.length*100)}% (${r.length}번)`:'-'})()}}).sort((a,b)=>sort==='hours'?b.hours-a.hours:sort==='ratio'?b.perHour-a.perHour:b.cost-a.cost);
 const tot={staff:rows.reduce((n,r)=>n+r.staff,0),hours:rows.reduce((n,r)=>n+r.hours,0),cost:rows.reduce((n,r)=>n+r.cost,0)};
 const head=['순위','지점','상태','직원','일한 시간','인건비(어림)','시간당 인건비','점검 완료율(7일)'];
 return <section className="panel t-gap" aria-labelledby="bc2-title"><div className="panel-heading"><h2 id="bc2-title">{Number(month.slice(5))}월 지점 순위</h2><div className="t-inline"><select aria-label="정렬" value={sort} onChange={e=>setSort(e.target.value as any)}><option value="cost">인건비 많은 순</option><option value="hours">일한 시간 많은 순</option><option value="ratio">시간당 인건비 높은 순</option></select><button type="button" className="secondary" onClick={()=>xls(`지점비교-${month}.xls`,[{name:'지점 비교',rows:[head,...rows.map((r,i)=>[i+1,r.name,r.status,r.staff,r.hours,r.cost,r.perHour,r.checks]),['','합계','',tot.staff,tot.hours,tot.cost,tot.hours?Math.round(tot.cost/tot.hours):0]]}])}>엑셀</button></div></div>
  <div className="t-tablewrap"><table className="t-table"><thead><tr>{head.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td>{r.status}</td><td>{r.staff}명</td><td>{r.hours}시간</td><td>{won(r.cost)}원</td><td>{won(r.perHour)}원</td><td>{r.checks}</td></tr>)}</tbody><tfoot><tr><th></th><th>전 지점 합계</th><td></td><td>{tot.staff}명</td><td>{tot.hours}시간</td><td><b>{won(tot.cost)}원</b></td><td>{tot.hours?won(Math.round(tot.cost/tot.hours)):0}원</td><td></td></tr></tfoot></table></div>
  {sales?<p className="footnote">이달 매출 {won(sales)}원 · 일한 시간당 매출 약 {won(Math.round(sales/Math.max(1,tot.hours)))}원 · 매출 대비 인건비 {Math.round(tot.cost/sales*1000)/10}%</p>:<p className="footnote">인건비는 출퇴근 기록 × 시급 + 월급으로 어림했어요(주휴·가산·보험 제외). 리포트에서 매출을 넣으면 시간당 매출도 보여요.</p>}
 </section>;
}

/** B166 지점 준비 체크(새 지점을 열면 할 일) */
export function BranchSetup({s,onOpen}:{s:Team,onOpen:(id:string,page?:string)=>void}){
 const list=s.branches.map(b=>{const x:any=b,es=s.employees.filter(e=>e.branchId===b.id&&e.status!=='퇴사');
  const items=[{k:'영업시간',ok:!!x.hours,page:'근무 스케줄'},{k:'매장 전화',ok:!!x.phone,page:'근무 스케줄'},{k:'직원 1명 이상',ok:es.length>0,page:'직원 관리'},{k:'시간대별 필요 인원',ok:(s.staffingNeeds||[]).some((n:any)=>!n.branchId||n.branchId===b.id),page:'근무 스케줄'},{k:'이번 주 근무표',ok:s.shifts.some(sh=>es.some(e=>e.id===sh.employeeId)&&sh.date>=todayK()&&sh.date<=datePlus(todayK(),6)),page:'근무 스케줄'},{k:'와이파이·첫 출근 안내',ok:!!x.info?.wifi||!!x.info?.firstDay,page:'매장 매뉴얼'}];
  return {b,items,done:items.filter(i=>i.ok).length}}).filter(r=>r.done<r.items.length);
 if(!list.length)return null;
 return <section className="panel t-gap" aria-labelledby="bs-title"><div className="panel-heading"><h2 id="bs-title">지점 준비 체크</h2></div><div className="t-panelbody">{list.map(r=><div key={r.b.id}><h3>{r.b.name} · {r.done}/{r.items.length}</h3><ul className="setup-list">{r.items.map(i=><li key={i.k} className={i.ok?'ok':'todo'}>{i.ok?'✓':'○'} {i.k}{!i.ok&&<> <button type="button" className="link-btn" onClick={()=>onOpen(r.b.id,i.page)}>하러 가기</button></>}</li>)}</ul></div>)}<p className="footnote">QR 출퇴근을 쓰면 지점마다 '출퇴근 QR 만들기'도 해 주세요.</p></div></section>;
}
