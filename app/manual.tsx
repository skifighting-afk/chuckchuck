'use client';
// 매장 매뉴얼(지시서 1라운드 D): 찾기 쉬운 목록 + 따라 하기 쉬운 단계.
// 위: 검색·분류 칩·만들기 / 왼쪽: 매뉴얼 카드 / 오른쪽: 큰 번호·사진·한 문장 단계. 휴대폰은 목록과 상세를 나눈다.
// 실제 매장은 /api/manual, 체험 화면은 메모리(source)로 같은 화면을 쓴다.
import {useEffect,useMemo,useRef,useState} from 'react';
import {Btn,Badge,Field} from './team-ui';
import {MANUAL_CATEGORIES,filterManuals,categoryCounts,audienceLabel,audienceLine,staffState,wasEdited,manualVisibleTo} from '../lib/manual-view';
type Step={text:string,imageId?:string|null};
type Manual={id:string,title:string,branchId:string,steps:Step[],createdAt?:string,updatedAt:string,read:boolean,readCount?:number,audience?:number,unread?:string[],category?:string,roles?:string[],note?:string,quiz?:{q:string,options:string[],answer?:number}[],quizPassed?:boolean,quizPasses?:string[],quizPending?:string[]};
export type ManualSource={load:()=>Promise<any>,call:(body:any)=>Promise<any>,imageUrl?:(id:string)=>string|null};
const api:ManualSource={load:()=>req(),call:b=>req(b)};
async function req(body?:any){const r=await fetch('/api/manual',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined),d:any=await r.json();if(!r.ok)throw Error(d.error||'처리하지 못했어요. 다시 시도해 주세요.');return d}
/** 사진을 긴 변 1280px JPEG로 줄여서 400KB 이하로 */
export async function shrinkImage(file:File):Promise<{mime:string,body:string}>{
 const bmp=await createImageBitmap(file);let side=1280;
 for(let tries=0;tries<6;tries++){const k=Math.min(1,side/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bmp,0,0,c.width,c.height);
  const blob=await new Promise<Blob>((ok,no)=>c.toBlob(b=>b?ok(b):no(Error('사진을 줄이지 못했어요. 다른 사진을 골라 주세요.')),'image/jpeg',0.8-tries*0.08));
  if(blob.size<=380000){const buf=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=0x8000)s+=String.fromCharCode(...buf.subarray(i,i+0x8000));return {mime:'image/jpeg',body:btoa(s)}}
  side=Math.round(side*0.8)}
 throw Error('사진이 너무 커요. 다른 사진을 골라 주세요.');
}
function ManualImage({id,alt,source}:{id:string,alt:string,source:ManualSource}){
 const direct=source.imageUrl?.(id)||(id.startsWith('data:')?id:null);
 const [src,setSrc]=useState(direct||'');
 useEffect(()=>{if(direct){setSrc(direct);return}let url='',alive=true;fetch('/api/manual?image='+encodeURIComponent(id)).then(r=>r.ok?r.blob():null).then(b=>{if(b&&alive){url=URL.createObjectURL(b);setSrc(url)}}).catch(()=>{});return()=>{alive=false;if(url)URL.revokeObjectURL(url)}},[id]);
 return src?<img className="manual-img" src={src} alt={alt}/>:<div className="manual-img manual-img-wait" aria-label="사진 불러오는 중"/>;
}
const day=(iso:string)=>new Date(iso).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
function stateBadge(m:Manual){const s=staffState(m as any);return <Badge tone={s==='확인함'?'green':s==='바뀜'?'amber':'blue'}><span aria-hidden="true">{s==='확인함'?'✓ ':s==='바뀜'?'↻ ':'● '}</span>{s}</Badge>}

