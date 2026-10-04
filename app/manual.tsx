'use client';
// 매장 매뉴얼: 사장님은 단계별 글·사진으로 만들고, 직원은 휴대폰에서 바로 따라 본다.
import {useEffect,useState} from 'react';
import {Btn,Badge,Field} from './team-ui';
type Step={text:string,imageId?:string|null};
type Manual={id:string,title:string,branchId:string,steps:Step[],updatedAt:string,read:boolean,readCount?:number};
async function call(body?:any){const r=await fetch('/api/manual',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined),d:any=await r.json();if(!r.ok)throw Error(d.error||'처리하지 못했어요. 다시 시도해 주세요.');return d}
/** 사진을 긴 변 1280px JPEG로 줄여서 400KB 이하로 */
export async function shrinkImage(file:File):Promise<{mime:string,body:string}>{
 const bmp=await createImageBitmap(file);let side=1280;
 for(let tries=0;tries<6;tries++){const k=Math.min(1,side/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bmp,0,0,c.width,c.height);
  const blob=await new Promise<Blob>((ok,no)=>c.toBlob(b=>b?ok(b):no(Error('사진을 줄이지 못했어요. 다른 사진을 골라 주세요.')),'image/jpeg',0.8-tries*0.08));
  if(blob.size<=380000){const buf=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=0x8000)s+=String.fromCharCode(...buf.subarray(i,i+0x8000));return {mime:'image/jpeg',body:btoa(s)}}
  side=Math.round(side*0.8)}
 throw Error('사진이 너무 커요. 다른 사진을 골라 주세요.');
}
function ManualImage({id,alt}:{id:string,alt:string}){
 const [src,setSrc]=useState('');
 useEffect(()=>{let url='',alive=true;fetch('/api/manual?image='+encodeURIComponent(id)).then(r=>r.ok?r.blob():null).then(b=>{if(b&&alive){url=URL.createObjectURL(b);setSrc(url)}}).catch(()=>{});return()=>{alive=false;if(url)URL.revokeObjectURL(url)}},[id]);
 return src?<img className="manual-img" src={src} alt={alt}/>:<div className="manual-img manual-img-wait" aria-label="사진 불러오는 중"/>;
}
export function StoreManual({branchId}:{branchId?:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState<string>(''),[edit,setEdit]=useState<any>(null),[msg,setMsg]=useState('');
 const load=()=>call().then(setData).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 const run=async(b:any,done?:string)=>{setBusy(true);setError('');setMsg('');try{const d=await call({...b,version:data.version});setData(d);if(done){setMsg(done);setEdit(null)}}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 if(!data)return <section className="panel t-panelbody"><p role={error?'alert':undefined}>{error||'매뉴얼을 불러오고 있어요.'}</p>{error&&<Btn onClick={()=>{setError('');load()}}>다시 불러오기</Btn>}</section>;
 const list:Manual[]=data.manuals.filter((m:Manual)=>!branchId||!data.owner||m.branchId==='all'||m.branchId===branchId);
 const branchName=(id:string)=>id==='all'?'전체 지점':data.branches.find((b:any)=>b.id===id)?.name||'';
 async function upload(i:number,file?:File|null){if(!file)return;setBusy(true);setError('');try{const img=await shrinkImage(file);const r=await call({action:'image',...img});const steps=edit.steps.slice();steps[i]={...steps[i],imageId:r.id};setEdit({...edit,steps})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(edit)return <section className="panel t-panelbody manual-edit"><h2>{edit.id?'매뉴얼 고치기':'새 매뉴얼'}</h2>{error&&<p className="saas-error" role="alert">{error}</p>}
  <div className="t-formgrid"><Field label="제목"><input maxLength={80} value={edit.title} placeholder="예: 마감 청소 순서" onChange={e=>setEdit({...edit,title:e.target.value})}/></Field><Field label="보여 줄 지점"><select value={edit.branchId} onChange={e=>setEdit({...edit,branchId:e.target.value})}><option value="all">전체 지점</option>{data.branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field></div>
  <ol className="manual-steps">{edit.steps.map((s:Step,i:number)=><li key={i}><Field label={`${i+1}단계`}><textarea rows={3} maxLength={1000} value={s.text} onChange={e=>{const steps=edit.steps.slice();steps[i]={...s,text:e.target.value};setEdit({...edit,steps})}}/></Field>{s.imageId&&<ManualImage id={s.imageId} alt={`${i+1}단계 사진`}/>}<div className="t-wrapactions"><label className="saas-secondary manual-upload">{s.imageId?'사진 바꾸기':'사진 넣기'}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>upload(i,e.target.files?.[0])}/></label>{s.imageId&&<Btn onClick={()=>{const steps=edit.steps.slice();steps[i]={...s,imageId:null};setEdit({...edit,steps})}}>사진 빼기</Btn>}<Btn disabled={i===0} onClick={()=>{const steps=edit.steps.slice();[steps[i-1],steps[i]]=[steps[i],steps[i-1]];setEdit({...edit,steps})}}>위로</Btn><Btn disabled={edit.steps.length<2} onClick={()=>setEdit({...edit,steps:edit.steps.filter((_:any,j:number)=>j!==i)})}>단계 삭제</Btn></div></li>)}</ol>
  <div className="actions"><Btn disabled={edit.steps.length>=30} onClick={()=>setEdit({...edit,steps:[...edit.steps,{text:'',imageId:null}]})}>단계 추가</Btn><Btn onClick={()=>{setEdit(null);setError('')}}>취소</Btn><Btn primary disabled={busy||!edit.title.trim()||edit.steps.every((s:Step)=>!s.text.trim()&&!s.imageId)} onClick={()=>run({action:'save',id:edit.id,title:edit.title,branchId:edit.branchId,steps:edit.steps.filter((s:Step)=>s.text.trim()||s.imageId)},'매뉴얼을 저장했어요. 직원 화면에 바로 보여요.')}>{busy?'저장 중…':'저장하고 직원에게 보이기'}</Btn></div>
  <p className="footnote">사진은 휴대폰에서 자동으로 줄여서 올려요(장당 400KB 이하). 고치면 직원 확인 표시가 처음부터 다시 시작돼요.</p>
 </section>;
 return <section className="manual"><div className="t-toolbar"><p className="footnote">{data.owner?'자주 설명하는 일을 단계별 글·사진으로 남겨 두면 직원이 휴대폰에서 바로 따라 해요.':'사장님이 정리한 우리 매장 일하는 방법이에요.'}</p>{data.owner&&<Btn primary onClick={()=>{setMsg('');setEdit({title:'',branchId:branchId||'all',steps:[{text:'',imageId:null}]})}}>새 매뉴얼</Btn>}</div>
  {error&&<p className="saas-error" role="alert">{error}</p>}{msg&&<p className="saas-success" role="status">{msg}</p>}
  {list.map(m=><article className="panel manual-card" key={m.id}><button className="manual-head" aria-expanded={open===m.id} onClick={()=>{setOpen(open===m.id?'':m.id);if(open!==m.id&&!data.owner&&!m.read)run({action:'read',id:m.id})}}><b>{m.title}</b><span>{m.steps.length}단계</span>{data.owner?<Badge>{branchName(m.branchId)} · {m.readCount}명 확인</Badge>:m.read?<Badge tone="green">확인함</Badge>:<Badge tone="amber">새 매뉴얼</Badge>}</button>
   {open===m.id&&<div className="t-panelbody"><ol className="manual-view">{m.steps.map((s,i)=><li key={i}>{s.text&&<p>{s.text}</p>}{s.imageId&&<ManualImage id={s.imageId} alt={`${m.title} ${i+1}단계`}/>}</li>)}</ol><small className="footnote">마지막 수정 {new Date(m.updatedAt).toLocaleDateString('ko-KR')}</small>{data.owner&&<div className="actions"><Btn onClick={()=>setEdit({id:m.id,title:m.title,branchId:m.branchId,steps:m.steps.map(s=>({...s}))})}>고치기</Btn><Btn disabled={busy} onClick={()=>{if(confirm(`'${m.title}' 매뉴얼을 지울까요? 사진도 함께 지워져요.`))run({action:'delete',id:m.id},'매뉴얼을 지웠어요.')}}>삭제</Btn></div>}</div>}
  </article>)}
  {!list.length&&<section className="panel empty">{data.owner?'아직 매뉴얼이 없어요. 오픈·마감 순서, 기계 사용법처럼 자주 묻는 일부터 만들어 보세요.':'아직 등록된 매뉴얼이 없어요.'}</section>}
 </section>
}
