'use client';
// 지시서 194 대리 승인자 · 197 직인·사업자 정보 · 199 근무표 자동 게시 예약
import {useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {validBizNo} from '../lib/plans';
const DAYS=['일','월','화','수','목','금','토'];
export function OwnerExtraSettings({s,busy,save}:{s:Team,busy:boolean,save:(n:Team)=>Promise<any>}){
 const st:any=s.settings,[d,setD]=useState<any>({delegate:st.delegate||null,bizNo:st.bizNo||'',bizAddress:st.bizAddress||'',seal:st.seal||'',autoPublish:st.autoPublish||null}),[msg,setMsg]=useState('');
 const managers=s.employees.filter(e=>e.access==='중간관리자'&&e.status!=='퇴사');
 const put=async()=>{setMsg('');const biz=d.bizNo.replace(/\D/g,'');if(biz&&!validBizNo(biz)){setMsg('사업자등록번호 10자리를 확인해 주세요.');return}
  const next:any={...st,bizNo:biz||undefined,bizAddress:d.bizAddress.trim()||undefined,seal:d.seal||undefined,delegate:d.delegate?.employeeId&&d.delegate?.until?d.delegate:undefined,autoPublish:d.autoPublish||undefined};
  if(await save({...s,settings:next}))setMsg('저장했어요.')};
 const sealFile=async(f:File)=>{const bmp=await createImageBitmap(f),k=Math.min(1,240/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d')!.drawImage(bmp,0,0,c.width,c.height);setD({...d,seal:c.toDataURL('image/png')})};
 return <section className="panel t-gap owner-extra"><div className="panel-heading"><h2>사업자 정보·대리 승인·자동 게시</h2></div><div className="t-panelbody">
  <fieldset><legend>사업자 정보·직인 (계약서·증명서에 자동으로 들어가요)</legend>
   <label>사업자등록번호<input inputMode="numeric" value={d.bizNo} onChange={e=>setD({...d,bizNo:e.target.value})} placeholder="000-00-00000"/></label>
   <label>사업장 주소<input maxLength={200} value={d.bizAddress} onChange={e=>setD({...d,bizAddress:e.target.value})}/></label>
   <span className="t-inline">{d.seal&&<img src={d.seal} alt="직인" width={64} height={64}/>}<label className="sd-file"><input type="file" accept="image/png,image/jpeg" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void sealFile(f)}}/>{d.seal?'직인 바꾸기':'직인 사진 넣기'}</label>{d.seal&&<button type="button" className="secondary" onClick={()=>setD({...d,seal:''})}>빼기</button>}</span>
  </fieldset>
  <fieldset><legend>사장님 부재 중 대리 승인자</legend>
   {managers.length?<><label>매니저<select value={d.delegate?.employeeId||''} onChange={e=>setD({...d,delegate:e.target.value?{employeeId:e.target.value,until:d.delegate?.until||today()}:null})}><option value="">없음</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{d.delegate&&<label>언제까지<input type="date" min={today()} value={d.delegate.until} onChange={e=>setD({...d,delegate:{...d.delegate,until:e.target.value}})}/></label>}<small>그 기간 동안 근무표·출퇴근 정정·휴가 승인·공지를 대신 처리해요. 급여 확정과 계약은 사장님만 해요.</small></>:<small>먼저 직원 정보에서 '중간관리자'를 정해 주세요.</small>}
  </fieldset>
  <fieldset><legend>근무표 자동 게시</legend>
   <label className="t-check"><input type="checkbox" checked={!!d.autoPublish} onChange={e=>setD({...d,autoPublish:e.target.checked?{weekday:5,hour:18}:null})}/> 다음 주 근무표를 정해진 때 직원에게 자동으로 공개</label>
   {d.autoPublish&&<span className="t-inline"><select aria-label="요일" value={d.autoPublish.weekday} onChange={e=>setD({...d,autoPublish:{...d.autoPublish,weekday:Number(e.target.value)}})}>{DAYS.map((x,i)=><option key={i} value={i}>매주 {x}요일</option>)}</select><select aria-label="시각" value={d.autoPublish.hour} onChange={e=>setD({...d,autoPublish:{...d.autoPublish,hour:Number(e.target.value)}})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{h}시</option>)}</select></span>}
  </fieldset>
  <button type="button" className="primary" disabled={busy} onClick={put}>저장</button>{msg&&<p role="status">{msg}</p>}
 </div></section>;
}