export function StoreManual({branchId,source=api,demoNote}:{branchId?:string,source?:ManualSource,demoNote?:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sel,setSel]=useState(''),[edit,setEdit]=useState<any>(null),[msg,setMsg]=useState('');
 const [cat,setCat]=useState('전체'),[q,setQ]=useState(''),[detail,setDetail]=useState(false),[preview,setPreview]=useState<string>('');
 const load=()=>source.load().then(setData).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 const run=async(b:any,done?:string)=>{setBusy(true);setError('');setMsg('');try{const d=await source.call({...b,version:data.version});setData(d);if(done){setMsg(done);setEdit(null)}return d}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const owner=!!data?.owner;
 const all:Manual[]=useMemo(()=>!data?[]:data.manuals.filter((m:Manual)=>!branchId||!owner||m.branchId==='all'||m.branchId===branchId),[data,branchId]);
 // 사장님의 '직원 화면으로 보기': 고른 업무의 직원에게 보이는 것만
 const pool=preview?all.filter(m=>manualVisibleTo(m as any,{branchId:branchId||m.branchId,role:preview==='전체'?'':preview})&&(preview!=='전체'||!m.roles?.length)):all;
 const [fav,setFav]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('cc-manual-fav')||'[]')}catch{return []}});// 개선 2차 B126 즐겨찾기(이 기기)
 const toggleFav=(id:string)=>{const n=fav.includes(id)?fav.filter(x=>x!==id):[...fav,id];setFav(n);try{localStorage.setItem('cc-manual-fav',JSON.stringify(n))}catch{}};
 const list=(filterManuals(pool as any,cat,q) as Manual[]).slice().sort((a,b)=>Number(fav.includes(b.id))-Number(fav.includes(a.id))),counts=categoryCounts(pool as any);
 const cur=list.find(m=>m.id===sel)||list[0];
 const branchName=(id:string)=>id==='all'?'전체 지점':data?.branches?.find((b:any)=>b.id===id)?.name||'';
 const open=(m:Manual)=>{setSel(m.id);setDetail(true);if(!owner&&!m.read)void run({action:'read',id:m.id})};
 if(!data)return <section className="panel t-panelbody"><p role={error?'alert':undefined}>{error||'매뉴얼을 불러오고 있어요.'}</p>{error&&<Btn onClick={()=>{setError('');load()}}>다시 불러오기</Btn>}</section>;
 if(edit)return <ManualEditor edit={edit} setEdit={setEdit} data={data} busy={busy} setBusy={setBusy} error={error} setError={setError} source={source}
  onSave={(m:any)=>run({action:'save',...m},m.id?'저장했어요. 대상 직원에게 바뀐 걸 알렸어요.':'매뉴얼을 만들었어요. 대상 직원 화면에 바로 보여요.').then(d=>{if(d&&!m.id)setSel(d.manuals.at(-1)?.id||'')})}/>;
 return <section className="manual2">
  {demoNote&&<p className="notice">{demoNote}</p>}
  <div className="manual-top">
   <label className="manual-search"><span className="sr-only">매뉴얼 찾기</span><input type="search" placeholder="매뉴얼 찾기 (예: 마감, 커피)" value={q} onChange={e=>{setQ(e.target.value);setDetail(false)}}/></label>
   {owner&&!preview&&<Btn primary onClick={()=>{setMsg('');setEdit({title:'',branchId:branchId||'all',category:cat!=='전체'?cat:'오픈',roles:[],note:'',steps:[{text:'',imageId:null}]})}}>+ 매뉴얼 만들기</Btn>}
  </div>
  <div className="manual-chips" role="group" aria-label="분류">{['전체',...MANUAL_CATEGORIES].map(c=><button key={c} type="button" aria-pressed={cat===c} onClick={()=>{setCat(c);setDetail(false)}}>{c} <b>{counts[c]||0}</b></button>)}</div>
  {owner&&<div className="manual-preview-bar">{preview?<><span>직원 화면 미리보기: <b>{preview==='전체'?'업무 지정 없는 직원':preview+' 직원'}</b>에게 보이는 매뉴얼만 보여요.</span><select aria-label="어느 업무로 볼까요" value={preview} onChange={e=>setPreview(e.target.value)}>{['전체',...(data.roles||[])].map((r:string)=><option key={r} value={r}>{r==='전체'?'업무 지정 없음':r}</option>)}</select><Btn onClick={()=>setPreview('')}>사장님 화면으로</Btn></>:null}</div>}
  {error&&<p className="saas-error" role="alert">{error}</p>}{msg&&<p className="saas-success" role="status">{msg}</p>}
  {!pool.length?<section className="panel empty">{owner?'아직 매뉴얼이 없어요. 오픈·마감 순서, 기계 사용법처럼 자주 묻는 일부터 만들어 보세요.':'아직 등록된 매뉴얼이 없어요.'}</section>:
  <div className={'manual-layout'+(detail?' show-detail':'')}>
   <ul className="manual-list" aria-label="매뉴얼 목록">{list.map(m=><li key={m.id}><button type="button" className={'manual-item'+(cur?.id===m.id?' on':'')} aria-current={cur?.id===m.id?'true':undefined} onClick={()=>open(m)}>
    <span className="mi-top"><Badge>{m.category||'기타'}</Badge>{(owner&&!preview)?(wasEdited(m as any)&&<small className="mi-changed">↻ 바뀜</small>):stateBadge(m)}</span>
    <b>{fav.includes(m.id)&&<span aria-label="즐겨찾기">★ </span>}{m.title}</b>
    <span className="mi-meta">{m.steps.length}단계 · {audienceLabel(m)} · {day(m.updatedAt)} 수정</span>
    {owner&&!preview&&<span className="mi-meta">{m.readCount??0}/{m.audience??0}명 읽음{data.branches?.length>1?' · '+branchName(m.branchId):''}</span>}
   </button></li>)}{!list.length&&<li className="empty">'{q||cat}'에 맞는 매뉴얼이 없어요.</li>}</ul>
   {cur&&<article className="manual-detail panel" aria-labelledby="manual-title">
    <button type="button" className="manual-back" onClick={()=>setDetail(false)}>← 목록</button>
    <header><Badge>{cur.category||'기타'}</Badge><h2 id="manual-title">{cur.title}</h2><button type="button" className="link-btn" aria-pressed={fav.includes(cur.id)} onClick={()=>toggleFav(cur.id)}>{fav.includes(cur.id)?'★ 즐겨찾기 빼기':'☆ 즐겨찾기'}</button><p className="md-who">{audienceLine(cur)}{data.branches?.length>1&&owner?` · ${branchName(cur.branchId)}`:''}</p>
     {cur.note&&wasEdited(cur as any)&&<p className="md-note"><b>최근 수정</b> {day(cur.updatedAt)} · {cur.note}</p>}
     {owner&&!preview&&<div className="actions"><Btn onClick={()=>{setPreview((cur.roles||[])[0]||'전체');setDetail(false)}}>직원 화면으로 보기</Btn><Btn primary onClick={()=>setEdit({id:cur.id,needPhoto:!!(cur as any).needPhoto,title:cur.title,branchId:cur.branchId,category:cur.category||'기타',roles:cur.roles||[],note:'',steps:cur.steps.map(s=>({...s})),quiz:(cur.quiz||[]).map(x=>({...x,options:[...x.options]}))})}>고치기</Btn></div>}
     {owner&&!preview&&cur.unread&&cur.unread.length>0&&<p className="footnote">아직 안 읽은 직원: {cur.unread.join(', ')}</p>}
    </header>
    <ol className="manual-steps2">{cur.steps.map((s,i)=><li key={i}><span className="ms-num" aria-hidden="true">{i+1}</span><div className="ms-body"><span className="sr-only">{i+1}단계. </span>{s.imageId&&<ManualImage source={source} id={s.imageId} alt={`${cur.title} ${i+1}단계 사진`}/>}{s.text&&<p>{s.text}</p>}{(s as any).videoUrl&&<a className="ms-video" href={(s as any).videoUrl} target="_blank" rel="noreferrer noopener">▶ 동영상으로 보기</a>}</div></li>)}</ol>
    {cur.quiz?.length?<QuizBox key={'q'+cur.id} m={cur} owner={owner&&!preview} busy={busy} run={run}/>:null}
    {!preview&&<CheckRunner key={cur.id} m={cur} runs={(data.checkRuns||[]).filter((r:any)=>r.manualId===cur.id)} owner={owner} busy={busy} source={source} run={run}/>}
    {owner&&!preview&&<div className="actions"><Btn disabled={busy} onClick={()=>{if(confirm(`'${cur.title}' 매뉴얼을 지울까요? 사진도 함께 지워져요.`))void run({action:'delete',id:cur.id},'매뉴얼을 지웠어요.')}}>삭제</Btn></div>}
   </article>}
  </div>}
 </section>;
}

