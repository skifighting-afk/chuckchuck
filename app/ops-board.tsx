'use client';
import {NoticeExtras,NoticeFormExtras} from './notice-extras';
// 지시서 1라운드 C: 휴가·공지 화면. 사장님이 처리할 것을 맨 위에, 버튼 한 번으로 끝내게.
// 실제 매장(Operations, /api/operations)과 체험 화면(DemoOperations, 메모리)이 같은 화면을 쓴다.
import {useMemo,useState} from 'react';
import {CalendarCheck,Megaphone,Users,Inbox,Check,Plus,Bell,ImagePlus,X} from 'lucide-react';
import {Btn,Badge,Field} from './team-ui';
import {Evidence} from './evidence';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {leaveImpact,swapImpact,leaveCalendar,targetLabel,md,REJECT_REASONS,type OpsEmp,type NoticeTarget} from '../lib/ops-view';

type Action=(b:any)=>void|Promise<void>;
const STATUS_TONE:Record<string,string>={'승인 대기':'amber','구하는 중':'amber','승인':'green','반려':'red','취소':'neutral'};
const ICON:Record<string,string>={'승인 대기':'◔','구하는 중':'◔','승인':'✓','반려':'✕','취소':'–'};
/** 상태 배지: 색과 글자(그리고 기호)를 같이 써서 색만으로 구분하지 않는다 */
export const StatusBadge=({s}:{s:string})=><Badge tone={STATUS_TONE[s]||'neutral'}><span aria-hidden="true">{ICON[s]||''} </span>{s}</Badge>;
const range=(a:string,b:string)=>a===b?md(a):`${md(a)}~${a.slice(0,7)===b.slice(0,7)?Number(b.slice(8))+'일':md(b)}`;