// 지시서 098: 급여 화면 잠금 — 공용 PC·태블릿에서 다른 사람이 급여를 못 보게 4~6자리 숫자로 잠근다(이 기기에서 연 동안만 풀림).
// 화면 잠금이에요. 계정 로그인 보안은 비밀번호·기기 목록·로그인 기록으로 지켜요.
export async function pinHash(pin:string,salt:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('cc-pay-pin:'+salt+':'+pin)))).map(n=>n.toString(16).padStart(2,'0')).join('')}
export function PayrollPinSetting({s,busy,save}:{s:Team,busy:boolean,save:(n:Team)=>Promise<any>}){
 const cur=(s.settings as any).payrollPin,[pin,setPin]=useState(''),[msg,setMsg]=useState('');
 const set=async()=>{if(!/^\d{4,6}$/.test(pin)){setMsg('숫자 4~6자리로 정해 주세요.');return}const salt=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>n.toString(16).padStart(2,'0')).join('');if(await save({...s,settings:{...s.settings,payrollPin:{salt,hash:await pinHash(pin,salt)}}} as any)){setPin('');setMsg('급여 화면 잠금을 켰어요. 급여 화면을 열 때 숫자를 물어봐요.')}};
 return <section className="panel t-gap" aria-label="급여 화면 잠금"><div className="panel-heading"><h2>급여 화면 잠금</h2></div><div className="t-panelbody">
  <p className="footnote">매장 PC·태블릿을 같이 쓰면 급여·명세서 화면에 숫자 잠금을 걸 수 있어요. 한 번 풀면 이 화면을 닫을 때까지 열려 있어요. 잊으면 여기서 새로 정하면 돼요.</p>
  <div className="t-inline"><label>잠금 숫자 <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label><button type="button" className="secondary" disabled={busy||!pin} onClick={set}>{cur?'숫자 바꾸기':'잠금 켜기'}</button>{cur&&<button type="button" className="link-btn" disabled={busy} onClick={async()=>{const n:any={...s.settings};delete n.payrollPin;if(await save({...s,settings:n} as any))setMsg('잠금을 껐어요.')}}>잠금 끄기</button>}</div>
  {msg&&<p role="status" className="saas-success">{msg}</p>}</div></section>;
}
export function PayrollGate({s,children}:{s:Team,children:any}){
 const cur=(s.settings as any).payrollPin,[open,setOpen]=useState(false),[pin,setPin]=useState(''),[err,setErr]=useState(''),[tries,setTries]=useState(0);
 if(!cur||open)return children;
 return <section className="panel t-panelbody pay-gate" aria-label="급여 화면 잠금"><h2>급여 화면이 잠겨 있어요</h2><p>사장님이 정한 숫자를 넣어 주세요.</p>
  <form onSubmit={async e=>{e.preventDefault();if(tries>=5){setErr('여러 번 틀렸어요. 잠시 뒤 다시 해 주세요.');return}if(await pinHash(pin,cur.salt)===cur.hash){setOpen(true);setErr('')}else{setTries(tries+1);setErr('숫자가 맞지 않아요. 다시 넣어 주세요.');setPin('');if(tries+1>=5)setTimeout(()=>setTries(0),60000)}}}>
   <input type="password" inputMode="numeric" autoComplete="off" aria-label="급여 화면 잠금 숫자" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} autoFocus/><button type="submit" className="primary" disabled={pin.length<4}>열기</button></form>
  {err&&<p role="alert" className="saas-error">{err}</p>}<p className="footnote">숫자를 잊었으면 설정의 '급여 화면 잠금'에서 새로 정해 주세요.</p></section>;
}

