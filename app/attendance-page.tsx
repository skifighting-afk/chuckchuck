'use client';
// 출퇴근 기록 화면 위쪽(지시서 2라운드): 날짜 이동(133) · 일·주·월 보기(012) · 인정 시간 규칙(004) · 확인 권장 ·
// 일간 시간표(013·014) · 상태 배지가 붙은 기록표(003) · 사장님 직접 기록 추가(011).
// 상태 판정은 lib/attendance-check.ts의 dayRows 하나만 쓴다(확인 권장·척척 비서·기록표가 같은 결과).
import {useMemo,useState} from 'react';
import {Btn,Badge,Field} from './team-ui';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {type Team,kdate,clock,worked,workedRaw,datePlus,today,DEFAULT_RULE,ruleLabel,type AttendanceRule} from '../lib/team-model';
import {dayRows,checkDay,TOLERANCE_NAMES,TOLERANCE_MINUTES,type Tolerance,type DayRow,type Status,shiftSpan} from '../lib/attendance-check';

type Att=Team['attendance'][number];
const TONE:Record<string,string>={정상:'green',지각:'amber',조퇴:'amber',미출근:'red',결근:'red',미퇴근:'red','예정 외':'blue','휴게 중':'neutral',휴가:'neutral','출근 전':'neutral'};
const MARK:Record<string,string>={정상:'✓',지각:'⏱',조퇴:'⏱',미출근:'!',결근:'✕',미퇴근:'!','예정 외':'＋','휴게 중':'☕',휴가:'🌴','출근 전':'·'};
/** 상태 배지: 색과 글자를 같이(색만으로 구분하지 않게) */
export const StatusChip=({x}:{x:Status})=><Badge tone={TONE[x.kind]||'neutral'}><span aria-hidden="true">{MARK[x.kind]} </span>{x.kind}{x.minutes?` ${x.minutes}분`:''}</Badge>;
const md=(d:string)=>`${Number(d.slice(5,7))}월 ${Number(d.slice(8))}일`;
const hm=(ms:number)=>new Date(ms+9*3600000).toISOString().slice(11,16);
const monthShift=(d:string,n:number)=>{const y=Number(d.slice(0,4)),m=Number(d.slice(5,7))-1+n;return new Date(Date.UTC(y,m,1)).toISOString().slice(0,10)};
const weekStartOf=(d:string,ws:'mon'|'sun')=>{const w=new Date(d+'T00:00:00Z').getUTCDay();return datePlus(d,-(ws==='mon'?(w+6)%7:w))};

export type AttCtx={s:Team,es:Team['employees'],day:string,setDay:(d:string)=>void,demo:boolean,busy:boolean,
 mutate:(b:any,method?:string,close?:boolean)=>Promise<boolean>,update:(s:Team,close?:boolean)=>Promise<any>,
 onQr:()=>void,onClock:()=>void,onCorrection:(a:Att)=>void,onEditShift:()=>void};