export function OpsView({data,action,busy,branchId,demo,initial,swaps,leaveTab}:{data:any,action:Action,busy:boolean,branchId?:string,demo?:boolean,initial?:string,swaps:React.ReactNode,leaveTab:React.ReactNode}){
 const owner=data.access==='owner';
 const emps:OpsEmp[]=useMemo(()=>{const m=new Map<string,OpsEmp>();for(const e of [...(data.colleagues||[]),...(data.employees||[])])m.set(e.id,{id:e.id,name:e.name,role:e.role,branchId:e.branchId});return [...m.values()]},[data]);
 const shifts=data.shifts||[];
 const pendLeaves=(data.leaves||[]).filter((l:any)=>l.status==='승인 대기');
 const pendSwaps=(data.swaps||[]).filter((w:any)=>w.status==='승인 대기'&&(!branchId||w.branchId===branchId));
 const todo=owner?pendLeaves.length+pendSwaps.length:0;
 const tabs=owner?['처리할 것','휴가','대타·교대','공지']:['휴가','대타·교대','공지'];
 const start=initial==='근무 요청'?'대타·교대':initial==='매장 공지'?'공지':initial&&tabs.includes(initial)?initial:owner&&todo?'처리할 것':owner?'처리할 것':'휴가';
 const [tab,setTab]=useState(start),[reject,setReject]=useState<any>(null),[why,setWhy]=useState('');
 const dayShift=(employeeId:string,from:string,to:string)=>shifts.filter((s:any)=>s.employeeId===employeeId&&s.date>=from&&s.date<=to);
 const approve=(it:any)=>it.type==='leave'?action({action:'reviewLeave',id:it.id,approve:true,comment:'승인'}):action({action:'reviewSwap',id:it.id,approve:true,comment:'승인'});
 const doReject=()=>{if(!why.trim()||!reject)return;void action(reject.type==='leave'?{action:'reviewLeave',id:reject.id,approve:false,comment:why.trim()}:{action:'reviewSwap',id:reject.id,approve:false,comment:why.trim()});setReject(null);setWhy('')};
 const items=[...pendLeaves.map((l:any)=>({type:'leave',id:l.id,at:l.at,l})),...pendSwaps.map((w:any)=>({type:'swap',id:w.id,at:w.taker?.at||w.at,w}))].sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 const done=[...(data.leaves||[]).filter((l:any)=>['승인','반려','취소'].includes(l.status)).map((l:any)=>({type:'leave',l,at:l.reviewedAt||l.at})),...(data.swaps||[]).filter((w:any)=>['승인','반려','취소'].includes(w.status)&&(!branchId||w.branchId===branchId)).map((w:any)=>({type:'swap',w,at:w.reviewedAt||w.at}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,30);
 const card=(it:any)=>{
  if(it.type==='leave'){const l=it.l,sh=dayShift(l.employeeId,l.start,l.end),imp=leaveImpact(l,shifts,emps);
   return <article className="ops-card" key={'l'+l.id}><div className="ops-card-top"><StatusBadge s={l.status}/><span className="ops-kind"><CalendarCheck size={15} aria-hidden="true"/> 휴가 · {l.kind} {l.days}일</span></div>
    <h3>{l.name} · {range(l.start,l.end)}</h3>
    <p className="ops-shift">{sh.length?sh.slice(0,3).map((s:any)=>`${md(s.date)} ${s.start}–${s.end}`).join(', ')+(sh.length>3?` 외 ${sh.length-3}개`:''):'그 기간 근무 없음'}</p>
    <p className={'ops-impact'+(imp.alone?' warn':'')}>{imp.alone&&<span aria-hidden="true">⚠ </span>}{imp.text}</p>
    {l.reason&&<p className="ops-reason">신청 사유: {l.reason}</p>}
    {!demo&&<Evidence leaveId={l.id} pending/>}
    <div className="ops-card-actions"><button type="button" className="ops-no" disabled={busy} onClick={()=>{setReject({type:'leave',id:l.id,name:l.name});setWhy('')}}>반려</button><button type="button" className="ops-yes" disabled={busy} onClick={()=>approve(it)}>승인</button></div></article>}
  const w=it.w,imp=swapImpact({kind:w.kind,shift:w.shift,taker:w.taker,counter:w.counter},shifts,data.weekStart||'mon');
  return <article className="ops-card" key={'w'+w.id}><div className="ops-card-top"><StatusBadge s={w.status}/><span className="ops-kind"><Users size={15} aria-hidden="true"/> {w.kind}</span></div>
   <h3>{w.shift.name} → {w.taker?.name||'?'} · {md(w.shift.date)}</h3>
   <p className="ops-shift">{w.shift.start}–{w.shift.end} 근무{w.counter?` ↔ ${md(w.counter.date)} ${w.counter.start}–${w.counter.end}`:''}</p>
   {imp&&<p className={'ops-impact'+(/52시간/.test(imp)?' warn':'')}>{imp}</p>}
   {w.reason&&<p className="ops-reason">요청 사유: {w.reason}</p>}
   <div className="ops-card-actions"><button type="button" className="ops-no" disabled={busy} onClick={()=>{setReject({type:'swap',id:w.id,name:w.shift.name});setWhy('')}}>반려</button><button type="button" className="ops-yes" disabled={busy} onClick={()=>approve(it)}>승인</button></div></article>;
 };
 return <div className="ops ops2">
  <div className="ops-tabs" role="tablist" aria-label="휴가·공지">{tabs.map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='처리할 것'?<Inbox size={17} aria-hidden="true"/>:t==='휴가'?<CalendarCheck size={17} aria-hidden="true"/>:t==='대타·교대'?<Users size={17} aria-hidden="true"/>:<Megaphone size={17} aria-hidden="true"/>} {t}{t==='처리할 것'&&<b className="ops-count">{todo}</b>}</button>)}</div>
  {tab==='처리할 것'&&<>
   {items.length?<div className="ops-cards">{items.map(card)}</div>:<section className="panel empty"><Check aria-hidden="true"/> 처리할 요청이 없어요. 직원이 휴가나 대타를 올리면 여기 떠요.</section>}
   <TwoWeeks leaves={data.leaves||[]} from={data.today||new Date().toISOString().slice(0,10)}/>
   {done.length>0&&<details className="ops-done"><summary>처리한 것 {done.length}건</summary><ul>{done.map((d:any)=>d.type==='leave'?<li key={'l'+d.l.id}><StatusBadge s={d.l.status}/> <b>{d.l.name}</b> 휴가 {range(d.l.start,d.l.end)}{d.l.comment&&d.l.comment!=='승인'?` · ${d.l.comment}`:''}{d.l.removedShifts?.length?` · 근무 ${d.l.removedShifts.length}개 뺌`:''}</li>:<li key={'w'+d.w.id}><StatusBadge s={d.w.status}/> <b>{d.w.shift.name}</b> {d.w.kind} {md(d.w.shift.date)}{d.w.taker?` → ${d.w.taker.name}`:''}{d.w.comment&&d.w.comment!=='승인'?` · ${d.w.comment}`:''}</li>)}</ul></details>}
  </>}
  {tab==='휴가'&&<>{owner&&<TwoWeeks leaves={data.leaves||[]} from={data.today||new Date().toISOString().slice(0,10)}/>}{leaveTab}</>}
  {tab==='대타·교대'&&swaps}
  {tab==='공지'&&<Notices data={data} owner={owner} emps={emps.filter(e=>!branchId||e.branchId===branchId)} busy={busy} action={action} branchId={branchId}/>}
  <Dialog open={!!reject} onOpenChange={v=>{if(!v)setReject(null)}}><DialogContent><DialogHeader><DialogTitle>{reject?.name}님 {reject?.type==='leave'?'휴가':'대타·교대'} 반려</DialogTitle><DialogDescription>사유를 고르거나 적어야 반려돼요. 직원에게 그대로 알려요.</DialogDescription></DialogHeader>
   <div className="ops-reasons" role="group" aria-label="자주 쓰는 사유">{REJECT_REASONS.map(r=><button type="button" key={r} aria-pressed={why===r} onClick={()=>setWhy(r)}>{r}</button>)}</div>
   <Field label="반려 사유"><textarea rows={3} maxLength={500} value={why} onChange={e=>setWhy(e.target.value)} placeholder="직접 적기"/></Field>
   <div className="ops-card-actions"><button type="button" className="ops-no" onClick={()=>setReject(null)}>닫기</button><button type="button" className="ops-yes danger" disabled={busy||!why.trim()} onClick={doReject}>반려하기</button></div>
  </DialogContent></Dialog>
 </div>;
}

