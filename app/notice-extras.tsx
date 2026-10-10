'use client';
// 개선 2차 공지: B114 첨부 PDF · B130 투표 · B113 반응 · B112 댓글·질문
import {useState} from 'react';
const E=['👍','❤️','😂','😮','🙏'];
export function NoticeExtras({n,busy,action}:{n:any,busy:boolean,action:(b:any)=>any}){
 const [t,setT]=useState(''),total=(n.pollCounts||[]).reduce((a:number,b:number)=>a+b,0);
 return <div className="notice-extras">
  {n.file&&<p><a href={n.file.data} download={n.file.name}>📎 {n.file.name}</a></p>}
  {n.poll&&<fieldset className="notice-poll"><legend>투표 · {total}명 참여</legend>{n.poll.map((o:string,i:number)=>{const c=n.pollCounts?.[i]||0;return <button type="button" key={i} disabled={busy} aria-pressed={n.myVote===i} className={n.myVote===i?'primary':'secondary'} onClick={()=>action({action:'voteNotice',id:n.id,option:i})}>{n.myVote===i?'✓ ':''}{o} · {c}표{total?` (${Math.round(c/total*100)}%)`:''}</button>})}</fieldset>}
  <div className="t-inline notice-react" role="group" aria-label="반응">{E.map(e=>{const r=n.reactions?.[e];return <button type="button" key={e} disabled={busy} aria-pressed={!!r?.mine} className={r?.mine?'primary':'secondary'} onClick={()=>action({action:'reactNotice',id:n.id,emoji:e})}>{e}{r?.n?' '+r.n:''}</button>})}</div>
  <details><summary>댓글·질문 {(n.comments||[]).length||''}</summary><ul className="notice-comments">{(n.comments||[]).map((c:any)=><li key={c.id}><b>{c.name}</b> {c.text} <small>{new Date(c.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small>{c.mine&&<button type="button" className="link-btn" disabled={busy} onClick={()=>action({action:'deleteComment',id:n.id,commentId:c.id})}>지우기</button>}</li>)}</ul>
   <form className="t-inline" onSubmit={e=>{e.preventDefault();if(!t.trim())return;void Promise.resolve(action({action:'commentNotice',id:n.id,text:t})).then(()=>setT(''))}}><input aria-label="댓글" maxLength={300} value={t} onChange={e=>setT(e.target.value)} placeholder="궁금한 점이나 답을 적어 주세요"/><button className="secondary" disabled={busy||!t.trim()}>남기기</button></form></details>
 </div>;
}
/** 공지 쓰기 창: 투표 선택지 · PDF 첨부 */
export function NoticeFormExtras({f,setF,setErr}:{f:any,setF:(x:any)=>void,setErr:(s:string)=>void}){
 return <><details><summary>투표 넣기{f.poll?.length?` · ${f.poll.length}개`:''}</summary>{(f.poll||[]).map((o:string,i:number)=><div key={i} className="t-inline"><input aria-label={`선택지 ${i+1}`} maxLength={40} value={o} onChange={e=>setF({...f,poll:f.poll.map((x:string,j:number)=>j===i?e.target.value:x)})}/><button type="button" className="link-btn" onClick={()=>setF({...f,poll:f.poll.filter((_:any,j:number)=>j!==i)})}>빼기</button></div>)}
  {(f.poll||[]).length<6&&<button type="button" className="secondary" onClick={()=>setF({...f,poll:[...(f.poll||[]),'']})}>+ 선택지</button>}<p className="footnote">예: 회식 날짜 — 금요일 / 토요일. 2~6개.</p></details>
  <label>PDF 첨부(선택, 250KB 이하) <input type="file" accept="application/pdf" onChange={async e=>{const file=e.target.files?.[0];if(!file){setF({...f,file:null});return}if(file.type!=='application/pdf'||file.size>250*1024){setErr('250KB 이하 PDF만 붙일 수 있어요. 파일을 줄이거나 사진으로 올려 주세요.');e.target.value='';return}const data=await new Promise<string>(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result));fr.readAsDataURL(file)});setF({...f,file:{name:file.name.slice(0,80),data}})}}/></label></>;
}