/** 지시서 084: 카카오톡에서 척척 비서 — 연결 코드 받기(카카오톡 채널 챗봇 설정은 사장님 할 일 목록 참고) */
export function KakaoBotPanel({demo}:{demo:boolean}){
 const [st,setSt]=useState<any>(null),[code,setCode]=useState(''),[err,setErr]=useState('');
 const call=async(action:string)=>{setErr('');try{const r=await fetch('/api/kakao-skill?link=1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const d:any=await r.json();if(!r.ok)throw Error(d.error||'처리하지 못했어요.');return d}catch(e){setErr((e as Error).message);return null}};
 if(demo)return null;
 return <details className="panel t-gap kakao-bot" onToggle={async e=>{if((e.target as HTMLDetailsElement).open&&!st)setSt(await call('status'))}}><summary>카카오톡에서 척척 비서 쓰기</summary><div className="t-panelbody">
  <p className="footnote">카카오톡 채널 대화창에서 "오늘 누가 근무해?", "이번 달 인건비"처럼 물으면 답해요. 근무 넣기·승인 같은 바꾸는 일은 앱에서 해요.</p>
  {st&&!st.ready&&<p className="notice">아직 카카오톡 채널 챗봇이 연결되지 않았어요. 운영자가 채널 챗봇(스킬 주소{st.skillUrl?`: ${st.skillUrl}`:''})을 설정하면 쓸 수 있어요.</p>}
  {st?.linked?<p>✓ 카카오톡과 연결돼 있어요{st.since?` (${new Date(st.since).toLocaleDateString('ko-KR')}부터)`:''}. <button type="button" className="link-btn" onClick={async()=>{if(await call('unlink'))setSt({...st,linked:false})}}>연결 끊기</button></p>
  :<><button type="button" className="secondary" onClick={async()=>{const d=await call('code');if(d)setCode(d.code)}}>연결 코드 받기</button>{code&&<p className="kakao-code">카카오톡 채널에 <b>연결 {code}</b> 라고 보내 주세요. 10분 동안만 쓸 수 있어요.</p>}</>}
  {err&&<p role="alert" className="saas-error">{err}</p>}</div></details>;
}

/** 지시서 010: 결근·지각 누적 알림 기준 */
export function AbsenceAlertSetting({s,busy,save}:{s:Team,busy:boolean,save:(n:Team)=>Promise<any>}){
 const cur=(s.settings as any).absenceAlert||{absent:2,late:4},[v,setV]=useState(cur),[msg,setMsg]=useState('');
 return <section className="panel t-gap" aria-label="결근·지각 누적 알림"><div className="panel-heading"><h2>결근·지각 누적 알림</h2></div><div className="t-panelbody">
  <p className="footnote">한 달에 정한 횟수에 닿으면 다음 날 아침 9시에 알려 드려요. 0으로 두면 끄기예요.</p>
  <div className="t-inline"><label>결근 <input type="number" min={0} max={31} value={v.absent} onChange={e=>setV({...v,absent:Math.max(0,Math.min(31,Number(e.target.value)||0))})}/>번</label><label>지각 <input type="number" min={0} max={31} value={v.late} onChange={e=>setV({...v,late:Math.max(0,Math.min(31,Number(e.target.value)||0))})}/>번</label><button type="button" className="secondary" disabled={busy} onClick={async()=>{if(await save({...s,settings:{...s.settings,absenceAlert:v}} as any))setMsg('저장했어요.')}}>저장</button></div>
  {msg&&<p role="status" className="saas-success">{msg}</p>}</div></section>;
}

/** 지시서 090: 오픈 API·웹훅 */
export function OpenApiPanel({demo}:{demo:boolean}){
 const [v,setV]=useState<any>(null),[secret,setSecret]=useState<{label:string,value:string}|null>(null),[url,setUrl]=useState(''),[ev,setEv]=useState<string[]>(['attendance.clock','payroll.finalized']),[err,setErr]=useState('');
 const call=async(b?:any)=>{setErr('');try{const r=await fetch('/api/open-admin',b?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}:undefined);const d:any=await r.json();if(!r.ok)throw Error(d.error||'처리하지 못했어요.');setV(d);if(d.key)setSecret({label:'API 키',value:d.key});if(d.secret)setSecret({label:'웹훅 서명 비밀값',value:d.secret});return d}catch(e){setErr((e as Error).message)}};
 if(demo)return null;
 const base=(typeof __SUPABASE_URL__!=='undefined'?__SUPABASE_URL__:'').replace(/\/$/,'')+'/functions/v1/api/open/v1/';
 return <details className="panel t-gap open-api" onToggle={e=>{if((e.target as HTMLDetailsElement).open&&!v)void call()}}><summary>오픈 API·웹훅 (사내 프로그램 연결)</summary><div className="t-panelbody">
  <p className="footnote">ERP·회계 프로그램이 직원·근무표·출퇴근·확정 급여를 읽어 갈 수 있어요(읽기 전용). 주소: <code>{base}employees</code> · <code>shifts?from=&amp;to=</code> · <code>attendance?from=&amp;to=</code> · <code>payroll?month=</code>, 헤더 <code>X-Api-Key</code>.</p>
  {secret&&<p className="notice">{secret.label}(지금 한 번만 보여요): <input readOnly value={secret.value} onFocus={e=>e.target.select()} aria-label={secret.label} style={{width:'100%'}}/></p>}
  <h3>API 키</h3><ul className="adv-list">{(v?.keys||[]).map((k:any)=><li key={k.prefix}><b>{k.label}</b> <code>{k.prefix}…</code> <small>{new Date(k.createdAt).toLocaleDateString('ko-KR')} 만듦{k.lastUsedAt?` · 마지막 사용 ${new Date(k.lastUsedAt).toLocaleString('ko-KR')}`:''}</small><button type="button" className="link-btn" onClick={()=>call({action:'revokeKey',prefix:k.prefix})}>끄기</button></li>)}</ul>
  <button type="button" className="secondary" onClick={()=>call({action:'createKey',label:prompt('어디에 쓸 키인가요? (예: 회계 프로그램)')||''})}>새 API 키</button>
  <h3>웹훅</h3><ul className="adv-list">{(v?.webhooks||[]).map((w:any)=><li key={w.id}><code>{w.url}</code> <small>{w.events.join(', ')}</small><button type="button" className="link-btn" onClick={()=>call({action:'testHook',id:w.id})}>시험 보내기</button><button type="button" className="link-btn" onClick={()=>call({action:'removeHook',id:w.id})}>지우기</button></li>)}</ul>
  <div className="t-inline"><input aria-label="웹훅 주소" inputMode="url" placeholder="https://내-서버/hook" value={url} onChange={e=>setUrl(e.target.value)}/>{[['attendance.clock','출퇴근'],['payroll.finalized','급여 확정']].map(([k,l])=><label key={k} className="t-check"><input type="checkbox" checked={ev.includes(k)} onChange={e=>setEv(e.target.checked?[...ev,k]:ev.filter(x=>x!==k))}/> {l}</label>)}<button type="button" className="secondary" disabled={!url} onClick={async()=>{if(await call({action:'addHook',url,events:ev}))setUrl('')}}>추가</button></div>
  <p className="footnote">웹훅 본문은 비밀값으로 서명해 X-Chukchuk-Signature: sha256=… 헤더에 넣어요. 받는 쪽에서 같은 방식으로 확인해 주세요.</p>
  {err&&<p role="alert" className="saas-error">{err}</p>}</div></details>;
}
declare const __SUPABASE_URL__:string;