/** 앞으로 2주: 날짜마다 쉬는 사람과 상태. 같은 날 2명 이상이면 강조 */
function TwoWeeks({leaves,from}:{leaves:any[],from:string}){
 const days=leaveCalendar(leaves,from,14),W='일월화수목금토';
 return <section className="panel ops-two"><div className="panel-heading"><h2>앞으로 2주 휴가</h2><small>같은 날 2명 이상 쉬면 강조해요</small></div>
  <ol className="ops-two-grid">{days.map(d=><li key={d.date} className={(d.busy?'busy ':'')+(d.people.length?'has':'')}><span className="d">{Number(d.date.slice(8))}<small>{W[new Date(d.date+'T00:00:00Z').getUTCDay()]}</small></span>
   {d.people.length?d.people.map((p,i)=><span key={i} className={'p '+(p.status==='승인'?'ok':'wait')}>{p.name}<small>{p.status==='승인'?'승인':'대기'}</small></span>):<span className="none">—</span>}{d.busy&&<span className="sr-only">2명 이상 쉼</span>}</li>)}</ol></section>;
}

function Notices({data,owner,emps,busy,action,branchId}:{data:any,owner:boolean,emps:OpsEmp[],busy:boolean,action:Action,branchId?:string}){
 const roles=[...new Set(emps.map(e=>e.role).filter(Boolean))] as string[];
 const blank={title:'',body:'',branchId:branchId||'all',mode:'all',roles:[] as string[],ids:[] as string[],photo:'',when:'now',at:'',poll:[] as string[],file:null as null|{name:string,data:string}};
 const [f,setF]=useState(()=>{try{const d=sessionStorage.getItem('cc-notice-draft');if(d){sessionStorage.removeItem('cc-notice-draft');const [first,...rest]=d.split(/\n|\. /);return {...blank,title:first.slice(0,100),body:d}}}catch{}return blank}),[err,setErr]=useState('');// 개선 2차 B149 비서가 만든 공지 초안
 const target=():NoticeTarget=>f.mode==='role'?{type:'role',roles:f.roles}:f.mode==='people'?{type:'people',ids:f.ids}:{type:'all'};
 async function photo(file?:File){if(!file)return;setErr('');try{const img=await createImageBitmap(file),k=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);let q=.8,url=c.toDataURL('image/jpeg',q);while(url.length>330000&&q>.3){q-=.15;url=c.toDataURL('image/jpeg',q)}if(url.length>340000){setErr('사진이 너무 커요. 다른 사진을 골라 주세요.');return}setF(v=>({...v,photo:url}))}catch{setErr('사진을 읽지 못했어요. 다른 사진을 골라 주세요.')}}
 function send(e:React.FormEvent){e.preventDefault();setErr('');
  if(f.mode==='role'&&!f.roles.length){setErr('받을 업무를 하나 이상 골라 주세요.');return}
  if(f.mode==='people'&&!f.ids.length){setErr('받을 직원을 한 명 이상 골라 주세요.');return}
  let publishAt:string|null=null;if(f.when==='later'){const t=Date.parse(f.at);if(!f.at||isNaN(t)||t<Date.now()){setErr('예약 시각을 지금 이후로 골라 주세요.');return}publishAt=new Date(t).toISOString()}
  const poll=(f.poll||[]).map((x:string)=>x.trim()).filter(Boolean);if(f.poll?.length&&poll.length<2){setErr('투표 선택지를 2개 이상 적어 주세요.');return}
  void Promise.resolve(action({action:'postNotice',title:f.title,body:f.body,branchId:f.branchId,target:target(),publishAt,photo:f.photo||null,...(poll.length?{poll}:{}),...(f.file?{file:f.file}:{})})).then(()=>setF(blank));
 }
 const list=(data.notices||[]).slice().reverse().sort((a:any,b:any)=>Number(!!b.pinned)-Number(!!a.pinned));
 return <div className={owner?'ops-notice-layout':''}>
  <div className="ops-notice-list">{list.map((n:any)=>{const aud=n.audience??((n.readCount||0)+(n.unread?.length||0)),pct=aud?Math.round((n.readCount||0)/aud*100):0;
   return <article className="panel t-panelbody ops-notice" key={n.id}><div className="t-inline ops-notice-meta"><Badge>{n.branchId==='all'?'전체 지점':data.branches?.find((b:any)=>b.id===n.branchId)?.name||'지점'}</Badge>{owner&&<Badge>{targetLabel(n.target,emps)}</Badge>}{n.scheduled?<Badge tone="amber"><span aria-hidden="true">⏰ </span>예약 {new Date(n.publishAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</Badge>:<small>{new Date(n.createdAt).toLocaleDateString('ko-KR')}</small>}</div>
    <h2>{n.pinned&&<span className="pin-tag">📌 고정</span>}{n.title}</h2>{n.photo&&<img className="ops-notice-photo" src={n.photo} alt={n.title+' 사진'}/>}<p className="ops-notice-body">{n.body}</p><NoticeExtras n={n} busy={busy} action={action}/>
    {owner?<div className="ops-reads"><div className="ops-readbar" role="img" aria-label={`${aud}명 중 ${n.readCount||0}명 읽음`}><i style={{width:pct+'%'}}/></div><p><b>{n.readCount||0}/{aud}명 읽음</b>{n.unread?.length>0&&<> · 안 읽은 사람: {n.unread.join(', ')}</>}</p>
     <Btn disabled={busy} onClick={()=>action({action:'pinNotice',id:n.id,pinned:!n.pinned})}>{n.pinned?'고정 풀기':'📌 맨 위에 고정'}</Btn>{!n.scheduled&&n.unread?.length>0&&<Btn disabled={busy} onClick={()=>action({action:'remindNotice',id:n.id})}><Bell size={16}/> 다시 알리기{n.remindedAt?` (마지막 ${new Date(n.remindedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})})`:''}</Btn>}</div>
    :<Btn disabled={busy||n.read} onClick={()=>action({action:'readNotice',id:n.id})}><Check size={16}/>{n.read?'확인 완료':'공지 확인'}</Btn>}
   </article>})}{!list.length&&<section className="panel empty">등록된 공지가 없어요.{owner?<> <button type="button" className="link-btn" onClick={()=>document.querySelector<HTMLInputElement>('.ops-notice-form input')?.focus()}>첫 공지 쓰기 →</button></>:' 새 공지가 오면 알림으로 알려 드려요.'}</section>}</div>
  {owner&&<form className="panel t-panelbody ops-notice-form" onSubmit={send} aria-labelledby="new-notice"><h2 id="new-notice"><Plus size={18} aria-hidden="true"/> 새 공지</h2>
   <Field label="제목"><input required maxLength={100} value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></Field>
   <Field label="내용"><textarea required rows={5} maxLength={3000} value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></Field><NoticeFormExtras f={f} setF={setF} setErr={setErr}/>
   {data.branches?.length>1&&<Field label="지점"><select value={f.branchId} onChange={e=>setF({...f,branchId:e.target.value})}><option value="all">전체 지점</option>{data.branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
   <fieldset className="ops-fs"><legend>받는 사람</legend><div className="ops-seg">{[['all','전체'],['role','업무별'],['people','직접 고르기']].map(([v,l])=><label key={v}><input type="radio" name="aud" checked={f.mode===v} onChange={()=>setF({...f,mode:v})}/>{l}</label>)}</div>
    {f.mode==='role'&&<div className="ops-chips">{roles.map(r=><label key={r}><input type="checkbox" checked={f.roles.includes(r)} onChange={e=>setF({...f,roles:e.target.checked?[...f.roles,r]:f.roles.filter(x=>x!==r)})}/>{r}</label>)}</div>}
    {f.mode==='people'&&<div className="ops-chips">{emps.map(e=><label key={e.id}><input type="checkbox" checked={f.ids.includes(e.id)} onChange={ev=>setF({...f,ids:ev.target.checked?[...f.ids,e.id]:f.ids.filter(x=>x!==e.id)})}/>{e.name}</label>)}</div>}</fieldset>
   <div className="ops-photo">{f.photo?<span className="ops-photo-prev"><img src={f.photo} alt="넣은 사진"/><button type="button" aria-label="사진 빼기" onClick={()=>setF({...f,photo:''})}><X size={16}/></button></span>:<label className="ops-photo-btn"><ImagePlus size={18} aria-hidden="true"/> 사진 넣기<input type="file" accept="image/*" onChange={e=>photo(e.target.files?.[0])}/></label>}</div>
   <fieldset className="ops-fs"><legend>보내는 때</legend><div className="ops-seg"><label><input type="radio" name="when" checked={f.when==='now'} onChange={()=>setF({...f,when:'now'})}/>지금 보내기</label><label><input type="radio" name="when" checked={f.when==='later'} onChange={()=>setF({...f,when:'later'})}/>예약</label></div>
    {f.when==='later'&&<Field label="예약 시각"><input type="datetime-local" value={f.at} onChange={e=>setF({...f,at:e.target.value})}/></Field>}</fieldset>
   {err&&<p className="saas-error" role="alert">{err}</p>}
   <button type="submit" className="ops-yes wide" disabled={busy||!f.title.trim()||!f.body.trim()}>{f.when==='later'?'예약하기':'지금 보내기'}</button>
   <p className="footnote">받는 직원의 앱에 바로 보이고, 알림을 켠 직원에게는 휴대폰 알림이 가요. 예약한 공지는 그 시각부터 직원 화면에 보여요.</p>
  </form>}
 </div>;
}
