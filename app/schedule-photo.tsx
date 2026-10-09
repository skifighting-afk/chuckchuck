'use client';
// 지시서 088: 사진·엑셀 근무표 옮기기 — 사진은 이 화면에서만 옆에 띄워 보며 옮기고(서버에 올리지 않음),
// 엑셀 표는 복사해 붙여 넣으면 근무로 바뀐다. 휴대폰이 사진 속 글자 읽기를 지원하면 자동으로 글자를 채워 본다.
import {useState} from 'react';
import {type Team,duration} from '../lib/team-model';
import {parsePastedSchedule} from '../lib/schedule-paste';
const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));
export function SchedulePhoto({s,es,week,busy,update,onClose}:{s:Team,es:Team['employees'],week:string,busy:boolean,update:(n:Team,close?:boolean)=>Promise<any>,onClose:()=>void}){
 const [img,setImg]=useState(''),[text,setText]=useState(''),[msg,setMsg]=useState(''),[ocr,setOcr]=useState('');
 const r=parsePastedSchedule(text,es.filter(e=>e.status!=='퇴사'),week);
 const clash=(x:{employeeId:string,date:string,start:string,end:string})=>s.shifts.some(y=>{if(y.employeeId!==x.employeeId||y.date!==x.date)return false;const a=mins(x.start),b=mins(x.end)<=a?mins(x.end)+1440:mins(x.end),c=mins(y.start),d=mins(y.end)<=c?mins(y.end)+1440:mins(y.end);return a<d&&c<b});
 const fresh=r.shifts.filter(x=>!clash(x)),skipped=r.shifts.length-fresh.length;
 const pick=async(f?:File)=>{if(!f)return;const u=URL.createObjectURL(f);setImg(u);setOcr('');const TD=(window as any).TextDetector;if(!TD){setOcr('이 기기는 사진 속 글자 읽기를 지원하지 않아요. 사진을 보며 아래에 적어 주세요.');return}
  try{const bmp=await createImageBitmap(f);const found=await new TD().detect(bmp);const lines=(found||[]).map((x:any)=>x.rawValue).filter(Boolean);if(lines.length){setText(lines.join('\n'));setOcr('사진 글자를 읽어 넣었어요. 틀린 곳을 고쳐 주세요.')}else setOcr('글자를 찾지 못했어요. 사진을 보며 적어 주세요.')}catch{setOcr('글자를 읽지 못했어요. 사진을 보며 적어 주세요.')}};
 const save=async()=>{const add=fresh.map(x=>({id:crypto.randomUUID(),...x,breakMinutes:duration(x.start,x.end,0)>=8?60:duration(x.start,x.end,0)>=4?30:0}));if(await update({...s,shifts:[...s.shifts,...add]},false)){setMsg(`근무 ${add.length}개를 넣었어요.${skipped?` 이미 있는 ${skipped}개는 건너뛰었어요.`:''} 휴게는 법정 최소(4시간 30분·8시간 1시간)로 넣었으니 확인해 주세요.`);setText('')}};
 return <div className="sched-photo">
  <p className="footnote">손글씨·엑셀 근무표 사진을 옆에 띄워 보며 아래 칸에 옮겨 적거나, 엑셀 표를 그대로 복사해 붙여 넣으세요. 사진은 서버에 올리지 않아요.</p>
  <label className="sd-file">근무표 사진 고르기(선택)<input type="file" accept="image/*" onChange={e=>{void pick(e.target.files?.[0]);e.target.value=''}}/></label>
  {ocr&&<p role="status" className="footnote">{ocr}</p>}
  <div className="sp-grid">{img&&<img src={img} alt="옮길 근무표 사진" className="sp-img"/>}
   <label className="slog-field">근무표 글<textarea rows={8} value={text} onChange={e=>setText(e.target.value)} placeholder={'예) 엑셀에서 표 복사 → 붙여넣기\n이름\t월\t화\t수\n김민지\t9-18\t휴\t10-15\n\n또는 한 줄씩: 김민지 월 9-18, 수 10-15'}/></label></div>
  {text.trim()&&<div className="hi-preview" role="status"><p><b>근무 {r.shifts.length}개를 읽었어요</b>{skipped?` · 이미 있는 ${skipped}개는 건너뜀`:''}</p>
   <ul className="hi-sample">{fresh.slice(0,8).map((x,i)=><li key={i}>{es.find(e=>e.id===x.employeeId)?.name} · {x.date} {x.start}–{x.end}</li>)}{fresh.length>8&&<li>… 외 {fresh.length-8}개</li>}</ul>
   {r.problems.length>0&&<details><summary>못 읽은 곳 {r.problems.length}개</summary><ul>{r.problems.slice(0,20).map((p,i)=><li key={i}>{p}</li>)}</ul></details>}</div>}
  {msg&&<p role="status" className="saas-success">{msg}</p>}
  <div className="actions"><button type="button" className="secondary" onClick={onClose}>닫기</button><button type="button" className="primary" disabled={busy||!fresh.length} onClick={save}>{fresh.length}개 넣기</button></div></div>;
}