function ManualEditor({edit,setEdit,data,busy,setBusy,error,setError,source,onSave}:any){
 const roles:string[]=data.roles||['홀','주방','매니저'];
 const steps:Step[]=edit.steps,set=(st:Step[])=>setEdit({...edit,steps:st});
 const drag=useRef<{from:number}|null>(null),[over,setOver]=useState<number|null>(null);
 async function upload(i:number,file?:File|null){if(!file)return;setBusy(true);setError('');try{const img=await shrinkImage(file);const r=await source.call({action:'image',...img});const st=steps.slice();st[i]={...st[i],imageId:r.id};set(st)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const move=(a:number,b:number)=>{if(b<0||b>=steps.length||a===b)return;const st=steps.slice();const [x]=st.splice(a,1);st.splice(b,0,x);set(st)};
 // 손잡이를 끌어 순서 바꾸기(마우스·손가락 모두)
 function grip(e:React.PointerEvent,i:number){e.preventDefault();drag.current={from:i};setOver(i);(e.target as Element).setPointerCapture?.(e.pointerId);
  const mv=(ev:PointerEvent)=>{for(const el of document.elementsFromPoint(ev.clientX,ev.clientY)){const li=(el as HTMLElement).closest?.('[data-step]');if(li){setOver(Number(li.getAttribute('data-step')));break}}};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);setOver(o=>{if(drag.current&&o!=null)move(drag.current.from,o);drag.current=null;return null})};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up)}
 return <section className="panel t-panelbody manual-edit"><h2>{edit.id?'매뉴얼 고치기':'새 매뉴얼'}</h2>{error&&<p className="saas-error" role="alert">{error}</p>}
  <div className="t-formgrid"><Field label="제목"><input maxLength={80} value={edit.title} placeholder="예: 마감 청소 순서" onChange={e=>setEdit({...edit,title:e.target.value})}/></Field>
   <Field label="분류"><select value={edit.category} onChange={e=>setEdit({...edit,category:e.target.value})}>{MANUAL_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field><label className="t-check"><input type="checkbox" checked={!!edit.needPhoto} onChange={e=>setEdit({...edit,needPhoto:e.target.checked})}/> 체크할 때 사진 필수(예: 마감 정리 인증)</label>
   {data.branches?.length>1&&<Field label="보여 줄 지점"><select value={edit.branchId} onChange={e=>setEdit({...edit,branchId:e.target.value})}><option value="all">전체 지점</option>{data.branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}</div>
  <fieldset className="ops-fs manual-aud"><legend>누구에게 보일까요</legend><div className="ops-seg"><label><input type="radio" name="maud" checked={!edit.roles.length} onChange={()=>setEdit({...edit,roles:[]})}/>모든 직원</label>{roles.map(r=><label key={r}><input type="checkbox" checked={edit.roles.includes(r)} onChange={e=>setEdit({...edit,roles:e.target.checked?[...edit.roles,r]:edit.roles.filter((x:string)=>x!==r)})}/>{r}만</label>)}</div></fieldset>
  {edit.id&&<Field label="무엇을 바꿨나요 (직원에게 같이 알려요)"><input maxLength={200} value={edit.note} placeholder="예: 3단계 세제 바뀜" onChange={e=>setEdit({...edit,note:e.target.value})}/></Field>}
  <ol className="manual-steps manual-steps-edit">{steps.map((s,i)=><li key={i} data-step={i} className={over===i&&drag.current?.from!==i?'drop':''}>
   <div className="mse-head"><button type="button" className="mse-grip" aria-label={`${i+1}단계 끌어서 순서 바꾸기`} onPointerDown={e=>grip(e,i)} onKeyDown={e=>{if(e.key==='ArrowUp'){e.preventDefault();move(i,i-1)}if(e.key==='ArrowDown'){e.preventDefault();move(i,i+1)}}}>⠿</button><span className="ms-num small" aria-hidden="true">{i+1}</span><b>{i+1}단계</b>
    <span className="mse-tools"><button type="button" aria-label={`${i+1}단계 위로`} disabled={i===0} onClick={()=>move(i,i-1)}>↑</button><button type="button" aria-label={`${i+1}단계 아래로`} disabled={i===steps.length-1} onClick={()=>move(i,i+1)}>↓</button><button type="button" aria-label={`${i+1}단계 삭제`} disabled={steps.length<2} onClick={()=>set(steps.filter((_,j)=>j!==i))}>삭제</button></span></div>
   <Field label={`${i+1}단계 설명 (한 문장)`}><textarea rows={2} maxLength={1000} value={s.text} onChange={e=>{const st=steps.slice();st[i]={...s,text:e.target.value};set(st)}}/></Field>
   <Field label="동영상 링크 (선택, 유튜브 등)"><input inputMode="url" maxLength={300} value={(s as any).videoUrl||''} placeholder="https://youtu.be/…" onChange={e=>{const st=steps.slice();st[i]={...s,videoUrl:e.target.value} as any;set(st)}}/></Field>
   {s.imageId&&<ManualImage source={source} id={s.imageId} alt={`${i+1}단계 사진`}/>}
   <div className="t-wrapactions"><label className="saas-secondary manual-upload">사진 찍기<input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={e=>upload(i,e.target.files?.[0])}/></label><label className="saas-secondary manual-upload">{s.imageId?'사진 바꾸기':'사진 고르기'}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>upload(i,e.target.files?.[0])}/></label>{s.imageId&&<Btn onClick={()=>{const st=steps.slice();st[i]={...s,imageId:null};set(st)}}>사진 빼기</Btn>}</div>
  </li>)}</ol>
  <QuizEditor quiz={edit.quiz||[]} set={(quiz:any[])=>setEdit({...edit,quiz})}/>
  <div className="actions"><Btn disabled={steps.length>=30} onClick={()=>set([...steps,{text:'',imageId:null}])}>+ 단계 추가</Btn><Btn onClick={()=>{setEdit(null);setError('')}}>취소</Btn><Btn primary disabled={busy||!edit.title.trim()||steps.every((s:any)=>!s.text.trim()&&!s.imageId&&!s.videoUrl?.trim())} onClick={()=>onSave({id:edit.id,title:edit.title,branchId:edit.branchId,category:edit.category,roles:edit.roles,note:edit.note,steps:steps.filter((s:any)=>s.text.trim()||s.imageId||s.videoUrl?.trim()),quiz:(edit.quiz||[]).filter((x:any)=>x.q.trim())})}>{busy?'저장 중…':'저장하고 직원에게 보이기'}</Btn></div>
  <p className="footnote">손잡이(⠿)를 끌거나 ↑↓로 순서를 바꿔요. 사진은 자동으로 줄여서 올려요(장당 400KB 이하). 고치면 직원 화면에 '바뀜'이 붙고 확인 표시가 처음부터 다시 시작돼요.</p>
 </section>;
}