export function AttendanceTop({ctx}:{ctx:AttCtx}){
 const {s,es,day,setDay,demo,busy}=ctx;
 const [view,setView]=useState<'day'|'week'|'month'>('day'),[add,setAdd]=useState<any>(null),[openEmp,setOpenEmp]=useState('');
 const ids=useMemo(()=>new Set(es.map(e=>e.id)),[es]),name=(id:string)=>es.find(e=>e.id===id)?.name||'직원';
 const tol=((s.settings as any).attendanceTolerance||'normal') as Tolerance,leaves=((s as any).approvedLeaves||[]) as {employeeId:string,start:string,end:string}[];
 const shifts=s.shifts.filter(x=>ids.has(x.employeeId)),att=s.attendance.filter(a=>ids.has(a.employeeId)),now=Date.now();
 const rule:AttendanceRule=(s.settings as any).attendanceRule||DEFAULT_RULE,ws=((s.settings as any).weekStart||'mon') as 'mon'|'sun';
 const rows=dayRows(day,shifts,att,tol,now,leaves),findings=checkDay(day,shifts,att,tol,now,leaves);
 const step=(n:number)=>setDay(view==='day'?datePlus(day,n):view==='week'?datePlus(day,7*n):monthShift(day,n));
 const label=view==='day'?(day===today()?'오늘':md(day)):view==='week'?`${md(weekStartOf(day,ws))} ~ ${md(datePlus(weekStartOf(day,ws),6))}`:`${Number(day.slice(0,4))}년 ${Number(day.slice(5,7))}월`;
 const openAdd=(employeeId?:string,shift?:Team['shifts'][number])=>{const d=shift?.date||day;setAdd({employeeId:employeeId||es[0]?.id||'',start:`${d}T${shift?.start||'09:00'}`,end:shift?`${shift.end<=shift.start?datePlus(d,1):d}T${shift.end}`:'',breakMinutes:shift?.breakMinutes??0,reason:''})};
 const saveAdd=async()=>{const toIso=(v:string)=>v?new Date(v+':00+09:00').toISOString():null;if(await ctx.mutate({action:'manualAttendance',employeeId:add.employeeId,start:toIso(add.start),end:toIso(add.end),breakMinutes:Number(add.breakMinutes)||0,reason:add.reason}))setAdd(null)};
 return <>
  <div className="t-toolbar att-nav">
   <div className="att-views" role="group" aria-label="보기">{([['day','일'],['week','주'],['month','월']] as const).map(([v,l])=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setView(v)}>{l}</button>)}</div>
   <div className="t-inline att-datenav"><Btn onClick={()=>step(-1)}>{view==='day'?'← 전날':view==='week'?'← 이전 주':'← 이전 달'}</Btn><input aria-label="근태 날짜" type="date" value={day} onInput={e=>{if(e.currentTarget.value)setDay(e.currentTarget.value)}} onChange={e=>{if(e.target.value)setDay(e.target.value)}}/><Btn onClick={()=>step(1)}>{view==='day'?'다음 날 →':view==='week'?'다음 주 →':'다음 달 →'}</Btn><Btn onClick={()=>setDay(today())}>오늘</Btn></div>
   <div className="t-inline att-actions"><Btn disabled={busy} onClick={ctx.onQr}>출퇴근 QR</Btn><Btn onClick={ctx.onClock}>출퇴근 기록</Btn><Btn primary onClick={()=>openAdd()}>+ 직접 기록 추가</Btn></div>
  </div>
  <p className="att-label"><b>{label}</b> <Badge tone="green">수정 이력 자동 기록</Badge></p>
  {view==='day'&&<>
   <section className="panel att-check" aria-labelledby="att-check-title"><div className="panel-heading"><h2 id="att-check-title">확인 권장 <Badge tone={findings.length?'amber':'green'}>{findings.length}</Badge></h2><label className="att-tol">허용 오차<select value={tol} disabled={busy||demo} onChange={e=>ctx.update({...s,settings:{...s.settings,attendanceTolerance:e.target.value}} as any,false)}>{(Object.keys(TOLERANCE_NAMES) as Tolerance[]).map(k=><option key={k} value={k}>{TOLERANCE_NAMES[k]}</option>)}</select></label></div>
    {findings.length?<ul className="att-findings">{rows.filter(r=>r.statuses.some(x=>!['정상','휴게 중','휴가','출근 전'].includes(x.kind))).map(r=><li key={r.key}><b>{name(r.employeeId)}</b>{r.statuses.filter(x=>!['정상','출근 전'].includes(x.kind)).map((x,i)=><StatusChip key={i} x={x}/>)}<small>{r.shift?`예정 ${r.shift.start}–${r.shift.end}`:'근무표에 없는 출근'}</small>{!r.records.length&&r.shift&&<button type="button" className="att-link" onClick={()=>openAdd(r.employeeId,r.shift)}>직접 기록</button>}</li>)}</ul>:<p className="footnote">근무표대로 출퇴근했어요. 허용 오차 안의 기록은 '정상'이에요.</p>}
   </section>
   <AttendanceTimeline rows={rows} date={day} es={es} att={att} shifts={shifts} now={now} onEditShift={ctx.onEditShift}/>
   <section className="panel t-tablewrap att-table"><table className="t-table"><thead><tr>{['직원','상태','출근','퇴근','휴게','실근무(인정)','관리'].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>
    {rows.flatMap(r=>(r.records.length?r.records:[null]).map((a,i)=><tr key={r.key+(a?.id||'none')}>
     <td><b>{name(r.employeeId)}</b>{r.shift&&i===0&&<small>예정 {r.shift.start}–{r.shift.end}</small>}{(a as any)?.source==='owner'&&<small className="att-owner">사장님 입력</small>}</td>
     <td>{i===0?<span className="att-chips">{r.statuses.map((x,j)=><StatusChip key={j} x={x}/>)}</span>:<small>같은 근무</small>}</td>
     <td>{a?clock(a.start):'—'}</td><td>{a?(a.end?clock(a.end):<Badge tone="green">{a.breakStart?'휴게 중':'근무 중'}</Badge>):'—'}</td><td>{a?Math.round(a.breakMinutes)+'분':'—'}</td>
     <td>{a?a.end?<>{worked(a).toFixed(2)}시간{a.credit&&Math.abs(worked(a)-workedRaw(a))>0.004&&<small className="att-raw">찍힌 {clock(a.start)}–{clock(a.end)} · {workedRaw(a).toFixed(2)}시간</small>}</>:'진행 중':'—'}</td>
     <td>{a?<button onClick={()=>ctx.onCorrection(a)}>수정 요청</button>:r.shift&&<button onClick={()=>openAdd(r.employeeId,r.shift)}>직접 기록</button>}</td></tr>))}
   </tbody></table>{!rows.length&&<div className="empty">이날은 근무표도 출퇴근 기록도 없어요.</div>}</section>
  </>}
  {view==='week'&&<WeekView es={es} shifts={shifts} att={att} start={weekStartOf(day,ws)} tol={tol} now={now} leaves={leaves} onDay={d=>{setDay(d);setView('day')}}/>}
  {view==='month'&&<MonthView es={es} shifts={shifts} att={att} month={day.slice(0,7)} tol={tol} now={now} leaves={leaves} open={openEmp} setOpen={setOpenEmp} onDay={d=>{setDay(d);setView('day')}}/>}
  <RulePanel rule={rule} busy={busy} demo={demo} onSave={r=>ctx.update({...s,settings:{...s.settings,attendanceRule:r}} as any,false)} tolMinutes={TOLERANCE_MINUTES[tol]}/>
  <Dialog open={!!add} onOpenChange={v=>{if(!v)setAdd(null)}}><DialogContent className="t-dialog"><DialogHeader><DialogTitle>직접 기록 추가</DialogTitle><DialogDescription>저장하면 바로 반영되고, 변경 이력에 '사장님 직접 입력'과 사유가 남아요. 직원 화면에는 '사장님 입력'으로 보여요.</DialogDescription></DialogHeader>
   {add&&<form onSubmit={e=>{e.preventDefault();void saveAdd()}}><div className="t-formgrid">
    <Field label="직원"><select value={add.employeeId} onChange={e=>setAdd({...add,employeeId:e.target.value})}>{es.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
    <Field label="휴게 (분)"><input type="number" min={0} max={480} value={add.breakMinutes} onChange={e=>setAdd({...add,breakMinutes:e.target.value})}/></Field>
    <Field label="출근 일시"><input required type="datetime-local" value={add.start} onChange={e=>setAdd({...add,start:e.target.value})}/></Field>
    <Field label="퇴근 일시 (비우면 근무 중)"><input type="datetime-local" value={add.end} onChange={e=>setAdd({...add,end:e.target.value})}/></Field>
    <Field label="사유 (필수)"><input required maxLength={300} value={add.reason} placeholder="예: QR 고장으로 못 찍음" onChange={e=>setAdd({...add,reason:e.target.value})}/></Field></div>
    <div className="actions"><Btn onClick={()=>setAdd(null)}>취소</Btn><button type="submit" className="primary" disabled={busy||!add.reason.trim()||!add.start}>바로 반영하기</button></div>
    <p className="footnote">같은 직원의 다른 기록과 시간이 겹치거나, 급여가 확정된 달이면 저장되지 않아요.</p></form>}
  </DialogContent></Dialog>
 </>;
}

/** 013·014 일간 시간표: 예정(점선)과 실제(채움)를 위아래로, 늦은 구간·지금 시각·미출근 표시 */
function AttendanceTimeline({rows,date,es,att,shifts,now,onEditShift}:{rows:DayRow<Team['shifts'][number],Att>[],date:string,es:Team['employees'],att:Att[],shifts:Team['shifts'],now:number,onEditShift:()=>void}){
 const [full,setFull]=useState(false);
 const base=Date.parse(date+'T00:00:00+09:00'),H=(ms:number)=>(ms-base)/3600000;
 // 전날 시작해 자정을 넘어온 근무도 이어서 보여 준다
 const prevOver=shifts.filter(x=>x.date===datePlus(date,-1)&&x.end<=x.start).map(x=>({employeeId:x.employeeId,s:shiftSpan(x)}));
 const items=rows.map(r=>{const sp=r.shift?shiftSpan(r.shift):null,recs=r.records.map(a=>[Date.parse(a.start),a.end?Date.parse(a.end):Math.max(now,Date.parse(a.start))] as const);return {r,sp,recs}});
 const pts=[...items.flatMap(i=>[...(i.sp?[i.sp[0],i.sp[1]]:[]),...i.recs.flat()]),...prevOver.map(p=>p.s[1])].map(H);
 let lo=pts.length?Math.floor(Math.min(...pts))-1:9,hi=pts.length?Math.ceil(Math.max(...pts))+1:18;
 if(full){lo=Math.min(0,lo);hi=Math.max(24,hi)}lo=Math.max(full?0:-1,lo);if(lo<0)lo=0;if(hi-lo<4)hi=lo+4;if(hi>36)hi=36;
 const pct=(h:number)=>`${Math.max(0,Math.min(100,(h-lo)/(hi-lo)*100))}%`,w=(a:number,b:number)=>`${Math.max(0.8,(Math.min(b,hi)-Math.max(a,lo))/(hi-lo)*100)}%`;
 const nowH=date===today()?H(now):null,ticks=Array.from({length:hi-lo+1},(_,i)=>lo+i).filter((_,i,a)=>a.length<=13||i%2===0);
 const name=(id:string)=>es.find(e=>e.id===id)?.name||'직원',role=(id:string)=>es.find(e=>e.id===id)?.role||'';
 return <section className="panel att-timeline" aria-labelledby="att-tl-title"><div className="panel-heading"><h2 id="att-tl-title">{date===today()?'오늘':md(date)} 시간표</h2><div className="t-inline"><label className="att-full"><input type="checkbox" checked={full} onChange={e=>setFull(e.target.checked)}/> 24시간 보기</label><Btn onClick={onEditShift}>근무표 고치기</Btn></div></div>
  <div className="att-legend" aria-hidden="true"><span><i className="lg-plan"/>예정</span><span><i className="lg-real"/>실제</span><span><i className="lg-late"/>늦은 구간</span>{nowH!=null&&<span><i className="lg-now"/>지금</span>}</div>
  {items.length?<div className="att-tl" role="img" aria-label={`${md(date)} 예정과 실제 근무 시간표`}>
   <div className="att-tl-scale"><span/>{<div className="att-tl-ticks">{ticks.map(t=><span key={t} style={{left:pct(t)}}>{String(t%24).padStart(2,'0')}{t>=24&&t%24===0?'(+1)':''}</span>)}</div>}</div>
   {items.map(({r,sp,recs})=><div className="att-tl-row" key={r.key}><div className="att-tl-name"><b>{name(r.employeeId)}</b><small>{role(r.employeeId)}</small></div>
    <div className="att-tl-track">{nowH!=null&&nowH>=lo&&nowH<=hi&&<i className="att-now" style={{left:pct(nowH)}}/>}
     {sp&&<button type="button" className="tl-plan" style={{left:pct(H(sp[0])),width:w(H(sp[0]),H(sp[1]))}} onClick={onEditShift} title="눌러서 근무 시간 고치기">{r.shift!.start}–{r.shift!.end}</button>}
     {recs.map(([a,b],i)=><span key={i} className={'tl-real'+(r.records[i]?.end?'':' open')} style={{left:pct(H(a)),width:w(H(a),H(b))}}>{hm(a)}{r.records[i]?.end?'–'+hm(b):' ~'}</span>)}
     {sp&&recs.length>0&&recs[0][0]>sp[0]&&r.statuses.some(x=>x.kind==='지각')&&<span className="tl-late" style={{left:pct(H(sp[0])),width:w(H(sp[0]),H(recs[0][0]))}} aria-hidden="true"/>}
     {sp&&!recs.length&&r.statuses.map((x,i)=>['미출근','결근','휴가'].includes(x.kind)?<span key={i} className={'tl-miss '+(x.kind==='휴가'?'leave':'')} style={{left:pct(H(sp[0]))}}>{x.kind}{x.minutes?` ${x.minutes}분`:''}</span>:null)}
    </div></div>)}
  </div>:<p className="empty">이날은 근무표도 출퇴근 기록도 없어요.</p>}
  <div className="sr-only"><h3>{md(date)} 근무 시간 목록</h3><ul>{items.map(({r})=><li key={r.key}>{name(r.employeeId)}: 예정 {r.shift?`${r.shift.start}–${r.shift.end}`:'없음'}, 실제 {r.records.map(a=>`${clock(a.start)}–${a.end?clock(a.end):'근무 중'}`).join(', ')||'기록 없음'}, 상태 {r.statuses.map(x=>x.kind+(x.minutes?` ${x.minutes}분`:'')).join(', ')}</li>)}</ul></div>
 </section>;
}

/** 012 주 보기: 직원 × 요일, 칸마다 출근–퇴근과 상태 */
function WeekView({es,shifts,att,start,tol,now,leaves,onDay}:{es:Team['employees'],shifts:Team['shifts'],att:Att[],start:string,tol:Tolerance,now:number,leaves:any[],onDay:(d:string)=>void}){
 const days=Array.from({length:7},(_,i)=>datePlus(start,i)),W='일월화수목금토',by=days.map(d=>dayRows(d,shifts,att,tol,now,leaves));
 return <section className="panel t-tablewrap"><table className="t-table att-week"><thead><tr><th>직원</th>{days.map(d=><th key={d}><button type="button" className="att-link" onClick={()=>onDay(d)}>{Number(d.slice(8))}일 ({W[new Date(d+'T00:00:00Z').getUTCDay()]})</button></th>)}</tr></thead>
  <tbody>{es.map(e=><tr key={e.id}><th scope="row">{e.name}</th>{by.map((rows,i)=>{const mine=rows.filter(r=>r.employeeId===e.id);return <td key={days[i]}>{mine.map(r=><div key={r.key} className="att-wcell">{r.records.length?<span>{clock(r.records[0].start)}–{r.records.at(-1)!.end?clock(r.records.at(-1)!.end!):'근무 중'}</span>:r.shift?<small>예정 {r.shift.start}–{r.shift.end}</small>:null}{r.statuses.filter(x=>x.kind!=='출근 전').map((x,j)=><StatusChip key={j} x={x}/>)}</div>)}{!mine.length&&<span className="att-none">—</span>}</td>})}</tr>)}</tbody></table></section>;
}

/** 012 월 보기: 직원별 근무일수·인정 시간 합계·지각·조퇴·결근. 줄을 누르면 일별 기록 */
function MonthView({es,shifts,att,month,tol,now,leaves,open,setOpen,onDay}:{es:Team['employees'],shifts:Team['shifts'],att:Att[],month:string,tol:Tolerance,now:number,leaves:any[],open:string,setOpen:(v:string)=>void,onDay:(d:string)=>void}){
 const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate(),days=Array.from({length:last},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`).filter(d=>d<=today());
 const all=days.map(d=>({d,rows:dayRows(d,shifts,att,tol,now,leaves)}));
 const stat=es.map(e=>{const recs=att.filter(a=>a.employeeId===e.id&&kdate(a.start).startsWith(month));const c={지각:0,조퇴:0,결근:0};for(const {rows} of all)for(const r of rows)if(r.employeeId===e.id)for(const x of r.statuses)if(x.kind in c)(c as any)[x.kind]++;
  return {e,recs,days:new Set(recs.map(a=>kdate(a.start))).size,hours:recs.filter(a=>a.end).reduce((n,a)=>n+worked(a),0),...c}});
 const total=stat.reduce((n,x)=>n+x.hours,0);
 return <section className="panel t-tablewrap"><table className="t-table att-month"><thead><tr>{['직원','근무일수','인정 시간 합계','지각','조퇴','결근',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
  <tbody>{stat.flatMap(x=>[<tr key={x.e.id} className="att-mrow"><th scope="row"><button type="button" className="att-link" aria-expanded={open===x.e.id} onClick={()=>setOpen(open===x.e.id?'':x.e.id)}>{x.e.name}</button></th><td>{x.days}일</td><td><b>{x.hours.toFixed(2)}시간</b></td><td>{x.지각}번</td><td>{x.조퇴}번</td><td>{x.결근}번</td><td><button type="button" className="att-link" onClick={()=>setOpen(open===x.e.id?'':x.e.id)}>{open===x.e.id?'접기':'일별 기록'}</button></td></tr>,
   open===x.e.id&&<tr key={x.e.id+'-d'}><td colSpan={7}><ul className="att-mdays">{x.recs.slice().sort((a,b)=>a.start.localeCompare(b.start)).map(a=><li key={a.id}><button type="button" className="att-link" onClick={()=>onDay(kdate(a.start))}>{md(kdate(a.start))}</button> {clock(a.start)}–{a.end?clock(a.end):'근무 중'} · {a.end?worked(a).toFixed(2)+'시간':'진행 중'}{(a as any).source==='owner'&&' · 사장님 입력'}</li>)}{!x.recs.length&&<li>이 달 기록이 없어요.</li>}</ul></td></tr>])}</tbody>
  <tfoot><tr><th scope="row">합계</th><td/><td><b>{total.toFixed(2)}시간</b></td><td colSpan={4}><small>완료된 기록의 인정 시간 합계 · 인건비 리포트 '완료된 실근무'와 같은 기준</small></td></tr></tfoot></table></section>;
}

/** 004 인정 시간 규칙 */
function RulePanel({rule,busy,demo,onSave,tolMinutes}:{rule:AttendanceRule,busy:boolean,demo:boolean,onSave:(r:AttendanceRule)=>void,tolMinutes:number}){
 const [r,setR]=useState(rule),dirty=JSON.stringify(r)!==JSON.stringify(rule);
 return <details className="panel att-rule"><summary><b>인정 시간 규칙</b> <small>{ruleLabel(rule)}</small></summary>
  <div className="t-formgrid">
   <Field label="일찍 출근하면"><select value={r.earlyIn} onChange={e=>setR({...r,earlyIn:e.target.value as any})}><option value="scheduled">예정 시각부터 인정</option><option value="actual">찍은 시각부터 인정</option></select></Field>
   <Field label="늦게 퇴근하면"><select value={r.lateOut} onChange={e=>setR({...r,lateOut:e.target.value as any})}><option value="actual">찍은 시각까지 인정</option><option value="scheduled">예정 시각까지 인정</option></select></Field>
   <Field label="계산 단위"><select value={r.unit} onChange={e=>setR({...r,unit:Number(e.target.value) as any})}><option value={1}>1분</option><option value={5}>5분 (직원에게 유리하게)</option><option value={10}>10분 (직원에게 유리하게)</option></select></Field>
  </div>
  <p className="notice">근무 시간은 1분 단위가 원칙이에요. 직원에게 불리하게 버리면 임금 체불이 될 수 있어요. 5분·10분 단위는 출근은 내리고 퇴근은 올려서, 직원에게 유리한 쪽으로만 맞춰요.</p>
  <p className="footnote">찍힌 원본 시각은 그대로 남고, 급여·인건비 리포트는 인정 시간을 써요. 규칙을 바꾸면 저장한 뒤 끝나는 근무부터 적용되고, 지난 기록과 확정된 달은 다시 계산하지 않아요. 허용 오차({tolMinutes}분)는 지각·조퇴 표시에만 쓰여요.</p>
  <Btn primary disabled={busy||!dirty} onClick={()=>onSave(r)}>규칙 저장{demo?' (체험)':''}</Btn>
 </details>;
}
