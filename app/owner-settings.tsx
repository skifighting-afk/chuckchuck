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