/** 지시서 5주차 061: 오픈·마감 체크 실행(단계 체크 + 사진 인증)과 최근 기록 */
function CheckRunner({m,runs,owner,busy,source,run}:{m:Manual,runs:any[],owner:boolean,busy:boolean,source:ManualSource,run:(b:any,done?:string)=>Promise<any>}){
 const [on,setOn]=useState(false),[done,setDone]=useState<number[]>([]),[photo,setPhoto]=useState<{mime:string,body:string}|null>(null),[err,setErr]=useState('');
 const t=(iso:string)=>{const k=new Date(Date.parse(iso)+9*3600000).toISOString();return `${Number(k.slice(5,7))}/${Number(k.slice(8,10))} ${k.slice(11,16)}`};
 return <section className="check-run" aria-label="체크 실행">
  {!on?<button type="button" className="primary" onClick={()=>{setOn(true);setDone([]);setPhoto(null)}}>✓ 지금 이 순서대로 체크하기</button>:<div className="cr-box">
   <b>{m.title} 체크 · {done.length}/{m.steps.length}</b>
   <ul>{m.steps.map((st,i)=><li key={i}><label className="t-check"><input type="checkbox" checked={done.includes(i)} onChange={e=>setDone(e.target.checked?[...done,i]:done.filter(x=>x!==i))}/> {i+1}. {st.text||'사진 단계'}</label></li>)}</ul>
   <label className="sd-file"><input type="file" accept="image/jpeg,image/png" capture="environment" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{setPhoto(await shrinkImage(f))}catch{setErr('사진을 읽지 못했어요. 다른 사진을 골라 주세요.')}}}/>{photo?'✓ 인증 사진 넣음 (다시 찍기)':'인증 사진 찍기(선택)'}</label>
   {err&&<p className="saas-error" role="alert">{err}</p>}
   <div className="actions"><Btn onClick={()=>setOn(false)}>그만두기</Btn><Btn primary disabled={busy||!done.length} onClick={async()=>{const d=await run({action:'checkRun',id:m.id,done,...(photo?{photo}:{})},done.length<m.steps.length?`${done.length}/${m.steps.length}단계만 체크해서 저장했어요. 사장님께 알렸어요.`:'체크를 마쳤어요.');if(d)setOn(false)}}>체크 완료</Btn></div>
  </div>}
  {runs.length>0&&<div className="cr-log"><b>{owner?'최근 체크 기록':'오늘 내 체크'}</b><ul>{runs.slice(0,7).map(r=><li key={r.id}><span>{t(r.at)} · {r.by} · {r.done.length===r.total?'✓ 모두 체크':`${r.done.length}/${r.total}단계`}</span>{r.photoId&&<details><summary>인증 사진</summary><ManualImage source={source} id={r.photoId} alt={`${r.title} 인증 사진`}/></details>}</li>)}</ul></div>}
 </section>;
}

/** 지시서 066: 신입 교육 퀴즈 만들기(질문·보기 2~4개·정답) */
function QuizEditor({quiz,set}:{quiz:{q:string,options:string[],answer:number}[],set:(q:any[])=>void}){
 const up=(i:number,x:any)=>set(quiz.map((y,j)=>j===i?x:y));
 return <fieldset className="quiz-edit"><legend>교육 퀴즈 (선택) · 직원이 다 맞히면 '교육 이수'로 남아요</legend>
  {quiz.map((x,i)=><div key={i} className="quiz-q"><Field label={`${i+1}번 질문`}><input maxLength={200} value={x.q} onChange={e=>up(i,{...x,q:e.target.value})} placeholder="예: 냉장 보관 온도는?"/></Field>
   {x.options.map((o,k)=><div key={k} className="t-inline quiz-opt"><label className="t-check"><input type="radio" name={'ans'+i} checked={x.answer===k} onChange={()=>up(i,{...x,answer:k})}/> 정답</label><input aria-label={`${i+1}번 보기 ${k+1}`} maxLength={100} value={o} onChange={e=>up(i,{...x,options:x.options.map((y,j)=>j===k?e.target.value:y)})}/>{x.options.length>2&&<button type="button" className="link-btn" onClick={()=>up(i,{...x,options:x.options.filter((_,j)=>j!==k),answer:x.answer===k?0:x.answer>k?x.answer-1:x.answer})}>빼기</button>}</div>)}
   <div className="actions">{x.options.length<4&&<button type="button" className="secondary" onClick={()=>up(i,{...x,options:[...x.options,'']})}>+ 보기</button>}<button type="button" className="link-btn" onClick={()=>set(quiz.filter((_,j)=>j!==i))}>이 문제 지우기</button></div></div>)}
  {quiz.length<10&&<button type="button" className="secondary" onClick={()=>set([...quiz,{q:'',options:['',''],answer:0}])}>+ 퀴즈 문제 추가</button>}
 </fieldset>;
}
/** 066: 직원은 풀고, 사장님은 누가 이수했는지 본다 */
function QuizBox({m,owner,busy,run}:{m:Manual,owner:boolean,busy:boolean,run:(b:any,done?:string)=>Promise<any>}){
 const [ans,setAns]=useState<number[]>([]),[res,setRes]=useState<any>(null);
 if(owner)return <section className="quiz-box"><h3>교육 퀴즈 {m.quiz!.length}문제</h3><p>이수 {m.quizPasses?.length||0}명{m.quizPasses?.length?`: ${m.quizPasses.join(', ')}`:''}</p>{m.quizPending?.length?<p className="footnote">아직 안 함: {m.quizPending.join(', ')}</p>:null}</section>;
 if(m.quizPassed)return <section className="quiz-box"><p className="pc-ok">✓ 교육 퀴즈를 통과했어요.</p></section>;
 return <section className="quiz-box"><h3>교육 퀴즈 · 다 맞히면 이수</h3><ol>{m.quiz!.map((x,i)=><li key={i}><fieldset><legend>{x.q}</legend>{x.options.map((o,k)=><label key={k} className="t-check"><input type="radio" name={'qz'+m.id+i} checked={ans[i]===k} onChange={()=>{const a=ans.slice();a[i]=k;setAns(a);setRes(null)}}/> {o}</label>)}</fieldset>{res?.wrong?.includes(i+1)&&<p className="slog-bad">다시 생각해 보세요.</p>}</li>)}</ol>
  {res&&!res.pass&&<p role="status" className="slog-bad">{res.total}문제 중 {res.correct}개 맞았어요. 매뉴얼을 다시 보고 틀린 문제를 고쳐 주세요.</p>}
  <button type="button" className="primary" disabled={busy||m.quiz!.some((_,i)=>ans[i]===undefined)} onClick={async()=>{const d=await run({action:'quiz',id:m.id,answers:ans});if(d?.quizResult)setRes(d.quizResult)}}>답 내기</button></section>;
}
